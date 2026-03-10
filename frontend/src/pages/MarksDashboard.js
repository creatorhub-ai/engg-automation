import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Button,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  CircularProgress,
  Chip,
  Tooltip,
  Fade,
  Paper,
  Tabs,
  Tab,
} from "@mui/material";
import BarChartIcon        from "@mui/icons-material/BarChart";
import GroupIcon           from "@mui/icons-material/Group";
import DownloadIcon        from "@mui/icons-material/Download";
import EmojiEventsIcon     from "@mui/icons-material/EmojiEvents";
import WorkIcon            from "@mui/icons-material/Work";
import CheckCircleIcon     from "@mui/icons-material/CheckCircle";
import CancelIcon          from "@mui/icons-material/Cancel";
import StarIcon            from "@mui/icons-material/Star";

const API_BASE =
  process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

/* ─── Design tokens ─────────────────────────────────────────────────────── */
const TOKENS = {
  bg:          "#d4e0fd",
  surface:     "#ffffff",
  surfaceAlt:  "#f8f9fc",
  border:      "#e4e8f0",
  accent:      "#3d5afe",
  accentLight: "#e8ecff",
  text:        "#1a1f36",
  textSub:     "#6b7280",
  success:     { fill: "#10b981", light: "#d1fae5", text: "#065f46" },
  warning:     { fill: "#f59e0b", light: "#fef3c7", text: "#92400e" },
  error:       { fill: "#ef4444", light: "#fee2e2", text: "#991b1b" },
  pdft:        { fill: "#7c3aed", light: "#ede9fe", text: "#4c1d95" },
  dvft:        { fill: "#0891b2", light: "#e0f2fe", text: "#0c4a6e" },
};

const cardSx = {
  background:   TOKENS.surface,
  borderRadius: "18px",
  border:       `1.5px solid ${TOKENS.border}`,
  boxShadow:    "0 2px 16px rgba(60,80,180,0.07)",
  p:            3,
};

/* ─── Batch helpers ─────────────────────────────────────────────────────── */
function isPdftBatch(batchNo) { return (batchNo || "").toUpperCase().includes("PDFT"); }
function isDvftBatch(batchNo) {
  const up = (batchNo || "").toUpperCase();
  return up.includes("DVFT") || (up.startsWith("DV") && !up.includes("PDFT"));
}

/* ─── PDFT subject key resolver ─────────────────────────────────────────── */
// assessment_name examples: "Digital Design", "CMOS", "TCL", "Physical Design",
//                           "Intermediate Assessment", "Final Project", "Viva"
function getPdftSubjectKey(assessmentName) {
  const raw = (assessmentName || "").toLowerCase();
  if (raw.includes("intermediate"))               return "intermediate";
  if (raw.includes("digital"))                    return "digital";
  if (raw.includes("cmos"))                       return "cmos";
  if (raw.includes("tcl"))                        return "tcl";
  if (raw.includes("physical") || raw.includes("phy")) return "physical";
  if (raw.includes("final project") || raw.includes("project")) return "project";
  if (raw.includes("viva"))                       return "viva";
  return null;
}

/* ─── DVFT subject key resolver ─────────────────────────────────────────── */
// assessment_name examples: "Digital", "Verilog", "SV", "UVM", "Python",
//                           "Intermediate Assessment", "Final Project", "Viva"
function getDvftSubjectKey(assessmentName) {
  const raw = (assessmentName || "").toLowerCase();
  if (raw.includes("intermediate"))               return "intermediate";
  if (raw.includes("uvm"))                        return "uvm";       // check uvm before sv
  if (raw.includes("python"))                     return "python";
  if (raw.includes("sv"))                         return "sv";
  if (raw.includes("verilog"))                    return "verilog";
  if (raw.includes("digital"))                    return "digital";
  if (raw.includes("final project") || raw.includes("project")) return "project";
  if (raw.includes("viva"))                       return "viva";
  return null;
}

/* ─── Grade helper ──────────────────────────────────────────────────────── */
function getGrade(pct) {
  if (pct === null || pct === undefined) return "—";
  if (pct >= 90) return "O";
  if (pct >= 80) return "A+";
  if (pct >= 70) return "A";
  if (pct >= 60) return "B+";
  if (pct >= 50) return "B";
  return "F";
}

function gradeColor(grade) {
  const map = {
    O: TOKENS.success, "A+": TOKENS.success, A: { fill: "#3d5afe", light: "#e8ecff", text: "#1e3a8a" },
    "B+": TOKENS.warning, B: TOKENS.warning, F: TOKENS.error,
  };
  return map[grade] || { fill: TOKENS.textSub, light: "#f3f4f6", text: TOKENS.textSub };
}

