// routes/coursePlanner.js
// Course Planner Generator: fills a domain template into an .xlsx (readable
// planner) and converts that .xlsx into the system-ingestable .csv.
// Both steps run the Python (openpyxl) scripts in ../scripts.
import express from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

const router = express.Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", ".."); // repo root (holds templates)
const SCRIPTS_DIR = path.join(__dirname, "..", "scripts");
const WORK_DIR = path.join(__dirname, "..", "uploads", "course-planner");
const PYTHON_BIN = process.env.PYTHON_BIN || (process.platform === "win32" ? "python" : "python3");

fs.mkdirSync(WORK_DIR, { recursive: true });

// Find the company holiday workbook dynamically (first "Holiday*.xlsx" in root).
function findHolidayFile() {
  try {
    const f = fs
      .readdirSync(ROOT_DIR)
      .find((n) => /holiday.*\.xlsx$/i.test(n));
    return f ? path.join(ROOT_DIR, f) : "";
  } catch {
    return "";
  }
}

// Run a python script, feed `stdinData` (if any), resolve with {stdout}.
function runPython(scriptName, args = [], stdinData = null) {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON_BIN, [path.join(SCRIPTS_DIR, scriptName), ...args]);
    let out = "";
    let err = "";
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.stderr.on("data", (d) => (err += d.toString()));
    proc.on("error", (e) => reject(new Error(`Failed to start Python (${PYTHON_BIN}): ${e.message}`)));
    proc.on("close", (code) => {
      if (code === 0) resolve({ stdout: out.trim() });
      else reject(new Error(err.trim() || `Python exited with code ${code}`));
    });
    if (stdinData !== null) {
      proc.stdin.write(stdinData);
      proc.stdin.end();
    }
  });
}

const isId = (s) => typeof s === "string" && /^[a-f0-9-]{36}$/i.test(s);
const readMeta = (id) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(WORK_DIR, `${id}.json`), "utf-8"));
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------
// POST /api/course-planner/generate
// body: { domain, batchNo, session1, session2, session3, labTimings, startDate }
// -> generates the .xlsx, returns { id, filename, template, holidaysMarked }
// ---------------------------------------------------------------------------
router.post("/generate", async (req, res) => {
  try {
    const { domain, batchNo, session1, session2, session3, labTimings, startDate } = req.body || {};
    if (!domain || !batchNo) {
      return res.status(400).json({ error: "domain and batchNo are required" });
    }

    const id = crypto.randomUUID();
    const xlsxPath = path.join(WORK_DIR, `${id}.xlsx`);

    const cfg = {
      domain,
      batch_no: batchNo,
      session1: session1 || "",
      session2: session2 || "",
      session3: session3 || "",
      lab_timings: labTimings || "",
      start_date: startDate || "",
      template_dir: ROOT_DIR,
      holiday_file: findHolidayFile(),
      out_path: xlsxPath,
    };

    const { stdout } = await runPython("generate_course_planner.py", [], JSON.stringify(cfg));
    let summary = {};
    try {
      summary = JSON.parse(stdout);
    } catch {
      /* non-JSON tail is fine */
    }

    const filename = `${batchNo} Course Planner.xlsx`;
    fs.writeFileSync(
      path.join(WORK_DIR, `${id}.json`),
      JSON.stringify({ id, batchNo, domain, filename })
    );

    return res.json({
      id,
      filename,
      template: summary.template || null,
      holidaysMarked: summary.holidays_marked || 0,
      startDate: summary.start_date || null,
    });
  } catch (err) {
    console.error("Course planner generate error:", err);
    return res.status(500).json({ error: err.message || "Generation failed" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/course-planner/convert   body: { id }
// -> flattens the generated .xlsx into the system .csv, returns { csvReady }
// ---------------------------------------------------------------------------
router.post("/convert", async (req, res) => {
  try {
    const { id } = req.body || {};
    if (!isId(id)) return res.status(400).json({ error: "valid id is required" });

    const xlsxPath = path.join(WORK_DIR, `${id}.xlsx`);
    const csvPath = path.join(WORK_DIR, `${id}.csv`);
    if (!fs.existsSync(xlsxPath)) {
      return res.status(404).json({ error: "Generated planner not found. Generate it first." });
    }

    const { stdout } = await runPython("course_planner_xlsx_to_csv.py", [xlsxPath, csvPath]);
    const meta = readMeta(id);
    const rows = (stdout.match(/Wrote\s+(\d+)/) || [])[1] || null;

    return res.json({
      id,
      csvFilename: meta ? `${meta.batchNo} CP.csv` : `${id}.csv`,
      rows: rows ? Number(rows) : null,
    });
  } catch (err) {
    console.error("Course planner convert error:", err);
    return res.status(500).json({ error: err.message || "Conversion failed" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/course-planner/download/:id/:kind   (kind = xlsx | csv)
// ---------------------------------------------------------------------------
router.get("/download/:id/:kind", (req, res) => {
  const { id, kind } = req.params;
  if (!isId(id) || !["xlsx", "csv"].includes(kind)) {
    return res.status(400).json({ error: "bad request" });
  }
  const filePath = path.join(WORK_DIR, `${id}.${kind}`);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "file not found" });

  const meta = readMeta(id);
  const base = meta ? meta.batchNo : id;
  const downloadName = kind === "xlsx" ? `${base} Course Planner.xlsx` : `${base} CP.csv`;
  return res.download(filePath, downloadName);
});

export default router;
