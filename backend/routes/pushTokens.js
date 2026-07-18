// backend/routes/pushTokens.js
// Endpoints for the mobile app to register / unregister its FCM device token,
// plus a test endpoint to fire a push on demand.
//
// Mounted at /api/push in index.js.

import express from "express";
import { supabase } from "../supabaseClient.js";
import { sendPushToEmails } from "../push/sendPush.js";
import { pushEnabled } from "../push/firebaseAdmin.js";

const router = express.Router();

/**
 * POST /api/push/register
 * body: { token, email, platform? }
 * Upserts the device token for a user (idempotent on token).
 */
router.post("/register", async (req, res) => {
  try {
    const { token, email, platform } = req.body || {};
    if (!token || !email) {
      return res.status(400).json({ error: "token and email are required" });
    }

    const row = {
      token: String(token),
      user_email: String(email).trim().toLowerCase(),
      platform: platform || "android",
      updated_at: new Date().toISOString(),
    };

    // Upsert on the unique `token` column so re-registering just refreshes it.
    const { error } = await supabase
      .from("device_tokens")
      .upsert(row, { onConflict: "token" });

    if (error) {
      console.error("❌ [push] register error:", error.message);
      return res.status(500).json({ error: error.message });
    }

    console.log(`✅ [push] Registered token for ${row.user_email}`);
    return res.json({ success: true, pushEnabled });
  } catch (err) {
    console.error("❌ [push] register exception:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/push/unregister
 * body: { token }
 * Called on logout so a device stops receiving that user's notifications.
 */
router.post("/unregister", async (req, res) => {
  try {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ error: "token is required" });

    const { error } = await supabase
      .from("device_tokens")
      .delete()
      .eq("token", String(token));

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/push/test
 * body: { email, title?, body? }
 * Sends a test push to every device registered for that email. Handy for QA.
 */
router.post("/test", async (req, res) => {
  try {
    const { email, title, body } = req.body || {};
    if (!email) return res.status(400).json({ error: "email is required" });

    const result = await sendPushToEmails(email, {
      title: title || "Test notification",
      body: body || "If you can see this, push notifications are working 🎉",
      data: { type: "test" },
    });
    return res.json({ success: true, result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/** GET /api/push/status — quick check whether the server can send push. */
router.get("/status", (_req, res) => res.json({ pushEnabled }));

export default router;