/* ─── PDFT Scorecard calculator ─────────────────────────────────────────── */
//   Intermediate        → 10%  (out of 25 → /25*100)
//   Digital + CMOS      → 20%  (Digital/30 + CMOS/20 averaged to /100)
//   TCL + Physical      → 30%  (TCL/25 + Physical/50 averaged to /100)
//   Final Project       → 30%  (out of 100)
//   Viva                → 10%  (out of 25 → /25*100)
function calcPdftScorecard(rows) {
  // rows: [{ learner_id, learner_name, email, assessment_name, points, out_off }]
  const byLearner = {};
  rows.forEach(r => {
    if (!byLearner[r.learner_id]) {
      byLearner[r.learner_id] = { id: r.learner_id, name: r.learner_name, email: r.email, subjects: {} };
    }
    const key = getPdftSubjectKey(r.assessment_name);
    if (key) {
      const pct = r.out_off > 0 ? (r.points / r.out_off) * 100 : 0;
      // keep highest if duplicates
      if (!byLearner[r.learner_id].subjects[key] || pct > byLearner[r.learner_id].subjects[key]) {
        byLearner[r.learner_id].subjects[key] = pct;
      }
    }
  });

  return Object.values(byLearner).map(l => {
    const s = l.subjects;

    // Intermediate (10%)
    const intermediateOutOf100 = s.intermediate ?? null;

    // Digital + CMOS (20%) — average of the two /100 values
    const digitalVerilogScores = [s.digital, s.cmos].filter(v => v !== undefined);
    const pdDigitalCmosOutOf100 = digitalVerilogScores.length
      ? digitalVerilogScores.reduce((a, b) => a + b, 0) / digitalVerilogScores.length
      : null;

    // TCL + Physical (30%) — average of the two /100 values
    const tclPhysicalScores = [s.tcl, s.physical].filter(v => v !== undefined);
    const pdTclPhysicalOutOf100 = tclPhysicalScores.length
      ? tclPhysicalScores.reduce((a, b) => a + b, 0) / tclPhysicalScores.length
      : null;

    // Project (30%)
    const projectOutOf100 = s.project ?? null;

    // Viva (10%)
    const vivaOutOf100 = s.viva ?? null;

    // Weighted overall — only include components where we have data
    let weightedSum = 0, weightTotal = 0;
    const add = (val, w) => { if (val !== null) { weightedSum += val * w; weightTotal += w; } };
    add(intermediateOutOf100, 0.10);
    add(pdDigitalCmosOutOf100, 0.20);
    add(pdTclPhysicalOutOf100, 0.30);
    add(projectOutOf100, 0.30);
    add(vivaOutOf100, 0.10);

    const overall = weightTotal > 0 ? weightedSum / weightTotal * (weightTotal / 1.0) : null;
    // Re-compute as proper weighted sum
    const overallFinal = (intermediateOutOf100 !== null ? intermediateOutOf100 * 0.10 : 0)
                       + (pdDigitalCmosOutOf100 !== null ? pdDigitalCmosOutOf100 * 0.20 : 0)
                       + (pdTclPhysicalOutOf100 !== null ? pdTclPhysicalOutOf100 * 0.30 : 0)
                       + (projectOutOf100 !== null ? projectOutOf100 * 0.30 : 0)
                       + (vivaOutOf100 !== null ? vivaOutOf100 * 0.10 : 0);

    const grade = getGrade(overallFinal);
    const certification = projectOutOf100 !== null && overallFinal !== null
      ? projectOutOf100 >= 70 && overallFinal >= 70
      : null;
    const placement = projectOutOf100 !== null && vivaOutOf100 !== null && overallFinal !== null
      ? projectOutOf100 >= 70 && vivaOutOf100 >= 70 && overallFinal >= 80
      : null;

    return {
      id: l.id, name: l.name, email: l.email,
      intermediate: intermediateOutOf100,
      digital: s.digital ?? null,
      cmos: s.cmos ?? null,
      tcl: s.tcl ?? null,
      physical: s.physical ?? null,
      project: projectOutOf100,
      viva: vivaOutOf100,
      overall: overallFinal,
      grade,
      certification,
      placement,
    };
  });
}

