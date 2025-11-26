import "dotenv/config";
import { supabase } from "./supabaseClient.js";
import { sendMail } from "./emailSender.js";

/**
 * Dispatch all scheduled emails whose send_at <= now
 * Checks every minute
 */
async function dispatchEmails() {
  console.log("📨 Email Dispatcher started...");

  setInterval(async () => {
    try {
      const now = new Date().toISOString();

      // Fetch emails that are scheduled but not yet sent
      const { data: emails, error } = await supabase
        .from("scheduled_emails")
        .select("*")
        .in("status", ["scheduled", "pending"]) // pick up any scheduled/pending email
        .lte("send_at", now);

      if (error) {
        console.error("❌ Fetch error:", error.message);
        return;
      }

      if (!emails || emails.length === 0) return;

      console.log(`📬 Found ${emails.length} email(s) to send...`);

      for (const email of emails) {
        try {
          // Determine recipient
          const recipient = email.recipient_email || email.recipient || email.learner_email;
          const body = email.body_html || email.body || "";

          console.log(`📧 Sending email to ${recipient} | Template=${email.template_name}`);

          await sendMail({
            to: recipient,
            subject: email.subject,
            html: body,
          });

          // Mark email as sent
          await supabase
            .from("scheduled_emails")
            .update({ status: "sent", sent_at: new Date().toISOString() })
            .eq("id", email.id);

          console.log(`✅ Sent to ${recipient}`);
        } catch (err) {
          console.error(`❌ Failed to send to ${email.recipient_email}:`, err.message);

          await supabase
            .from("scheduled_emails")
            .update({ status: "failed", error: err.message })
            .eq("id", email.id);
        }
      }
    } catch (err) {
      console.error("❌ Dispatcher loop error:", err.message || err);
    }
  }, 60 * 1000); // every 1 min
}

dispatchEmails();
