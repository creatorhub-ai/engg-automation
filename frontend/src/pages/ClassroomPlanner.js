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
} from "@mui/material";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";

const API_BASE =
  process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

const colorPalette = [
  "#edc7cf",
  "#bdd9bf",
  "#c7ceea",
  "#ffeebb",
  "#a4c2f4",
  "#a1eafb",
  "#e6c7e3",
  "#f7cac9",
  "#ffe066",
  "#f8b195",
  "#80ced6",
  "#d5f4e6",
  "#f0a6ca",
  "#b5ead7",
  "#ead3d7",
  "#ffe0ac",
  "#b3cdd1",
  "#eec9e6",
];

const slotDisplayMap = {
  morning: "morning",
  evening: "evening",
  Shift_1: "morning",
  Shift_2: "evening",
};

// Parse Excel dates like 11.05.2026 or ISO yyyy-MM-dd to Date
function parseExcelDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(value);
  }

  if (/^\d{2}\.\d{2}\.\d{4}$/.test(value)) {
    const [dd, mm, yyyy] = value.split(".");
    return new Date(`${yyyy}-${mm}-${dd}`);
  }

  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

// Convert Date to ISO yyyy-MM-dd
function toIsoDateString(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function getWeeksInRange(start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const weeks = [];
  let cur = new Date(startDate);
  cur.setDate(cur.getDate() - cur.getDay()); // Sunday
  while (cur <= endDate) {
    const y = cur.getFullYear();
    const m = cur.getMonth();
    const weekNum = Math.ceil(
      (cur.getDate() + 1 - new Date(y, m, 1).getDay()) / 7
    );
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
  return !(
    new Date(end1) < new Date(start2) || new Date(start1) > new Date(end2)
  );
}

// Trim header names from XLSX (ex: "MODE " -> "MODE")
function normalizeRowKeys(row) {
  const normalized = {};
  Object.keys(row).forEach((key) => {
    const trimmedKey = key.trim();
    normalized[trimmedKey] = row[key];
  });
  return normalized;
}

// Infer domain from COURSE prefix
function getDomainFromCourse(course) {
  if (!course || typeof course !== "string") return "";
  const up = course.toUpperCase();
  if (up.startsWith("PDFT") || up.startsWith("PD")) return "PD";
  if (up.startsWith("DVFT") || up.startsWith("DV")) return "DV";
  if (up.startsWith("DFTFT") || up.startsWith("DFT")) return "DFT";
  return "";
}

// Updated classroom planning function that uses database classrooms
async function planClassroomsForOffline(rows, classrooms) {
  const shifts = ["morning", "evening"];
  const plans = [];
  const unallocatedBatches = [];
  const occupancyIndex = {};

  const getKey = (roomName, slot) => `${roomName}|${slot}`;

  rows.forEach((originalRow) => {
    const row = normalizeRowKeys(originalRow);

    const course = row["COURSE"];
    let mode = row["MODE"];
    const aStartRaw = row["A.START DATE"];
    const aEndRaw = row["A.DUE DATE"];

    const aStartDate = parseExcelDate(aStartRaw);
    const aEndDate = parseExcelDate(aEndRaw);
    const aStart = toIsoDateString(aStartDate);
    const aEnd = toIsoDateString(aEndDate);

    const capacity = Number(row["CAPACITY"] || 0);
    const enrolled = Number(row["ENROLLED"] || 0);

    mode = typeof mode === "string" ? mode.trim().toUpperCase() : "";

    if (!course || mode !== "OFFLINE" || !aStart || !aEnd) return;

    const hasSufficientCapacity = enrolled <= capacity || enrolled === 0;
    const licenseNeeded = enrolled > capacity ? enrolled - capacity : 0;

    let assignedRoom = (row["CLASS_ROOM"] || "").trim();
    let assignedShiftRaw = (row["SHIFTS"] || "").trim();
    let slot = "";

    if (assignedShiftRaw) {
      slot = slotDisplayMap[assignedShiftRaw] || "morning";
    }

    // If no pre-assignment, try to allocate based on ENROLLED vs classroom capacity
    if (!assignedRoom || !assignedShiftRaw) {
      const suitableClassrooms = classrooms.filter(
        (classroom) => classroom.capacity >= enrolled
      ).sort((a, b) => a.capacity - b.capacity); // Prefer smaller suitable rooms

      let found = false;
      for (const classroom of suitableClassrooms) {
        for (const s of shifts) {
          const key = getKey(classroom.name, s);
          if (!occupancyIndex[key]) occupancyIndex[key] = [];

          const slotBookings = occupancyIndex[key];
          const overlap = slotBookings.some((b) =>
            isDateOverlap(aStart, aEnd, b.start, b.end)
          );

          if (!overlap) {
            assignedRoom = classroom.name;
            slot = s;
            assignedShiftRaw = s === "morning" ? "Shift_1" : "Shift_2";
            slotBookings.push({ start: aStart, end: aEnd, course });
            found = true;
            break;
          }
        }
        if (found) break;
      }

      // If no suitable classroom found, mark as unallocated
      if (!found) {
        unallocatedBatches.push({
          batch_no: course,
          enrolled,
          required_capacity: enrolled,
          available_classrooms: classrooms
            .filter((c) => c.capacity < enrolled)
            .map((c) => `${c.name} (${c.capacity})`),
        });
      }
    } else {
      // Validate pre-assigned room capacity
      const classroom = classrooms.find((c) => c.name === assignedRoom.split(" ")[0]);
      if (classroom && enrolled > classroom.capacity) {
        unallocatedBatches.push({
          batch_no: course,
          enrolled,
          required_capacity: enrolled,
          available_classrooms: classrooms
            .filter((c) => c.capacity < enrolled)
            .map((c) => `${c.name} (${c.capacity})`),
          issue: "Pre-assigned classroom capacity insufficient",
        });
      } else {
        const roomName = assignedRoom.split(" ")[0];
        slot = slotDisplayMap[assignedShiftRaw] || "morning";
        const key = getKey(roomName, slot);
        if (!occupancyIndex[key]) occupancyIndex[key] = [];
        occupancyIndex[key].push({ start: aStart, end: aEnd, course });
      }
    }

    if (assignedRoom) {
      plans.push({
        batch_no: course,
        mode,
        a_start: aStart,
        a_end: aEnd,
        capacity,
        enrolled,
        hasSufficientCapacity,
        licenseNeeded,
        classroom_name: `${assignedRoom}`,
        slot,
      });
    }
  });

  return { plans, unallocatedBatches };
}

function getBatchColorMap(allMatrixTable) {
  const batchSet = new Set();
  allMatrixTable.forEach((row) =>
    row.forEach((cell) => {
      if (Array.isArray(cell)) cell.forEach((bn) => batchSet.add(bn));
    })
  );
  const paletteLength = colorPalette.length;
  const batchArr = Array.from(batchSet).filter(Boolean).sort();
  const batchColorMap = {};
  batchArr.forEach((bn, idx) => {
    batchColorMap[bn] = colorPalette[idx % paletteLength];
  });
  return batchColorMap;
}

// Convert hex to RGB object for ExcelJS
function hexToRGB(hex) {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
  };
}

export default function ClassroomPlanner() {
  const [plans, setPlans] = useState([]);
  const [weeks, setWeeks] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [processingStatus, setProcessingStatus] = useState("");
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [downloadFileName, setDownloadFileName] = useState("classroom_plan.xlsx");
  const [saveStatus, setSaveStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [licenses, setLicenses] = useState([]);
  const [licenseError, setLicenseError] = useState("");
  const [classrooms, setClassrooms] = useState([]);
  const [unallocatedBatches, setUnallocatedBatches] = useState([]);
  const [showUnallocatedDialog, setShowUnallocatedDialog] = useState(false);

  // Load classrooms from database
  const loadClassrooms = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/classrooms`);
      if (res.ok) {
        const data = await res.json();
        setClassrooms(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error("loadClassrooms error:", e);
    }
  }, []);

  // Load existing matrix
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

      // Map to plans format
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

      // Compute weeks from dates
      const allDates = normalizedPlans.flatMap((p) => [p.a_start, p.a_end]).filter(Boolean);
      if (allDates.length) {
        const start = allDates.reduce((a, b) => (a < b ? a : b));
        const end = allDates.reduce((a, b) => (a > b ? a : b));
        setWeeks(getWeeksInRange(start, end));
      } else {
        setWeeks([]);
      }

      setProcessingStatus(
        `Loaded ${occupancyRows.length} saved batches (auto-reload on next upload)`
      );
    } catch (e) {
      console.error("loadExistingMatrix error", e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load initial data
  useEffect(() => {
    loadClassrooms();
    loadExistingMatrix();
    loadLicenses();
  }, [loadClassrooms, loadExistingMatrix]);

  const loadLicenses = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/licenses`);
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.licenses || [];
      setLicenses(list);
    } catch (e) {
      console.error("loadLicenses error", e);
      setLicenseError("Failed to load licenses.");
    }
  };

  const classroomsList = useMemo(
    () => [...new Set(plans.map((p) => p.classroom_name).filter(Boolean))],
    [plans]
  );
  const slots = ["morning", "夕方"];

  const table = useMemo(() => {
    const t = [];
    classroomsList.forEach((room) => {
      slots.forEach((slot) => {
        const row = [room, slot];
        weeks.forEach((week) => {
          const weekStart = week.weekStart;
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 6);
          const startIso = weekStart.toISOString().slice(0, 10);
          const endIso = weekEnd.toISOString().slice(0, 10);

          const batches = plans
            .filter(
              (p) =>
                p.classroom_name === room &&
                p.slot === slot &&
                isDateOverlap(p.a_start, p.a_end, startIso, endIso)
            )
            .map((p) => p.batch_no)
            .filter(Boolean);

          row.push(batches);
        });
        t.push(row);
      });
    });
    return t;
  }, [classroomsList, slots, weeks, plans]);

  const batchColorMap = useMemo(() => getBatchColorMap(table), [table]);

  const batchDetailMap = useMemo(() => {
    const m = {};
    plans.forEach((p) => {
      m[p.batch_no] = p;
    });
    return m;
  }, [plans]);

  // License mapping
  const getLicenseInfoForBatch = (batchNo, enrolled) => {
    const domain = getDomainFromCourse(batchNo);
    if (!domain || !Array.isArray(licenses)) return [];

    const domainLicenses = licenses.filter(
      (l) => (l.domain || "").toString().toUpperCase() === domain
    );
    if (!domainLicenses.length) return [];

    return domainLicenses.map((lic) => {
      const count = Number(lic.count || 0);
      const additionalNeeded = Math.max(0, enrolled - count);
      return {
        license_name: lic.license_name,
        count,
        additional_needed: additionalNeeded,
      };
    });
  };

  const handleBatchClick = (batch) => {
    if (!batch) return;
    const base = batchDetailMap[batch] || null;
    if (!base) {
      setSelectedBatch(null);
      return;
    }
    const learnerCount = base.enrolled || base.capacity || 0;
    const licenseInfo = getLicenseInfoForBatch(base.batch_no, learnerCount);
    setSelectedBatch({ ...base, licenseInfo });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError("");
    setProcessingStatus("Reading file...");
    setPlans([]);
    setWeeks([]);
    setSelectedBatch(null);
    setSaveStatus("");
    setUnallocatedBatches([]);

    try {
      const data = await file.arrayBuffer();

      setProcessingStatus("Parsing spreadsheet...");
      const wb = XLSX.read(data, { type: "array" });
      const sheetName = wb.SheetNames[0];
      const sheet = wb.Sheets[sheetName];

      const rows = XLSX.utils.sheet_to_json(sheet, {
        defval: "",
        raw: false,
      });

      setProcessingStatus("Fetching classrooms and processing OFFLINE batches...");
      
      // Use real classrooms from database
      const { plans: offlinePlans, unallocatedBatches: unallocated } = await planClassroomsForOffline(rows, classrooms);
      
      setPlans(offlinePlans);
      setUnallocatedBatches(unallocated);

      if (unallocated.length > 0) {
        setShowUnallocatedDialog(true);
        setProcessingStatus(`Completed! Planned ${offlinePlans.length} batches. ${unallocated.length} batches unallocated due to capacity constraints.`);
      } else if (!offlinePlans.length) {
        setError("No OFFLINE batches found in the file. Only MODE = OFFLINE rows are planned.");
      } else {
        const allDates = [];
        offlinePlans.forEach((p) => {
          if (p.a_start) allDates.push(p.a_start);
          if (p.a_end) allDates.push(p.a_end);
        });
        const matrixStart = allDates.reduce((a, b) => (a < b ? a : b));
        const matrixEnd = allDates.reduce((a, b) => (a > b ? a : b));
        const w = getWeeksInRange(matrixStart, matrixEnd);
        setWeeks(w);
        setProcessingStatus(`Completed! Planned ${offlinePlans.length} OFFLINE batches.`);
      }
    } catch (err) {
      console.error("File processing error:", err);
      setError(`Failed to process file: ${err.message || "Invalid file format"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadXlsx = async () => {
    if (!plans.length) {
      setError("No data to export. Please upload a file with OFFLINE batches.");
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();

      // === CLASSROOM MATRIX SHEET ===
      const matrixSheet = workbook.addWorksheet("Classroom Matrix");
      const headerRow = ["Classroom", "Slot", ...weeks.map((w) => `${w.month} W${w.weekNum}`)];
      matrixSheet.addRow(headerRow);

      const headerRowExcel = matrixSheet.getRow(1);
      headerRowExcel.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRowExcel.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF333333" },
      };
      headerRowExcel.alignment = {
        horizontal: "center",
        vertical: "center",
        wrapText: true,
      };

      table.forEach((row) => {
        const outRow = [];
        row.forEach((cell, idx) => {
          if (idx < 2) {
            outRow.push(idx === 1 ? slotDisplayMap[cell] || cell : cell);
          } else {
            if (Array.isArray(cell)) outRow.push(cell.join(", "));
            else outRow.push("");
          }
        });

        const excelRow = matrixSheet.addRow(outRow);

        row.forEach((cell, colIdx) => {
          if (colIdx >= 2 && Array.isArray(cell) && cell.length > 0) {
            const firstBatch = cell[0];
            const hexColor = batchColorMap[firstBatch];

            if (hexColor) {
              const rgb = hexToRGB(hexColor);
              const rgbHex =
                `FF${rgb.r.toString(16).padStart(2, "0")}${rgb.g
                  .toString(16)
                  .padStart(2, "0")}${rgb.b.toString(16).padStart(2, "0")}`.toUpperCase();

              const excelCell = excelRow.getCell(colIdx + 1);
              excelCell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: rgbHex },
              };
              excelCell.font = { bold: true, color: { argb: "FF222222" } };
              excelCell.alignment = {
                horizontal: "center",
                vertical: "center",
                wrapText: true,
              };
            }
          }
        });

        excelRow.getCell(1).font = { bold: true };
        excelRow.getCell(2).alignment = {
          horizontal: "center",
          vertical: "center",
        };
      });

      matrixSheet.columns = [{ width: 20 }, { width: 12 }, ...weeks.map(() => ({ width: 18 }))];

      // === OFFLINE PLANS SHEET ===
      const plansSheet = workbook.addWorksheet("Offline Plans");
      const plansHeader = [
        "COURSE",
        "MODE",
        "A.START DATE",
        "A.DUE DATE",
        "CAPACITY",
        "ENROLLED",
        "HAS_SUFFICIENT_CAPACITY",
        "LICENSE_ADDITIONAL_NEEDED",
        "CLASSROOM_NAME",
        "SLOT",
      ];
      plansSheet.addRow(plansHeader);

      const plansHeaderRow = plansSheet.getRow(1);
      plansHeaderRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      plansHeaderRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF333333" },
      };
      plansHeaderRow.alignment = {
        horizontal: "center",
        vertical: "center",
        wrapText: true,
      };

      plans.forEach((p) => {
        plansSheet.addRow([
          p.batch_no,
          p.mode,
          p.a_start,
          p.a_end,
          p.capacity,
          p.enrolled,
          p.hasSufficientCapacity ? "YES" : "NO",
          p.licenseNeeded,
          p.classroom_name,
          p.slot,
        ]);
      });

      plansSheet.columns = [
        { width: 15 },
        { width: 12 },
        { width: 15 },
        { width: 15 },
        { width: 12 },
        { width: 12 },
        { width: 20 },
        { width: 25 },
        { width: 20 },
        { width: 12 },
      ];

      // === UNALLOCATED BATCHES SHEET ===
      if (unallocatedBatches.length > 0) {
        const unallocatedSheet = workbook.addWorksheet("Unallocated Batches");
        const unallocatedHeader = [
          "BATCH_NO",
          "ENROLLED",
          "REQUIRED_CAPACITY",
          "ISSUE",
          "AVAILABLE_CLASSROOMS",
        ];
        unallocatedSheet.addRow(unallocatedHeader);

        const unallocatedHeaderRow = unallocatedSheet.getRow(1);
        unallocatedHeaderRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
        unallocatedHeaderRow.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFCC0000" },
        };

        unallocatedBatches.forEach((batch) => {
          unallocatedSheet.addRow([
            batch.batch_no,
            batch.enrolled,
            batch.required_capacity,
            batch.issue || "No suitable classroom available",
            batch.available_classrooms?.join(", ") || "None",
          ]);
        });
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = downloadFileName || "classroom_plan.xlsx";
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download error:", err);
      setError(`Failed to download: ${err.message}`);
    }
  };

  // Updated save function to match classroom_occupancy table structure
  const handleSaveMatrix = async () => {
    if (!plans.length) {
      setError("No matrix to save. Upload a file first.");
      return;
    }
    setSaving(true);
    setSaveStatus("");
    setError("");

    try {
      const occupancyRows = plans
        .filter((p) => p.batch_no && p.classroom_name && p.slot && p.a_start && p.a_end)
        .map((p) => ({
          batch_no: p.batch_no.trim(),
          occupancy_start: p.a_start,
          occupancy_end: p.a_end,
          enrolled: p.enrolled || 0,
          class_room: p.classroom_name, // matches classroom_occupancy table
          shifts: p.slot === "morning" ? "Shift_1" : "Shift_2", // matches classroom_occupancy table
          classroom_name: p.classroom_name,
          slot: p.slot,
        }));

      if (!occupancyRows.length) {
        throw new Error("No valid rows to save.");
      }

      const payload = { occupancyRows };

      const res = await fetch(`${API_BASE}/api/save-classroom-matrix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const { inserted, updated, skipped } = data.summary || {};
      setSaveStatus(
        `✅ ${inserted || 0} NEW + ${updated || 0} UPDATED + ${skipped || 0} unchanged`
      );

      await loadExistingMatrix();
    } catch (err) {
      console.error("Save error:", err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const getWorstLicenseShortfall = (licenseInfo = []) => {
    if (!licenseInfo.length) return null;
    return licenseInfo.reduce(
      (max, cur) =>
        cur.additional_needed > (max?.additional_needed || 0) ? cur : max,
      { additional_needed: 0 }
    );
  };

  return (
    <Box sx={{ maxWidth: "98vw", mx: "auto", my: 4 }}>
      <Paper elevation={5} sx={{ p: 4, borderRadius: 3, mb: 4 }}>
        <Typography variant="h4" color="primary" gutterBottom>
          Classroom Planner
        </Typography>
        <Divider sx={{ mb: 3 }} />

        <Box sx={{ mb: 3, display: "flex", flexDirection: "column", gap: 2 }}>
          <Typography variant="subtitle1">
            Upload CSV or XLSX file with columns like COURSE, MODE, A.START DATE, A.DUE DATE,
            CAPACITY, ENROLLED, CLASS_ROOM, SHIFTS. Only MODE = OFFLINE rows are planned.
          </Typography>

          <Typography variant="body2" color="text.secondary">
            Available Classrooms ({classrooms.length}):{" "}
            {classrooms.map((c) => `${c.name}(${c.capacity})`).join(", ") || "None"}
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
            InputProps={{
              endAdornment: <InputAdornment position="end">.xlsx</InputAdornment>,
            }}
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
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              mt: 2,
              p: 2,
              bgcolor: "primary.main",
              color: "white",
              borderRadius: 2,
            }}
          >
            <CircularProgress size={20} color="inherit" />
            <Typography variant="body1" fontWeight="bold">
              {processingStatus || "Processing..."}
            </Typography>
          </Box>
        )}

        {!loading && processingStatus && (
          <Chip label={processingStatus} color="info" variant="outlined" sx={{ mt: 2 }} />
        )}

        <Fade in={!!error}>
          <Box>{error && <Alert severity="error" sx={{ mt: 3 }}>{error}</Alert>}</Box>
        </Fade>

        {licenseError && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {licenseError}
          </Alert>
        )}

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
                    Dates: {selectedBatch.a_start} → {selectedBatch.a_end}
                  </Typography>
                  <Typography variant="body2">
                    Classroom: {selectedBatch.classroom_name || "Not assigned"} | Slot:{" "}
                    {slotDisplayMap[selectedBatch.slot] || selectedBatch.slot || "Not assigned"}
                  </Typography>
                </Box>

                {selectedBatch.licenseInfo && selectedBatch.licenseInfo.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    {(() => {
                      const worst = getWorstLicenseShortfall(selectedBatch.licenseInfo);
                      const totalShort = selectedBatch.licenseInfo.reduce(
                        (sum, cur) => sum + (cur.additional_needed || 0),
                        0
                      );
                      const isSufficient = totalShort <= 0;

                      return (
                        <>
                          <Typography
                            variant="body2"
                            fontWeight="bold"
                            color={isSufficient ? "success.main" : "error.main"}
                          >
                            License Status:{" "}
                            {isSufficient
                              ? "All licenses are sufficient for this batch."
                              : `Insufficient license: ${worst.license_name} (have ${worst.count}, need ${
                                  worst.count + worst.additional_needed
                                }).`}
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
                                    <TableCell
                                      sx={{
                                        color:
                                          lic.additional_needed > 0
                                            ? "error.main"
                                            : "success.main",
                                      }}
                                    >
                                      {lic.additional_needed}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </>
                      );
                    })()}
                  </Box>
                )}
              </Alert>
            )}
          </Box>
        </Fade>
      </Paper>

      <Paper elevation={3} sx={{ p: 4, borderRadius: 3, minHeight: 320 }}>
        <Typography variant="h5" fontWeight="bold" mb={2}>
          Classroom Occupancy Matrix
        </Typography>

        {loading ? (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: 200,
            }}
          >
            <CircularProgress />
            <Typography sx={{ ml: 2 }}>Generating matrix...</Typography>
          </Box>
        ) : !plans.length ? (
          <Alert severity="info">
            Upload a file with OFFLINE batches or rely on auto-loaded data to see the classroom
            occupancy matrix.
          </Alert>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Showing {plans.length} OFFLINE batches across {classroomsList.length} classrooms.
              {unallocatedBatches.length > 0 && (
                <Chip
                  label={`${unallocatedBatches.length} unallocated`}
                  color="warning"
                  size="small"
                  sx={{ ml: 1 }}
                />
              )}
            </Typography>
            <TableContainer sx={{ maxHeight: 450 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Classroom</TableCell>
                    <TableCell>Slot</TableCell>
                    {weeks.map((w, idx) => (
                      <TableCell key={idx} align="center">
                        {w.month} W{w.weekNum}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {table.map((row, idx) => (
                    <TableRow key={idx} hover>
                      {row.map((cell, jdx) =>
                        jdx < 2 ? (
                          <TableCell
                            key={jdx}
                            sx={{
                              whiteSpace: "pre-wrap",
                              minWidth: jdx === 0 ? 140 : 80,
                              fontWeight: jdx === 0 ? "bold" : 500,
                            }}
                            align="left"
                          >
                            {jdx === 1 ? slotDisplayMap[cell] || cell : cell}
                          </TableCell>
                        ) : (
                          <TableCell
                            key={jdx}
                            sx={{ minWidth: 80, p: 0.5, textAlign: "center" }}
                          >
                            <Box
                              sx={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: 0.25,
                              }}
                            >
                              {Array.isArray(cell)
                                ? cell.filter(Boolean).map((batch, bid) => (
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
                                  ))
                                : null}
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

      {/* Unallocated Batches Dialog */}
      <Dialog
        open={showUnallocatedDialog}
        onClose={() => setShowUnallocatedDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Unallocated Batches ({unallocatedBatches.length})</DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            The following batches could not be allocated due to capacity constraints:
          </Typography>
          <TableContainer sx={{ mt: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Batch</TableCell>
                  <TableCell>Enrolled</TableCell>
                  <TableCell>Required Capacity</TableCell>
                  <TableCell>Issue</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {unallocatedBatches.map((batch, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{batch.batch_no}</TableCell>
                    <TableCell>{batch.enrolled}</TableCell>
                    <TableCell>{batch.required_capacity}</TableCell>
                    <TableCell>{batch.issue || "No suitable classroom available"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowUnallocatedDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