/* ─── DVFT Scorecard calculator ─────────────────────────────────────────── */
//   Intermediate              → 10%  (out of 25 → /25*100)
//   Digital + Verilog         → 20%  (average of both /100)
//   SV + UVM + Python         → 30%  (average of all /100)
//   Final Project             → 30%  (out of 100)
//   Viva                      → 10%  (out of 25 → /25*100)
function calcDvftScorecard(rows) {
  const byLearner = {};
  rows.forEach(r => {
    if (!byLearner[r.learner_id]) {
      byLearner[r.learner_id] = { id: r.learner_id, name: r.learner_name, email: r.email, subjects: {} };
    }
    const key = getDvftSubjectKey(r.assessment_name);
    if (key) {
      const pct = r.out_off > 0 ? (r.points / r.out_off) * 100 : 0;
      if (!byLearner[r.learner_id].subjects[key] || pct > byLearner[r.learner_id].subjects[key]) {
        byLearner[r.learner_id].subjects[key] = pct;
      }
    }
  });

  return Object.values(byLearner).map(l => {
    const s = l.subjects;

    // Intermediate (10%)
    const intermediateOutOf100 = s.intermediate ?? null;

    // Digital + Verilog (20%)
    const dvGroup1 = [s.digital, s.verilog].filter(v => v !== undefined);
    const dvDigitalVerilogOutOf100 = dvGroup1.length
      ? dvGroup1.reduce((a, b) => a + b, 0) / dvGroup1.length
      : null;

    // SV + UVM + Python (30%)
    const dvGroup2 = [s.sv, s.uvm, s.python].filter(v => v !== undefined);
    const dvSvGroupOutOf100 = dvGroup2.length
      ? dvGroup2.reduce((a, b) => a + b, 0) / dvGroup2.length
      : null;

    // Project (30%)
    const projectOutOf100 = s.project ?? null;

    // Viva (10%)
    const vivaOutOf100 = s.viva ?? null;

    const overallFinal = (intermediateOutOf100 !== null ? intermediateOutOf100 * 0.10 : 0)
                       + (dvDigitalVerilogOutOf100 !== null ? dvDigitalVerilogOutOf100 * 0.20 : 0)
                       + (dvSvGroupOutOf100 !== null ? dvSvGroupOutOf100 * 0.30 : 0)
                       + (projectOutOf100 !== null ? projectOutOf100 * 0.30 : 0)
                       + (vivaOutOf100 !== null ? vivaOutOf100 * 0.10 : 0);

    const grade = getGrade(overallFinal);
    const certification = projectOutOf100 !== null && overallFinal !== null
      ? projectOutOf100 >= 70 && overallFinal >= 70
      : null;
    const placement = projectOutOf100 !== null && vivaOutOf100 !== null && overallFinal !== null
      ? projectOutOf100 >= 70 && vivaOutOf100 >= 70 && overallFinal >= 80
      : null;

    return {
      id: l.id, name: l.name, email: l.email,
      intermediate: intermediateOutOf100,
      digital: s.digital ?? null,
      verilog: s.verilog ?? null,
      sv: s.sv ?? null,
      uvm: s.uvm ?? null,
      python: s.python ?? null,
      project: projectOutOf100,
      viva: vivaOutOf100,
      overall: overallFinal,
      grade,
      certification,
      placement,
    };
  });
}

/* ─── Pct cell helper ───────────────────────────────────────────────────── */
function PctCell({ val }) {
  if (val === null || val === undefined) return <TableCell align="center" sx={{ color: TOKENS.textSub, fontSize: 12 }}>—</TableCell>;
  const rounded = Math.round(val * 10) / 10;
  const color = val >= 70 ? TOKENS.success.text : val >= 50 ? TOKENS.warning.text : TOKENS.error.text;
  return (
    <TableCell align="center" sx={{ fontWeight: 600, fontSize: 13, color }}>
      {rounded}%
    </TableCell>
  );
}

/* ─── Bool cell (Certification / Placement) ─────────────────────────────── */
function BoolCell({ val, trueLabel = "Yes", falseLabel = "No" }) {
  if (val === null || val === undefined)
    return <TableCell align="center" sx={{ color: TOKENS.textSub, fontSize: 12 }}>—</TableCell>;
  return (
    <TableCell align="center">
      {val
        ? <Chip icon={<CheckCircleIcon sx={{ fontSize: 14 }} />} label={trueLabel} size="small"
            sx={{ background: TOKENS.success.light, color: TOKENS.success.text, fontWeight: 700, fontSize: 11 }} />
        : <Chip icon={<CancelIcon sx={{ fontSize: 14 }} />} label={falseLabel} size="small"
            sx={{ background: TOKENS.error.light, color: TOKENS.error.text, fontWeight: 700, fontSize: 11 }} />}
    </TableCell>
  );
}

