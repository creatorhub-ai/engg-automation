// backend/push/firebaseAdmin.js
// Lazily initialises the Firebase Admin SDK for sending FCM push messages.
//
// Credentials come from ONE of these env vars (checked in order):
//   1. FIREBASE_SERVICE_ACCOUNT       -> the full service-account JSON as a string
//   2. FIREBASE_SERVICE_ACCOUNT_BASE64-> the same JSON, base64-encoded (handy on Render)
//   3. GOOGLE_APPLICATION_CREDENTIALS -> path to a service-account .json file
//
// If none are set the module stays "disabled" and every send becomes a no-op,
// so the rest of the backend (email, etc.) keeps working exactly as before.

import admin from "firebase-admin";
import dotenv from "dotenv";
dotenv.config();

let app = null;
let enabled = false;

function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw && raw.trim().startsWith("{")) {
    return JSON.parse(raw);
  }

  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (b64 && b64.trim()) {
    return JSON.parse(Buffer.from(b64.trim(), "base64").toString("utf8"));
  }

  // GOOGLE_APPLICATION_CREDENTIALS is picked up automatically by applicationDefault()
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return "APPLICATION_DEFAULT";
  }

  return null;
}

try {
  const svc = loadServiceAccount();

  if (!svc) {
    console.warn(
      "⚠️  [push] No Firebase credentials found (FIREBASE_SERVICE_ACCOUNT / " +
        "FIREBASE_SERVICE_ACCOUNT_BASE64 / GOOGLE_APPLICATION_CREDENTIALS). " +
        "Push notifications are DISABLED; email keeps working normally."
    );
  } else if (svc === "APPLICATION_DEFAULT") {
    app = admin.initializeApp({ credential: admin.credential.applicationDefault() });
    enabled = true;
    console.log("✅ [push] Firebase Admin initialised (application default credentials).");
  } else {
    // Normalise the escaped newlines that Render/hosting panels add to the key.
    if (svc.private_key && svc.private_key.includes("\\n")) {
      svc.private_key = svc.private_key.replace(/\\n/g, "\n");
    }
    app = admin.initializeApp({ credential: admin.credential.cert(svc) });
    enabled = true;
    console.log(`✅ [push] Firebase Admin initialised (project: ${svc.project_id}).`);
  }
} catch (err) {
  console.error("❌ [push] Failed to initialise Firebase Admin:", err.message);
  enabled = false;
}

export const messaging = enabled ? admin.messaging() : null;
export const pushEnabled = enabled;
export default app;
