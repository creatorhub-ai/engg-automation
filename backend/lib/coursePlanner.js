// backend/lib/coursePlanner.js
// Node/exceljs port of the former Python (openpyxl) Course Planner scripts.
// Removes the Python + openpyxl runtime dependency entirely so the feature
// works on any deploy (e.g. Render) with no extra system packages.
//
//   generatePlanner(cfg)          -> fills a domain template .xlsx
//   convertPlannerToCsv(xlsx,csv) -> flattens that .xlsx into the system .csv
//
// exceljs resolves merged cells natively: reading a merged *slave* cell returns
// the master's value and exposes cell.isMerged / cell.master. We use that to
// mirror openpyxl's "value inherits merge anchor" behaviour, and treat a slave
// as empty (null) where the Python code read RAW cell values.

import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";

const DATE_COL = 2; // column B holds the date
const TOPIC_COLS = [3, 4, 5, 6, 7, 8, 9]; // C..I
const WEEKEND_RE = /weekend|saturday\s*&\s*sunday/i;
const HOLIDAY_ARGB = "FFFFF2CC"; // FF alpha + FFF2CC

// --------------------------------------------------------------------------- //
// small value / date helpers
// --------------------------------------------------------------------------- //

function asText(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join("");
    if (v instanceof Date) return v.toISOString();
    if (v.result !== undefined && v.result !== null) return String(v.result);
    if (v.text !== undefined && v.text !== null) return String(v.text); // hyperlink
    if (v.formula !== undefined) return "";
    return "";
  }
  return String(v);
}

// RAW value: a merged slave reads as null (like openpyxl ws.cell().value)
function rawValue(ws, r, c) {
  const cell = ws.getCell(r, c);
  if (cell.isMerged && cell.master && cell.master.address !== cell.address) return null;
  return cell.value;
}

// merge-inherited value: exceljs returns the master's value for slaves
function mergedValue(ws, r, c) {
  return ws.getCell(r, c).value;
}

// the cell that actually stores a merged range's value (write here)
function anchorCell(ws, r, c) {
  const cell = ws.getCell(r, c);
  return cell.isMerged && cell.master ? cell.master : cell;
}

// map "r,c" -> column span width (max_col - min_col), like openpyxl span()
function buildSpanMap(ws) {
  const span = new Map();
  for (const range of ws.model.merges || []) {
    const [a, b] = range.split(":");
    const s = ws.getCell(a);
    const e = ws.getCell(b);
    const width = e.col - s.col;
    for (let r = s.row; r <= e.row; r++) {
      for (let c = s.col; c <= e.col; c++) span.set(`${r},${c}`, width);
    }
  }
  return span;
}
const spanAt = (span, r, c) => span.get(`${r},${c}`) || 0;

// exceljs can report a bogus columnCount (up to 16384) after round-tripping;
// the planner only ever uses the first handful of columns, so cap all scans.
const colBound = (ws) => Math.min(ws.columnCount || 12, 40);

function parseYmd(s) {
  const [Y, M, D] = String(s).split("-").map(Number);
  return new Date(Date.UTC(Y, M - 1, D));
}
const addDays = (dt, n) => new Date(dt.getTime() + n * 86400000);
const ymdKey = (dt) => `${dt.getUTCFullYear()}-${dt.getUTCMonth() + 1}-${dt.getUTCDate()}`;
const mdyStr = (dt) => `${dt.getUTCMonth() + 1}/${dt.getUTCDate()}/${dt.getUTCFullYear()}`;

// --------------------------------------------------------------------------- //
// GENERATE
// --------------------------------------------------------------------------- //

