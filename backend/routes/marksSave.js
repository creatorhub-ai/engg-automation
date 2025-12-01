// routes/marksSave.js
const express = require("express");
const { pool } = require("../db");
const { getWindowStatus } = require("../marksWindowService");
const router = express.Router();

router.post("/:assessmentType", async (req, res) => {
  const { assessmentType } = req.params;
  const {
    learner_id,
    batch_no,
    week_no,
    assessment_date,
    out_off,
    points,
    percentage,
  } = req.body;

  if (!learner_id || !batch_no || !week_no || !assessment_date || !out_off) {
    return res
      .status(400)
      .json({ error: "Required fields missing (learner_id, batch_no, week_no, assessment_date, out_off)" });
  }

  try {
    const status = await getWindowStatus({
      batchNo: batch_no,
      assessmentType,
      weekNo: week_no,
    });

    if (!status.exists || !status.is_open) {
      return res
        .status(403)
        .json({ error: "Marks entry portal is closed for this assessment" });
    }

    await pool.query(
      `INSERT INTO marks_${assessmentType} 
         (learner_id, batch_no, week_no, assessment_date, out_off, points, percentage, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7, now())
       ON CONFLICT (learner_id, batch_no, week_no) DO UPDATE
         SET points = EXCLUDED.points,
             percentage = EXCLUDED.percentage,
             out_off = EXCLUDED.out_off,
             assessment_date = EXCLUDED.assessment_date,
             updated_at = now()`,
      [learner_id, batch_no, week_no, assessment_date, out_off, points, percentage]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("save marks error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
