import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import tz from "dayjs/plugin/timezone.js";
import { supabase } from "./supabaseClient.js";

dayjs.extend(utc);
dayjs.extend(tz);

// --- Helper: Format date in dd-MMM-yyyy (IST) ---
function formatDateIST(dateStr) {
  if (!dateStr) return "TBD";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

// --- Helper: Replace {{placeholders}} in templates ---
function renderTemplate(template, variables) {
  return template.replace(/\{\{(.*?)\}\}/g, (_, key) => {
    return variables[key.trim()] || "";
  });
}

// --- Compute exact scheduled time in IST ---
function computeScheduledAtISO(startDateStr, offsetDays = 0, sendTime = "09:00") {
  if (!startDateStr) throw new Error("Missing startDateStr");

  const base = dayjs.tz(startDateStr, "Asia/Kolkata").startOf("day");
  const target = base.add(Number(offsetDays || 0), "day");
  const [h, m] = (sendTime || "09:00").split(":").map((x) => parseInt(x, 10) || 0);

  const finalIST = target.hour(h).minute(m).second(0).millisecond(0);
  return finalIST.utc().toISOString();
}

/**
 * Schedule emails from internal_email_templates
 * This function only schedules emails - they are sent by the unified cron job in index.js
 */
export async function scheduleInternalEmail(userRole, batchNo) {
  try {
    console.log(`📧 Scheduling internal emails for role=${userRole}, batch=${batchNo}`);

    // 1. Get batch start date
    const { data: batchRow, error: batchErr } = await supabase
      .from("course_planner_data")
      .select("batch_no, date")
      .eq("batch_no", batchNo)
      .order("date", { ascending: true })
      .limit(1)
      .single();

    if (batchErr || !batchRow) {
      console.warn(`⚠️ No course_planner_data found for batch ${batchNo}`);
      return;
    }

    const startDateStr = batchRow.date;
    const formattedStartDate = formatDateIST(startDateStr);

    // 2. Get form_url from batch_forms
    const { data: formRow, error: formErr } = await supabase
      .from("batch_forms")
      .select("form_url")
      .eq("batch_no", batchNo)
      .maybeSingle();

    let formUrl = "";
    if (formErr) {
      console.error(`❌ Error fetching form_url for batch ${batchNo}:`, formErr.message);
    } else if (formRow) {
      formUrl = formRow.form_url;
    }

    // 3. Get templates for role
    const { data: templates, error: tmplErr } = await supabase
      .from("internal_email_templates")
      .select("*")
      .eq("user_role", userRole)
      .eq("active", true)
      .order("offset_days", { ascending: true });

    if (tmplErr) {
      console.error(`❌ Error fetching templates for ${userRole}:`, tmplErr.message);
      return;
    }

    if (!templates || templates.length === 0) {
      console.log(`ℹ️ No active templates found for role=${userRole}`);
      return;
    }

    console.log(`Found ${templates.length} template(s) for ${userRole}`);

    // 4. Resolve recipients based on role
    let recipients = [];
    if (userRole === "Trainer") {
      const { data: trainerRows, error: trainerErr } = await supabase
        .from("course_planner_data")
        .select("trainer_email")
        .eq("batch_no", batchNo)
        .not("trainer_email", "is", null);

      if (trainerErr) {
        console.error(`❌ Error fetching trainers for ${batchNo}:`, trainerErr.message);
        return;
      }
      recipients = [...new Set(trainerRows.map((r) => r.trainer_email).filter(Boolean))];

    } else if (userRole === "Learner") {
      const { data: learnerRows, error: learnerErr } = await supabase
        .from("learners_data")
        .select("email")
        .eq("batch_no", batchNo)
        .not("email", "is", null);

      if (learnerErr) {
        console.error(`❌ Error fetching learners for ${batchNo}:`, learnerErr.message);
        return;
      }
      recipients = [...new Set(learnerRows.map((r) => r.email).filter(Boolean))];

    } else if (userRole === "IT Admin") {
      recipients = ["itadmin@chipedge.com"];

    } else if (userRole === "Learning Coordinator") {
      recipients = ["coordinator@chipedge.com"];

    } else if (userRole === "Management") {
      recipients = ["mgmt1@chipedge.com", "mgmt2@chipedge.com"];
    }

    if (recipients.length === 0) {
      console.warn(`⚠️ No recipients found for role=${userRole}, batch=${batchNo}`);
      return;
    }

    console.log(`Found ${recipients.length} recipient(s) for ${userRole}: ${recipients.join(", ")}`);

    // 5. Schedule each template for each recipient
    let scheduledCount = 0;
    for (const template of templates) {
      const scheduledTimeISO = computeScheduledAtISO(
        startDateStr,
        template.offset_days,
        template.send_time || "09:00"
      );

      for (const recipientEmail of recipients) {
        // Check if email already scheduled to avoid duplicates
        const { data: existingEmail } = await supabase
          .from("scheduled_emails")
          .select("id")
          .eq("batch_no", batchNo)
          .eq("recipient_email", recipientEmail)
          .eq("template_name", template.template_name)
          .eq("user_role", userRole)
          .eq("scheduled_at", scheduledTimeISO)
          .maybeSingle();

        if (existingEmail) {
          console.log(`⏭️ Email already scheduled: ${template.template_name} to ${recipientEmail}`);
          continue;
        }

        const variables = { 
          batch_no: batchNo, 
          start_date: formattedStartDate,
          recipient_email: recipientEmail,
          form_link: formUrl
        };

        const subject = renderTemplate(template.subject || "", variables);
        const bodyHtml = renderTemplate(template.body_html || "", variables);

        const { error: insertError } = await supabase.from("scheduled_emails").insert([
          {
            batch_no: batchNo,
            user_role: userRole,
            recipient_email: recipientEmail,
            subject,
            body_html,
            scheduled_at: scheduledTimeISO,
            status: "scheduled",
            source: "internal_email_templates",
            template_name: template.template_name,
            created_at: new Date().toISOString(),
          },
        ]);

        if (insertError) {
          console.error(`❌ Failed to schedule email: ${template.template_name} to ${recipientEmail}:`, insertError.message);
          continue;
        }

        scheduledCount++;
        console.log(`📌 Queued "${template.template_name}" for ${recipientEmail} | Batch=${batchNo} | At=${formatDateIST(scheduledTimeISO)}`);
      }
    }

    console.log(`✅ Scheduled ${scheduledCount} internal email(s) for ${userRole}, batch ${batchNo}`);

  } catch (err) {
    console.error(`❌ scheduleInternalEmail error for ${userRole}, batch ${batchNo}:`, err.message);
  }
}

// Export utility functions for testing
export { formatDateIST, renderTemplate, computeScheduledAtISO };
