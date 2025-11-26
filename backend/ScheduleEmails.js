// backend/ScheduleEmails.js
import { supabase } from "./supabaseClient.js";
import dayjs from "dayjs";

// --- Helper: Compute send_at timestamp ---
function computeSendAt(startDate, offsetDays, sendTime) {
  if (!startDate || !sendTime) return null;

  const baseDate = dayjs(startDate).add(offsetDays, "day");

  const [hours, minutes] = sendTime.split(":").map(Number);
  return baseDate.hour(hours).minute(minutes).second(0).toISOString();
}

// --- Schedule emails for learners ---
export async function scheduleEmails(batchNo, mode, batchType) {
  try {
    console.log(`📩 Scheduling emails for Batch: ${batchNo}, Mode: ${mode}, Batch Type: ${batchType}`);

    // 1. Get learners for this batch
    const { data: learners, error: learnersError } = await supabase
      .from("learners_data")
      .select("*")
      .eq("batch_no", batchNo);

    if (learnersError) throw learnersError;
    if (!learners || learners.length === 0) {
      console.log(`⚠️ No learners found for batch ${batchNo}`);
      return;
    }

    // 2. Get start_date for this batch
    const { data: coursePlanner, error: courseError } = await supabase
      .from("course_planner")
      .select("start_date")
      .eq("batch_no", batchNo)
      .single();

    if (courseError) throw courseError;
    const startDate = coursePlanner.start_date;

    // 3. Get templates
    let query = supabase.from("email_templates").select("*").eq("active", true).eq("mode", mode);
    if (mode === "offline") {
      query = query.eq("batch_type", batchType);
    }

    const { data: templates, error: templateError } = await query;
    if (templateError) throw templateError;

    if (!templates || templates.length === 0) {
      console.log("⚠️ No active templates found.");
      return;
    }

    // 4. Schedule emails for each learner & template
    for (const template of templates) {
      const sendAt = computeSendAt(startDate, template.offset_days, template.send_time);

      if (!sendAt) {
        console.error(`❌ Could not compute send_at for template ${template.template_name}`);
        continue;
      }

      for (const learner of learners) {
        const subject = template.subject
          .replace("{{batch_no}}", batchNo)
          .replace("{{start_date}}", dayjs(startDate).format("DD-MMM-YYYY"));

        const bodyHtml = template.body_html
          .replace("{{name}}", learner.name)
          .replace("{{batch_no}}", batchNo)
          .replace("{{start_date}}", dayjs(startDate).format("DD-MMM-YYYY"));

        const { error: insertError } = await supabase.from("scheduled_emails").insert([
          {
            batch_no: batchNo,
            template_id: template.id,
            template_name: template.template_name,
            subject,
            body_html: bodyHtml,
            send_at: sendAt, // ✅ always a valid timestamp
            mode,
            batch_type: batchType,
            created_at: new Date().toISOString(),
            recipient_email: learner.email,
            scheduled_at: new Date().toISOString(),
            status: "scheduled",
          },
        ]);

        if (insertError) {
          console.error("❌ Insert error:", insertError.message);
        } else {
          console.log(`✅ Scheduled email for ${learner.email} at ${sendAt}`);
        }
      }
    }
  } catch (err) {
    console.error("❌ Schedule error:", err.message || err);
  }
}
