import express from "express";
const router = express.Router();

import { pool } from "../db.js";   // <-- Correct import

// ============================
// GET attendance by batch_no
// ============================
router.get("/by_batch", async (req, res) => {
  try {
    const { batch_no } = req.query;

    if (!batch_no) {
      return res.status(400).json({ error: "batch_no is required" });
    }

    // Run query
    const query = `
      SELECT *
      FROM attendance
      WHERE batch_no = $1
    `;

    const result = await pool.query(query, [batch_no]);

    return res.json(result.rows);
  } catch (err) {
    console.error("Error fetching attendance:", err);
    return res.status(500).json({ error: "Server Error" });
  }
});

export default router;
