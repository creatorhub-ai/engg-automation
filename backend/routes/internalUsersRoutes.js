// internalUsersRoutes.js
import express from "express";
import { pool } from "../db.js";

const router = express.Router();

// GET /api/internal-users/trainers
router.get("/trainers", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email
       FROM internal_users
       WHERE role = 'Trainer'
       ORDER BY name`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch trainers failed:", err);
    res.status(500).json({ error: "Failed to fetch trainers" });
  }
});

export default router;
