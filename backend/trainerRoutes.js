// backend/trainerRoutes.js
import express from "express";
import { supabase } from "./supabaseClient.js";
import { verifyToken } from "./auth.js";
import { canUpdateStatus } from "./helpers.js";

const router = express.Router();

/** Middleware: verify JWT from Authorization header */
router.use(async (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: "Missing token" });
  const token = auth.split(" ")[1];
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: "Invalid token" });
  req.user = payload; // { email, role }
  next();
});

/** GET /trainer/batches - unique batches assigned to logged-in trainer */
router.get("/batches", async (req, res) => {
  try {
    const trainerEmail = req.user.email;

    const { data, error } = await supabase
      .from("course_planner_data")
      .select("batch_no", { distinct: true })
      .eq("trainer_email", trainerEmail);

    if (error) throw error;
    return res.json(data.map((r) => r.batch_no));
  } catch (err) {
    console.error("GET /trainer/batches error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/** GET /trainer/topics/:batchNo - topics for the batch for this trainer */
router.get("/topics/:batchNo", async (req, res) => {
  try {
    const trainerEmail = req.user.email;
    const batchNo = req.params.batchNo;

    const { data, error } = await supabase
      .from("course_planner_data")
      .select("*")
      .eq("trainer_email", trainerEmail)
      .eq("batch_no", batchNo)
      .order("date", { ascending: true });

    if (error) throw error;
    return res.json(data);
  } catch (err) {
    console.error("GET /trainer/topics error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/** POST /trainer/topics/:topicId/complete - attempt to mark completed */
router.post("/topics/:topicId/complete", async (req, res) => {
  try {
    const trainerEmail = req.user.email;
    const topicId = Number(req.params.topicId);

    // fetch topic
    const { data: topic, error: fetchErr } = await supabase
      .from("course_planner_data")
      .select("*")
      .eq("id", topicId)
      .limit(1)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!topic) return res.status(404).json({ error: "Topic not found" });

    if (topic.trainer_email !== trainerEmail) {
      return res.status(403).json({ error: "Not authorized for this topic" });
    }

    // check if already completed
    if ((topic.topic_status || "").toLowerCase() === "completed") {
      return res.json({ success: true, message: "Already completed" });
    }

    // timing check
    const allowed = canUpdateStatus(topic.batch_type || "Morning", topic.date, new Date());
    if (!allowed) {
      // insert unlock request
      const { error: insertErr } = await supabase.from("status_unlock_requests").insert([
        {
          topic_id: topic.id,
          trainer_email: trainerEmail,
          batch_no: topic.batch_no,
        },
      ]);
      if (insertErr) {
        console.error("Insert unlock request error:", insertErr.message);
        return res.status(500).json({ error: insertErr.message });
      }
      // return with message to notify manager
      return res.status(403).json({
        error: "Update locked. Unlock request sent to manager.",
        unlock_requested: true,
      });
    }

    // if allowed -> update status
    const { error: updateErr } = await supabase
      .from("course_planner_data")
      .update({ topic_status: "Completed" })
      .eq("id", topicId);

    if (updateErr) throw updateErr;
    return res.json({ success: true, message: "Topic marked as Completed" });
  } catch (err) {
    console.error("POST /trainer/topics/:topicId/complete error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
