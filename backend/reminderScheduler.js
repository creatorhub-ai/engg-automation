// backend/reminderScheduler.js

import { supabase } from "./supabaseClient.js";
import { sendRawEmail } from "./emailSender.js";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

dayjs.extend(utc);
dayjs.extend(timezone);

const IST = "Asia/Kolkata";

// Helper: Schedule an email by inserting into scheduled_emails table (avoiding duplicates)
async function scheduleReminderEmail({
  batchNo,
  recipientEmail,
  subject,
  bodyHtml,
  scheduledAtISO,
  mode = "Online",
  batchType = null,
  templateName = "Weekly Quiz Reminder",
}) {
  // Check duplicate
  const { data: existing } = await supabase
    .from("scheduled_emails")
    .select("id")
    .eq("recipient_email", recipientEmail)
    .eq("batch_no", batchNo)
    .eq("template_name", templateName)
    .eq("scheduled_at", scheduledAtISO)
    .maybeSingle();

  if (existing) {
    return false; // Already scheduled
  }

  const { error } = await supabase.from("scheduled_emails").insert([
    {
      batch_no: batchNo,
      recipient_email: recipientEmail,
      subject,
      body_html: bodyHtml,
      scheduled_at: scheduledAtISO,
      status: "scheduled",
      mode,
      batch_type: batchType,
      template_name: templateName,
      created_at: new Date().toISOString(),
    },
  ]);

  if (error) {
    console.error("❌ Failed to schedule reminder email:", error.message);
    return false;
  }
  return true;
}

// Main function to schedule Weekly Quiz reminders
export async function scheduleWeeklyQuizReminders() {
  try {
    const today = dayjs().tz(IST).startOf("day");
    const nextWeek = today.add(7, "day").endOf("day");

    const { data: quizEntries, error } = await supabase
      .from("course_planner_data")
      .select("batch_no,date,trainer_email")
      .ilike("topic_name", "%Weekly Quiz%")
      .gte("date", today.format("YYYY-MM-DD"))
      .lte("date", nextWeek.format("YYYY-MM-DD"));

    if (error) throw error;
    if (!quizEntries || quizEntries.length === 0) {
      console.log("No Weekly Quiz scheduled in the next week");
      return;
    }

    for (const quiz of quizEntries) {
      const quizDateIST = dayjs.tz(quiz.date, IST);
      const batchNo = quiz.batch_no;

      const learnerEmailTime = quizDateIST.hour(12).minute(32).second(0);

      const { data: learners, error: learnerErr } = await supabase
        .from("learners_data")
        .select("email,name")
        .eq("batch_no", batchNo);
      if (learnerErr) {
        console.error("Failed to fetch learners for batch ", batchNo);
        continue;
      }

      const learnerSubject = `Reminder: Weekly Quiz scheduled today for batch ${batchNo}`;
      const learnerBody = `
        <p>Dear Learner,</p>
        <p>This is a reminder that the Weekly Quiz for your batch <b>${batchNo}</b> is scheduled today (${quizDateIST.format("DD-MMM-YYYY")}). Please prepare accordingly.</p>
        <p>Best regards,</p><p>Training Team</p>
      `;

      for (const learner of learners) {
        await scheduleReminderEmail({
          batchNo,
          recipientEmail: learner.email,
          subject: learnerSubject,
          bodyHtml: learnerBody,
          scheduledAtISO: learnerEmailTime.utc().toISOString(),
          mode: "Online",
          templateName: "Learner Weekly Quiz Reminder",
        });
      }

      const trainerEmailTime = quizDateIST
        .subtract(quizDateIST.day() >= 4 ? quizDateIST.day() - 4 : 3 + quizDateIST.day(), "day")
        .hour(9)
        .minute(0)
        .second(0);

      const trainerEmail = quiz.trainer_email || null;
      if (trainerEmail) {
        const trainerSubject = `Reminder: Prepare question paper for Weekly Quiz on ${quizDateIST.format("DD-MMM-YYYY")}`;
        const trainerBody = `
          <p>Dear Trainer,</p>
          <p>Please prepare the question paper for the Weekly Quiz scheduled for batch <b>${batchNo}</b> on <b>${quizDateIST.format("DD-MMM-YYYY")}</b>.</p>
          <p>Thank you for your cooperation.</p>
        `;

        await scheduleReminderEmail({
          batchNo,
          recipientEmail: trainerEmail,
          subject: trainerSubject,
          bodyHtml: trainerBody,
          scheduledAtISO: trainerEmailTime.utc().toISOString(),
          mode: "Offline",
          batchType: null,
          templateName: "Trainer Weekly Quiz Reminder",
        });
      }
    }
  } catch (error) {
    console.error("❌ Failed to schedule Weekly Quiz reminders:", error.message);
  }
}