/* ─── Grade cell ─────────────────────────────────────────────────────────── */
function GradeCell({ grade }) {
  const c = gradeColor(grade);
  return (
    <TableCell align="center">
      <Chip label={grade} size="small"
        sx={{ background: c.light, color: c.text, fontWeight: 800, fontSize: 12, minWidth: 36 }} />
    </TableCell>
  );
}

/* ─── CSV export ─────────────────────────────────────────────────────────── */
function exportCsv(rows, columns, filename) {
  const header = columns.map(c => c.label).join(",");
  const body = rows.map(r =>
    columns.map(c => {
      const v = c.get(r);
      if (v === null || v === undefined) return "";
      return typeof v === "string" && v.includes(",") ? `"${v}"` : v;
    }).join(",")
  ).join("\n");
  const blob = new Blob([`${header}\n${body}`], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/* ─── Batch type pill ───────────────────────────────────────────────────── */
function BatchPill({ batchNo }) {
  const isPdft = isPdftBatch(batchNo);
  const isDvft = isDvftBatch(batchNo);
  if (!isPdft && !isDvft) return null;
  const { fill, light, text } = isPdft ? TOKENS.pdft : TOKENS.dvft;
  return (
    <Chip label={isPdft ? "PDFT Batch" : "DVFT Batch"} size="small"
      sx={{ background: light, color: text, fontWeight: 700, fontSize: 11,
            border: `1px solid ${fill}30`, ml: 1 }} />
  );
}

/* ─── PDFT Scorecard Table ───────────────────────────────────────────────── */
function PdftScorecardTable({ data }) {
  const colSx = { fontWeight: 700, fontSize: 12, color: TOKENS.textSub, whiteSpace: "nowrap" };

  const csvCols = [
    { label: "Name",          get: r => r.name },
    { label: "Email",         get: r => r.email },
    { label: "Intermediate%", get: r => r.intermediate !== null ? Math.round(r.intermediate * 10) / 10 : "" },
    { label: "Digital%",      get: r => r.digital !== null ? Math.round(r.digital * 10) / 10 : "" },
    { label: "CMOS%",         get: r => r.cmos !== null ? Math.round(r.cmos * 10) / 10 : "" },
    { label: "TCL%",          get: r => r.tcl !== null ? Math.round(r.tcl * 10) / 10 : "" },
    { label: "Physical%",     get: r => r.physical !== null ? Math.round(r.physical * 10) / 10 : "" },
    { label: "Project%",      get: r => r.project !== null ? Math.round(r.project * 10) / 10 : "" },
    { label: "Viva%",         get: r => r.viva !== null ? Math.round(r.viva * 10) / 10 : "" },
    { label: "Overall%",      get: r => Math.round(r.overall * 10) / 10 },
    { label: "Grade",         get: r => r.grade },
    { label: "Certification", get: r => r.certification === true ? "Yes" : r.certification === false ? "No" : "" },
    { label: "Placement",     get: r => r.placement === true ? "Yes" : r.placement === false ? "No" : "" },
  ];

  return (
    <>
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1.5 }}>
        <Button size="small" startIcon={<DownloadIcon sx={{ fontSize: 14 }} />}
          onClick={() => exportCsv(data, csvCols, "pdft_scorecard.csv")}
          sx={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 12, textTransform: "none",
               borderRadius: "10px", borderColor: TOKENS.border, color: TOKENS.textSub,
               "&:hover": { borderColor: TOKENS.accent, color: TOKENS.accent } }}
          variant="outlined">Export CSV</Button>
      </Box>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: 900 }}>
          <TableHead>
            <TableRow sx={{ background: TOKENS.surfaceAlt }}>
              <TableCell sx={colSx}>#</TableCell>
              <TableCell sx={colSx}>Name</TableCell>
              <TableCell sx={{ ...colSx, textAlign: "center" }}>Intermediate<br/><span style={{ fontWeight: 400, fontSize: 10 }}>(10%)</span></TableCell>
              <TableCell sx={{ ...colSx, textAlign: "center" }}>Digital %</TableCell>
              <TableCell sx={{ ...colSx, textAlign: "center" }}>CMOS %<br/><span style={{ fontWeight: 400, fontSize: 10 }}>(Theory - 20%)</span></TableCell>
              <TableCell sx={{ ...colSx, textAlign: "center" }}>TCL %</TableCell>
              <TableCell sx={{ ...colSx, textAlign: "center" }}>Physical %<br/><span style={{ fontWeight: 400, fontSize: 10 }}>(Design - 30%)</span></TableCell>
              <TableCell sx={{ ...colSx, textAlign: "center" }}>Project<br/><span style={{ fontWeight: 400, fontSize: 10 }}>(30%)</span></TableCell>
              <TableCell sx={{ ...colSx, textAlign: "center" }}>Viva<br/><span style={{ fontWeight: 400, fontSize: 10 }}>(10%)</span></TableCell>
              <TableCell sx={{ ...colSx, textAlign: "center" }}>Overall %</TableCell>
              <TableCell sx={{ ...colSx, textAlign: "center" }}>Grade</TableCell>
              <TableCell sx={{ ...colSx, textAlign: "center" }}><EmojiEventsIcon sx={{ fontSize: 13, mr: 0.3 }} />Cert</TableCell>
              <TableCell sx={{ ...colSx, textAlign: "center" }}><WorkIcon sx={{ fontSize: 13, mr: 0.3 }} />Place</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((r, i) => (
              <TableRow key={r.id} hover sx={{ "&:nth-of-type(even)": { background: TOKENS.surfaceAlt } }}>
                <TableCell sx={{ fontSize: 12, color: TOKENS.textSub }}>{i + 1}</TableCell>
                <TableCell sx={{ fontSize: 13, fontWeight: 600, color: TOKENS.text, whiteSpace: "nowrap" }}>
                  {r.name}<br/>
                  <span style={{ fontSize: 11, fontWeight: 400, color: TOKENS.textSub }}>{r.email}</span>
                </TableCell>
                <PctCell val={r.intermediate} />
                <PctCell val={r.digital} />
                <PctCell val={r.cmos} />
                <PctCell val={r.tcl} />
                <PctCell val={r.physical} />
                <PctCell val={r.project} />
                <PctCell val={r.viva} />
                <PctCell val={r.overall} />
                <GradeCell grade={r.grade} />
                <BoolCell val={r.certification} trueLabel="✓" falseLabel="✗" />
                <BoolCell val={r.placement} trueLabel="✓" falseLabel="✗" />
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </>
  );
}

