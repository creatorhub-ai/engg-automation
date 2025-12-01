// routes/marksExtension.js
const express = require("express");
const { pool } = require("../db");
const { getWindowStatus } = require("../marksWindowService");
const router = express.Router();

// Trainer raises request
router.post("/extension-request", async (req, res) => {
  try {
    const { batch_no, assessment_type, week_no, reason } = req.body;
    const trainerEmail = req.user?.email; // from auth

    if (!trainerEmail) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!batch_no || !assessment_type || !week_no) {
      return res
        .status(400)
        .json({ error: "batch_no, assessment_type, week_no are required" });
    }

    // If portal already open, no need to request
    const status = await getWindowStatus({
      batchNo: batch_no,
      assessmentType: assessment_type,
      weekNo: week_no,
    });
    if (status.is_open) {
      return res.json({
        success: false,
        error: "Portal is already open for this assessment",
      });
    }

    // Avoid duplicate pending requests by same trainer
    const { rows: existing } = await pool.query(
      `SELECT id FROM marks_entry_extension_requests
        WHERE batch_no = $1
          AND assessment_type = $2
          AND week_no = $3
          AND trainer_email = $4
          AND status = 'pending'
        LIMIT 1`,
      [batch_no, assessment_type, week_no, trainerEmail]
    );
    if (existing.length > 0) {
      return res.json({
        success: false,
        error: "You already have a pending request for this assessment",
      });
    }

    const { rows } = await pool.query(
      `INSERT INTO marks_entry_extension_requests
         (batch_no, assessment_type, week_no, trainer_email, reason)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id`,
      [batch_no, assessment_type, week_no, trainerEmail, reason || null]
    );

    const requestId = rows[0].id;

    // TODO: send email to manager(s) using your existing mailer
    // e.g. insert into scheduled_emails or marks_reminder_jobs

    res.json({ success: true, request_id: requestId });
  } catch (err) {
    console.error("extension-request error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
