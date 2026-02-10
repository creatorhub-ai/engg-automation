// ClassroomPlanner.jsx
import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  Paper,
  Typography,
  Button,
  Box,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  Select,
  MenuItem,
  Stack,
  CircularProgress,
  Alert,
} from "@mui/material";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";

/* ================= CONFIG ================= */
const API_BASE =
  process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

/* ================= COLORS ================= */
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
];

/* ================= UTILS ================= */
const parseExcelDate = (v) => {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(v)) {
    const [d, m, y] = v.split(".");
    return new Date(`${y}-${m}-${d}`);
  }
  return new Date(v);
};

const toISO = (d) =>
  d instanceof Date && !isNaN(d) ? d.toISOString().slice(0, 10) : "";

const isOverlap = (s1, e1, s2, e2) =>
  !(new Date(e1) < new Date(s2) || new Date(s1) > new Date(e2));

function getWeeksInRange(start, end) {
  const weeks = [];
  const cur = new Date(start);
  cur.setDate(cur.getDate() - cur.getDay());

  while (cur <= new Date(end)) {
    const y = cur.getFullYear();
    const m = cur.getMonth();
    const weekNum = Math.ceil(
      (cur.getDate() + 1 - new Date(y, m, 1).getDay()) / 7
    );

    weeks.push({
      year: y,
      month: cur.toLocaleString("default", { month: "short" }),
      weekNum,
      start: new Date(cur),
      end: new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 6),
      key: `${y}-${m + 1}-W${weekNum}`,
    });

    cur.setDate(cur.getDate() + 7);
  }
  return weeks;
}

const getBatchColorMap = (plans) => {
  const map = {};
  [...new Set(plans.map((p) => p.batch_no))].forEach(
    (b, i) => (map[b] = colorPalette[i % colorPalette.length])
  );
  return map;
};

