// emailSender.js
import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
  connectionTimeout: 15000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
});

// Verify on startup
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ emailSender SMTP ERROR:", error.message);
  } else {
    console.log("✅ emailSender SMTP READY");
  }
});

/**
 * sendRawEmail({ to, subject, html, text, inReplyTo, references, attachments })
 * Returns { success: true, messageId } or { success: false, error: string }
 */
export async function sendRawEmail({ to, subject, html, text, inReplyTo, references, attachments }) {
  if (!to || !subject) {
    return { success: false, error: "Missing 'to' or 'subject'" };
  }

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error("❌ EMAIL_USER or EMAIL_PASS not set in environment");
    return { success: false, error: "Email credentials not configured" };
  }

  const mailOptions = {
    from: `"ChipEdge Learning" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html: html || text || "",
    text: text || (html ? html.replace(/<[^>]+>/g, "") : ""),
  };

  if (inReplyTo) mailOptions.inReplyTo = inReplyTo;
  if (references) mailOptions.references = references;
  if (attachments && attachments.length > 0) mailOptions.attachments = attachments;

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${to} | MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`❌ Failed to send email to ${to}:`, err.message);
    return { success: false, error: err.message };
  }
}