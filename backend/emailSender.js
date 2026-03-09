// emailSender.js  — uses node-mailjet SDK (no raw fetch, no auth bugs)
//
// INSTALL ONCE on your server:
//   npm install node-mailjet
//
// ENV VARS required:
//   MAILJET_API_KEY    — your Mailjet API key (public key)
//   MAILJET_SECRET_KEY — your Mailjet secret key
//   FROM_EMAIL         — verified sender address in Mailjet
//   FROM_NAME          — display name (optional)

import Mailjet from "node-mailjet";
import dotenv from "dotenv";
dotenv.config();

const FROM_EMAIL = process.env.FROM_EMAIL || "coordinator@chipedge.com";
const FROM_NAME  = process.env.FROM_NAME  || "ChipEdge Learning";

if (!process.env.MAILJET_API_KEY || !process.env.MAILJET_SECRET_KEY) {
  console.error("❌ MAILJET_API_KEY or MAILJET_SECRET_KEY not set in environment");
} else {
  console.log("✅ Mailjet email service ready");
  console.log("   FROM_EMAIL:", FROM_EMAIL);
}

// Initialise the SDK client once at module load
const mailjet = new Mailjet({
  apiKey:    process.env.MAILJET_API_KEY,
  apiSecret: process.env.MAILJET_SECRET_KEY,
});

/**
 * sendRawEmail({ to, subject, html, text, attachments })
 *
 * to          — string or string[]
 * subject     — string
 * html        — HTML body string
 * text        — plain-text body string (auto-stripped from html if omitted)
 * attachments — [{ filename, content (Buffer|base64 string), contentType }]
 *
 * Returns { success: true, messageId } or { success: false, error: string }
 */
export async function sendRawEmail({ to, subject, html, text, attachments }) {
  // ── Validate inputs ──────────────────────────────────────────────
  if (!to || !subject) {
    console.error("sendRawEmail: missing 'to' or 'subject'");
    return { success: false, error: "Missing 'to' or 'subject'" };
  }
  if (!process.env.MAILJET_API_KEY || !process.env.MAILJET_SECRET_KEY) {
    console.error("sendRawEmail: Mailjet credentials not configured");
    return { success: false, error: "Mailjet credentials not configured" };
  }

  // ── Build recipient list ─────────────────────────────────────────
  const toList = (Array.isArray(to) ? to : [to])
    .map(addr => ({ Email: String(addr).trim() }))
    .filter(r => r.Email.includes("@"));

  if (toList.length === 0) {
    console.error(`sendRawEmail: no valid recipients in "${to}"`);
    return { success: false, error: `No valid recipient address: "${to}"` };
  }

  // ── Build HTML / text ────────────────────────────────────────────
  const htmlPart = html || `<p>${text || ""}</p>`;
  const textPart = text || htmlPart.replace(/<[^>]+>/g, "").trim();

  // ── Build message object ─────────────────────────────────────────
  const message = {
    From:     { Email: FROM_EMAIL, Name: FROM_NAME },
    To:       toList,
    Subject:  subject,
    HTMLPart: htmlPart,
    TextPart: textPart,
  };

  // ── Attachments (optional) ───────────────────────────────────────
  if (attachments && attachments.length > 0) {
    message.Attachments = attachments.map(att => ({
      ContentType:   att.contentType || "application/octet-stream",
      Filename:      att.filename,
      Base64Content: Buffer.isBuffer(att.content)
        ? att.content.toString("base64")
        : String(att.content),
    }));
  }

  // ── Send via SDK ─────────────────────────────────────────────────
  console.log(`📤 Sending → ${toList.map(r => r.Email).join(", ")} | subject: "${subject}"`);

  try {
    const response = await mailjet
      .post("send", { version: "v3.1" })
      .request({ Messages: [message] });

    const body    = response.body;
    const msgInfo = body?.Messages?.[0];
    const status  = msgInfo?.Status;

    console.log(`   Mailjet HTTP ${response.response.status} | message status: ${status}`);

    if (status === "success") {
      const messageId = String(msgInfo?.To?.[0]?.MessageID || "sent");
      console.log(`✅ Delivered → ${toList[0].Email} | Mailjet ID: ${messageId}`);
      return { success: true, messageId };
    }

    // Mailjet returned 200 but message-level failure
    const errMsg = msgInfo?.Errors?.[0]?.ErrorMessage
      || `Mailjet message status: ${status}`;
    console.error(`❌ Mailjet message-level error:`, JSON.stringify(msgInfo));
    return { success: false, error: errMsg };

  } catch (err) {
    // SDK throws on non-2xx HTTP responses
    const mjErr   = err.response?.body;
    const errMsg  =
      mjErr?.Messages?.[0]?.Errors?.[0]?.ErrorMessage ||
      mjErr?.ErrorMessage ||
      err.message;

    console.error(`❌ Mailjet SDK error for ${toList[0].Email}: ${errMsg}`);
    if (mjErr) console.error("   Full Mailjet error body:", JSON.stringify(mjErr));

    return { success: false, error: errMsg };
  }
}