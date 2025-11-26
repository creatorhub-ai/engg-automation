// backend/routes/scheduleEmail.js
import express from "express";
import { supabase } from "../supabaseClient.js";
import { google } from "googleapis";
import dayjs from "dayjs";

const router = express.Router();

// === Google Auth Setup ===
const auth = new google.auth.GoogleAuth({
  keyFile: "credentials.json", // service account key file
  scopes: [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/forms.body",
  ],
});

// === Helper: Copy Google Form for the Batch ===
async function createBatchFormCopy(batchNo) {
  const drive = google.drive({ version: "v3", auth: await auth.getClient() });
  const templateFormId = process.env.COURSE_APPLICATION_FORM_ID;

  try {
    // Copy template form
    const copyRes = await drive.files.copy({
      fileId: templateFormId,
      requestBody: { name: `Course Application for ${batchNo}` },
    });

    const newFormId = copyRes.data.id;
    const newFormLink = `https://docs.google.com/forms/d/${newFormId}/viewform`;

    return newFormLink;
  } catch (err) {
    console.error("❌ Error creating form copy:", err.message);
    throw new Error("Failed to create Google Form copy");
  }
}

// === API: Schedule Emails ===
router.post("/", async (req, res) => {
  const { batch_no, start_date } = req.body;

  if (!batch_no || !start_date) {
    return res.status(400).json({ error: "batch_no and start_date are required" });
  }

  try {
    // Step 1: Copy Google Form for this batch
    const newFormLink = await createBatchFormCopy(batch_no);

    // Step 2: Fetch email templates from DB
    const { data: templates, error: templateError } = await supabase
      .from("email_templates")
      .select("*");

    if (templateError) throw templateError;

    // Step 3: Insert scheduled emails
    const scheduledEmails = [];

    for (const template of templates) {
      const sendDate = dayjs(start_date)
        .add(template.offset_days || 0, "day")
        .set("hour", template.send_time.split(":")[0])
        .set("minute", template.send_time.split(":")[1])
        .toDate();

      const body_html = (template.body_html || "")
        .replace(/{{batch_no}}/g, batch_no)
        .replace(/{{start_date}}/g, dayjs(start_date).format("DD-MMM-YYYY"))
        .replace(/{{application_form_link}}/g, newFormLink);

      scheduledEmails.push({
        batch_no,
        subject: template.subject,
        body_html,
        send_time: sendDate,
        created_at: new Date(),
      });
    }

    const { error: insertError } = await supabase
      .from("scheduled_emails")
      .insert(scheduledEmails);

    if (insertError) throw insertError;

    res.json({
      message: `✅ Emails scheduled for batch ${batch_no}`,
      form_link: newFormLink,
      count: scheduledEmails.length,
    });
  } catch (err) {
    console.error("❌ Error scheduling emails:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
