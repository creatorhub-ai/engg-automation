// holidaysRoutes.js
import express from "express";
import multer from "multer";
import xlsx from "xlsx";
import { pool } from "../db.js"; // adjust .js if needed

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

// POST /api/holidays/upload
// Body: form-data { file: <xlsx> }
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "File is required" });
    }

    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    // Expect header row with columns including Date, Holiday, Type of Holiday
    // Skip header rows and any footer rows
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row.length) continue;

      const dateStr = row[0]; // e.g. "01-Jan"
      const holidayName = row[2]; // "New Year's Day"
      const typeStr = row[3]; // "Holiday" / "Restricted Holiday"

      if (!dateStr || !holidayName || !typeStr) continue;

      // Convert "01-Jan" with year 2025 (you can pass year as query param if needed)
      const [dayPart, monPart] = String(dateStr).split("-");
      const year = 2025; // or derive from filename or input param
      const dateISO = new Date(`${dayPart}-${monPart}-${year}`);

      if (isNaN(dateISO.getTime())) continue;

      const pgDate = dateISO.toISOString().slice(0, 10);

      await pool.query(
        `
        INSERT INTO holidays (holiday_date, name, type)
        VALUES ($1, $2, $3)
        ON CONFLICT (holiday_date)
        DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type
        `,
        [pgDate, holidayName, typeStr]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Holiday upload failed:", err);
    res.status(500).json({ error: "Failed to process holiday file" });
  }
});

// GET /api/holidays?year=2025
router.get("/", async (req, res) => {
  try {
    const year = req.query.year || new Date().getFullYear();
    const rows = await pool.query(
      `SELECT holiday_date, name, type
       FROM holidays
       WHERE EXTRACT(YEAR FROM holiday_date) = $1`,
      [year]
    );
    res.json(rows.rows);
  } catch (err) {
    console.error("Fetch holidays failed:", err);
    res.status(500).json({ error: "Failed to fetch holidays" });
  }
});

export default router;