function findTemplate(templateDir, domain) {
  const dom = String(domain).trim().toLowerCase();
  const files = fs
    .readdirSync(templateDir)
    .filter((n) => n.toLowerCase().endsWith(".xlsx"))
    .sort();
  const wordRe = new RegExp(`\\b${dom.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
  for (const n of files) {
    const low = n.toLowerCase();
    if (low.includes("course planner template") && wordRe.test(low)) {
      return path.join(templateDir, n);
    }
  }
  for (const n of files) {
    const low = n.toLowerCase();
    if (low.includes("template") && low.includes(dom)) return path.join(templateDir, n);
  }
  throw new Error(`No template found for domain '${domain}' in ${templateDir}`);
}

async function loadHolidays(holidayFile) {
  const map = new Map();
  if (!holidayFile || !fs.existsSync(holidayFile)) return map;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(holidayFile);
  const ws = wb.worksheets[0];
  const header = {};
  for (let c = 1; c <= colBound(ws); c++) {
    const v = ws.getCell(1, c).value;
    if (v !== null && v !== undefined) header[asText(v).trim().toLowerCase()] = c;
  }
  const dateC = header["date"] || 1;
  const nameC = header["holiday"] || 3;
  const typeC = header["type of holiday"] || 4;
  for (let r = 2; r <= ws.rowCount; r++) {
    const d = ws.getCell(r, dateC).value;
    const t = ws.getCell(r, typeC).value;
    if (!(d instanceof Date)) continue;
    if (asText(t).trim().toLowerCase() === "holiday") {
      map.set(ymdKey(d), asText(ws.getCell(r, nameC).value || "Holiday").trim() || "Holiday");
    }
  }
  return map;
}

function fillMetadata(ws, cfg) {
  const s1 = cfg.session1 || "";
  const s2 = cfg.session2 || "";
  const s3 = cfg.session3 || "";
  const batch = cfg.batch_no;
  const dom = cfg.domain;
  const lab = cfg.lab_timings || "";

  ws.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      // only the master/non-merged cell, and only string content (like openpyxl)
      if (cell.isMerged && cell.master && cell.master.address !== cell.address) return;
      let v = cell.value;
      if (typeof v !== "string") {
        if (v && typeof v === "object" && Array.isArray(v.richText)) {
          v = v.richText.map((t) => t.text).join("");
        } else return;
      }
      let nw = v;
      nw = nw.split("(batch_no)").join(batch);
      nw = nw.split("(session1_timings)").join(s1);
      nw = nw.split("(session2_timinigs)").join(s2); // template typo
      nw = nw.split("(session2_timings)").join(s2);
      nw = nw.split("(session3_timings)").join(s3);
      nw = nw.replace(/(Session\s*1\s*:)[ \t]*/g, `$1 ${s1}`);
      nw = nw.replace(/(Session\s*2\s*:)[ \t]*/g, `$1 ${s2}`);
      if (s3) nw = nw.replace(/(Session\s*3\s*:)[ \t]*/g, `$1 ${s3}`);

      const low = v.toLowerCase();
      const stripped = low.trim().replace(/:$/, "");
      if (stripped === "domain" || low.startsWith("domain:")) {
        nw = `Domain: ${dom}`;
      } else if (stripped === "batch no" || low.startsWith("batch no:")) {
        nw = `Batch No: ${batch}`;
      } else if (low.startsWith("lab access timings") && lab && !v.includes(lab)) {
        nw = `${v.replace(/\s+$/, "")}\n${lab}`;
      }

      if (s1 && /^module name\s*-\s*s1/i.test(low)) nw = nw.replace(/(Module Name\s*-\s*S1\s*\n)[\s\S]*/i, `$1${s1}`);
      if (s2 && /^module name\s*-\s*s2/i.test(low)) nw = nw.replace(/(Module Name\s*-\s*S2\s*\n)[\s\S]*/i, `$1${s2}`);
      if (s3 && /^module name\s*-\s*s3/i.test(low)) nw = nw.replace(/(Module Name\s*-\s*S3\s*\n)[\s\S]*/i, `$1${s3}`);

      if (nw !== v) anchorCell(ws, cell.row, cell.col).value = nw;
    });
  });
}

function isDayRow(ws, span, r) {
  const bv = mergedValue(ws, r, DATE_COL);
  const bStr = typeof bv === "string" ? bv : bv && bv.richText ? asText(bv) : null;
  if (bStr !== null && WEEKEND_RE.test(bStr)) return false;
  if (bStr !== null && spanAt(span, r, DATE_COL) >= 5) return false; // full-width banner
  for (const c of TOPIC_COLS) {
    const v = rawValue(ws, r, c);
    if (v !== null && v !== undefined && asText(v).trim() !== "") return true;
  }
  return false;
}

function fillDates(ws, startDate, holidays) {
  const span = buildSpanMap(ws);
  let current = startDate;
  let marked = 0;
  const maxRow = ws.rowCount;
  const maxCol = colBound(ws);

  let dataStart = 5;
  for (let r = 1; r <= maxRow; r++) {
    if (typeof rawValue(ws, r, 1) === "number") {
      dataStart = r;
      break;
    }
  }
  const headerRow = dataStart - 1;
  const noteCol = maxCol + 1;
  ws.getCell(headerRow, noteCol).value = "Remarks";

  for (let r = dataStart; r <= maxRow; r++) {
    if (!isDayRow(ws, span, r)) continue;
    while (current.getUTCDay() === 0 || current.getUTCDay() === 6) current = addDays(current, 1);
    const target = anchorCell(ws, r, DATE_COL);
    target.value = current;
    target.numFmt = "m/d/yyyy";
    if (holidays.has(ymdKey(current))) {
      ws.getCell(r, noteCol).value = `Holiday - ${holidays.get(ymdKey(current))}`;
      for (let c = 1; c <= noteCol; c++) {
        ws.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: HOLIDAY_ARGB } };
      }
      marked++;
    }
    current = addDays(current, 1);
  }
  return marked;
}

export async function generatePlanner(cfg) {
  const template = findTemplate(cfg.template_dir, cfg.domain);
  const holidays = await loadHolidays(cfg.holiday_file);
  const startDate = cfg.start_date ? parseYmd(cfg.start_date) : null;

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(template);
  const ws = wb.worksheets[0];

  fillMetadata(ws, cfg);
  let holidaysMarked = 0;
  if (startDate) holidaysMarked = fillDates(ws, startDate, holidays);

  await wb.xlsx.writeFile(cfg.out_path);
  return {
    ok: true,
    template: path.basename(template),
    out_path: cfg.out_path,
    holidays_marked: holidaysMarked,
    start_date: cfg.start_date || null,
  };
}

// --------------------------------------------------------------------------- //
// CONVERT (xlsx -> csv)
// --------------------------------------------------------------------------- //

const CSV_HEADER = [
  "batch_no", "domain", "mode", "week_no", "date", "start_time", "end_time",
  "module_name", "topic_name", "trainer_name", "trainer_email", "topic_status",
  "remarks", "batch_type", "actual_date", "date_difference",
  "date_changed_by", "date_changed_at",
];
const MODE = "offline";
const STATUS = "Planned";
const EN_DASH = "–";
const SESSION_MAPS = {
  PD: [[3, 4], [6, 7], [9, 9]],
  DV: [[3, 4], [7, 9]],
};
const DEFAULT_MAP = [[3, 4], [6, 7], [9, 9]];
const TIME_RE = /(\d{1,2})[.:](\d{2})\s*([APap][Mm])/g;

function fmtTime(h, m, ap) {
  return `${parseInt(h, 10)}:${m} ${ap.toUpperCase()}`;
}
function parseRange(text) {
  if (!text) return ["", ""];
  const hits = [...String(text).matchAll(TIME_RE)];
  if (hits.length >= 2) return [fmtTime(hits[0][1], hits[0][2], hits[0][3]), fmtTime(hits[1][1], hits[1][2], hits[1][3])];
  if (hits.length === 1) return [fmtTime(hits[0][1], hits[0][2], hits[0][3]), ""];
  return ["", ""];
}
function normalize(v) {
  if (v === null || v === undefined) return "";
  return asText(v).replace(/–/g, "-").replace(/—/g, "-").trim();
}
function splitTitle(raw) {
  const full = normalize(raw);
  const s = asText(raw);
  if (s.includes(EN_DASH)) return [s.split(EN_DASH)[0].trim(), full];
  return [full, full];
}
function trainerFor(module) {
  const m = module.toLowerCase();
  if (m.includes("soft skill")) return ["Rani", "customer.success@chipedge.com"];
  if (module === "Lab" || (m.includes("assessment") && !m.includes("quiz")))
    return ["Akanksha", "akanksha.kumbar@chipedge.com"];
  return ["Obulesu", "obulesu.b@chipedge.com"];
}

function readBatchDomain(ws) {
  let batchNo = "";
  let domain = "";
  let title = "";
  const sessions = ["", "", ""];
  for (let r = 1; r <= ws.rowCount; r++) {
    for (let c = 1; c <= colBound(ws); c++) {
      const raw = rawValue(ws, r, c);
      if (typeof raw !== "string") {
        if (!(raw && raw.richText)) continue;
      }
      const s = asText(raw).trim();
      if (!s) continue;
      const low = s.toLowerCase();
      if (low.startsWith("batch no:")) batchNo = s.split(/:(.*)/s)[1].trim();
      else if (low.startsWith("domain:")) domain = s.split(/:(.*)/s)[1].trim();
      if (low.includes("course") && s.includes("(") && s.includes(")") && !title) title = s;
      for (let i = 0; i < 3; i++) {
        const m = new RegExp(`session\\s*${i + 1}\\s*:\\s*(.+)`, "i").exec(s);
        if (m && !sessions[i]) {
          let frag = m[1].split(/\r?\n/)[0];
          frag = frag.split(/session\s*\d\s*:/i)[0];
          sessions[i] = frag.trim();
        }
      }
    }
  }
  if (!batchNo && title) {
    const m = /\(([^)]+)\)\s*$/.exec(title);
    if (m) batchNo = m[1].trim();
  }
  return { batchNo, domain, sessions };
}

function readTimes(ws, sessions, sessionCols) {
  for (let i = 0; i < sessionCols.length; i++) {
    const mcol = sessionCols[i][0];
    if (i < sessions.length && !sessions[i]) {
      const hdr = ws.getCell(4, mcol).value;
      if (typeof hdr === "string" && hdr.includes("\n")) sessions[i] = hdr.split("\n").slice(1).join("\n").trim();
    }
  }
  return sessionCols.map((_, i) => (i < sessions.length ? parseRange(sessions[i]) : ["", ""]));
}

function csvField(v) {
  const s = v === null || v === undefined ? "" : String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function convertPlannerToCsv(xlsxPath, csvPath) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);
  const ws = wb.worksheets[0];
  const span = buildSpanMap(ws);
  const { batchNo, domain, sessions } = readBatchDomain(ws);
  const sessionCols = SESSION_MAPS[(domain || "").toUpperCase()] || DEFAULT_MAP;
  const times = readTimes(ws, sessions, sessionCols);

  let remarksCol = null;
  for (let hr = 1; hr <= 6 && !remarksCol; hr++) {
    for (let c = 1; c <= colBound(ws); c++) {
      if (asText(ws.getCell(hr, c).value).trim().toLowerCase() === "remarks") {
        remarksCol = c;
        break;
      }
    }
  }

  const dayStart = times[0][0] || "7:30 AM";
  let dayEnd = "1:15 PM";
  for (let i = times.length - 1; i >= 0; i--) {
    if (times[i][1]) {
      dayEnd = times[i][1];
      break;
    }
  }

  const makeRow = (week, dateStr, start, end, module, topic, remarks = "") => {
    const [tname, temail] = trainerFor(module);
    return {
      batch_no: batchNo, domain, mode: MODE, week_no: week === null ? "" : week,
      date: dateStr, start_time: start, end_time: end, module_name: module,
      topic_name: topic, trainer_name: tname, trainer_email: temail,
      topic_status: STATUS, remarks, batch_type: "", actual_date: "",
      date_difference: "", date_changed_by: "", date_changed_at: "",
    };
  };

  const rows = [];
  const seen = new Set();
  let week = null;

  for (let r = 1; r <= ws.rowCount; r++) {
    const a = rawValue(ws, r, 1);
    if (typeof a === "number") week = Math.trunc(a);

    const b = rawValue(ws, r, DATE_COL);
    if (!(b instanceof Date)) continue;
    const dateStr = mdyStr(b);

    let remarks = "";
    if (remarksCol) {
      const rv = ws.getCell(r, remarksCol).value;
      if (rv) remarks = asText(rv).trim();
    }

    const s1Raw = mergedValue(ws, r, 3);
    if (s1Raw && spanAt(span, r, 3) >= 2 && /final assessment|self preparation/i.test(asText(s1Raw))) {
      const [module, topic] = splitTitle(s1Raw);
      const sig = `${dateStr}|${dayStart}|${module}|${topic}`;
      if (!seen.has(sig)) {
        seen.add(sig);
        rows.push(makeRow(week, dateStr, dayStart, dayEnd, module, topic, remarks));
      }
      continue;
    }

    for (let idx = 0; idx < sessionCols.length; idx++) {
      const [mcol, tcol] = sessionCols[idx];
      const [start, end] = idx < times.length ? times[idx] : ["", ""];
      let module;
      let topic;
      if (mcol === tcol) {
        const text = normalize(mergedValue(ws, r, mcol));
        if (!text) continue;
        const low = text.toLowerCase();
        if (low.includes("lab")) module = "Lab";
        else if (low.includes("quiz")) module = "Weekly Quiz";
        else module = splitTitle(mergedValue(ws, r, mcol))[0];
        topic = text;
      } else {
        const mRaw = mergedValue(ws, r, mcol);
        const tRaw = mergedValue(ws, r, tcol);
        if (!normalize(mRaw) && !normalize(tRaw)) continue;
        module = splitTitle(normalize(mRaw) ? mRaw : tRaw)[0];
        topic = normalize(tRaw) ? normalize(tRaw) : module;
      }
      const sig = `${dateStr}|${start}|${module}|${topic}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
      rows.push(makeRow(week, dateStr, start, end, module, topic, remarks));
    }
  }

  const lines = [CSV_HEADER.join(",")];
  for (const row of rows) lines.push(CSV_HEADER.map((k) => csvField(row[k])).join(","));
  fs.writeFileSync(csvPath, lines.join("\r\n") + "\r\n", "utf-8");
  return rows.length;
}
