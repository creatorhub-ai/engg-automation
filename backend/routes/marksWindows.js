// backend/routes/marksWindows.js
import express from "express";
import { getWindowStatus } from "../marksWindowService.js";

const router = express.Router();

router.get("/window-status", async (req, res) => {
  try {
    const { batch_no, assessment_type, week_no } = req.query;
    if (!batch_no || !assessment_type) {
      return res
        .status(400)
        .json({ error: "batch_no and assessment_type are required" });
    }

    const status = await getWindowStatus({
      batchNo: batch_no,
      assessmentType: assessment_type,
      weekNo: week_no ? Number(week_no) : null,
    });

    return res.json(status);
  } catch (err) {
    console.error("window-status error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