/* ================= MAIN ================= */
export default function ClassroomPlanner() {
  const [plans, setPlans] = useState([]);
  const [weeks, setWeeks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [yearFilter, setYearFilter] = useState("ALL");
  const [batchFilter, setBatchFilter] = useState("ALL");
  const [showUnassigned, setShowUnassigned] = useState(false);

  /* ---------- LOAD MATRIX ---------- */
  const loadMatrix = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/get-classroom-matrix`);
      const { occupancyRows } = await res.json();

      setPlans(
        occupancyRows.map((r) => ({
          batch_no: r.batch_no,
          classroom_name: r.classroom_name,
          slot: r.slot,
          a_start: r.occupancy_start,
          a_end: r.occupancy_end,
        }))
      );

      const dates = occupancyRows.flatMap((r) => [
        r.occupancy_start,
        r.occupancy_end,
      ]);
      setWeeks(getWeeksInRange(Math.min(...dates), Math.max(...dates)));
    } catch (e) {
      setError("Failed to load matrix");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMatrix();
  }, [loadMatrix]);

  /* ---------- FILE UPLOAD ---------- */
  const handleUpload = async (file) => {
    setLoading(true);
    try {
      const wb = XLSX.read(await file.arrayBuffer());
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);

      const payload = rows.map((r) => ({
        batch_no: r.COURSE,
        occupancy_start: toISO(parseExcelDate(r["A.START DATE"])),
        occupancy_end: toISO(parseExcelDate(r["A.DUE DATE"])),
        enrolled: r.ENROLLED || null,
        classroom_name: r.CLASS_ROOM || null,
        slot:
          r.SHIFTS?.toLowerCase() === "shift_2"
            ? "evening"
            : "morning",
      }));

      await fetch(`${API_BASE}/api/classroom-occupancy/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      await loadMatrix();
    } catch (e) {
      setError("Upload failed");
    } finally {
      setLoading(false);
    }
  };

  /* ---------- FILTERS ---------- */
  const years = ["ALL", ...new Set(weeks.map((w) => w.year))];
  const batches = ["ALL", ...new Set(plans.map((p) => p.batch_no))];

  const filteredPlans = plans.filter(
    (p) =>
      (batchFilter === "ALL" || p.batch_no === batchFilter) &&
      (yearFilter === "ALL" ||
        weeks.some(
          (w) =>
            w.year === yearFilter &&
            isOverlap(p.a_start, p.a_end, w.start, w.end)
        ))
  );

  /* ---------- MATRIX ---------- */
  const classrooms = [...new Set(filteredPlans.map((p) => p.classroom_name))];
  const slots = ["morning", "evening"];

  const { matrix, unassigned } = useMemo(() => {
    const occ = {};
    const un = {};

    classrooms.forEach((c) =>
      slots.forEach((s) => (occ[`${c}|${s}`] = {}))
    );

    filteredPlans.forEach((p) => {
      weeks.forEach((w) => {
        if (
          yearFilter !== "ALL" &&
          w.year !== yearFilter
        )
          return;

        if (!isOverlap(p.a_start, p.a_end, w.start, w.end)) return;

        const key = `${p.classroom_name}|${p.slot}`;
        occ[key][w.key] ??= [];

        if (occ[key][w.key].length === 0) {
          occ[key][w.key].push(p.batch_no);
        } else {
          un[w.key] ??= [];
          un[w.key].push(p.batch_no);
        }
      });
    });

    return { matrix: occ, unassigned: un };
  }, [filteredPlans, weeks, classrooms, slots, yearFilter]);

  const batchColors = getBatchColorMap(plans);

  /* ---------- EXPORT ---------- */
  const exportExcel = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Matrix");

    ws.addRow(["Classroom", "Slot", ...weeks.map((w) => `${w.year} W${w.weekNum}`)]);

    classrooms.forEach((c) =>
      slots.forEach((s) => {
        const row = ws.addRow([
          c,
          s,
          ...weeks.map(
            (w) => matrix[`${c}|${s}`][w.key]?.[0] || ""
          ),
        ]);

        row.eachCell((cell, i) => {
          const batch = cell.value;
          if (batch && batchColors[batch]) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: batchColors[batch].replace("#", "FF") },
            };
          }
        });
      })
    );

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf]);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "classroom_matrix.xlsx";
    a.click();
  };

  /* ================= UI ================= */
  return (
    <Box sx={{ maxWidth: "98vw", mx: "auto", my: 3 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Classroom Allocation Matrix
        </Typography>

        <Stack direction="row" spacing={2} mb={2}>
          <Button variant="contained" component="label">
            Upload Excel
            <input hidden type="file" onChange={(e) => handleUpload(e.target.files[0])} />
          </Button>

          <Button variant="outlined" onClick={exportExcel}>
            Export
          </Button>

          <FormControl size="small">
            <Select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
              {years.map((y) => (
                <MenuItem key={y} value={y}>{y}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small">
            <Select value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)}>
              {batches.map((b) => (
                <MenuItem key={b} value={b}>{b}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button color="warning" onClick={() => setShowUnassigned(true)}>
            Unassigned
          </Button>
        </Stack>

        {loading && <CircularProgress />}
        {error && <Alert severity="error">{error}</Alert>}

        <TableContainer sx={{ maxHeight: 500 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell>Classroom</TableCell>
                <TableCell>Slot</TableCell>
                {weeks
                  .filter((w) => yearFilter === "ALL" || w.year === yearFilter)
                  .map((w) => (
                    <TableCell key={w.key} align="center">
                      {w.year} · {w.month} W{w.weekNum}
                    </TableCell>
                  ))}
              </TableRow>
            </TableHead>

            <TableBody>
              {classrooms.map((c) =>
                slots.map((s) => (
                  <TableRow key={`${c}-${s}`}>
                    <TableCell>{c}</TableCell>
                    <TableCell>{s}</TableCell>
                    {weeks
                      .filter((w) => yearFilter === "ALL" || w.year === yearFilter)
                      .map((w) => (
                        <TableCell key={w.key} align="center">
                          {(matrix[`${c}|${s}`][w.key] || []).map((b) => (
                            <Chip
                              key={b}
                              label={b}
                              size="small"
                              sx={{
                                backgroundColor: batchColors[b],
                                fontWeight: 600,
                              }}
                            />
                          ))}
                        </TableCell>
                      ))}
                  </TableRow>
                ))
              )}

              <TableRow sx={{ bgcolor: "#fff3e0" }}>
                <TableCell colSpan={2}>UNASSIGNED</TableCell>
                {weeks.map((w) => (
                  <TableCell key={w.key}>
                    {(unassigned[w.key] || []).map((b) => (
                      <Chip key={b} label={b} color="error" size="small" />
                    ))}
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={showUnassigned} onClose={() => setShowUnassigned(false)}>
        <DialogTitle>Unassigned Batches</DialogTitle>
        <DialogContent>
          {[...new Set(Object.values(unassigned).flat())].map((b) => (
            <Chip key={b} label={b} color="error" sx={{ m: 0.5 }} />
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowUnassigned(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
