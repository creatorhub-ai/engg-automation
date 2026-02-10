// ClassroomPlanner.js
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
  Modal,
  MenuItem,
} from "@mui/material";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";

/* =========================
   CONFIG
========================= */
const API_BASE =
  process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

const colorPalette = [
  "#edc7cf","#bdd9bf","#c7ceea","#ffeebb","#a4c2f4",
  "#a1eafb","#e6c7e3","#f7cac9","#ffe066","#f8b195",
  "#80ced6","#d5f4e6","#f0a6ca","#b5ead7","#ead3d7",
  "#ffe0ac","#b3cdd1","#eec9e6",
];

const slotDisplayMap = {
  morning: "Morning",
  evening: "Evening",
  unassigned: "Unassigned",
};

/* =========================
   DATE HELPERS
========================= */
const toISO = (d) =>
  d instanceof Date && !isNaN(d) ? d.toISOString().slice(0, 10) : "";

const parseExcelDate = (v) => {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(v)) {
    const [d,m,y] = v.split(".");
    return new Date(`${y}-${m}-${d}`);
  }
  const d = new Date(v);
  return isNaN(d) ? null : d;
};

const isOverlap = (a1,a2,b1,b2) =>
  !(new Date(a2) < new Date(b1) || new Date(a1) > new Date(b2));

/* =========================
   WEEK GENERATOR
========================= */
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

/* =========================
   CLASSROOM PLANNING
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

    const start = toISO(parseExcelDate(r["A.START DATE"]));
    const end = toISO(parseExcelDate(r["A.DUE DATE"]));
    const enrolled = Number(r.ENROLLED || 0);
    const batch = r.COURSE;

    let placed = false;

    for (const room of rooms) {
      if (room.cap < enrolled) continue;

      for (const slot of ["morning", "evening"]) {
        const key = `${room.name}|${slot}`;
        occupancy[key] ??= [];

        if (!occupancy[key].some(o => isOverlap(start,end,o.start,o.end))) {
          occupancy[key].push({ start, end });
          plans.push({
            batch_no: batch,
            classroom_name: room.name,
            slot,
            a_start: start,
            a_end: end,
            enrolled,
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
      });
    }
  });

  return { plans, unassigned };
}

/* =========================
   MAIN COMPONENT
========================= */
export default function ClassroomPlanner() {
  const [plans, setPlans] = useState([]);
  const [weeks, setWeeks] = useState([]);
  const [unassigned, setUnassigned] = useState([]);
  const [showUnassigned, setShowUnassigned] = useState(false);

  const [batchFilter, setBatchFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("ALL");

  /* =========================
     FILE UPLOAD
  ========================= */
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: "array" });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

    const { plans, unassigned } = planClassroomsForOffline(rows);
    setPlans(plans);
    setUnassigned(unassigned);
    setShowUnassigned(unassigned.length > 0);

    const dates = plans.flatMap(p => [p.a_start,p.a_end]);
    if (dates.length) {
      setWeeks(getWeeksInRange(
        dates.reduce((a,b)=>a<b?a:b),
        dates.reduce((a,b)=>a>b?a:b)
      ));
    }
  };

  /* =========================
     FILTERED DATA
  ========================= */
  const years = useMemo(
    () => [...new Set(weeks.map(w => w.year))],
    [weeks]
  );

  const filteredWeeks = weeks.filter(
    w => yearFilter === "ALL" || w.year === Number(yearFilter)
  );

  const classrooms = useMemo(
    () => [...new Set(plans.map(p => p.classroom_name))],
    [plans]
  );

  const table = useMemo(() => {
    const rows = [];

    classrooms.forEach(room => {
      ["morning","evening","unassigned"].forEach(slot => {
        const r = [room, slot];
        filteredWeeks.forEach(w => {
          r.push(
            plans
              .filter(p =>
                p.classroom_name === room &&
                p.slot === slot &&
                isOverlap(p.a_start,p.a_end,w.start,w.end) &&
                p.batch_no?.toLowerCase().includes(batchFilter.toLowerCase())
              )
              .map(p => p.batch_no)
          );
        });
        rows.push(r);
      });
    });

    return rows;
  }, [plans, filteredWeeks, batchFilter, classrooms]);

  /* =========================
     UI
  ========================= */
  return (
    <Box sx={{ maxWidth:"98vw", mx:"auto", my:4 }}>
      <Paper sx={{ p:4, mb:3 }}>
        <Typography variant="h4">Classroom Planner</Typography>
        <Divider sx={{ my:2 }}/>

        <Button variant="contained" component="label">
          Upload File
          <input hidden type="file" onChange={handleFileUpload}/>
        </Button>

        {/* 🔵 FILTERS */}
        <Box sx={{ display:"flex", gap:2, mt:3 }}>
          <TextField
            label="Filter by Batch"
            value={batchFilter}
            onChange={e=>setBatchFilter(e.target.value)}
          />
          <TextField
            select
            label="Year"
            value={yearFilter}
            onChange={e=>setYearFilter(e.target.value)}
          >
            <MenuItem value="ALL">ALL</MenuItem>
            {years.map(y=>(
              <MenuItem key={y} value={y}>{y}</MenuItem>
            ))}
          </TextField>
        </Box>
      </Paper>

      {/* 🔵 MATRIX */}
      <Paper sx={{ p:3 }}>
        <Typography variant="h5" mb={2}>Classroom Occupancy Matrix</Typography>

        <TableContainer sx={{ maxHeight:450 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell>Classroom</TableCell>
                <TableCell>Slot</TableCell>
                {filteredWeeks.map(w=>(
                  <TableCell key={w.key} align="center">
                    {w.month} {w.year} – W{w.weekNum}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {table.map((row,i)=>(
                <TableRow key={i}>
                  {row.map((cell,j)=>(
                    j<2
                      ? <TableCell key={j}>{slotDisplayMap[cell]||cell}</TableCell>
                      : <TableCell key={j} align="center">
                          {cell.map((b,k)=>(
                            <Chip key={k} label={b} size="small" sx={{ m:0.25 }}/>
                          ))}
                        </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* 🔵 UNASSIGNED POPUP */}
      <Modal open={showUnassigned} onClose={()=>setShowUnassigned(false)}>
        <Paper sx={{ p:4, width:500, mx:"auto", mt:"10%" }}>
          <Typography variant="h6" gutterBottom>
            Unassigned Batches
          </Typography>
          {unassigned.map((u,i)=>(
            <Alert key={i} severity="warning" sx={{ mb:1 }}>
              <b>{u.batch_no}</b><br/>
              {u.a_start} → {u.a_end}<br/>
              Enrolled: {u.enrolled}<br/>
              Reason: {u.reason}
            </Alert>
          ))}
          <Button onClick={()=>setShowUnassigned(false)} sx={{ mt:2 }}>
            Close
          </Button>
        </Paper>
      </Modal>
    </Box>
  );
}
