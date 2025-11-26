import nodemailer from "nodemailer";
import dns from "dns";
import dotenv from "dotenv";

dotenv.config();

// =========================================================
// Force Node.js DNS to prefer IPv4 (avoid ENETUNREACH on IPv6-only failures)
// =========================================================
try {
  if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder("ipv4first");
    console.log("🌐 DNS resolution order set to IPv4 first");
  }
} catch (e) {
  console.warn("⚠️ DNS setDefaultResultOrder not supported in this Node version");
}

// =========================================================
// Check required environment variables
// =========================================================
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || !process.env.FROM_EMAIL) {
  console.error("❌ Missing EMAIL_USER, EMAIL_PASS or FROM_EMAIL in .env file");
  process.exit(1);
}

// =========================================================
// Gmail SMTP transporter (App Password required, not normal password)
// Forcing IPv4 by setting family: 4
// =========================================================
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // Use STARTTLS
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: true,
  },
  family: 4,
});

// =========================================================
// Verify transporter once at startup
// =========================================================
transporter.verify(function (error, success) {
  if (error) {
    console.error("❌ SMTP transporter verification failed:", error.message);
  } else {
    console.log("✅ SMTP transporter is ready to send emails");
  }
});

/**
 * Send a raw/custom email with optional attachments.
 * Supports threaded replies by setting `inReplyTo` and `references`.
 * Supports passing a custom `messageId` header for threading control.
 * 
 * @param {Object} params
 * @param {string|string[]} params.to - Recipient email or array of emails
 * @param {string} [params.subject]
 * @param {string} [params.html]
 * @param {string} [params.text] - Text fallback content
 * @param {Array} [params.attachments]
 * @param {string} [params.inReplyTo] - Sets In-Reply-To header for threading
 * @param {string} [params.references] - Sets References header for threading
 * @param {string} [params.messageId] - Custom Message-ID header for email threading
 */
export async function sendRawEmail({
  to,
  subject,
  html,
  text,
  attachments = [],
  inReplyTo,
  references,
  messageId
}) {
  if (!to || (Array.isArray(to) && to.length === 0)) {
    console.error("❌ sendRawEmail called without recipient email (to). Skipping.");
    return { success: false, error: "Recipient email missing" };
  }

  // Normalize 'to' if array; join with comma for multiple recipients if not using BCC
  let toField = Array.isArray(to) ? to.join(", ") : to;

  const mailOptions = {
    from: `"ChipEdge Technologies" <${process.env.FROM_EMAIL}>`,
    to: toField,
    subject: subject || "(No subject)",
    text: text || "",
    html: html || "",
    attachments,
  };

  if (inReplyTo) {
    mailOptions.inReplyTo = inReplyTo;
  }
  if (references) {
    mailOptions.references = references;
  }
  if (messageId) {
    mailOptions.headers = mailOptions.headers || {};
    mailOptions.headers["Message-ID"] = messageId;
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email successfully sent to ${toField}: ${info.messageId}`);
    return { success: true, info };
  } catch (error) {
    console.error(`❌ Failed to send email to ${toField}:`, error.message);

    if (error.code === "ENETUNREACH") {
      console.error("⚠️ ENETUNREACH: IPv6 blocked, forced IPv4 via family:4 and smtp.gmail.com");
    }

    return {
      success: false,
      error: error.message || "Email sending failed",
    };
  }
}

/**
 * Send a group email to multiple recipients by putting emails in BCC.
 * This sends a single email visible as one sent mail in Sent box.
 * 
 * @param {Object} params
 * @param {string[]} params.recipients - Array of recipient emails
 * @param {string} [params.subject]
 * @param {string} [params.html]
 * @param {string} [params.text]
 * @param {Array} [params.attachments]
 */
export async function sendGroupEmail({
  recipients,
  subject,
  html,
  text,
  attachments = []
}) {
  if (!recipients || recipients.length === 0) {
    console.error("❌ sendGroupEmail called without recipients. Skipping.");
    return { success: false, error: "Recipient emails missing" };
  }

  const mailOptions = {
    from: `"ChipEdge Technologies" <${process.env.FROM_EMAIL}>`,
    to: process.env.FROM_EMAIL, // Single visible To address (your own)
    bcc: recipients,            // Recipients go in BCC
    subject: subject || "(No subject)",
    text: text || "",
    html: html || "",
    attachments,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Group email successfully sent to ${recipients.length} recipients: ${info.messageId}`);
    return { success: true, info };
  } catch (error) {
    console.error("❌ Failed to send group email:", error.message);
    return {
      success: false,
      error: error.message || "Group email sending failed",
    };
  }
}

/**
 * Send Welcome Email with default password info
 */
export async function sendWelcomeEmail(to, name, defaultPassword) {
  const subject = "Welcome to ChipEdge Platform – Your Account Details";
  const html = `
    <p>Dear ${name},</p>
    <p>Your account has been created successfully on the ChipEdge platform.</p>
    <p><strong>Default Login Password:</strong> ${defaultPassword}</p>
    <p>For security, please log in and change your password immediately.</p>
    <p>Regards,<br/>ChipEdge Team</p>
  `;

  return sendRawEmail({ to, subject, html });
}

/**
 * Send Password Reset Email with reset link
 */
export async function sendPasswordResetEmail(to, name, resetLink) {
  const subject = "ChipEdge – Password Reset Request";
  const html = `
    <p>Dear ${name},</p>
    <p>We received a request to reset your password.</p>
    <p>You can reset it by clicking the link below:</p>
    <p><a href="${resetLink}" target="_blank">Reset Password</a></p>
    <p>If you did not request this, please ignore this email.</p>
    <p>Regards,<br/>ChipEdge Team</p>
  `;

  return sendRawEmail({ to, subject, html });
}
