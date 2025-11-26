const { supabase } = require('./supabaseClient');
const { sendWelcomeEmail } = require('./mailer');
const { WELCOME_TEMPLATE, renderTemplate } = require('./templates');

const POLL_INTERVAL = 60000; // 1 minute

async function schedulerLoop() {
  while (true) {
    try {
      const now = new Date().toISOString();
      const { data: scheduledEmails, error } = await supabase
        .from('scheduled_emails')
        .select('*')
        .eq('status', 'pending')
        .lte('scheduled_at', now);

      if (error) {
        console.error("Scheduler fetch error:", error);
        continue;
      }

      for (const emailEntry of scheduledEmails || []) {
        try {
          const scheduledDate = new Date(emailEntry.scheduled_at);
          const batchTime = scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const startDateFormatted = scheduledDate.toLocaleDateString();

          const subject = renderTemplate(WELCOME_TEMPLATE.subject, {
            batch_no: emailEntry.batch_no,
            start_date: startDateFormatted,
          });

          const body = renderTemplate(WELCOME_TEMPLATE.body, {
            batch_no: emailEntry.batch_no,
            start_date: startDateFormatted,
            batch_time: batchTime,
          });

          await sendWelcomeEmail({
            to: emailEntry.learner_email,
            subject,
            body,
          });

          await supabase
            .from('scheduled_emails')
            .update({ status: 'sent' })
            .eq('id', emailEntry.id);
        } catch (err) {
          console.error("Error sending email:", err);
          await supabase
            .from('scheduled_emails')
            .update({ status: 'failed', error: err.message })
            .eq('id', emailEntry.id);
        }
      }
    } catch (err) {
      console.error("Scheduler loop unexpected error:", err);
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
  }
}

module.exports = { schedulerLoop };
