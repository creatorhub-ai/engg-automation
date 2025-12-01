// routes/marksWindows.js
const express = require("express");
const { getWindowStatus } = require("../marksWindowService");
const { pool } = require("../db");
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

    // check pending request for this trainer if you have auth
    let hasPendingRequest = false;
    if (req.user?.email) {
      const { rows } = await pool.query(
        `SELECT 1
           FROM marks_entry_extension_requests
          WHERE batch_no = $1
            AND assessment_type = $2
            AND (week_no = $3 OR $3 IS NULL)
            AND trainer_email = $4
            AND status = 'pending'
          LIMIT 1`,
        [batch_no, assessment_type, week_no || null, req.user.email]
      );
      hasPendingRequest = rows.length > 0;
    }

    res.json({ ...status, has_pending_request: hasPendingRequest });
  } catch (err) {
    console.error("window-status error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
