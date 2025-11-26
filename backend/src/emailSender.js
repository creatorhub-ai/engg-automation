// backend/src/emailSender.js
import nodemailer from "nodemailer";
import { supabase } from "./supabaseClient.js";

/**
 * Primary transporter (Gmail SMTP with SSL, port 465)
 * Forces IPv4 to avoid ENETUNREACH errors with IPv6
 */
export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 465,
  secure: Number(process.env.SMTP_PORT) === 465, // true only for port 465
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Gmail App Password, not normal password
  },
  tls: {
    family: 4, // 👈 force IPv4
    rejectUnauthorized: true,
  },
  // 👇 explicitly set IPv4 for nodemailer socket connection
  socketTimeout: 20000, // prevent hangs
  connectionTimeout: 20000,
});

/**
 * Verify transporter connection at startup
 */
transporter.verify((err, success) => {
  if (err) {
    console.error("❌ SMTP transporter verification failed:", err.message);
    console.error(
      "👉 Check: (1) App Password, (2) SMTP host/port, (3) firewall allowing 465/587"
    );
  } else {
    console.log("✅ SMTP transporter is ready to send emails");
  }
});

/**
 * Generic mail sender
 * Falls back to port 587 (TLS) if port 465 fails
 */
export async function sendMail({ to, subject, text, html }) {
  try {
    const info = await transporter.sendMail({
      from: `"ChipEdge" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html,
    });
    console.log(`✅ Email sent to ${to}: ${info.response}`);
    return info;
  } catch (err) {
    console.error(`❌ Failed to send to ${to}:`, err.message);

    // --- fallback: retry with port 587 (TLS) if 465 fails ---
    if (process.env.SMTP_PORT !== "587") {
      console.warn("🔄 Retrying with port 587 (TLS)...");
      const fallback = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false, // TLS
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
        tls: { family: 4, rejectUnauthorized: true },
        socketTimeout: 20000,
        connectionTimeout: 20000,
      });
      const info = await fallback.sendMail({
        from: `"ChipEdge" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        text,
        html,
      });
      console.log(
        `✅ Email sent via fallback (587) to ${to}: ${info.response}`
      );
      return info;
    }

    throw err;
  }
}

/**
 * Fetch batch learners from Supabase
 */
export async function getBatchInfo(batchId) {
  const { data, error } = await supabase
    .from("Learners")
    .select("*")
    .eq("BatchID", batchId);

  if (error) throw error;
  return data;
}

/**
 * Raw email sender (used directly in index.js if needed)
 */
export async function sendRawEmail({ to, subject, text, html }) {
  try {
    const info = await transporter.sendMail({
      from: `"ChipEdge" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html,
    });
    console.log(`📧 Nodemailer success: ${info.response}`);
    return { success: true, info };
  } catch (err) {
    console.error(`❌ Nodemailer error: ${err.message}`);
    return { success: false, error: err.message };
  }
}
