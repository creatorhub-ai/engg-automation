// emailSender.js
import dotenv from "dotenv";
dotenv.config();

const MAILJET_API_KEY    = process.env.MAILJET_API_KEY;
const MAILJET_SECRET_KEY = process.env.MAILJET_SECRET_KEY;
const FROM_EMAIL         = process.env.FROM_EMAIL || "coordinator@chipedge.com";
const FROM_NAME          = process.env.FROM_NAME  || "ChipEdge Learning";

if (!MAILJET_API_KEY || !MAILJET_SECRET_KEY) {
  console.error("❌ MAILJET_API_KEY or MAILJET_SECRET_KEY not set");
} else {
  console.log("✅ Mailjet email service ready");
}

export async function sendRawEmail({
  to, subject, html, text, inReplyTo, references, attachments,
}) {
  if (!to || !subject) {
    return { success: false, error: "Missing 'to' or 'subject'" };
  }
  if (!MAILJET_API_KEY || !MAILJET_SECRET_KEY) {
    return { success: false, error: "Mailjet credentials not configured" };
  }

  // Normalize recipients
  const toList = Array.isArray(to)
    ? to.map(email => ({ Email: email.trim() }))
    : [{ Email: to.trim() }];

  const payload = {
    Messages: [
      {
        From: {
          Email: FROM_EMAIL,
          Name:  FROM_NAME,
        },
        To:       toList,
        Subject:  subject,
        HTMLPart: html || `<p>${text || ""}</p>`,
        TextPart: text || (html ? html.replace(/<[^>]+>/g, "") : ""),
      },
    ],
  };

  // Attachments
  if (attachments && attachments.length > 0) {
    payload.Messages[0].Attachments = attachments.map(att => ({
      ContentType:   att.contentType || "application/octet-stream",
      Filename:      att.filename,
      Base64Content: Buffer.isBuffer(att.content)
        ? att.content.toString("base64")
        : att.content,
    }));
  }

  // Thread headers
  if (inReplyTo || references) {
    payload.Messages[0].Headers = {};
    if (inReplyTo) payload.Messages[0].Headers["In-Reply-To"] = inReplyTo;
    if (references) payload.Messages[0].Headers["References"]  = references;
  }

  // Basic auth for Mailjet
  const credentials = Buffer.from(
    `${MAILJET_API_KEY}:${MAILJET_SECRET_KEY}`
  ).toString("base64");

  try {
    console.log(`📤 Sending email via Mailjet to: ${to} | Subject: ${subject}`);

    const response = await fetch(
      "https://api.mailjet.com/v3.1/send",
      {
        method:  "POST",
        headers: {
          "Authorization": `Basic ${credentials}`,
          "Content-Type":  "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      const errMsg = result?.ErrorMessage
        || result?.Messages?.[0]?.Errors?.[0]?.ErrorMessage
        || `HTTP ${response.status}`;
      console.error(`❌ Mailjet HTTP ${response.status} sending to ${to}:`, JSON.stringify(result));
      return { success: false, error: errMsg };
    }

    // Check for per-message errors even on 200
    const msgStatus = result?.Messages?.[0]?.Status;
    if (msgStatus && msgStatus !== "success") {
      const errMsg = result?.Messages?.[0]?.Errors?.[0]?.ErrorMessage || `Status: ${msgStatus}`;
      console.error(`❌ Mailjet message error for ${to}:`, JSON.stringify(result.Messages[0]));
      return { success: false, error: errMsg };
    }

    const msgId = result?.Messages?.[0]?.To?.[0]?.MessageID || "sent";
    console.log(`✅ Email sent to ${to} | Mailjet ID: ${msgId}`);
    return { success: true, messageId: String(msgId) };

  } catch (err) {
    console.error(`❌ sendRawEmail network/parse error for ${to}:`, err.message);
    return { success: false, error: err.message };
  }
}