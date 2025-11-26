import { supabase } from "./supabaseClient.js";
import { sendRawEmail } from "./emailSender.js";

const POLL_INTERVAL = 60 * 1000; // 1 minute

async function schedulerLoop() {
  console.log("⏰ Email Scheduler started...");

  while (true) {
    const now = new Date().toISOString();

    try {
      // Only fetch rows with recipient_email set
      const { data: scheduledEmails, error } = await supabase
        .from("scheduled_emails")
        .select("*")
        .eq("status", "scheduled")
        .lte("scheduled_at", now)
        .not("recipient_email", "is", null)
        .neq("recipient_email", "");

      if (error) {
        console.error("❌ Error fetching scheduled emails:", error.message);
      }

      if (scheduledEmails && scheduledEmails.length > 0) {
        console.log(`📬 Found ${scheduledEmails.length} scheduled email(s) to send...`);

        for (const email of scheduledEmails) {
          const result = await sendRawEmail({
            to: email.recipient_email,
            subject: email.subject,
            html: email.body_html,
          });

          if (result.success) {
            await supabase
              .from("scheduled_emails")
              .update({
                status: "sent",
                sent_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("id", email.id);

            console.log(`✅ Email ID=${email.id} sent to ${email.recipient_email}`);
          } else {
            await supabase
              .from("scheduled_emails")
              .update({
                status: "failed",
                error: result.error,
                updated_at: new Date().toISOString(),
              })
              .eq("id", email.id);

            console.error(`❌ Failed to send Email ID=${email.id}: ${result.error}`);
          }
        }
      } else {
        console.log("📭 No scheduled emails to send at this time.");
      }
    } catch (err) {
      console.error("⚠️ Scheduler loop error:", err.message);
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
  }
}

schedulerLoop();