// New function to schedule Intermediate Assessment trainer reminders
export async function scheduleIntermediateAssessmentReminders(batch_no = null) {
  const today = dayjs().tz(IST).startOf("day");
  const upperLimit = today.add(40, "day").endOf("day");
  console.log(`⏳ Checking Intermediate Assessment for batch ${batch_no}`);
  let query = supabase
    .from("course_planner_data")
    .select("batch_no, date, topic_name, trainer_email, trainer_name")
    .ilike("topic_name", "Intermediate Assessment%")
    .gte("date", today.format("YYYY-MM-DD"))
    .lte(upperLimit.format("YYYY-MM-DD"));
  if (batch_no) query = query.eq("batch_no", batch_no);
  const { data: topics, error } = await query;
  if (error) {
    console.error("❌ Error fetching topics:", error.message);
    return;
  }
  if (!topics || topics.length === 0) {
    console.log("⚠️ No Intermediate Assessment found for batch", batch_no);
    return;
  }
  for (const topic of topics) {
    if (!topic.trainer_email) {
      console.log(`⚠️ Skipping ${topic.batch_no}, missing trainer_email`);
      continue;
    }
    const assessmentDate = dayjs.tz(topic.date, IST);
    if (!assessmentDate.isValid()) {
      console.log(`⚠️ Skipping ${topic.batch_no}: invalid date '${topic.date}'`);
      continue;
    }
    const reminderDate = assessmentDate.subtract(7, "day").hour(9).minute(0).second(0).millisecond(0);
    if (reminderDate.isBefore(today)) {
      console.log(`⚠️ Skipping ${topic.batch_no}: reminder date in past (${reminderDate.format()})`);
      continue;
    }
    const reminderISO = reminderDate.utc().format("YYYY-MM-DDTHH:mm:ss[Z]");
    const { data: existing } = await supabase
      .from("scheduled_emails")
      .select("id")
      .eq("recipient_email", topic.trainer_email)
      .eq("batch_no", topic.batch_no)
      .eq("template_name", "Trainer Intermediate Assessment Reminder")
      .eq("scheduled_at", reminderISO)
      .maybeSingle();
    if (existing) {
      console.log(`ℹ️ Already scheduled for batch ${topic.batch_no} (${reminderISO})`);
      continue;
    }
    const subject = `Reminder: ${topic.topic_name} for batch ${topic.batch_no}`;
    const body_html = `
      <p>Dear ${topic.trainer_name || "Trainer"},</p>
      <p>This is the reminder for the <b>${topic.topic_name}</b>. Kindly get ready with the question papers and the necessary things.</p>
    `;
    const { error: insertErr } = await supabase.from("scheduled_emails").insert({
      batch_no: topic.batch_no,
      recipient_email: topic.trainer_email,
      subject,
      body_html,
      scheduled_at: reminderISO,
      status: "scheduled",
      mode: "Offline",
      template_name: "Trainer Intermediate Assessment Reminder",
      source: "intermediate_assessment_reminder",
      created_at: new Date().toISOString(),
    });
    if (insertErr) {
      console.error(`❌ Failed for batch ${topic.batch_no}:`, insertErr.message);
    } else {
      console.log(`✅ Scheduled batch ${topic.batch_no} trainer: ${topic.trainer_email}, at ${reminderISO}`);
    }
  }
  console.log("✅ Intermediate Assessment scheduling completed.");
}
