// emailSender.js
// Pure fetch-based Mailjet v3.1 sender with FULL response logging.
// No SDK, no dependencies beyond Node built-ins.

import dotenv from "dotenv";
dotenv.config();

const FROM_EMAIL = process.env.FROM_EMAIL || "coordinator@chipedge.com";
const FROM_NAME  = process.env.FROM_NAME  || "ChipEdge Learning";

console.log("✅ emailSender loaded");
console.log("   FROM_EMAIL       :", FROM_EMAIL);
console.log("   MAILJET_API_KEY  :", process.env.MAILJET_API_KEY  ? process.env.MAILJET_API_KEY.slice(0,8)  + "..." : "❌ NOT SET");
console.log("   MAILJET_SECRET   :", process.env.MAILJET_SECRET_KEY ? process.env.MAILJET_SECRET_KEY.slice(0,4) + "..." : "❌ NOT SET");

export async function sendRawEmail({ to, subject, html, text, attachments }) {
  const API_KEY    = process.env.MAILJET_API_KEY;
  const SECRET_KEY = process.env.MAILJET_SECRET_KEY;

  // ── Guard: credentials ───────────────────────────────────────────
  if (!API_KEY || !SECRET_KEY) {
    console.error("❌ sendRawEmail: MAILJET_API_KEY or MAILJET_SECRET_KEY missing");
    return { success: false, error: "Mailjet credentials not configured" };
  }

  // ── Guard: required fields ───────────────────────────────────────
  if (!to || !subject) {
    console.error("❌ sendRawEmail: 'to' or 'subject' missing");
    return { success: false, error: "Missing 'to' or 'subject'" };
  }

  // ── Build To list ────────────────────────────────────────────────
  const toList = (Array.isArray(to) ? to : [to])
    .map(a => String(a).trim())
    .filter(a => a.includes("@"))
    .map(a => ({ Email: a }));

  if (toList.length === 0) {
    console.error(`❌ sendRawEmail: no valid email address in to="${to}"`);
    return { success: false, error: `No valid recipient: "${to}"` };
  }

  // ── Build body ───────────────────────────────────────────────────
  const htmlPart = html  || `<p>${text || ""}</p>`;
  const textPart = text  || htmlPart.replace(/<[^>]+>/g, "").trim();

  const message = {
    From:     { Email: FROM_EMAIL, Name: FROM_NAME },
    To:       toList,
    Subject:  subject,
    HTMLPart: htmlPart,
    TextPart: textPart,
  };

  if (attachments && attachments.length > 0) {
    message.Attachments = attachments.map(a => ({
      ContentType:   a.contentType || "application/octet-stream",
      Filename:      a.filename,
      Base64Content: Buffer.isBuffer(a.content)
        ? a.content.toString("base64")
        : String(a.content),
    }));
  }

  const payload = { Messages: [message] };

  // ── Build Basic-auth header ──────────────────────────────────────
  // IMPORTANT: API_KEY is the username, SECRET_KEY is the password.
  const auth = Buffer.from(`${API_KEY}:${SECRET_KEY}`).toString("base64");

  console.log(`\n📤 [Mailjet] Sending email`);
  console.log(`   to      : ${toList.map(r => r.Email).join(", ")}`);
  console.log(`   from    : ${FROM_EMAIL}`);
  console.log(`   subject : ${subject}`);
  console.log(`   payload : ${JSON.stringify(payload).slice(0, 300)}`);

  // ── Fire request ─────────────────────────────────────────────────
  let rawResponse, responseText, responseJson;
  try {
    rawResponse  = await fetch("https://api.mailjet.com/v3.1/send", {
      method:  "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify(payload),
    });

    responseText = await rawResponse.text();   // read ONCE as text
    console.log(`   HTTP status : ${rawResponse.status}`);
    console.log(`   Raw body    : ${responseText}`);  // ← FULL Mailjet response in logs

    try {
      responseJson = JSON.parse(responseText);
    } catch {
      // Mailjet returned non-JSON (network proxy error, etc.)
      console.error("❌ [Mailjet] Non-JSON response:", responseText);
      return { success: false, error: `Non-JSON response: ${responseText.slice(0, 200)}` };
    }

  } catch (networkErr) {
    console.error("❌ [Mailjet] Network/fetch error:", networkErr.message);
    return { success: false, error: `Network error: ${networkErr.message}` };
  }

  // ── Parse result ─────────────────────────────────────────────────
  const msgInfo   = responseJson?.Messages?.[0];
  const mjStatus  = msgInfo?.Status;

  if (!rawResponse.ok) {
    const errMsg =
      msgInfo?.Errors?.[0]?.ErrorMessage ||
      responseJson?.ErrorMessage ||
      `HTTP ${rawResponse.status}`;
    console.error(`❌ [Mailjet] HTTP ${rawResponse.status} error: ${errMsg}`);
    return { success: false, error: errMsg };
  }

  if (mjStatus !== "success") {
    const errMsg =
      msgInfo?.Errors?.[0]?.ErrorMessage ||
      `Mailjet message status="${mjStatus}"`;
    console.error(`❌ [Mailjet] Message-level failure: ${errMsg}`);
    return { success: false, error: errMsg };
  }

  const messageId = String(msgInfo?.To?.[0]?.MessageID || "unknown");
  console.log(`✅ [Mailjet] SUCCESS → ${toList[0].Email} | MessageID: ${messageId}`);
  return { success: true, messageId };
}