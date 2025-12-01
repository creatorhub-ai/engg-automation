// workers/sendMarksReminders.js
const { pool } = require("../db");
const { sendEmail } = require("../mailer"); // your existing mailer

async function processReminders() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT *
         FROM marks_reminder_jobs
        WHERE status = 'scheduled'
          AND send_at <= now()
        FOR UPDATE SKIP LOCKED
        LIMIT 50`
    );

    for (const job of rows) {
      try {
        // build email from template_name + payload
        await sendEmail({
          to: job.to_email,
          subject: "Marks entry reminder",
          html: buildReminderHtml(job.template_name, job.payload),
        });

        await client.query(
          `UPDATE marks_reminder_jobs
              SET status = 'sent', sent_at = now()
            WHERE id = $1`,
          [job.id]
        );
      } catch (err) {
        console.error("reminder send failed:", err);
        await client.query(
          `UPDATE marks_reminder_jobs
              SET status = 'failed'
            WHERE id = $1`,
          [job.id]
        );
      }
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("processReminders error:", err);
  } finally {
    client.release();
  }
}

module.exports = { processReminders };
