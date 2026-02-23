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
  const s1 = new Date(start1);
  const e1 = new Date(end1);
  const s2 = new Date(start2);
  const e2 = new Date(end2);

  if (isNaN(s1) || isNaN(e1) || isNaN(s2) || isNaN(e2)) {
    return true;
  }

  return s1 <= e2 && s2 <= e1;
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

/**
 * Plan classrooms only for MODE = OFFLINE.
 * Capacity rule:
 *   CAPACITY <= 35 -> Yamuna or Cauvery
 *   CAPACITY > 35  -> Ganga
 */
function planClassroomsForOffline(rows) {
  const classrooms = [
    { name: "Ganga", capacity: 50 },
    { name: "Yamuna", capacity: 35 },
    { name: "Cauvery", capacity: 35 },
    { name: "Bhavani", capacity: 35 },
  ];

  const shifts = ["morning", "evening"];
  const plans = [];
  const unallocated = [];

  const occupancyIndex = {};
  const getKey = (room, slot) => `${room}|${slot}`;

  // STEP 1: Normalize and FILTER only valid OFFLINE rows first
  const filteredRows = rows
    .map(normalizeRowKeys)
    .filter((row) => {
      const mode =
        typeof row["MODE"] === "string"
          ? row["MODE"].trim().toUpperCase()
          : "";

      const aStart = parseExcelDate(row["A.START DATE"]);
      const aEnd = parseExcelDate(row["A.DUE DATE"]);

      return (
        row["COURSE"] &&
        mode === "OFFLINE" &&
        aStart &&
        aEnd
      );
    });

  // STEP 2: SORT BY START DATE (earliest first)
  filteredRows.sort((a, b) => {
    const dateA = parseExcelDate(a["A.START DATE"]);
    const dateB = parseExcelDate(b["A.START DATE"]);

    const diff = dateA - dateB;
    if (diff !== 0) return diff;

    return (a["COURSE"] || "").localeCompare(b["COURSE"] || "");
  });

  // STEP 3: Allocation happens in sorted order
  filteredRows.forEach((row) => {
    const course = row["COURSE"];
    const mode = "OFFLINE";

    const aStartDate = parseExcelDate(row["A.START DATE"]);
    const aEndDate = parseExcelDate(row["A.DUE DATE"]);

    const aStart = toIsoDateString(aStartDate);
    const aEnd = toIsoDateString(aEndDate);

    const enrolled = Number(row["ENROLLED"] || 0);
    const batchCapacity = Number(row["CAPACITY"] || 0);

    // RULE 1: enrolled should not exceed batch capacity
    if (enrolled > batchCapacity) {
      plans.push({
        batch_no: course,
        mode,
        a_start: aStart,
        a_end: aEnd,
        enrolled,
        capacity: batchCapacity,
        classroom_name: "",
        slot: "",
        isAllocated: false,
        // Preserve trainer info from enriched rows
        trainer_name: row["trainer_name"] || "UNASSIGNED",
      });

      unallocated.push({
        batch_no: course,
        enrolled,
        a_start: aStart,
        a_end: aEnd,
      });

      return;
    }

    let allocated = false;
    let assignedRoom = "";
    let assignedSlot = "";

    for (const room of classrooms) {
      if (enrolled > room.capacity) continue;

      for (const slot of shifts) {
        const key = getKey(room.name, slot);
        if (!occupancyIndex[key]) occupancyIndex[key] = [];

        const overlap = occupancyIndex[key].some((b) =>
          isDateOverlap(aStart, aEnd, b.start, b.end)
        );

        if (!overlap) {
          assignedRoom = `${room.name} [${room.capacity}]`;
          assignedSlot = slot;

          occupancyIndex[key].push({
            start: new Date(aStart).toISOString(),
            end: new Date(aEnd).toISOString(),
            course,
          });

          allocated = true;
          break;
        }
      }

      if (allocated) break;
    }

    if (!allocated) {
      unallocated.push({
        batch_no: course,
        enrolled,
        a_start: aStart,
        a_end: aEnd,
      });
    }

    plans.push({
      batch_no: course,
      mode,
      a_start: aStart,
      a_end: aEnd,
      enrolled,
      capacity: batchCapacity,
      classroom_name: assignedRoom,
      slot: assignedSlot,
      isAllocated: allocated,
      // Preserve trainer info from enriched rows
      trainer_name: row["trainer_name"] || "UNASSIGNED",
    });
  });

  return { plans, unallocated };
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
  const [unallocatedBatches, setUnallocatedBatches] = useState([]);
  const [trainerOverlapInfo, setTrainerOverlapInfo] = useState({});

  // ✅ FIX 2: Helper to compute weeks from plans
  const computeAndSetWeeks = useCallback((normalizedPlans) => {
    const allDates = normalizedPlans
      .flatMap((p) => [p.a_start, p.a_end])
      .filter(Boolean);

    if (allDates.length) {
      const start = allDates.reduce((a, b) => (a < b ? a : b));
      const end = allDates.reduce((a, b) => (a > b ? a : b));
      setWeeks(getWeeksInRange(start, end));
    } else {
      setWeeks([]);
    }
  }, []);

  // ✅ FIX 2: loadExistingMatrix now correctly preserves capacity from DB
  const loadExistingMatrix = useCallback(async () => {
    try {
      setLoading(true);
      setProcessingStatus("Loading saved matrix...");

      const res = await fetch(`${API_BASE}/api/get-classroom-matrix`);
      if (!res.ok) {
        setProcessingStatus("No saved matrix found.");
        setPlans([]);
        setWeeks([]);
        setUnallocatedBatches([]);
        return;
      }

      const data = await res.json();
      const { occupancyRows } = data || {};

      if (!occupancyRows?.length) {
        setProcessingStatus("No saved data.");
        setPlans([]);
        setWeeks([]);
        setUnallocatedBatches([]);
        return;
      }

      const normalizedPlans = occupancyRows.map((r) => ({
        batch_no: r.batch_no,
        classroom_name: r.classroom_name || "",
        slot: r.slot || "",
        a_start: r.occupancy_start,
        a_end: r.occupancy_end,
        enrolled: r.enrolled || 0,
        // ✅ FIX 2: Use actual capacity from DB, not hardcoded 35
        capacity: r.capacity || r.enrolled || 0,
        mode: "OFFLINE",
        // ✅ FIX 1: Preserve trainer_name from DB
        trainer_name: r.trainer_name || "UNASSIGNED",
      }));

      const allocated = normalizedPlans.filter(
        (p) => p.classroom_name && p.slot
      );

      const unallocated = normalizedPlans.filter(
        (p) => !p.classroom_name || !p.slot
      );

      setPlans(normalizedPlans);

      setUnallocatedBatches(
        unallocated.map((p) => ({
          batch_no: p.batch_no,
          enrolled: p.enrolled,
          a_start: p.a_start,
          a_end: p.a_end,
        }))
      );

      computeAndSetWeeks(normalizedPlans);

      setProcessingStatus(
        `Loaded ${occupancyRows.length} saved batches.`
      );
    } catch (e) {
      console.error("loadExistingMatrix error", e);
      setProcessingStatus("Error loading saved matrix.");
    } finally {
      setLoading(false);
    }
  }, [computeAndSetWeeks]);

  // Auto-load matrix + licenses on mount
  useEffect(() => {
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

    loadExistingMatrix();
    loadLicenses();
  }, [loadExistingMatrix]);

  const classrooms = useMemo(() => {
    const allocatedRooms = [
      ...new Set(
        plans
          .filter((p) => p.classroom_name && p.slot)
          .map((p) => p.classroom_name)
      ),
    ];

    if (unallocatedBatches.length > 0) {
      allocatedRooms.push("UNALLOCATED");
    }

    return allocatedRooms;
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
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 6);

          const startIso = weekStart.toISOString().slice(0, 10);
          const endIso = weekEnd.toISOString().slice(0, 10);

          let batches = [];

          if (room === "UNALLOCATED") {
            batches = unallocatedBatches
              .filter((p) =>
                isDateOverlap(p.a_start, p.a_end, startIso, endIso)
              )
              .map((p) => p.batch_no);
          } else {
            batches = plans
              .filter(
                (p) =>
                  p.classroom_name === room &&
                  p.slot === slot &&
                  isDateOverlap(p.a_start, p.a_end, startIso, endIso)
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

  // ================= TRAINER MATRIX =================

  const trainers = useMemo(() => {
    const unique = new Set(
      plans.map((p) => p.trainer_name || "UNASSIGNED")
    );
    return Array.from(unique).sort();
  }, [plans]);

  const trainerTable = useMemo(() => {
    const t = [];

    trainers.forEach((trainer) => {
      const row = [trainer];

      weeks.forEach((week) => {
        const weekStart = week.weekStart;
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);

        const startIso = weekStart.toISOString().slice(0, 10);
        const endIso = weekEnd.toISOString().slice(0, 10);

        const batches = plans
          .filter(
            (p) =>
              (p.trainer_name || "UNASSIGNED") === trainer &&
              isDateOverlap(p.a_start, p.a_end, startIso, endIso)
          )
          .map((p) => p.batch_no);

        row.push(batches.filter(Boolean));
      });

      t.push(row);
    });

    return t;
  }, [trainers, weeks, plans]);

  const batchColorMap = useMemo(() => getBatchColorMap(table), [table]);

  const batchDetailMap = useMemo(() => {
    const m = {};
    plans.forEach((p) => {
      m[p.batch_no] = p;
    });
    return m;
  }, [plans]);

  const trainerBatchColorMap = useMemo(
    () => getBatchColorMap(trainerTable),
    [trainerTable]
  );

  // License based on CLASSROOM CAPACITY
  const getLicenseInfoForBatch = (batchNo, classroomCapacity, enrolled) => {
    const domain = getDomainFromCourse(batchNo);
    if (!domain || !Array.isArray(licenses)) return [];

    const domainLicenses = licenses.filter(
      (l) => (l.domain || "").toString().toUpperCase() === domain
    );

    if (!domainLicenses.length) return [];

    return domainLicenses.map((lic) => {
      const licenseCount = Number(lic.count || 0);

      const requiredLicenses = Math.max(
        Number(enrolled || 0),
        Number(classroomCapacity || 0)
      );

      const additionalNeeded = Math.max(
        0,
        requiredLicenses - licenseCount
      );

      return {
        license_name: lic.license_name,
        count: licenseCount,
        required: requiredLicenses,
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

    const classroomCapacity = base.capacity || 0;
    const enrolled = base.enrolled || 0;

    const licenseInfo = getLicenseInfoForBatch(
      base.batch_no,
      classroomCapacity,
      enrolled
    );

    setSelectedBatch({
      ...base,
      licenseInfo,
    });
  };

  // ✅ FIX 1: Fetch trainer assignments from course_planner_data for batch-level rows
  const fetchTrainerForBatches = async (batchNos, offlinePlans) => {
    try {
      // Build date range map from the plans we just computed
      const batch_date_ranges = {};
      offlinePlans.forEach((p) => {
        if (p.batch_no && p.a_start && p.a_end) {
          batch_date_ranges[p.batch_no] = {
            start: p.a_start,
            end: p.a_end,
          };
        }
      });

      const res = await fetch(`${API_BASE}/api/get-batch-trainers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch_nos: batchNos, batch_date_ranges }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.error("get-batch-trainers error response:", errData);
        return { trainerMap: {}, overlapInfo: {} };
      }

      const data = await res.json();
      return {
        trainerMap: data.trainerMap || {},
        overlapInfo: data.overlapInfo || {},
      };
    } catch (e) {
      console.error("fetchTrainerForBatches error:", e);
      return { trainerMap: {}, overlapInfo: {} };
    }
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

      // ===============================
      // STEP 1: CLASSROOM ALLOCATION
      // ===============================
      setProcessingStatus("Allocating classrooms...");

      const { plans: offlinePlans, unallocated } =
        planClassroomsForOffline(rows);

      // ===============================
      // ✅ FIX 1: STEP 2: FETCH TRAINER ASSIGNMENTS FROM DB
      // Based on batch_no (COURSE) from course_planner_data table
      // ===============================
      setProcessingStatus("Fetching trainer assignments...");

      const batchNos = offlinePlans.map((p) => p.batch_no).filter(Boolean);
      const trainerResult = await fetchTrainerForBatches(batchNos, offlinePlans);
      const trainerMap = trainerResult.trainerMap || {};
      setTrainerOverlapInfo(trainerResult.overlapInfo || {});

      // ===============================
      // STEP 3: ALSO TRY plan-with-trainers API as fallback
      // (For cases where trainer_domain table is the source)
      // ===============================
      let trainerApiMap = {};
      try {
        const trainerRes = await fetch(`${API_BASE}/api/plan-with-trainers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows }),
        });

        if (trainerRes.ok) {
          const trainerData = await trainerRes.json();
          const assignedRows = trainerData.assignedRows || [];

          // Build a map from COURSE -> trainer_name from the API response
          assignedRows.forEach((r) => {
            const course =
              r["COURSE"] || r["course"] || r["Course"] || "";
            const trainerName = r.trainer_name;
            if (
              course &&
              trainerName &&
              trainerName !== "UNASSIGNED" &&
              trainerName !== null
            ) {
              // Group by course: take first non-null assignment
              if (!trainerApiMap[course]) {
                trainerApiMap[course] = trainerName;
              }
            }
          });
        }
      } catch (trainerErr) {
        console.warn("plan-with-trainers API failed (non-fatal):", trainerErr);
      }

      // ===============================
      // STEP 4: ENRICH PLANS WITH TRAINER
      // Priority: DB trainer map > API trainer map > "UNASSIGNED"
      // ===============================
      const enrichedPlans = offlinePlans.map((p) => {
        const trainerFromDb = trainerMap[p.batch_no];
        const trainerFromApi = trainerApiMap[p.batch_no];

        const finalTrainer =
          (trainerFromDb && trainerFromDb !== "UNASSIGNED"
            ? trainerFromDb
            : null) ||
          (trainerFromApi && trainerFromApi !== "UNASSIGNED"
            ? trainerFromApi
            : null) ||
          "UNASSIGNED";

        return {
          ...p,
          trainer_name: finalTrainer,
        };
      });

      // ===============================
      // STEP 5: UPDATE STATE
      // ===============================

      setPlans(enrichedPlans);

      setUnallocatedBatches(
        unallocated.map((u) => ({
          batch_no: u.batch_no,
          enrolled: u.enrolled,
          a_start: u.a_start,
          a_end: u.a_end,
        }))
      );

      if (!offlinePlans.length) {
        setError(
          "No OFFLINE batches found in the file. Only MODE = OFFLINE rows are planned."
        );
      } else {
        const allDates = [];
        offlinePlans.forEach((p) => {
          if (p.a_start) allDates.push(p.a_start);
          if (p.a_end) allDates.push(p.a_end);
        });

        if (allDates.length > 0) {
          const matrixStart = allDates.reduce((a, b) =>
            a < b ? a : b
          );
          const matrixEnd = allDates.reduce((a, b) =>
            a > b ? a : b
          );

          const w = getWeeksInRange(matrixStart, matrixEnd);
          setWeeks(w);
        }

        setProcessingStatus(
          `Completed! Planned ${offlinePlans.length} OFFLINE batches.`
        );
      }
    } catch (err) {
      console.error("File processing error:", err);
      setError(
        `Failed to process file: ${
          err.message || "Invalid file format"
        }`
      );
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
        "TRAINER",
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
        const licenseInfo = getLicenseInfoForBatch(
          p.batch_no,
          p.capacity,
          p.enrolled
        );

        const totalShortage = licenseInfo.reduce(
          (sum, l) => sum + (l.additional_needed || 0),
          0
        );

        plansSheet.addRow([
          p.batch_no,
          p.mode,
          p.a_start,
          p.a_end,
          p.capacity,
          p.enrolled,
          totalShortage === 0 ? "YES" : "NO",
          totalShortage,
          p.classroom_name,
          p.slot,
          p.trainer_name || "UNASSIGNED",
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
        { width: 20 },
      ];

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

  // ✅ FIX 2: Save to backend — include actual capacity in payload
  const handleSaveMatrix = async () => {
    if (!plans.length && !unallocatedBatches.length) {
      setError("No matrix to save.");
      return;
    }

    setSaving(true);
    setSaveStatus("");
    setError("");

    try {
      // Combine BOTH allocated + unallocated
      const allRows = [
        ...plans,
        ...unallocatedBatches.map((u) => ({
          batch_no: u.batch_no,
          classroom_name: null,
          slot: null,
          a_start: u.a_start,
          a_end: u.a_end,
          enrolled: u.enrolled,
          capacity: u.capacity || 0,
          trainer_name: u.trainer_name || null,
        })),
      ];

      const occupancyRows = allRows.map((p) => ({
        batch_no: p.batch_no?.trim(),
        classroom_name: p.classroom_name || null,
        slot: p.slot || null,
        occupancy_start: p.a_start,
        occupancy_end: p.a_end,
        enrolled: p.enrolled || 0,
        // ✅ FIX 2: Always send actual capacity, not just enrolled
        capacity: p.capacity || p.enrolled || 0,
        trainer_name: p.trainer_name || null,
      }));

      const res = await fetch(`${API_BASE}/api/save-classroom-matrix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ occupancyRows }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const { inserted, updated, skipped } = data.summary || {};
      setSaveStatus(
        `✅ ${inserted || 0} NEW + ${updated || 0} UPDATED + ${skipped || 0} unchanged`
      );

      // ✅ FIX 2: After save, reload from DB but preserve current plans in state
      // so License Summary remains visible with correct capacity values
      // We store current plans snapshot before reload, then merge
      const currentPlansSnapshot = [...plans];
      const currentUnallocatedSnapshot = [...unallocatedBatches];

      await loadExistingMatrix();

      // If loadExistingMatrix returns empty or capacity is wrong,
      // fall back to current enriched plans
      setPlans((prev) => {
        if (!prev.length) return currentPlansSnapshot;
        // Merge: use DB data but override capacity if DB has default 35
        return prev.map((dbPlan) => {
          const localPlan = currentPlansSnapshot.find(
            (lp) => lp.batch_no === dbPlan.batch_no
          );
          if (localPlan) {
            return {
              ...dbPlan,
              // Use whichever capacity is larger (local is more accurate)
              capacity:
                localPlan.capacity > dbPlan.capacity
                  ? localPlan.capacity
                  : dbPlan.capacity,
              // Preserve trainer from local if DB says UNASSIGNED
              trainer_name:
                dbPlan.trainer_name && dbPlan.trainer_name !== "UNASSIGNED"
                  ? dbPlan.trainer_name
                  : localPlan.trainer_name || "UNASSIGNED",
            };
          }
          return dbPlan;
        });
      });
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
                  {/* ✅ FIX 1: Show trainer in batch details */}
                  <Typography variant="body2">
                    Trainer: {selectedBatch.trainer_name || "UNASSIGNED"}
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
        ) : !plans.length && !unallocatedBatches.length ? (
          <Alert severity="info">
            Upload a file with OFFLINE batches or rely on auto-loaded data to see the classroom
            occupancy matrix.
          </Alert>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Showing {plans.length} OFFLINE batches across {classrooms.length} classrooms.
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
                      sx={
                        row[0] === "UNALLOCATED"
                          ? { backgroundColor: "#fff3f3" }
                          : {}
                      }
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

      {/* ================= TRAINER MATRIX ================= */}
      <Paper elevation={3} sx={{ p: 4, borderRadius: 3, mt: 4 }}>
        <Typography variant="h5" fontWeight="bold" mb={2}>
          Trainer Allocation Matrix
        </Typography>

        {!plans.length ? (
          <Alert severity="info">
            Upload file to see trainer allocation.
          </Alert>
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
                    sx={
                      row[0] === "UNASSIGNED"
                        ? { backgroundColor: "#fff3f3" }
                        : {}
                    }
                  >
                    {row.map((cell, jdx) =>
                      jdx === 0 ? (
                        <TableCell
                          key={jdx}
                          sx={{ fontWeight: "bold", minWidth: 140 }}
                        >
                          {cell}
                        </TableCell>
                      ) : (
                        <TableCell
                          key={jdx}
                          sx={{ textAlign: "center", p: 0.5 }}
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
                              ? cell.map((batch, bid) => (
                                  <Chip
                                    key={bid}
                                    label={batch}
                                    size="small"
                                    sx={{
                                      backgroundColor:
                                        trainerBatchColorMap[batch] ||
                                        "#e0e0e0",
                                      fontWeight: 600,
                                      cursor: "pointer",
                                    }}
                                    onClick={() =>
                                      handleBatchClick(batch)
                                    }
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
        )}
      </Paper>

      {unallocatedBatches.length > 0 && (
        <Paper elevation={3} sx={{ p: 3, mt: 4 }}>
          <Typography variant="h6" color="error" gutterBottom>
            Unallocated Batches
          </Typography>

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Batch</TableCell>
                <TableCell>Enrolled</TableCell>
                <TableCell>Start Date</TableCell>
                <TableCell>End Date</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {unallocatedBatches.map((u) => (
                <TableRow key={u.batch_no}>
                  <TableCell>{u.batch_no}</TableCell>
                  <TableCell>{u.enrolled}</TableCell>
                  <TableCell>{u.a_start}</TableCell>
                  <TableCell>{u.a_end}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {Object.keys(trainerOverlapInfo).length > 0 && (
        <Paper elevation={3} sx={{ p: 3, mt: 4, border: "2px solid #f44336" }}>
          <Typography variant="h6" color="error" gutterBottom>
            ⚠️ Trainer Overlap / Unavailability
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            The following batches could not be assigned a trainer due to scheduling conflicts:
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Batch</TableCell>
                <TableCell>Trainer</TableCell>
                <TableCell>Conflicting Batch</TableCell>
                <TableCell>Conflict Dates</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.entries(trainerOverlapInfo).flatMap(([batchNo, overlaps]) =>
                overlaps.flatMap((o, i) =>
                  o.conflicts.map((c, j) => (
                    <TableRow key={`${batchNo}-${i}-${j}`} sx={{ backgroundColor: "#fff3f3" }}>
                      <TableCell sx={{ fontWeight: "bold", color: "error.main" }}>{batchNo}</TableCell>
                      <TableCell>{o.trainer}</TableCell>
                      <TableCell>{c.batch_no}</TableCell>
                      <TableCell sx={{ color: "error.main" }}>
                        {c.start} → {c.end}
                      </TableCell>
                    </TableRow>
                  ))
                )
              )}
            </TableBody>
          </Table>
        </Paper>
      )}

      {/* ================= LICENSE REQUIREMENT SECTION ================= */}
      {/* ✅ FIX 2: Always show this section when plans exist, regardless of save state */}
      {plans.length > 0 && (
        <Paper elevation={3} sx={{ p: 3, mt: 4 }}>
          <Typography variant="h6" color="primary" gutterBottom>
            License Requirement Summary
          </Typography>

          {(() => {
            const licenseIssues = [];

            plans.forEach((p) => {
              if (!p.batch_no) return;

              const licenseInfo = getLicenseInfoForBatch(
                p.batch_no,
                p.capacity,
                p.enrolled
              );

              const shortages = licenseInfo.filter(
                (l) => l.additional_needed > 0
              );

              if (shortages.length > 0) {
                licenseIssues.push({
                  batch_no: p.batch_no,
                  shortages,
                });
              }
            });

            if (licenseIssues.length === 0) {
              return (
                <Alert severity="success">
                  ✅ License is sufficient for all batches.
                </Alert>
              );
            }

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
                  {licenseIssues.map((issue) =>
                    issue.shortages.map((lic, idx) => (
                      <TableRow
                        key={`${issue.batch_no}-${idx}`}
                        sx={{ backgroundColor: "#fff3f3" }}
                      >
                        <TableCell sx={{ fontWeight: "bold", color: "error.main" }}>
                          {issue.batch_no}
                        </TableCell>
                        <TableCell>{lic.license_name}</TableCell>
                        <TableCell>{lic.count}</TableCell>
                        <TableCell>{lic.required}</TableCell>
                        <TableCell sx={{ color: "error.main", fontWeight: 600 }}>
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