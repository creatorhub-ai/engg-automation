import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  Paper,
  Typography,
  Button,
  Alert,
  Fade,
  Box,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  Divider,
  InputAdornment,
  TextField,
  CircularProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from "@mui/material";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";

const API_BASE =
  process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

const colorPalette = [
  "#edc7cf", "#bdd9bf", "#c7ceea", "#ffeebb", "#a4c2f4",
  "#a1eafb", "#e6c7e3", "#f7cac9", "#ffe066", "#f8b195",
  "#80ced6", "#d5f4e6", "#f0a6ca", "#b5ead7", "#ead3d7",
  "#ffe0ac", "#b3cdd1", "#eec9e6",
];

const slotDisplayMap = {
  morning: "Morning",
  evening: "Evening",
  unassigned: "Unassigned",
  Shift_1: "Morning",
  Shift_2: "Evening",
};

function parseExcelDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(value);
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(value)) {
    const [dd, mm, yyyy] = value.split(".");
    return new Date(`${yyyy}-${mm}-${dd}`);
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function toISO(d) {
  if (!(d instanceof Date)) return "";
  return d.toISOString().slice(0, 10);
}

function isOverlap(a1, a2, b1, b2) {
  return !(new Date(a2) < new Date(b1) || new Date(a1) > new Date(b2));
}

function getWeeksInRange(start, end) {
  const weeks = [];
  let cur = new Date(start);
  cur.setDate(cur.getDate() - cur.getDay());
  while (cur <= new Date(end)) {
    const y = cur.getFullYear();
    const m = cur.getMonth();
    const weekNum = Math.ceil(
      (cur.getDate() + 1 - new Date(y, m, 1).getDay()) / 7
    );
    weeks.push({
      key: `${y}-${m}-W${weekNum}`,
      year: y,
      month: cur.toLocaleString("default", { month: "short" }),
      weekNum,
      start: new Date(cur),
      end: new Date(cur.getTime() + 6 * 86400000),
    });
    cur.setDate(cur.getDate() + 7);
  }
  return weeks;
}

function getDomainFromCourse(course) {
  if (!course || typeof course !== "string") return "";
  const up = course.toUpperCase();
  if (up.startsWith("PDFT") || up.startsWith("PD")) return "PD";
  if (up.startsWith("DVFT") || up.startsWith("DV")) return "DV";
  if (up.startsWith("DFTFT") || up.startsWith("DFT")) return "DFT";
  return "";
}

/* =========================
   STRICT NON-OVERLAP PLANNER
========================= */
function planClassroomsForOffline(rows) {
  const rooms = [
    { name: "Ganga", cap: 50 },
    { name: "Yamuna", cap: 35 },
    { name: "Cauvery", cap: 35 },
  ];

  const occupancy = {};
  const plans = [];
  const unassigned = [];

  rows.forEach((r) => {
    if ((r.MODE || "").toUpperCase() !== "OFFLINE") return;

    const batch = r.COURSE;
    const start = toISO(parseExcelDate(r["A.START DATE"]));
    const end = toISO(parseExcelDate(r["A.DUE DATE"]));
    const enrolled = Number(r.ENROLLED || 0);

    let placed = false;

    for (const room of rooms) {
      if (room.cap < enrolled) continue;

      for (const slot of ["morning", "evening"]) {
        const key = `${room.name}|${slot}`;
        occupancy[key] ??= [];

        const clash = occupancy[key].some(o =>
          isOverlap(start, end, o.start, o.end)
        );

        if (!clash) {
          occupancy[key].push({ start, end });
          plans.push({
            batch_no: batch,
            classroom_name: room.name,
            slot,
            a_start: start,
            a_end: end,
            enrolled,
            capacity: room.cap,
            mode: "OFFLINE",
          });
          placed = true;
          break;
        }
      }
      if (placed) break;
    }

    if (!placed) {
      unassigned.push({
        batch_no: batch,
        a_start: start,
        a_end: end,
        enrolled,
        reason: "No free classroom without overlap",
      });

      plans.push({
        batch_no: batch,
        classroom_name: "UNASSIGNED",
        slot: "unassigned",
        a_start: start,
        a_end: end,
        enrolled,
        capacity: 0,
        mode: "OFFLINE",
      });
    }
  });

  return { plans, unassigned };
}

/* =========================
   COMPONENT START
========================= */
export default function ClassroomPlanner() {
  const [plans, setPlans] = useState([]);
  const [weeks, setWeeks] = useState([]);
  const [unassigned, setUnassigned] = useState([]);
  const [showUnassigned, setShowUnassigned] = useState(false);
  const [batchFilter, setBatchFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("ALL");
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
    const [processingStatus, setProcessingStatus] = useState("");
  const [downloadFileName, setDownloadFileName] = useState("classroom_plan.xlsx");
  const [saveStatus, setSaveStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [licenses, setLicenses] = useState([]);
  const [licenseError, setLicenseError] = useState("");

  /* =========================
     LOAD EXISTING MATRIX
  ========================= */
  const loadExistingMatrix = useCallback(async () => {
    try {
      setLoading(true);
      setProcessingStatus("Loading saved matrix...");

      const res = await fetch(`${API_BASE}/api/get-classroom-matrix`);
      if (!res.ok) {
        setProcessingStatus("No saved matrix found.");
        setPlans([]);
        setWeeks([]);
        return;
      }

      const data = await res.json();
      const { occupancyRows } = data || {};

      if (!occupancyRows?.length) {
        setProcessingStatus("No saved data.");
        setPlans([]);
        setWeeks([]);
        return;
      }

      const normalizedPlans = occupancyRows.map((r) => ({
        batch_no: r.batch_no,
        classroom_name: r.classroom_name,
        slot: r.slot,
        a_start: r.occupancy_start,
        a_end: r.occupancy_end,
        enrolled: r.enrolled || 0,
        capacity: r.capacity || 35,
        mode: "OFFLINE",
      }));

      setPlans(normalizedPlans);

      const allDates = normalizedPlans.flatMap((p) => [p.a_start, p.a_end]);
      if (allDates.length) {
        setWeeks(
          getWeeksInRange(
            allDates.reduce((a, b) => (a < b ? a : b)),
            allDates.reduce((a, b) => (a > b ? a : b))
          )
        );
      }

      setProcessingStatus(`Loaded ${occupancyRows.length} saved batches`);
    } catch (e) {
      console.error(e);
      setError("Failed to load saved matrix.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExistingMatrix();
  }, [loadExistingMatrix]);

  /* =========================
     FILTERED WEEKS (YEAR)
  ========================= */
  const availableYears = useMemo(() => {
    const s = new Set(weeks.map((w) => w.year));
    return Array.from(s).sort();
  }, [weeks]);

  const filteredWeeks = useMemo(() => {
    if (yearFilter === "ALL") return weeks;
    return weeks.filter((w) => w.year === Number(yearFilter));
  }, [weeks, yearFilter]);

  /* =========================
     CLASSROOMS
  ========================= */
  const classrooms = useMemo(() => {
    const base = new Set(plans.map((p) => p.classroom_name));
    base.add("UNASSIGNED");
    return Array.from(base);
  }, [plans]);

  /* =========================
     MATRIX TABLE
  ========================= */
  const table = useMemo(() => {
    const rows = [];

    classrooms.forEach((room) => {
      ["morning", "evening", "unassigned"].forEach((slot) => {
        const row = [room, slot];

        filteredWeeks.forEach((w) => {
          const batches = plans
            .filter(
              (p) =>
                p.classroom_name === room &&
                p.slot === slot &&
                isOverlap(
                  p.a_start,
                  p.a_end,
                  toISO(w.start),
                  toISO(w.end)
                ) &&
                p.batch_no
                  ?.toLowerCase()
                  .includes(batchFilter.toLowerCase())
            )
            .map((p) => p.batch_no);

          row.push([...new Set(batches)]);
        });

        rows.push(row);
      });
    });

    return rows;
  }, [plans, classrooms, filteredWeeks, batchFilter]);

  /* =========================
     COLOR MAP
  ========================= */
  const batchColorMap = useMemo(() => {
    const set = new Set();
    table.forEach((r) =>
      r.forEach((c) => Array.isArray(c) && c.forEach((b) => set.add(b)))
    );
    const arr = Array.from(set);
    const map = {};
    arr.forEach((b, i) => {
      map[b] = colorPalette[i % colorPalette.length];
    });
    return map;
  }, [table]);

  const batchDetailMap = useMemo(() => {
    const m = {};
    plans.forEach((p) => (m[p.batch_no] = p));
    return m;
  }, [plans]);

  /* =========================
     FILE UPLOAD
  ========================= */
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: "array" });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

    const { plans, unassigned } = planClassroomsForOffline(rows);

    setPlans(plans);
    setUnassigned(unassigned);
    setShowUnassigned(unassigned.length > 0);

    const dates = plans.flatMap((p) => [p.a_start, p.a_end]);
    if (dates.length) {
      setWeeks(
        getWeeksInRange(
          dates.reduce((a, b) => (a < b ? a : b)),
          dates.reduce((a, b) => (a > b ? a : b))
        )
      );
    }

    setLoading(false);
  };

    /* =========================
     EXPORT
  ========================= */
  const handleExport = () => {
    const wb = XLSX.utils.book_new();
    const aoa = [];

    aoa.push(["Classroom", "Slot", ...filteredWeeks.map(w => `W${w.week} (${w.year})`)]);

    table.forEach(row => {
      aoa.push([
        row[0],
        row[1],
        ...row.slice(2).map(cell => cell.join(", "))
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, "Matrix");
    XLSX.writeFile(wb, downloadFileName);
  };

  /* =========================
     RENDER
  ========================= */
  return (
    <div className="classroom-planner">

      <h2>Classroom Allocation Matrix</h2>

      {/* Upload */}
      <div className="toolbar">
        <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} />

        <button onClick={handleExport}>Export</button>

        {unassigned.length > 0 && (
          <button className="warn" onClick={() => setShowUnassigned(true)}>
            Unassigned ({unassigned.length})
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="filters">
        <label>
          Year:
          <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}>
            <option value="ALL">All</option>
            {availableYears.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </label>

        <label>
          Batch filter:
          <input
            value={batchFilter}
            onChange={e => setBatchFilter(e.target.value)}
            placeholder="Search batch"
          />
        </label>
      </div>

      {/* Matrix */}
      <div className="matrix-wrapper">
        <table className="matrix">
          <thead>
            <tr>
              <th>Classroom</th>
              <th>Slot</th>
              {filteredWeeks.map(w => (
                <th key={w.key}>
                  W{w.week}
                  <div className="year">{w.year}</div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {table.map((row, i) => (
              <tr key={i}>
                <td>{row[0]}</td>
                <td>{row[1]}</td>
                {row.slice(2).map((cell, ci) => (
                  <td key={ci}>
                    {cell.map(b => (
                      <div
                        key={b}
                        className="batch-chip"
                        style={{ background: batchColorMap[b] }}
                        title={JSON.stringify(batchDetailMap[b], null, 2)}
                      >
                        {b}
                      </div>
                    ))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Unassigned Popup */}
      {showUnassigned && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>Unassigned Batches</h3>

            <table className="unassigned-table">
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Enrolled</th>
                </tr>
              </thead>
              <tbody>
                {unassigned.map((u, i) => (
                  <tr key={i}>
                    <td>{u.batch_no}</td>
                    <td>{u.a_start}</td>
                    <td>{u.a_end}</td>
                    <td>{u.enrolled}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button onClick={() => setShowUnassigned(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

