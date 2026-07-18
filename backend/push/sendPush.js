// backend/push/sendPush.js
// Helpers to send FCM push notifications to users by their email address.
//
// Device tokens are stored in the Supabase `device_tokens` table
// (see backend/sql/device_tokens.sql). Tokens that FCM reports as
// unregistered/invalid are pruned automatically so the table stays clean.
//
// Every function is defensive: if push is disabled or anything throws,
// it logs and returns quietly WITHOUT bubbling the error up, so it can be
// safely fire-and-forgotten next to the existing email logic.

import { messaging, pushEnabled } from "./firebaseAdmin.js";
import { supabase } from "../supabaseClient.js";

/**
 * Fetch all device tokens registered for the given email address(es).
 * @param {string|string[]} emails
 * @returns {Promise<Array<{token:string,user_email:string}>>}
 */
async function getTokensForEmails(emails) {
  const list = (Array.isArray(emails) ? emails : [emails])
    .map((e) => String(e || "").trim().toLowerCase())
    .filter((e) => e.includes("@"));

  if (list.length === 0) return [];

  const { data, error } = await supabase
    .from("device_tokens")
    .select("token,user_email")
    .in("user_email", list);

  if (error) {
    console.error("❌ [push] getTokensForEmails error:", error.message);
    return [];
  }
  return data || [];
}

/** Remove tokens that FCM told us are no longer valid. */
async function pruneTokens(tokens) {
  if (!tokens || tokens.length === 0) return;
  try {
    await supabase.from("device_tokens").delete().in("token", tokens);
    console.log(`🧹 [push] Pruned ${tokens.length} invalid token(s).`);
  } catch (e) {
    console.warn("⚠️ [push] pruneTokens failed:", e.message);
  }
}

/**
 * Low-level: send a notification to an explicit list of tokens.
 * @returns {Promise<{sent:number,failed:number}>}
 */
export async function sendToTokens(tokens, { title, body, data = {} } = {}) {
  if (!pushEnabled || !messaging) {
    return { sent: 0, failed: 0, disabled: true };
  }
  const unique = [...new Set((tokens || []).filter(Boolean))];
  if (unique.length === 0) return { sent: 0, failed: 0 };

  // FCM data payload values must all be strings.
  const stringData = Object.fromEntries(
    Object.entries(data || {}).map(([k, v]) => [k, String(v)])
  );

  const message = {
    tokens: unique,
    notification: { title: String(title || ""), body: String(body || "") },
    data: stringData,
    android: {
      priority: "high",
      notification: {
        channelId: "default",
        sound: "default",
        // Lets a closed app still surface a heads-up notification.
        defaultSound: true,
      },
    },
  };

  try {
    const resp = await messaging.sendEachForMulticast(message);
    const invalid = [];
    resp.responses.forEach((r, i) => {
      if (!r.success) {
        const code = r.error?.code || "";
        if (
          code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token" ||
          code === "messaging/invalid-argument"
        ) {
          invalid.push(unique[i]);
        }
      }
    });
    if (invalid.length) await pruneTokens(invalid);

    console.log(
      `📲 [push] Sent notification "${title}" → ${resp.successCount} ok, ${resp.failureCount} failed.`
    );
    return { sent: resp.successCount, failed: resp.failureCount };
  } catch (err) {
    console.error("❌ [push] sendToTokens error:", err.message);
    return { sent: 0, failed: (tokens || []).length, error: err.message };
  }
}

/**
 * High-level: send a push to everyone registered under these email(s).
 * Safe to fire-and-forget; never throws.
 * @param {string|string[]} emails
 * @param {{title:string, body:string, data?:object}} payload
 */
export async function sendPushToEmails(emails, payload) {
  try {
    if (!pushEnabled) return { sent: 0, failed: 0, disabled: true };
    const rows = await getTokensForEmails(emails);
    if (rows.length === 0) return { sent: 0, failed: 0 };
    return await sendToTokens(rows.map((r) => r.token), payload);
  } catch (err) {
    console.error("❌ [push] sendPushToEmails error:", err.message);
    return { sent: 0, failed: 0, error: err.message };
  }
}

/**
 * Look up the emails of all active users holding any of the given roles.
 * Roles in `internal_users` are capitalized, e.g. "Manager", "Management",
 * "Coordinator", "Trainer". Never throws — returns [] on any error.
 * @param {string[]} roles
 * @returns {Promise<string[]>}
 */
export async function getRoleEmails(roles) {
  try {
    const wanted = (Array.isArray(roles) ? roles : [roles]).filter(Boolean);
    if (wanted.length === 0) return [];
    const { data, error } = await supabase
      .from("internal_users")
      .select("email,is_active,role")
      .in("role", wanted)
      .eq("is_active", true);
    if (error) {
      console.error("❌ [push] getRoleEmails error:", error.message);
      return [];
    }
    return (data || [])
      .map((u) => (u.email || "").trim())
      .filter((e) => e.includes("@"));
  } catch (err) {
    console.error("❌ [push] getRoleEmails exception:", err.message);
    return [];
  }
}

/** The roles that should receive "request / needs-action" notifications. */
export const APPROVER_ROLES = ["Management", "Manager", "Coordinator"];

/**
 * Emails of everyone who approves requests (Admin/Management, Manager,
 * Coordinator). Use for REQUEST-type events. Never throws.
 * @returns {Promise<string[]>}
 */
export async function getApproverEmails() {
  return getRoleEmails(APPROVER_ROLES);
}

/**
 * Fire-and-forget helper: resolve recipients then push, never throwing and
 * never blocking the response. Accepts a single email, an array, or a
 * promise that resolves to either.
 * @param {string|string[]|Promise<string|string[]>} emailsOrPromise
 * @param {{title:string, body:string, data?:object}} payload
 */
export function notify(emailsOrPromise, payload) {
  Promise.resolve(emailsOrPromise)
    .then((emails) => sendPushToEmails(emails, payload))
    .catch((err) => console.error("❌ [push] notify error:", err.message));
}

export default sendPushToEmails;
