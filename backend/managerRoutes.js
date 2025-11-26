// backend/managerRoutes.js
import express from "express";
import { supabase } from "./supabaseClient.js";
import { verifyToken } from "./auth.js";
import { sendRawEmail } from "./emailSender.js";

const router = express.Router();

// verify JWT and role=manager or admin
router.use((req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: "Missing token" });
  const token = auth.split(" ")[1];
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: "Invalid token" });
  if (!["manager", "admin"].includes(payload.role)) {
    return res.status(403).json({ error: "Not authorized" });
  }
  req.user = payload;
  next();
});

/** GET /manager/unlock-requests */
router.get("/unlock-requests", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("status_unlock_requests")
      .select("*")
      .eq("approved", false)
      .order("requested_at", { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error("GET /manager/unlock-requests error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/** POST /manager/unlock-requests/:id/approve */
router.post("/unlock-requests/:id/approve", async (req, res) => {
  try {
    const reqId = Number(req.params.id);
    // fetch request
    const { data: reqRow, error: fetchErr } = await supabase
      .from("status_unlock_requests")
      .select("*")
      .eq("id", reqId)
      .limit(1)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!reqRow) return res.status(404).json({ error: "Request not found" });

    // mark approved
    const { error: updateErr } = await supabase
      .from("status_unlock_requests")
      .update({
        approved: true,
        approved_by: req.user.email,
        approved_at: new Date().toISOString(),
      })
      .eq("id", reqId);

    if (updateErr) throw updateErr;

    // Option A: Automatically allow trainer to mark as completed by updating course_planner_data topic_status = 'Completed'
    // Here we *do not* auto-complete; instead we allow a one-time override. Easiest approach: update course_planner_data.topic_status to 'Planned (Unlocked)' or directly set to Completed.
    // I'll update topic_status to 'Unlocked' so trainer can now mark Completed via the same endpoint (we'll treat unlocked requests as unlocking).
    const { error: unlockErr } = await supabase
      .from("course_planner_data")
      .update({ topic_status: "Unlocked" })
      .eq("id", reqRow.topic_id);

    if (unlockErr) {
      console.error("Failed to set topic unlocked:", unlockErr.message);
    }

    // notify trainer via email (optional)
    try {
      await sendRawEmail({
        to: reqRow.trainer_email,
        subject: `Unlock approved for topic ${reqRow.topic_id} (Batch ${reqRow.batch_no})`,
        text: `Your unlock request has been approved by ${req.user.email}. You can now mark the topic as Completed.`,
      });
    } catch (e) {
      console.error("Notify trainer error:", e.message);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("POST /manager/unlock-requests/:id/approve error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
