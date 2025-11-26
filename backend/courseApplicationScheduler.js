// backend/courseApplicationScheduler.js
import { supabase } from "./supabaseClient.js";
import { sendRawEmail } from "./emailSender.js";

const POLL_INTERVAL = 60000; // 1 minute

export async function scheduleCourseApplicationEmails() {
  while (true) {
    try {
      const now = new Date().toISOString();

      // Step 1: Fetch course application emails that need to be sent
      const { data: scheduledEmails, error: emailError } = await supabase
        .from("scheduled_emails")
        .select("*")
        .eq("status", "scheduled")
        .eq("template_name", "Course Application")
        .lte("scheduled_at", now);

      if (emailError) {
        console.error("Error fetching scheduled course emails:", emailError);
        await new Promise((r) => setTimeout(r, POLL_INTERVAL));
        continue;
      }

      if (!scheduledEmails || scheduledEmails.length === 0) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL));
        continue;
      }

      for (const email of scheduledEmails) {
        try {
          // Step 2: Fetch the correct email template from email_templates table
          const { data: template, error: templateError } = await supabase
            .from("email_templates")
            .select("*")
            .eq("template_name", email.template_name)
            .limit(1)
            .single();

          if (templateError || !template) {
            console.error(
              "Template not found for email:",
              email.id,
              templateError
            );
            continue;
          }

          // Step 3: Fetch the batch form link from batch_forms table
          const { data: batchFormData, error: batchError } = await supabase
            .from("batch_forms")
            .select("form_url")
            .eq("batch_no", email.template_data.batch_no) // ✅ fixed
            .limit(1)
            .single();

          if (batchError || !batchFormData) {
            console.error(
              "Batch form link not found for batch:",
              email.template_data.batch_no
            );
            continue;
          }

          const batchLink = batchFormData.form_url; // ✅ use form_url

          // Step 4: Render template with the correct batch link
          const emailHtml = template.template_body.replace(
            "{{batch_form_link}}",
            batchLink
          );

          // Step 5: Send the email
          await sendRawEmail({
            to: email.recipient_email, // use recipient_email
            subject: template.subject,
            html: emailHtml,
          });

          // Step 6: Update the email status to "sent"
          await supabase
            .from("scheduled_emails")
            .update({ status: "sent", sent_at: new Date().toISOString() })
            .eq("id", email.id);

          console.log(
            `✅ Course Application email sent to ${email.recipient_email || email.to_email}`
          );
        } catch (innerError) {
          console.error("Error sending course email:", innerError);
        }
      }
    } catch (err) {
      console.error("Error in course application scheduler loop:", err);
    }

    // Wait before next poll
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
  }
}
