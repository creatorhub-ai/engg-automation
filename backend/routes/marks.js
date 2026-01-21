const express = require("express");
const router = express.Router();
const db = require("../db");

// Convert DD-MM-YYYY → YYYY-MM-DD
const normalizeDate = (dateStr) => {
  if (!dateStr) return null;

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

  // DD-MM-YYYY or DD/MM/YYYY
  const m = dateStr.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (!m) return null;

  const [_, d, mth, y] = m;
  return `${y}-${mth.padStart(2, "0")}-${d.padStart(2, "0")}`;
};

// POST /api/marks/:assessmentType
router.post("/:assessmentType", async (req, res) => {
  try {
    const assessmentType = req.params.assessmentType;

    const {
      learner_id,
      batch_no,
      week_no,
      assessment_date,
      out_off,
      points,
      percentage,
    } = req.body;

    if (!learner_id || !batch_no || !assessment_date) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const formattedDate = normalizeDate(assessment_date);
    if (!formattedDate) {
      return res.status(400).json({ error: "Invalid date format" });
    }

    const sql = `
      INSERT INTO marks (
        learner_id,
        batch_no,
        assessment_type,
        week_no,
        assessment_date,
        out_off,
        points,
        percentage
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        out_off = VALUES(out_off),
        points = VALUES(points),
        percentage = VALUES(percentage),
        updated_at = CURRENT_TIMESTAMP
    `;

    const values = [
      learner_id,
      batch_no,
      assessmentType,
      week_no,
      formattedDate,
      out_off,
      points,
      percentage,
    ];

    await db.execute(sql, values);

    res.json({ success: true });
  } catch (err) {
    console.error("❌ MARK SAVE ERROR:", err);
    res.status(500).json({ error: "Failed to save marks" });
  }
});

module.exports = router;