/* ─── DVFT Scorecard Table ───────────────────────────────────────────────── */
function DvftScorecardTable({ data }) {
  const colSx = { fontWeight: 700, fontSize: 12, color: TOKENS.textSub, whiteSpace: "nowrap" };

  const csvCols = [
    { label: "Name",          get: r => r.name },
    { label: "Email",         get: r => r.email },
    { label: "Intermediate%", get: r => r.intermediate !== null ? Math.round(r.intermediate * 10) / 10 : "" },
    { label: "Digital%",      get: r => r.digital !== null ? Math.round(r.digital * 10) / 10 : "" },
    { label: "Verilog%",      get: r => r.verilog !== null ? Math.round(r.verilog * 10) / 10 : "" },
    { label: "SV%",           get: r => r.sv !== null ? Math.round(r.sv * 10) / 10 : "" },
    { label: "UVM%",          get: r => r.uvm !== null ? Math.round(r.uvm * 10) / 10 : "" },
    { label: "Python%",       get: r => r.python !== null ? Math.round(r.python * 10) / 10 : "" },
    { label: "Project%",      get: r => r.project !== null ? Math.round(r.project * 10) / 10 : "" },
    { label: "Viva%",         get: r => r.viva !== null ? Math.round(r.viva * 10) / 10 : "" },
    { label: "Overall%",      get: r => Math.round(r.overall * 10) / 10 },
    { label: "Grade",         get: r => r.grade },
    { label: "Certification", get: r => r.certification === true ? "Yes" : r.certification === false ? "No" : "" },
    { label: "Placement",     get: r => r.placement === true ? "Yes" : r.placement === false ? "No" : "" },
  ];

  return (
    <>
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1.5 }}>
        <Button size="small" startIcon={<DownloadIcon sx={{ fontSize: 14 }} />}
          onClick={() => exportCsv(data, csvCols, "dvft_scorecard.csv")}
          sx={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 12, textTransform: "none",
               borderRadius: "10px", borderColor: TOKENS.border, color: TOKENS.textSub,
               "&:hover": { borderColor: TOKENS.dvft.fill, color: TOKENS.dvft.fill } }}
          variant="outlined">Export CSV</Button>
      </Box>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: 1000 }}>
          <TableHead>
            <TableRow sx={{ background: TOKENS.surfaceAlt }}>
              <TableCell sx={colSx}>#</TableCell>
              <TableCell sx={colSx}>Name</TableCell>
              <TableCell sx={{ ...colSx, textAlign: "center" }}>Intermediate<br/><span style={{ fontWeight: 400, fontSize: 10 }}>(10%)</span></TableCell>
              <TableCell sx={{ ...colSx, textAlign: "center" }}>Digital %</TableCell>
              <TableCell sx={{ ...colSx, textAlign: "center" }}>Verilog %<br/><span style={{ fontWeight: 400, fontSize: 10 }}>(Group 1 - 20%)</span></TableCell>
              <TableCell sx={{ ...colSx, textAlign: "center" }}>SV %</TableCell>
              <TableCell sx={{ ...colSx, textAlign: "center" }}>UVM %</TableCell>
              <TableCell sx={{ ...colSx, textAlign: "center" }}>Python %<br/><span style={{ fontWeight: 400, fontSize: 10 }}>(Group 2 - 30%)</span></TableCell>
              <TableCell sx={{ ...colSx, textAlign: "center" }}>Project<br/><span style={{ fontWeight: 400, fontSize: 10 }}>(30%)</span></TableCell>
              <TableCell sx={{ ...colSx, textAlign: "center" }}>Viva<br/><span style={{ fontWeight: 400, fontSize: 10 }}>(10%)</span></TableCell>
              <TableCell sx={{ ...colSx, textAlign: "center" }}>Overall %</TableCell>
              <TableCell sx={{ ...colSx, textAlign: "center" }}>Grade</TableCell>
              <TableCell sx={{ ...colSx, textAlign: "center" }}><EmojiEventsIcon sx={{ fontSize: 13, mr: 0.3 }} />Cert</TableCell>
              <TableCell sx={{ ...colSx, textAlign: "center" }}><WorkIcon sx={{ fontSize: 13, mr: 0.3 }} />Place</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((r, i) => (
              <TableRow key={r.id} hover sx={{ "&:nth-of-type(even)": { background: TOKENS.surfaceAlt } }}>
                <TableCell sx={{ fontSize: 12, color: TOKENS.textSub }}>{i + 1}</TableCell>
                <TableCell sx={{ fontSize: 13, fontWeight: 600, color: TOKENS.text, whiteSpace: "nowrap" }}>
                  {r.name}<br/>
                  <span style={{ fontSize: 11, fontWeight: 400, color: TOKENS.textSub }}>{r.email}</span>
                </TableCell>
                <PctCell val={r.intermediate} />
                <PctCell val={r.digital} />
                <PctCell val={r.verilog} />
                <PctCell val={r.sv} />
                <PctCell val={r.uvm} />
                <PctCell val={r.python} />
                <PctCell val={r.project} />
                <PctCell val={r.viva} />
                <PctCell val={r.overall} />
                <GradeCell grade={r.grade} />
                <BoolCell val={r.certification} trueLabel="✓" falseLabel="✗" />
                <BoolCell val={r.placement} trueLabel="✓" falseLabel="✗" />
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </>
  );
}

