// internalUsersRoutes.js
const express = require("express");
const router = express.Router();
const pool = require("../db");

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

module.exports = router;
