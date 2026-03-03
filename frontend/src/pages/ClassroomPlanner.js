import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
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
} from "@mui/material";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";

const API_BASE =
  process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

const colorPalette = [
  "#edc7cf","#bdd9bf","#c7ceea","#ffeebb","#a4c2f4","#a1eafb",
  "#e6c7e3","#f7cac9","#ffe066","#f8b195","#80ced6","#d5f4e6",
  "#f0a6ca","#b5ead7","#ead3d7","#ffe0ac","#b3cdd1","#eec9e6",
];

const slotDisplayMap = {
  morning: "morning",
  evening: "evening",
  Shift_1: "morning",
  Shift_2: "evening",
};

// ─────────────────────────────────────────────────────────────────────────────
// Compute batch occupancy end = A.START DATE + 5 months + 2 weeks.
// A.DUE DATE is stored for reference only; classroom allocation ignores it.
// ─────────────────────────────────────────────────────────────────────────────
function computeOccupancyEnd(startDate) {
  if (!(startDate instanceof Date) || isNaN(startDate.getTime())) return null;
  const d = new Date(startDate);
  d.setMonth(d.getMonth() + 5);  // +5 months
  d.setDate(d.getDate() + 14);   // +2 weeks
  return d;
}

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

function toIsoDateString(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function getWeeksInRange(start, end) {
  const startDate = new Date(start);
  const endDate   = new Date(end);
  const weeks     = [];
  let cur = new Date(startDate);
  cur.setDate(cur.getDate() - cur.getDay());
  while (cur <= endDate) {
    const y = cur.getFullYear();
    const m = cur.getMonth();
    const weekNum = Math.ceil((cur.getDate() + 1 - new Date(y, m, 1).getDay()) / 7);
    weeks.push({
      year: y,
      month: cur.toLocaleString("default", { month: "long" }),
      monthNum: m,
      weekNum,
      weekStart: new Date(cur),
      key: `${y}-${m + 1}-W${weekNum}`,
    });
    cur.setDate(cur.getDate() + 7);
  }
  return weeks;
}

function isDateOverlap(start1, end1, start2, end2) {
  const s1 = new Date(start1), e1 = new Date(end1);
  const s2 = new Date(start2), e2 = new Date(end2);
  if (isNaN(s1) || isNaN(e1) || isNaN(s2) || isNaN(e2)) return true;
  return s1 <= e2 && s2 <= e1;
}

function normalizeRowKeys(row) {
  const out = {};
  Object.keys(row).forEach((k) => { out[k.trim()] = row[k]; });
  return out;
}

function getDomainFromCourse(course) {
  if (!course || typeof course !== "string") return "";
  const up = course.toUpperCase();
  if (up.startsWith("DFTFT") || up.startsWith("DFT")) return "DFT";
  if (up.startsWith("DVFT")  || up.startsWith("DV"))  return "DV";
  if (up.startsWith("PDFT")  || up.startsWith("PD"))  return "PD";
  return "";
}

// ─────────────────────────────────────────────────────────────────────────────
// planClassroomsForOffline
// occupancy end = A.START DATE + 5 months + 2 weeks (ignores A.DUE DATE)
// ─────────────────────────────────────────────────────────────────────────────
function planClassroomsForOffline(rows) {
  const classrooms = [
    { name: "Ganga",   capacity: 50 },
    { name: "Yamuna",  capacity: 35 },
    { name: "Cauvery", capacity: 35 },
  ];
  const shifts         = ["morning", "evening"];
  const plans          = [];
  const unallocated    = [];
  const occupancyIndex = {};

  const filteredRows = rows
    .map(normalizeRowKeys)
    .filter((row) => {
      const mode = typeof row["MODE"] === "string" ? row["MODE"].trim().toUpperCase() : "";
      return row["COURSE"] && mode === "OFFLINE" && parseExcelDate(row["A.START DATE"]);
    });

  filteredRows.sort((a, b) => {
    const diff = parseExcelDate(a["A.START DATE"]) - parseExcelDate(b["A.START DATE"]);
    if (diff !== 0) return diff;
    const aOcc = computeOccupancyEnd(parseExcelDate(a["A.START DATE"]));
    const bOcc = computeOccupancyEnd(parseExcelDate(b["A.START DATE"]));
    const endDiff = (aOcc ? aOcc.getTime() : 0) - (bOcc ? bOcc.getTime() : 0);
    if (endDiff !== 0) return endDiff;
    return (a["COURSE"] || "").localeCompare(b["COURSE"] || "");
  });

  filteredRows.forEach((row) => {
    const course   = row["COURSE"];
    const startDt  = parseExcelDate(row["A.START DATE"]);
    const aStart   = toIsoDateString(startDt);
    const dueDt    = parseExcelDate(row["A.DUE DATE"]);
    const aEnd     = toIsoDateString(dueDt);       // original due date (display only)
    const occEndDt = computeOccupancyEnd(startDt);
    const occEnd   = toIsoDateString(occEndDt);    // 5m+2w — used for room allocation

    const enrolled = Number(row["ENROLLED"] || 0);
    const capacity = Number(row["CAPACITY"] || 0);

    if (enrolled > capacity) {
      plans.push({
        batch_no: course, mode: "OFFLINE",
        a_start: aStart, a_end: aEnd, occupancy_end: occEnd,
        enrolled, capacity,
        classroom_name: "", slot: "", isAllocated: false,
        trainer_name: "UNASSIGNED", module_trainers: [],
      });
      unallocated.push({ batch_no: course, enrolled, a_start: aStart, a_end: aEnd, occupancy_end: occEnd });
      return;
    }

    let allocated    = false;
    let assignedRoom = "";
    let assignedSlot = "";

    for (const room of classrooms) {
      if (enrolled > room.capacity) continue;
      for (const slot of shifts) {
        const key = `${room.name}|${slot}`;
        if (!occupancyIndex[key]) occupancyIndex[key] = [];
        const overlap = occupancyIndex[key].some((b) =>
          isDateOverlap(aStart, occEnd, b.start, b.end)
        );
        if (!overlap) {
          assignedRoom = `${room.name} [${room.capacity}]`;
          assignedSlot = slot;
          occupancyIndex[key].push({ start: aStart, end: occEnd, course });
          allocated = true;
          break;
        }
      }
      if (allocated) break;
    }

    if (!allocated) {
      unallocated.push({ batch_no: course, enrolled, a_start: aStart, a_end: aEnd, occupancy_end: occEnd });
    }

    plans.push({
      batch_no: course, mode: "OFFLINE",
      a_start: aStart, a_end: aEnd, occupancy_end: occEnd,
      enrolled, capacity,
      classroom_name: assignedRoom, slot: assignedSlot,
      isAllocated: allocated,
      trainer_name: "UNASSIGNED", module_trainers: [],
    });
  });

  return { plans, unallocated };
}

function getBatchColorMap(allMatrixTable) {
  const batchSet = new Set();
  allMatrixTable.forEach((row) =>
    row.forEach((cell) => { if (Array.isArray(cell)) cell.forEach((bn) => batchSet.add(bn)); })
  );
  const map = {};
  Array.from(batchSet).filter(Boolean).sort().forEach((bn, idx) => {
    map[bn] = colorPalette[idx % colorPalette.length];
  });
  return map;
}

function hexToRGB(hex) {
  const c = hex.replace("#", "");
  return {
    r: parseInt(c.slice(0,2),16),
    g: parseInt(c.slice(2,4),16),
    b: parseInt(c.slice(4,6),16),
  };
}

export default function ClassroomPlanner() {
  const [plans,              setPlans]              = useState([]);
  const [weeks,              setWeeks]              = useState([]);
  const [error,              setError]              = useState("");
  const [loading,            setLoading]            = useState(false);
  const [processingStatus,   setProcessingStatus]   = useState("");
  const [selectedBatch,      setSelectedBatch]      = useState(null);
  const [downloadFileName,   setDownloadFileName]   = useState("classroom_plan.xlsx");
  const [saveStatus,         setSaveStatus]         = useState("");
  const [saving,             setSaving]             = useState(false);
  const [licenses,           setLicenses]           = useState([]);
  const [licenseError,       setLicenseError]       = useState("");
  const [unallocatedBatches, setUnallocatedBatches] = useState([]);
  const [trainerOverlapInfo, setTrainerOverlapInfo] = useState({});

  // Tracks whether there is valid in-memory data so a silent reload
  // failure after save does NOT wipe what the user sees.
  const hasInMemoryData = useRef(false);

  // ── computeAndSetWeeks ────────────────────────────────────────────────
  const computeAndSetWeeks = useCallback((normalizedPlans) => {
    const allDates = normalizedPlans
      .flatMap((p) => [p.a_start, p.occupancy_end || p.a_end])
      .filter(Boolean);
    if (allDates.length) {
      setWeeks(getWeeksInRange(
        allDates.reduce((a, b) => (a < b ? a : b)),
        allDates.reduce((a, b) => (a > b ? a : b))
      ));
    } else {
      setWeeks([]);
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // loadExistingMatrix
  //
  // silent=false (default) → initial page load.
  //   Shows loading spinner. Wipes state on empty/error (nothing to show).
  //
  // silent=true → called after Save Matrix.
  //   No spinner, no state wipe on failure.
  //   Only updates state when DB returns valid rows (so data stays visible
  //   even if the column `a_end` doesn't exist yet in the DB schema).
  // ─────────────────────────────────────────────────────────────────────────
  const loadExistingMatrix = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
        setProcessingStatus("Loading saved matrix...");
      }

      const res = await fetch(`${API_BASE}/api/get-classroom-matrix`);

      if (!res.ok) {
        if (!silent) {
          setProcessingStatus("No saved matrix found.");
          if (!hasInMemoryData.current) {
            setPlans([]); setWeeks([]); setUnallocatedBatches([]); setTrainerOverlapInfo({});
          }
        }
        return;
      }

      const data = await res.json();
      const { occupancyRows } = data || {};

      if (!occupancyRows?.length) {
        if (!silent) {
          setProcessingStatus("No saved data.");
          if (!hasInMemoryData.current) {
            setPlans([]); setWeeks([]); setUnallocatedBatches([]); setTrainerOverlapInfo({});
          }
        }
        return;
      }

      const sortedRows = [...occupancyRows].sort((a, b) => {
        const sa = a.occupancy_start || "", sb = b.occupancy_start || "";
        if (sa !== sb) return sa.localeCompare(sb);
        const ea = a.occupancy_end || "", eb = b.occupancy_end || "";
        if (ea !== eb) return ea.localeCompare(eb);
        return (a.batch_no || "").localeCompare(b.batch_no || "");
      });

      const batchNos = sortedRows.map((r) => r.batch_no).filter(Boolean);

      let moduleTrainerMap = {};
      let savedOverlapInfo = {};
      try {
        const mtRes = await fetch(`${API_BASE}/api/get-batch-module-trainers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ batch_nos: batchNos }),
        });
        if (mtRes.ok) {
          const mtData     = await mtRes.json();
          moduleTrainerMap = mtData.moduleTrainerMap || {};
          savedOverlapInfo = mtData.overlapInfo      || {};
        }
      } catch (e) {
        console.warn("Could not fetch module trainers (non-fatal):", e);
      }

      const normalizedPlans = sortedRows.map((r) => {
        const moduleTrainers = moduleTrainerMap[r.batch_no] || [];
        const primaryTrainer =
          moduleTrainers.find((mt) => mt.trainer_name && mt.trainer_name !== "UNASSIGNED")
            ?.trainer_name || r.trainer_name || "UNASSIGNED";

        // Use DB-stored occupancy_end; compute if absent (backward compat)
        const occEnd =
          r.occupancy_end ||
          toIsoDateString(computeOccupancyEnd(parseExcelDate(r.occupancy_start)));

        return {
          batch_no:        r.batch_no,
          classroom_name:  r.classroom_name || "",
          slot:            r.slot           || "",
          a_start:         r.occupancy_start,
          a_end:           r.a_end          || "",
          occupancy_end:   occEnd,
          enrolled:        r.enrolled       || 0,
          capacity:        r.capacity       || r.enrolled || 0,
          mode:            "OFFLINE",
          trainer_name:    primaryTrainer,
          module_trainers: moduleTrainers,
        };
      });

      const unallocated = normalizedPlans.filter((p) => !p.classroom_name || !p.slot);

      // Successfully got DB data — update all state
      hasInMemoryData.current = true;
      setPlans(normalizedPlans);
      setUnallocatedBatches(unallocated.map((p) => ({
        batch_no:      p.batch_no,
        enrolled:      p.enrolled,
        a_start:       p.a_start,
        a_end:         p.a_end,
        occupancy_end: p.occupancy_end,
      })));
      setTrainerOverlapInfo(savedOverlapInfo);
      computeAndSetWeeks(normalizedPlans);

      if (!silent) {
        setProcessingStatus(`Loaded ${occupancyRows.length} saved batches.`);
      }
    } catch (e) {
      console.error("loadExistingMatrix error", e);
      if (!silent) {
        setProcessingStatus("Error loading saved matrix.");
      }
      // On silent reload failure, leave existing in-memory state untouched
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [computeAndSetWeeks]);

  useEffect(() => {
    const loadLicenses = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/licenses`);
        if (!res.ok) return;
        const data = await res.json();
        setLicenses(Array.isArray(data) ? data : data.licenses || []);
      } catch (e) {
        console.error("loadLicenses error", e);
        setLicenseError("Failed to load licenses.");
      }
    };
    loadExistingMatrix(false);  // initial load — show spinner
    loadLicenses();
  }, [loadExistingMatrix]);

  // ── Derived state ──────────────────────────────────────────────────────
  const classrooms = useMemo(() => {
    const rooms = [...new Set(
      plans.filter((p) => p.classroom_name && p.slot).map((p) => p.classroom_name)
    )];
    if (unallocatedBatches.length > 0) rooms.push("UNALLOCATED");
    return rooms;
  }, [plans, unallocatedBatches]);

  const slots = ["morning", "evening"];

  const table = useMemo(() => {
    const t = [];
    classrooms.forEach((room) => {
      const roomSlots = room === "UNALLOCATED" ? ["-"] : slots;
      roomSlots.forEach((slot) => {
        const row = [room, slot];
        weeks.forEach((week) => {
          const weekStart = week.weekStart;
          const weekEnd   = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 6);
          const startIso  = weekStart.toISOString().slice(0, 10);
          const endIso    = weekEnd.toISOString().slice(0, 10);

          let batches = [];
          if (room === "UNALLOCATED") {
            batches = unallocatedBatches
              .filter((p) => isDateOverlap(p.a_start, p.occupancy_end || p.a_end, startIso, endIso))
              .map((p) => p.batch_no);
          } else {
            batches = plans
              .filter((p) =>
                p.classroom_name === room &&
                p.slot === slot &&
                isDateOverlap(p.a_start, p.occupancy_end || p.a_end, startIso, endIso)
              )
              .map((p) => p.batch_no);
          }
          row.push(batches.filter(Boolean));
        });
        t.push(row);
      });
    });
    return t;
  }, [classrooms, slots, weeks, plans, unallocatedBatches]);

  const trainers = useMemo(() => {
    const unique      = new Set();
    let hasUnassigned = false;
    plans.forEach((p) => {
      if (p.module_trainers?.length) {
        p.module_trainers.forEach((mt) => {
          if (mt.trainer_name && mt.trainer_name !== "UNASSIGNED") unique.add(mt.trainer_name);
          else hasUnassigned = true;
        });
      } else {
        if (p.trainer_name && p.trainer_name !== "UNASSIGNED") unique.add(p.trainer_name);
        else hasUnassigned = true;
      }
    });
    const sorted = Array.from(unique).sort();
    if (hasUnassigned) sorted.push("UNASSIGNED");
    return sorted;
  }, [plans]);

  const trainerTable = useMemo(() => {
    return trainers.map((trainer) => {
      const row = [trainer];
      weeks.forEach((week) => {
        const weekStart = week.weekStart;
        const weekEnd   = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const startIso  = weekStart.toISOString().slice(0, 10);
        const endIso    = weekEnd.toISOString().slice(0, 10);
        const batches   = plans
          .filter((p) => {
            if (!isDateOverlap(p.a_start, p.occupancy_end || p.a_end, startIso, endIso)) return false;
            if (p.module_trainers?.length)
              return p.module_trainers.some((mt) => mt.trainer_name === trainer);
            return (p.trainer_name || "UNASSIGNED") === trainer;
          })
          .map((p) => p.batch_no);
        row.push(batches.filter(Boolean));
      });
      return row;
    });
  }, [trainers, weeks, plans]);

  const batchColorMap        = useMemo(() => getBatchColorMap(table),        [table]);
  const trainerBatchColorMap = useMemo(() => getBatchColorMap(trainerTable), [trainerTable]);

  const batchDetailMap = useMemo(() => {
    const m = {};
    plans.forEach((p) => { m[p.batch_no] = p; });
    return m;
  }, [plans]);

  const getLicenseInfoForBatch = (batchNo, classroomCapacity, enrolled) => {
    const domain = getDomainFromCourse(batchNo);
    if (!domain || !Array.isArray(licenses)) return [];
    const domainLicenses = licenses.filter(
      (l) => (l.domain || "").toString().toUpperCase() === domain
    );
    if (!domainLicenses.length) return [];
    return domainLicenses.map((lic) => {
      const licenseCount     = Number(lic.count || 0);
      const required         = Math.max(Number(enrolled || 0), Number(classroomCapacity || 0));
      const additionalNeeded = Math.max(0, required - licenseCount);
      return { license_name: lic.license_name, count: licenseCount, required, additional_needed: additionalNeeded };
    });
  };

  const handleBatchClick = (batch) => {
    if (!batch) return;
    const base = batchDetailMap[batch];
    if (!base) { setSelectedBatch(null); return; }
    setSelectedBatch({
      ...base,
      licenseInfo: getLicenseInfoForBatch(base.batch_no, base.capacity, base.enrolled),
    });
  };

  const fetchModuleTrainersForBatches = async (batchNos, offlinePlans) => {
    try {
      const batch_date_ranges = {};
      (offlinePlans || []).forEach((p) => {
        if (p.batch_no && p.a_start && p.occupancy_end) {
          batch_date_ranges[p.batch_no] = { start: p.a_start, end: p.occupancy_end };
        }
      });
      const res = await fetch(`${API_BASE}/api/assign-batch-trainers-by-module`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch_nos: batchNos, batch_date_ranges }),
      });
      if (!res.ok) return { moduleTrainerMap: {}, overlapInfo: {} };
      const data = await res.json();
      return { moduleTrainerMap: data.moduleTrainerMap || {}, overlapInfo: data.overlapInfo || {} };
    } catch (e) {
      console.error("fetchModuleTrainersForBatches error:", e);
      return { moduleTrainerMap: {}, overlapInfo: {} };
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError("");
    setProcessingStatus("Reading file...");
    setPlans([]); setWeeks([]); setSelectedBatch(null); setSaveStatus(""); setTrainerOverlapInfo({});
    hasInMemoryData.current = false;
    try {
      const wb   = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "", raw: false });

      setProcessingStatus("Allocating classrooms (5 months + 2 weeks from start date)...");
      const { plans: offlinePlans, unallocated } = planClassroomsForOffline(rows);

      setProcessingStatus("Assigning trainers per module type...");
      const batchNos = offlinePlans.map((p) => p.batch_no).filter(Boolean);
      const { moduleTrainerMap, overlapInfo } = await fetchModuleTrainersForBatches(batchNos, offlinePlans);
      setTrainerOverlapInfo(overlapInfo);

      const enrichedPlans = offlinePlans.map((p) => {
        const moduleTrainers = moduleTrainerMap[p.batch_no] || [];
        return {
          ...p,
          trainer_name: moduleTrainers.find((mt) => mt.trainer_name && mt.trainer_name !== "UNASSIGNED")
            ?.trainer_name || "UNASSIGNED",
          module_trainers: moduleTrainers,
        };
      });

      const sortedPlans = [...enrichedPlans].sort((a, b) => {
        if (a.a_start !== b.a_start) return a.a_start.localeCompare(b.a_start);
        const ae = a.occupancy_end || a.a_end || "";
        const be = b.occupancy_end || b.a_end || "";
        if (ae !== be) return ae.localeCompare(be);
        return (a.batch_no || "").localeCompare(b.batch_no || "");
      });

      hasInMemoryData.current = true;
      setPlans(sortedPlans);
      setUnallocatedBatches(
        [...unallocated]
          .sort((a, b) => (a.a_start || "").localeCompare(b.a_start || ""))
          .map((u) => ({
            batch_no:      u.batch_no,
            enrolled:      u.enrolled,
            a_start:       u.a_start,
            a_end:         u.a_end,
            occupancy_end: u.occupancy_end,
          }))
      );

      if (!offlinePlans.length) {
        setError("No OFFLINE batches found in the file.");
      } else {
        const allDates = offlinePlans
          .flatMap((p) => [p.a_start, p.occupancy_end || p.a_end])
          .filter(Boolean);
        if (allDates.length) {
          setWeeks(getWeeksInRange(
            allDates.reduce((a, b) => (a < b ? a : b)),
            allDates.reduce((a, b) => (a > b ? a : b))
          ));
        }
        setProcessingStatus(
          `Completed! Planned ${offlinePlans.length} OFFLINE batches (occupancy = start + 5 months + 2 weeks).`
        );
      }
    } catch (err) {
      console.error("File processing error:", err);
      setError(`Failed to process file: ${err.message || "Invalid file format"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadXlsx = async () => {
    if (!plans.length) { setError("No data to export."); return; }
    try {
      const workbook = new ExcelJS.Workbook();

      // ── Classroom Matrix sheet ──
      const matrixSheet = workbook.addWorksheet("Classroom Matrix");
      matrixSheet.addRow(["Classroom", "Slot", ...weeks.map((w) => `${w.month} W${w.weekNum}`)]);
      const mh = matrixSheet.getRow(1);
      mh.font      = { bold: true, color: { argb: "FFFFFFFF" } };
      mh.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF333333" } };
      mh.alignment = { horizontal: "center", vertical: "center", wrapText: true };

      table.forEach((row) => {
        const outRow = row.map((cell, idx) =>
          idx < 2
            ? (idx === 1 ? slotDisplayMap[cell] || cell : cell)
            : (Array.isArray(cell) ? cell.join(", ") : "")
        );
        const excelRow = matrixSheet.addRow(outRow);
        row.forEach((cell, colIdx) => {
          if (colIdx >= 2 && Array.isArray(cell) && cell.length > 0) {
            const hexColor = batchColorMap[cell[0]];
            if (hexColor) {
              const rgb  = hexToRGB(hexColor);
              const argb = `FF${rgb.r.toString(16).padStart(2,"0")}${rgb.g.toString(16).padStart(2,"0")}${rgb.b.toString(16).padStart(2,"0")}`.toUpperCase();
              const ec   = excelRow.getCell(colIdx + 1);
              ec.fill      = { type: "pattern", pattern: "solid", fgColor: { argb } };
              ec.font      = { bold: true, color: { argb: "FF222222" } };
              ec.alignment = { horizontal: "center", vertical: "center", wrapText: true };
            }
          }
        });
        excelRow.getCell(1).font      = { bold: true };
        excelRow.getCell(2).alignment = { horizontal: "center", vertical: "center" };
      });
      matrixSheet.columns = [{ width: 20 }, { width: 12 }, ...weeks.map(() => ({ width: 18 }))];

      // ── Offline Plans sheet ──
      const plansSheet = workbook.addWorksheet("Offline Plans");
      plansSheet.addRow([
        "COURSE","MODE","A.START DATE","A.DUE DATE","OCCUPANCY_END (5m+2w)",
        "CAPACITY","ENROLLED",
        "HAS_SUFFICIENT_CAPACITY","LICENSE_ADDITIONAL_NEEDED",
        "CLASSROOM_NAME","SLOT","MODULE_TYPE","TRAINER",
      ]);
      const ph = plansSheet.getRow(1);
      ph.font      = { bold: true, color: { argb: "FFFFFFFF" } };
      ph.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF333333" } };
      ph.alignment = { horizontal: "center", vertical: "center", wrapText: true };

      [...plans]
        .sort((a, b) => {
          if (a.a_start !== b.a_start) return (a.a_start||"").localeCompare(b.a_start||"");
          const ae = a.occupancy_end||a.a_end||"", be = b.occupancy_end||b.a_end||"";
          if (ae !== be) return ae.localeCompare(be);
          return (a.batch_no||"").localeCompare(b.batch_no||"");
        })
        .forEach((p) => {
          const li       = getLicenseInfoForBatch(p.batch_no, p.capacity, p.enrolled);
          const shortage = li.reduce((s, l) => s + (l.additional_needed || 0), 0);
          const occEnd   = p.occupancy_end || "";

          if (p.module_trainers?.length) {
            p.module_trainers.forEach((mt, idx) => {
              plansSheet.addRow([
                idx === 0 ? p.batch_no    : "",
                idx === 0 ? p.mode        : "",
                idx === 0 ? p.a_start     : "",
                idx === 0 ? p.a_end       : "",
                idx === 0 ? occEnd        : "",
                idx === 0 ? p.capacity    : "",
                idx === 0 ? p.enrolled    : "",
                idx === 0 ? (shortage === 0 ? "YES" : "NO") : "",
                idx === 0 ? shortage      : "",
                idx === 0 ? p.classroom_name : "",
                idx === 0 ? p.slot        : "",
                mt.module_type            || "",
                mt.trainer_name           || "UNASSIGNED",
              ]);
            });
          } else {
            plansSheet.addRow([
              p.batch_no, p.mode, p.a_start, p.a_end, occEnd,
              p.capacity, p.enrolled,
              shortage === 0 ? "YES" : "NO", shortage,
              p.classroom_name, p.slot, "", p.trainer_name || "UNASSIGNED",
            ]);
          }
        });

      plansSheet.columns = [
        {width:15},{width:12},{width:15},{width:15},{width:20},
        {width:12},{width:12},{width:20},{width:25},{width:20},{width:12},{width:15},{width:20},
      ];

      const buffer = await workbook.xlsx.writeBuffer();
      const blob   = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url    = window.URL.createObjectURL(blob);
      const link   = document.createElement("a");
      link.href = url; link.download = downloadFileName || "classroom_plan.xlsx"; link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download error:", err);
      setError(`Failed to download: ${err.message}`);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // handleSaveMatrix
  //
  // ROOT CAUSE FIX:
  //   Before this fix, after a successful save the code called
  //   `await loadExistingMatrix()` which:
  //     1. Set loading=true → hid the matrix ("Upload a file..." message showed)
  //     2. If a_end column didn't exist in DB, Supabase returned an error
  //        → setPlans([]) wipeout
  //     3. Even on success, there was a flash of empty state
  //
  //   Now:
  //     - Save sends payload WITHOUT a_end (avoids unknown-column DB errors)
  //     - State is NOT wiped after save — in-memory plans stay visible
  //     - A silent background reload is fired (silent=true) that updates
  //       state from DB only on success, never wipes on failure
  // ─────────────────────────────────────────────────────────────────────────
  const handleSaveMatrix = async () => {
    if (!plans.length && !unallocatedBatches.length) { setError("No matrix to save."); return; }
    setSaving(true); setSaveStatus(""); setError("");
    try {
      const allRows = [
        ...plans,
        ...unallocatedBatches.map((u) => ({
          batch_no:       u.batch_no,
          classroom_name: null,
          slot:           null,
          a_start:        u.a_start,
          a_end:          u.a_end,
          occupancy_end:  u.occupancy_end,
          enrolled:       u.enrolled,
          capacity:       u.capacity || 0,
          trainer_name:   null,
          module_trainers: [],
        })),
      ].sort((a, b) => {
        const sa = a.a_start||"", sb = b.a_start||"";
        if (sa !== sb) return sa.localeCompare(sb);
        const ea = a.occupancy_end||a.a_end||"", eb = b.occupancy_end||b.a_end||"";
        if (ea !== eb) return ea.localeCompare(eb);
        return (a.batch_no||"").localeCompare(b.batch_no||"");
      });

      // NOTE: we intentionally omit `a_end` from the payload so the save
      // does not break if the `a_end` column has not yet been added to the
      // classroom_occupancy table. occupancy_end (5m+2w) is what matters.
      const occupancyRows = allRows.map((p) => ({
        batch_no:        p.batch_no?.trim(),
        classroom_name:  p.classroom_name  || null,
        slot:            p.slot            || null,
        occupancy_start: p.a_start,
        occupancy_end:   p.occupancy_end   || p.a_end || null,
        enrolled:        p.enrolled        || 0,
        capacity:        p.capacity        || p.enrolled || 0,
        trainer_name:    p.trainer_name    || null,
        module_trainers: p.module_trainers || [],
        overlap_info:    trainerOverlapInfo[p.batch_no] || [],
      }));

      const res  = await fetch(`${API_BASE}/api/save-classroom-matrix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ occupancyRows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      const { inserted, updated, skipped } = data.summary || {};
      setSaveStatus(`✅ ${inserted||0} NEW + ${updated||0} UPDATED + ${skipped||0} unchanged`);

      // Silent background refresh — will update state from DB if it succeeds,
      // but NEVER wipes plans/weeks/trainers if it fails or returns empty.
      loadExistingMatrix(true);

    } catch (err) {
      console.error("Save error:", err);
      setError(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const getWorstLicenseShortfall = (licenseInfo = []) =>
    licenseInfo.reduce(
      (max, cur) => (cur.additional_needed > (max?.additional_needed || 0) ? cur : max),
      { additional_needed: 0 }
    );

  // ── RENDER ───────────────────────────────────────────────────────────────
  return (
    <Box sx={{ maxWidth: "98vw", mx: "auto", my: 4 }}>
      {/* ── Controls ── */}
      <Paper elevation={5} sx={{ p: 4, borderRadius: 3, mb: 4 }}>
        <Typography variant="h4" color="primary" gutterBottom>Classroom Planner</Typography>
        <Divider sx={{ mb: 3 }} />
        <Box sx={{ mb: 3, display: "flex", flexDirection: "column", gap: 2 }}>
          <Typography variant="subtitle1">
            Upload CSV or XLSX with columns: COURSE, MODE, A.START DATE, A.DUE DATE, CAPACITY,
            ENROLLED. Only MODE = OFFLINE rows are planned.{" "}
            <strong>Classroom occupancy is calculated as A.START DATE + 5 months + 2 weeks</strong>{" "}
            (A.DUE DATE is stored for reference only). Trainers are assigned per module type
            (BASIC, CORE_THEORY, CORE_LAB).
          </Typography>
          <Button variant="contained" component="label" disabled={loading}>
            {loading ? <CircularProgress size={24} /> : "Upload File"}
            <input
              type="file"
              hidden
              accept=".csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={handleFileUpload}
              disabled={loading}
            />
          </Button>
          <TextField
            label="Download file name"
            value={downloadFileName}
            onChange={(e) => setDownloadFileName(e.target.value)}
            fullWidth
            disabled={loading}
            InputProps={{ endAdornment: <InputAdornment position="end">.xlsx</InputAdornment> }}
          />
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, my: 2, flexWrap: "wrap" }}>
          <Typography variant="subtitle1">Actions:</Typography>
          <Button
            variant="contained"
            color="success"
            onClick={handleDownloadXlsx}
            disabled={loading || !plans.length}
          >
            Download XLSX
          </Button>
          <Button
            variant="outlined"
            color="primary"
            onClick={handleSaveMatrix}
            disabled={loading || saving || !plans.length}
          >
            {saving ? <CircularProgress size={20} /> : "Save Matrix"}
          </Button>
          {saveStatus && (
            <Chip label={saveStatus} color="success" variant="filled" sx={{ ml: 1 }} />
          )}
        </Box>

        {loading && (
          <Box sx={{ display:"flex", alignItems:"center", gap:2, mt:2, p:2, bgcolor:"primary.main", color:"white", borderRadius:2 }}>
            <CircularProgress size={20} color="inherit" />
            <Typography variant="body1" fontWeight="bold">{processingStatus || "Processing..."}</Typography>
          </Box>
        )}
        {!loading && processingStatus && (
          <Chip label={processingStatus} color="info" variant="outlined" sx={{ mt: 2 }} />
        )}

        <Fade in={!!error}>
          <Box>{error && <Alert severity="error" sx={{ mt: 3 }}>{error}</Alert>}</Box>
        </Fade>
        {licenseError && <Alert severity="warning" sx={{ mt: 2 }}>{licenseError}</Alert>}

        {/* Batch detail popup */}
        <Fade in={!!selectedBatch}>
          <Box sx={{ mt: 3 }}>
            {selectedBatch && (
              <Alert severity="info" variant="outlined">
                <Typography variant="subtitle1" fontWeight="bold">
                  Batch Details: {selectedBatch.batch_no}
                </Typography>
                <Box sx={{ mt: 1 }}>
                  <Typography variant="body2">
                    Capacity: {selectedBatch.capacity} | Enrolled: {selectedBatch.enrolled}
                  </Typography>
                  <Typography variant="body2">
                    Start Date: {selectedBatch.a_start} | Due Date: {selectedBatch.a_end || "—"}
                  </Typography>
                  <Typography variant="body2" color="primary.main" fontWeight={600}>
                    Occupancy End (5m+2w): {selectedBatch.occupancy_end || "—"}
                  </Typography>
                  <Typography variant="body2">
                    Classroom: {selectedBatch.classroom_name || "Not assigned"} | Slot:{" "}
                    {slotDisplayMap[selectedBatch.slot] || selectedBatch.slot || "Not assigned"}
                  </Typography>
                  {selectedBatch.module_trainers?.length > 0 ? (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="body2" fontWeight="bold">Trainers by Module Type:</Typography>
                      <TableContainer component={Paper} sx={{ maxWidth: 480, mt: 0.5 }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Module Type</TableCell>
                              <TableCell>Module Name</TableCell>
                              <TableCell>Trainer</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {selectedBatch.module_trainers.map((mt, idx) => (
                              <TableRow key={idx}>
                                <TableCell>
                                  <Chip
                                    label={mt.module_type}
                                    size="small"
                                    color={
                                      mt.module_type === "CORE_THEORY" ? "primary" :
                                      mt.module_type === "CORE_LAB"    ? "secondary" : "default"
                                    }
                                  />
                                </TableCell>
                                <TableCell>{mt.module_name || "-"}</TableCell>
                                <TableCell
                                  sx={{
                                    color: mt.trainer_name === "UNASSIGNED" ? "error.main" : "success.main",
                                    fontWeight: 600,
                                  }}
                                >
                                  {mt.trainer_name || "UNASSIGNED"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  ) : (
                    <Typography variant="body2">
                      Trainer: {selectedBatch.trainer_name || "UNASSIGNED"}
                    </Typography>
                  )}
                </Box>
                {selectedBatch.licenseInfo?.length > 0 && (() => {
                  const worst      = getWorstLicenseShortfall(selectedBatch.licenseInfo);
                  const totalShort = selectedBatch.licenseInfo.reduce((s, c) => s + (c.additional_needed||0), 0);
                  return (
                    <Box sx={{ mt: 2 }}>
                      <Typography
                        variant="body2"
                        fontWeight="bold"
                        color={totalShort <= 0 ? "success.main" : "error.main"}
                      >
                        License Status:{" "}
                        {totalShort <= 0
                          ? "All licenses are sufficient for this batch."
                          : `Insufficient: ${worst.license_name} (have ${worst.count}, need ${worst.count + worst.additional_needed}).`}
                      </Typography>
                      <TableContainer component={Paper} sx={{ maxWidth: 480, mt: 1 }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>License Name</TableCell>
                              <TableCell>Count</TableCell>
                              <TableCell>Additional Needed</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {selectedBatch.licenseInfo.map((lic) => (
                              <TableRow key={lic.license_name}>
                                <TableCell>{lic.license_name}</TableCell>
                                <TableCell>{lic.count}</TableCell>
                                <TableCell sx={{ color: lic.additional_needed > 0 ? "error.main" : "success.main" }}>
                                  {lic.additional_needed}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  );
                })()}
              </Alert>
            )}
          </Box>
        </Fade>
      </Paper>

      {/* ── Classroom Matrix ── */}
      <Paper elevation={3} sx={{ p: 4, borderRadius: 3, minHeight: 320 }}>
        <Typography variant="h5" fontWeight="bold" mb={2}>Classroom Occupancy Matrix</Typography>
        {loading ? (
          <Box sx={{ display:"flex", justifyContent:"center", alignItems:"center", height:200 }}>
            <CircularProgress />
            <Typography sx={{ ml: 2 }}>Generating matrix...</Typography>
          </Box>
        ) : !plans.length && !unallocatedBatches.length ? (
          <Alert severity="info">
            Upload a file or load saved data to see the classroom occupancy matrix.
          </Alert>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Showing {plans.length} OFFLINE batches across {classrooms.length} classrooms.
              Occupancy spans <strong>5 months + 2 weeks from each batch's start date</strong>.
            </Typography>
            <TableContainer sx={{ maxHeight: 450 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Classroom</TableCell>
                    <TableCell>Slot</TableCell>
                    {weeks.map((w, idx) => (
                      <TableCell key={idx} align="center">
                        {w.month} {w.year} W{w.weekNum}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {table.map((row, idx) => (
                    <TableRow
                      key={idx}
                      hover
                      sx={row[0] === "UNALLOCATED" ? { backgroundColor: "#fff3f3" } : {}}
                    >
                      {row.map((cell, jdx) =>
                        jdx < 2 ? (
                          <TableCell
                            key={jdx}
                            sx={{
                              whiteSpace: "pre-wrap",
                              minWidth: jdx === 0 ? 140 : 80,
                              fontWeight: jdx === 0 ? "bold" : 500,
                            }}
                          >
                            {jdx === 1 ? slotDisplayMap[cell] || cell : cell}
                          </TableCell>
                        ) : (
                          <TableCell key={jdx} sx={{ minWidth:80, p:0.5, textAlign:"center" }}>
                            <Box sx={{ display:"flex", flexDirection:"column", alignItems:"center", gap:0.25 }}>
                              {Array.isArray(cell) && cell.filter(Boolean).map((batch, bid) => (
                                <Chip
                                  key={bid}
                                  label={batch}
                                  size="small"
                                  sx={{
                                    backgroundColor: batchColorMap[batch] || "#e0e0e0",
                                    color: "#222",
                                    fontWeight: 600,
                                    height: 24,
                                    fontSize: "0.75rem",
                                    cursor: "pointer",
                                  }}
                                  onClick={() => handleBatchClick(batch)}
                                />
                              ))}
                            </Box>
                          </TableCell>
                        )
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </Paper>

      {/* ── Trainer Matrix ── */}
      <Paper elevation={3} sx={{ p: 4, borderRadius: 3, mt: 4 }}>
        <Typography variant="h5" fontWeight="bold" mb={2}>Trainer Allocation Matrix</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Each trainer row shows batches they handle across module types (BASIC, CORE_THEORY, CORE_LAB).
          A batch may appear under multiple trainers. Span based on 5 months + 2 weeks occupancy window.
        </Typography>
        {!plans.length ? (
          <Alert severity="info">Upload a file or load saved data to see trainer allocation.</Alert>
        ) : (
          <TableContainer sx={{ maxHeight: 450 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Trainer</TableCell>
                  {weeks.map((w, idx) => (
                    <TableCell key={idx} align="center">
                      {w.month} {w.year} W{w.weekNum}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {trainerTable.map((row, idx) => (
                  <TableRow
                    key={idx}
                    sx={row[0] === "UNASSIGNED" ? { backgroundColor: "#fff3f3" } : {}}
                  >
                    {row.map((cell, jdx) =>
                      jdx === 0 ? (
                        <TableCell key={jdx} sx={{ fontWeight:"bold", minWidth:140 }}>
                          {cell}
                        </TableCell>
                      ) : (
                        <TableCell key={jdx} sx={{ textAlign:"center", p:0.5 }}>
                          <Box sx={{ display:"flex", flexDirection:"column", alignItems:"center", gap:0.25 }}>
                            {Array.isArray(cell) && cell.map((batch, bid) => (
                              <Chip
                                key={bid}
                                label={batch}
                                size="small"
                                sx={{
                                  backgroundColor: trainerBatchColorMap[batch] || "#e0e0e0",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                }}
                                onClick={() => handleBatchClick(batch)}
                              />
                            ))}
                          </Box>
                        </TableCell>
                      )
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* ── Unallocated Batches ── */}
      {unallocatedBatches.length > 0 && (
        <Paper elevation={3} sx={{ p: 3, mt: 4 }}>
          <Typography variant="h6" color="error" gutterBottom>Unallocated Batches</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Batch</TableCell>
                <TableCell>Enrolled</TableCell>
                <TableCell>Start Date</TableCell>
                <TableCell>Due Date</TableCell>
                <TableCell>Occupancy End (5m+2w)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {[...unallocatedBatches]
                .sort((a, b) => (a.a_start||"").localeCompare(b.a_start||""))
                .map((u) => (
                  <TableRow key={u.batch_no}>
                    <TableCell>{u.batch_no}</TableCell>
                    <TableCell>{u.enrolled}</TableCell>
                    <TableCell>{u.a_start}</TableCell>
                    <TableCell>{u.a_end}</TableCell>
                    <TableCell sx={{ color: "primary.main", fontWeight: 600 }}>
                      {u.occupancy_end}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {/* ── Trainer Scheduling Conflicts ── */}
      {Object.keys(trainerOverlapInfo).length > 0 && (
        <Paper elevation={3} sx={{ p: 3, mt: 4, border: "2px solid #f44336" }}>
          <Typography variant="h6" color="error" gutterBottom>⚠️ Trainer Scheduling Conflicts</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            These module types could not be assigned a trainer — all eligible trainers have overlapping batches.
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Unassigned Batch</TableCell>
                  <TableCell>Module Type</TableCell>
                  <TableCell>Trainer</TableCell>
                  <TableCell>Conflicting Batch</TableCell>
                  <TableCell>Conflict Period</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.entries(trainerOverlapInfo).flatMap(([batchNo, moduleConflicts]) =>
                  (Array.isArray(moduleConflicts) ? moduleConflicts : []).flatMap((mc, i) =>
                    mc.conflicts?.length > 0
                      ? mc.conflicts.map((c, j) => (
                          <TableRow key={`${batchNo}-${i}-${j}`} sx={{ backgroundColor: "#fff3f3" }}>
                            <TableCell sx={{ fontWeight:"bold", color:"error.main" }}>{batchNo}</TableCell>
                            <TableCell><Chip label={mc.module_type||"-"} size="small" /></TableCell>
                            <TableCell>{mc.trainer}</TableCell>
                            <TableCell>{c.batch_no}</TableCell>
                            <TableCell sx={{ color:"error.main" }}>
                              {String(c.start||"").slice(0,10)} → {String(c.end||"").slice(0,10)}
                            </TableCell>
                          </TableRow>
                        ))
                      : [(
                          <TableRow key={`${batchNo}-${i}-none`} sx={{ backgroundColor: "#fff3f3" }}>
                            <TableCell sx={{ fontWeight:"bold", color:"error.main" }}>{batchNo}</TableCell>
                            <TableCell><Chip label={mc.module_type||"-"} size="small" /></TableCell>
                            <TableCell>{mc.trainer}</TableCell>
                            <TableCell colSpan={2} sx={{ color:"text.secondary" }}>No free slot found</TableCell>
                          </TableRow>
                        )]
                  )
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* ── License Requirement Summary ── */}
      {plans.length > 0 && (
        <Paper elevation={3} sx={{ p: 3, mt: 4 }}>
          <Typography variant="h6" color="primary" gutterBottom>License Requirement Summary</Typography>
          {(() => {
            const issues = plans
              .filter((p) => p.batch_no)
              .map((p) => ({
                batch_no: p.batch_no,
                shortages: getLicenseInfoForBatch(p.batch_no, p.capacity, p.enrolled)
                  .filter((l) => l.additional_needed > 0),
              }))
              .filter((p) => p.shortages.length > 0);
            if (!issues.length)
              return <Alert severity="success">✅ License is sufficient for all batches.</Alert>;
            return (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Batch</TableCell>
                    <TableCell>License</TableCell>
                    <TableCell>Available</TableCell>
                    <TableCell>Required (Capacity)</TableCell>
                    <TableCell>Additional Needed</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {issues.map((issue) =>
                    issue.shortages.map((lic, idx) => (
                      <TableRow key={`${issue.batch_no}-${idx}`} sx={{ backgroundColor: "#fff3f3" }}>
                        <TableCell sx={{ fontWeight:"bold", color:"error.main" }}>{issue.batch_no}</TableCell>
                        <TableCell>{lic.license_name}</TableCell>
                        <TableCell>{lic.count}</TableCell>
                        <TableCell>{lic.required}</TableCell>
                        <TableCell sx={{ color:"error.main", fontWeight:600 }}>
                          {lic.additional_needed}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            );
          })()}
        </Paper>
      )}
    </Box>
  );
}