/* ─── Summary stat card ──────────────────────────────────────────────────── */
function StatCard({ label, value, color = TOKENS.accent, sub }) {
  return (
    <Box sx={{ ...cardSx, p: 2.5, minWidth: 130, flex: "1 1 130px" }}>
      <Typography sx={{ fontSize: 11, color: TOKENS.textSub, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, mb: 0.5 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>{value}</Typography>
      {sub && <Typography sx={{ fontSize: 11, color: TOKENS.textSub, mt: 0.5 }}>{sub}</Typography>}
    </Box>
  );
}

/* ─── Main Dashboard ─────────────────────────────────────────────────────── */
export default function MarksDashboard() {
  const [availableBatches, setAvailableBatches] = useState([]);
  const [loadingBatches,   setLoadingBatches]   = useState(true);
  const [batchNo,          setBatchNo]           = useState("");
  const [loading,          setLoading]           = useState(false);
  const [error,            setError]             = useState("");
  const [scorecard,        setScorecard]         = useState([]);  // computed rows
  const [rawRows,          setRawRows]           = useState([]);  // all marks rows from API
  const [tab,              setTab]               = useState(0);   // 0=scorecard, 1=raw

  const isPdft = isPdftBatch(batchNo);
  const isDvft = isDvftBatch(batchNo);
  const isSpecialBatch = isPdft || isDvft;

  /* ── Load batches ── */
  useEffect(() => {
    fetch(`${API_BASE}/api/batches`)
      .then(res => res.json())
      .then(data => setAvailableBatches(
        Array.isArray(data)
          ? [...new Set(data.map(b => typeof b === "string" ? b : b.batch_no))]
          : []
      ))
      .finally(() => setLoadingBatches(false));
  }, []);

  /* ── Load scorecard ── */
  const loadScorecard = useCallback(async () => {
    if (!batchNo) return;
    setLoading(true); setError(""); setScorecard([]); setRawRows([]);
    try {
      const res = await fetch(`${API_BASE}/api/scorecard/${encodeURIComponent(batchNo)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("Unexpected response");
      setRawRows(data);
      if (isPdftBatch(batchNo)) {
        setScorecard(calcPdftScorecard(data));
      } else if (isDvftBatch(batchNo)) {
        setScorecard(calcDvftScorecard(data));
      } else {
        setScorecard([]);
      }
    } catch (e) {
      setError(`Failed to load scorecard: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [batchNo]);

  useEffect(() => { loadScorecard(); }, [loadScorecard]);

  /* ── Summary stats ── */
  const totalLearners = scorecard.length;
  const certified     = scorecard.filter(r => r.certification === true).length;
  const placed        = scorecard.filter(r => r.placement === true).length;
  const avgOverall    = totalLearners
    ? Math.round((scorecard.reduce((s, r) => s + (r.overall || 0), 0) / totalLearners) * 10) / 10
    : 0;
  const topPerformers = scorecard.filter(r => r.overall >= 80).length;

  /* ── Weightage info ── */
  const WeightageInfo = () => (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1.5, mb: 0.5 }}>
      {isPdft ? (
        <>
          <Chip size="small" label="Intermediate: 10%" sx={{ fontSize: 11, background: TOKENS.accentLight, color: TOKENS.accent, fontWeight: 600 }} />
          <Chip size="small" label="Digital + CMOS: 20%" sx={{ fontSize: 11, background: TOKENS.accentLight, color: TOKENS.accent, fontWeight: 600 }} />
          <Chip size="small" label="TCL + Physical: 30%" sx={{ fontSize: 11, background: TOKENS.accentLight, color: TOKENS.accent, fontWeight: 600 }} />
          <Chip size="small" label="Project: 30%" sx={{ fontSize: 11, background: TOKENS.accentLight, color: TOKENS.accent, fontWeight: 600 }} />
          <Chip size="small" label="Viva: 10%" sx={{ fontSize: 11, background: TOKENS.accentLight, color: TOKENS.accent, fontWeight: 600 }} />
        </>
      ) : isDvft ? (
        <>
          <Chip size="small" label="Intermediate: 10%" sx={{ fontSize: 11, background: TOKENS.dvft.light, color: TOKENS.dvft.text, fontWeight: 600 }} />
          <Chip size="small" label="Digital + Verilog: 20%" sx={{ fontSize: 11, background: TOKENS.dvft.light, color: TOKENS.dvft.text, fontWeight: 600 }} />
          <Chip size="small" label="SV + UVM + Python: 30%" sx={{ fontSize: 11, background: TOKENS.dvft.light, color: TOKENS.dvft.text, fontWeight: 600 }} />
          <Chip size="small" label="Project: 30%" sx={{ fontSize: 11, background: TOKENS.dvft.light, color: TOKENS.dvft.text, fontWeight: 600 }} />
          <Chip size="small" label="Viva: 10%" sx={{ fontSize: 11, background: TOKENS.dvft.light, color: TOKENS.dvft.text, fontWeight: 600 }} />
        </>
      ) : null}
    </Box>
  );

  return (
    <Box sx={{ minHeight: "100vh", background: TOKENS.bg, p: { xs: 2, md: 3 }, fontFamily: "'DM Sans', sans-serif" }}>

      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
        <BarChartIcon sx={{ fontSize: 28, color: TOKENS.accent }} />
        <Typography sx={{ fontSize: 22, fontWeight: 800, color: TOKENS.text, fontFamily: "'DM Sans', sans-serif" }}>
          Marks Dashboard
        </Typography>
        {batchNo && <BatchPill batchNo={batchNo} />}
      </Box>

      {/* Batch selector */}
      <Box sx={{ ...cardSx, mb: 2.5, display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
        <GroupIcon sx={{ fontSize: 20, color: TOKENS.textSub }} />
        <FormControl size="small" sx={{ minWidth: 240 }}>
          <InputLabel sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>Select Batch</InputLabel>
          <Select
            value={batchNo}
            label="Select Batch"
            onChange={e => setBatchNo(e.target.value)}
            disabled={loadingBatches}
            sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, borderRadius: "12px" }}
          >
            {availableBatches.map(b => (
              <MenuItem key={b} value={b} sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>{b}</MenuItem>
            ))}
          </Select>
        </FormControl>
        {loadingBatches && <CircularProgress size={18} />}
      </Box>

      {/* Error */}
      {error && (
        <Box sx={{ ...cardSx, mb: 2, background: TOKENS.error.light, border: `1px solid ${TOKENS.error.fill}40` }}>
          <Typography sx={{ color: TOKENS.error.text, fontSize: 13, fontWeight: 600 }}>{error}</Typography>
        </Box>
      )}

      {/* Loading */}
      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 6 }}>
          <CircularProgress size={36} sx={{ color: TOKENS.accent }} />
        </Box>
      )}

      {/* Content: only show for special batches */}
      {!loading && batchNo && !isSpecialBatch && (
        <Box sx={{ ...cardSx, textAlign: "center", color: TOKENS.textSub, py: 5 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 500 }}>
            Scorecard is available only for PDFT and DVFT batches.
          </Typography>
        </Box>
      )}

      {!loading && isSpecialBatch && scorecard.length > 0 && (
        <Fade in>
          <Box>

            {/* Weightage pills */}
            <WeightageInfo />

            {/* Summary stats */}
            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mt: 2, mb: 2.5 }}>
              <StatCard label="Total Learners" value={totalLearners} color={TOKENS.text} />
              <StatCard label="Avg Overall" value={`${avgOverall}%`} color={TOKENS.accent} />
              <StatCard label="Top Performers" value={topPerformers} color={TOKENS.success.fill} sub="≥ 80%" />
              <StatCard label="Certified" value={certified} color={TOKENS.pdft.fill}
                sub={`${totalLearners ? Math.round((certified / totalLearners) * 100) : 0}%`} />
              <StatCard label="Placement Ready" value={placed} color={TOKENS.success.fill}
                sub={`${totalLearners ? Math.round((placed / totalLearners) * 100) : 0}%`} />
            </Box>

            {/* Tabs */}
            <Box sx={{ ...cardSx }}>
              <Tabs
                value={tab}
                onChange={(_, v) => setTab(v)}
                sx={{
                  mb: 2,
                  "& .MuiTab-root": { fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, textTransform: "none" },
                  "& .Mui-selected": { color: `${isPdft ? TOKENS.pdft.fill : TOKENS.dvft.fill} !important` },
                  "& .MuiTabs-indicator": { background: isPdft ? TOKENS.pdft.fill : TOKENS.dvft.fill },
                }}
              >
                <Tab label={`${isPdft ? "PDFT" : "DVFT"} Scorecard`} icon={<StarIcon sx={{ fontSize: 15 }} />} iconPosition="start" />
                <Tab label="Raw Marks" icon={<BarChartIcon sx={{ fontSize: 15 }} />} iconPosition="start" />
              </Tabs>

              {tab === 0 && (
                isPdft
                  ? <PdftScorecardTable data={scorecard} />
                  : <DvftScorecardTable data={scorecard} />
              )}

              {tab === 1 && (
                <Box sx={{ overflowX: "auto" }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ background: TOKENS.surfaceAlt }}>
                        {["#", "Name", "Email", "Assessment", "Points", "Out Of", "% Score", "Date"].map(h => (
                          <TableCell key={h} sx={{ fontWeight: 700, fontSize: 12, color: TOKENS.textSub, whiteSpace: "nowrap" }}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rawRows.map((r, i) => (
                        <TableRow key={i} hover sx={{ "&:nth-of-type(even)": { background: TOKENS.surfaceAlt } }}>
                          <TableCell sx={{ fontSize: 12, color: TOKENS.textSub }}>{i + 1}</TableCell>
                          <TableCell sx={{ fontSize: 13, fontWeight: 600, color: TOKENS.text }}>{r.learner_name}</TableCell>
                          <TableCell sx={{ fontSize: 12, color: TOKENS.textSub }}>{r.email}</TableCell>
                          <TableCell sx={{ fontSize: 12 }}>{r.assessment_name}</TableCell>
                          <TableCell align="center" sx={{ fontSize: 13, fontWeight: 700 }}>{r.points}</TableCell>
                          <TableCell align="center" sx={{ fontSize: 12, color: TOKENS.textSub }}>{r.out_off}</TableCell>
                          <TableCell align="center" sx={{ fontSize: 13, fontWeight: 600, color: TOKENS.accent }}>
                            {r.out_off > 0 ? `${Math.round((r.points / r.out_off) * 1000) / 10}%` : "—"}
                          </TableCell>
                          <TableCell sx={{ fontSize: 12, color: TOKENS.textSub }}>{r.assessment_date?.slice(0, 10) || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              )}
            </Box>
          </Box>
        </Fade>
      )}

      {!loading && isSpecialBatch && scorecard.length === 0 && !error && (
        <Box sx={{ ...cardSx, textAlign: "center", color: TOKENS.textSub, py: 5 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 500 }}>
            No marks data found for <strong>{batchNo}</strong>. Enter marks in the Mark Sheet first.
          </Typography>
        </Box>
      )}
    </Box>
  );
}