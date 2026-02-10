// ClassroomPlanner.jsx
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
  FormControl,
  Select,
  MenuItem,
  Stack,
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
const slotDisplayMap = {
  morning: "Morning",
  evening: "Evening",
  Shift_1: "Morning",
  Shift_2: "Evening",
};

const parseExcelDate = (v) => {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(v);
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(v)) {
    const [d, m, y] = v.split(".");
    return new Date(`${y}-${m}-${d}`);
  }
  const d = new Date(v);
  return isNaN(d) ? null : d;
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
  const [processingStatus, setProcessingStatus] = useState("");
  const [error, setError] = useState("");

  const [yearFilter, setYearFilter] = useState("ALL");
  const [batchFilter, setBatchFilter] = useState("ALL");
  const [showUnassigned, setShowUnassigned] = useState(false);

  /* ---------- LOAD SAVED MATRIX ---------- */
  const loadExistingMatrix = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/get-classroom-matrix`);
      if (!res.ok) return;

      const { occupancyRows } = await res.json();
      const mapped = occupancyRows.map((r) => ({
        batch_no: r.batch_no,
        classroom_name: r.classroom_name,
        slot: r.slot,
        a_start: r.occupancy_start,
        a_end: r.occupancy_end,
      }));

      setPlans(mapped);

      if (mapped.length) {
        const allDates = mapped.flatMap((p) => [p.a_start, p.a_end]);
        setWeeks(getWeeksInRange(Math.min(...allDates.map(Date.parse)), Math.max(...allDates.map(Date.parse))));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExistingMatrix();
  }, [loadExistingMatrix]);

  /* ---------- FILTERS ---------- */
  const years = useMemo(() => {
    const ys = new Set();
    weeks.forEach((w) => ys.add(w.year));
    return ["ALL", ...Array.from(ys).sort()];
  }, [weeks]);

  const batches = useMemo(
    () => ["ALL", ...new Set(plans.map((p) => p.batch_no))],
    [plans]
  );

  const filteredPlans = useMemo(() => {
    return plans.filter((p) => {
      if (batchFilter !== "ALL" && p.batch_no !== batchFilter) return false;
      if (
        yearFilter !== "ALL" &&
        !weeks.some(
          (w) =>
            w.year === yearFilter &&
            isOverlap(p.a_start, p.a_end, toISO(w.start), toISO(w.end))
        )
      )
        return false;
      return true;
    });
  }, [plans, batchFilter, yearFilter, weeks]);

  /* ---------- MATRIX BUILD ---------- */
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

        if (
          !isOverlap(p.a_start, p.a_end, toISO(w.start), toISO(w.end))
        )
          return;

        const key = `${p.classroom_name}|${p.slot}`;
        if (!occ[key][w.key]) occ[key][w.key] = [];

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

  const batchColors = useMemo(() => getBatchColorMap(plans), [plans]);

  /* ================= UI ================= */
  return (
    <Box sx={{ maxWidth: "98vw", mx: "auto", my: 4 }}>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Classroom Occupancy Matrix
        </Typography>

        <Stack direction="row" spacing={2} mb={2}>
          <FormControl size="small">
            <Select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
              {years.map((y) => (
                <MenuItem key={y} value={y}>
                  {y}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small">
            <Select value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)}>
              {batches.map((b) => (
                <MenuItem key={b} value={b}>
                  {b}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button color="warning" variant="contained" onClick={() => setShowUnassigned(true)}>
            Unassigned
          </Button>
        </Stack>

        <TableContainer sx={{ maxHeight: 450 }}>
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
                    <TableCell fontWeight="bold">{c}</TableCell>
                    <TableCell>{slotDisplayMap[s]}</TableCell>

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
                                cursor: "pointer",
                              }}
                            />
                          ))}
                        </TableCell>
                      ))}
                  </TableRow>
                ))
              )}

              {/* UNASSIGNED ROW */}
              <TableRow sx={{ bgcolor: "#fff3e0" }}>
                <TableCell colSpan={2} fontWeight="bold">
                  UNASSIGNED
                </TableCell>
                {weeks
                  .filter((w) => yearFilter === "ALL" || w.year === yearFilter)
                  .map((w) => (
                    <TableCell key={w.key} align="center">
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

      {/* UNASSIGNED POPUP */}
      <Dialog open={showUnassigned} onClose={() => setShowUnassigned(false)} fullWidth maxWidth="sm">
        <DialogTitle>Unassigned Batches</DialogTitle>
        <DialogContent>
          {Object.values(unassigned)
            .flat()
            .filter((v, i, a) => a.indexOf(v) === i)
            .map((b) => (
              <Chip key={b} label={b} color="error" sx={{ mr: 1, mb: 1 }} />
            ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowUnassigned(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
