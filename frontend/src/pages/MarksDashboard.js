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
  Fade,
  Tabs,
  Tab,
} from "@mui/material";
import BarChartIcon      from "@mui/icons-material/BarChart";
import GroupIcon         from "@mui/icons-material/Group";
import DownloadIcon      from "@mui/icons-material/Download";
import EmojiEventsIcon   from "@mui/icons-material/EmojiEvents";
import WorkIcon          from "@mui/icons-material/Work";
import CheckCircleIcon   from "@mui/icons-material/CheckCircle";
import CancelIcon        from "@mui/icons-material/Cancel";
import StarIcon          from "@mui/icons-material/Star";
import AssignmentIcon    from "@mui/icons-material/Assignment";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";

const API_BASE =
  process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

/* ─── Design tokens ──────────────────────────────────────────────────────── */
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

/* ─── Assessment map (mirrors MarkSheet.js) ──────────────────────────────── */
const ASSESSMENT_MAP = {
  weekly:        { api: "weekly-assessment",       label: "Weekly Assessment",       autoDate: false },
  intermediate:  { api: "intermediate-assessment", label: "Intermediate Assessment", autoDate: false },
  module:        { api: "module-level-assessment", label: "Module Level Assessment", autoDate: false },
  final:         { api: "final-assessment",        label: "Final Assessment",        autoDate: false },
  final_project: { api: "final-project",           label: "Final Project",           autoDate: true  },
  viva:          { api: "viva",                    label: "Viva",                    autoDate: true  },
};

/* ─── Batch helpers ──────────────────────────────────────────────────────── */
function isPdftBatch(b) { return (b || "").toUpperCase().includes("PDFT"); }
function isDvftBatch(b) {
  const up = (b || "").toUpperCase();
  return up.includes("DVFT") || (up.startsWith("DV") && !up.includes("PDFT"));
}

/* ─── Subject key resolvers ──────────────────────────────────────────────── */
function getPdftSubjectKey(name) {
  const r = (name || "").toLowerCase();
  if (r.includes("intermediate"))                    return "intermediate";
  if (r.includes("digital"))                         return "digital";
  if (r.includes("cmos"))                            return "cmos";
  if (r.includes("tcl"))                             return "tcl";
  if (r.includes("physical") || r.includes("phy"))  return "physical";
  if (r.includes("final project") || r.includes("project")) return "project";
  if (r.includes("viva"))                            return "viva";
  return null;
}

function getDvftSubjectKey(name) {
  const r = (name || "").toLowerCase();
  if (r.includes("intermediate"))                    return "intermediate";
  if (r.includes("uvm"))                             return "uvm";   // before "sv"
  if (r.includes("python"))                          return "python";
  if (r.includes("sv"))                              return "sv";
  if (r.includes("verilog"))                         return "verilog";
  if (r.includes("digital"))                         return "digital";
  if (r.includes("final project") || r.includes("project")) return "project";
  if (r.includes("viva"))                            return "viva";
  return null;
}

/* ─── Grade helpers ──────────────────────────────────────────────────────── */
function getGrade(pct) {
  if (pct == null) return "—";
  if (pct >= 90) return "O";
  if (pct >= 80) return "A+";
  if (pct >= 70) return "A";
  if (pct >= 60) return "B+";
  if (pct >= 50) return "B";
  return "F";
}
function gradeColor(g) {
  return ({
    O:    TOKENS.success,
    "A+": TOKENS.success,
    A:    { fill: "#3d5afe", light: "#e8ecff", text: "#1e3a8a" },
    "B+": TOKENS.warning,
    B:    TOKENS.warning,
    F:    TOKENS.error,
  })[g] || { fill: TOKENS.textSub, light: "#f3f4f6", text: TOKENS.textSub };
}
function pctColor(v) {
  if (v == null) return TOKENS.textSub;
  if (v >= 70) return TOKENS.success.text;
  if (v >= 50) return TOKENS.warning.text;
  return TOKENS.error.text;
}

/* ─── Scorecard calculators ──────────────────────────────────────────────── */
function calcPdftScorecard(rows) {
  const byL = {};
  rows.forEach(r => {
    if (!byL[r.learner_id])
      byL[r.learner_id] = { id: r.learner_id, name: r.learner_name, email: r.email, s: {} };
    const key = getPdftSubjectKey(r.assessment_name);
    if (key) {
      const pct = r.out_off > 0 ? (r.points / r.out_off) * 100 : 0;
      if (byL[r.learner_id].s[key] == null || pct > byL[r.learner_id].s[key])
        byL[r.learner_id].s[key] = pct;
    }
  });
  return Object.values(byL).map(l => {
    const s = l.s;
    const intV     = s.intermediate ?? null;
    const dg       = [s.digital, s.cmos].filter(v => v != null);
    const digCmosV = dg.length ? dg.reduce((a,b)=>a+b,0)/dg.length : null;
    const tp       = [s.tcl, s.physical].filter(v => v != null);
    const tclPhyV  = tp.length ? tp.reduce((a,b)=>a+b,0)/tp.length : null;
    const projV    = s.project ?? null;
    const vivaV    = s.viva    ?? null;
    const overall  = (intV     ?? 0)*0.10 + (digCmosV ?? 0)*0.20
                   + (tclPhyV ?? 0)*0.30 + (projV    ?? 0)*0.30
                   + (vivaV   ?? 0)*0.10;
    return {
      id: l.id, name: l.name, email: l.email,
      intermediate: intV,
      digital: s.digital ?? null, cmos: s.cmos ?? null,
      tcl: s.tcl ?? null, physical: s.physical ?? null,
      project: projV, viva: vivaV, overall,
      grade: getGrade(overall),
      certification: projV != null ? projV >= 70 && overall >= 70 : null,
      placement: (projV != null && vivaV != null) ? projV >= 70 && vivaV >= 70 && overall >= 80 : null,
    };
  });
}

function calcDvftScorecard(rows) {
  const byL = {};
  rows.forEach(r => {
    if (!byL[r.learner_id])
      byL[r.learner_id] = { id: r.learner_id, name: r.learner_name, email: r.email, s: {} };
    const key = getDvftSubjectKey(r.assessment_name);
    if (key) {
      const pct = r.out_off > 0 ? (r.points / r.out_off) * 100 : 0;
      if (byL[r.learner_id].s[key] == null || pct > byL[r.learner_id].s[key])
        byL[r.learner_id].s[key] = pct;
    }
  });
  return Object.values(byL).map(l => {
    const s = l.s;
    const intV    = s.intermediate ?? null;
    const dv      = [s.digital, s.verilog].filter(v => v != null);
    const digVerV = dv.length ? dv.reduce((a,b)=>a+b,0)/dv.length : null;
    const sv      = [s.sv, s.uvm, s.python].filter(v => v != null);
    const svGrpV  = sv.length ? sv.reduce((a,b)=>a+b,0)/sv.length : null;
    const projV   = s.project ?? null;
    const vivaV   = s.viva    ?? null;
    const overall = (intV    ?? 0)*0.10 + (digVerV ?? 0)*0.20
                  + (svGrpV ?? 0)*0.30 + (projV   ?? 0)*0.30
                  + (vivaV  ?? 0)*0.10;
    return {
      id: l.id, name: l.name, email: l.email,
      intermediate: intV,
      digital: s.digital ?? null, verilog: s.verilog ?? null,
      sv: s.sv ?? null, uvm: s.uvm ?? null, python: s.python ?? null,
      project: projV, viva: vivaV, overall,
      grade: getGrade(overall),
      certification: projV != null ? projV >= 70 && overall >= 70 : null,
      placement: (projV != null && vivaV != null) ? projV >= 70 && vivaV >= 70 && overall >= 80 : null,
    };
  });
}

/* ─── CSV export ─────────────────────────────────────────────────────────── */
function exportCsv(rows, cols, filename) {
  const header = cols.map(c => c.label).join(",");
  const body = rows.map(r =>
    cols.map(c => {
      const v = c.get(r);
      if (v == null) return "";
      return String(v).includes(",") ? `"${v}"` : v;
    }).join(",")
  ).join("\n");
  const blob = new Blob([`${header}\n${body}`], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/* ─── Shared table cells ─────────────────────────────────────────────────── */
function PctCell({ val }) {
  if (val == null) return <TableCell align="center" sx={{ color: TOKENS.textSub, fontSize:12 }}>—</TableCell>;
  return <TableCell align="center" sx={{ fontWeight:600, fontSize:13, color: pctColor(val) }}>{Math.round(val*10)/10}%</TableCell>;
}
function GradeCell({ grade }) {
  const c = gradeColor(grade);
  return (
    <TableCell align="center">
      <Chip label={grade} size="small" sx={{ background: c.light, color: c.text, fontWeight:800, fontSize:12, minWidth:36 }} />
    </TableCell>
  );
}
function BoolCell({ val }) {
  if (val == null) return <TableCell align="center" sx={{ color: TOKENS.textSub, fontSize:12 }}>—</TableCell>;
  return (
    <TableCell align="center">
      {val
        ? <Chip icon={<CheckCircleIcon sx={{ fontSize:13 }} />} label="Yes" size="small"
            sx={{ background: TOKENS.success.light, color: TOKENS.success.text, fontWeight:700, fontSize:11 }} />
        : <Chip icon={<CancelIcon     sx={{ fontSize:13 }} />} label="No"  size="small"
            sx={{ background: TOKENS.error.light,   color: TOKENS.error.text,   fontWeight:700, fontSize:11 }} />}
    </TableCell>
  );
}

/* ─── Batch type pill ────────────────────────────────────────────────────── */
function BatchPill({ batchNo }) {
  const isPdft = isPdftBatch(batchNo);
  const isDvft = isDvftBatch(batchNo);
  if (!isPdft && !isDvft) return null;
  const { fill, light, text } = isPdft ? TOKENS.pdft : TOKENS.dvft;
  return <Chip label={isPdft ? "PDFT Batch" : "DVFT Batch"} size="small"
    sx={{ background: light, color: text, fontWeight:700, fontSize:11, border:`1px solid ${fill}30`, ml:1 }} />;
}

/* ─── Summary stat card ──────────────────────────────────────────────────── */
function StatCard({ label, value, color = TOKENS.accent, sub }) {
  return (
    <Box sx={{ ...cardSx, p:2.5, minWidth:130, flex:"1 1 130px" }}>
      <Typography sx={{ fontSize:11, color: TOKENS.textSub, fontWeight:600, textTransform:"uppercase", letterSpacing:0.5, mb:0.5 }}>{label}</Typography>
      <Typography sx={{ fontSize:26, fontWeight:800, color, lineHeight:1 }}>{value}</Typography>
      {sub && <Typography sx={{ fontSize:11, color: TOKENS.textSub, mt:0.5 }}>{sub}</Typography>}
    </Box>
  );
}

/* ─── Per-assessment marks table ─────────────────────────────────────────── */
function AssessmentMarksTable({ rows, assessmentLabel, batchNo }) {
  if (!rows.length) return (
    <Box sx={{ textAlign:"center", py:4, color: TOKENS.textSub }}>
      <Typography sx={{ fontSize:13 }}>No marks found for this selection.</Typography>
    </Box>
  );

  const csvCols = [
    { label: "Name",       get: r => r.learner_name },
    { label: "Email",      get: r => r.email },
    { label: "Assessment", get: r => r.assessment_name },
    { label: "Date",       get: r => r.assessment_date?.slice(0,10) || "" },
    { label: "Points",     get: r => r.points },
    { label: "Out Of",     get: r => r.out_off },
    { label: "% Score",    get: r => r.out_off > 0 ? Math.round((r.points/r.out_off)*1000)/10 : "" },
    { label: "Grade",      get: r => getGrade(r.out_off > 0 ? (r.points/r.out_off)*100 : null) },
  ];

  const colSx = { fontWeight:700, fontSize:12, color: TOKENS.textSub, whiteSpace:"nowrap" };
  const avg   = Math.round(rows.reduce((s,r) => s + (r.out_off>0 ? (r.points/r.out_off)*100 : 0), 0) / rows.length * 10) / 10;
  const passed = rows.filter(r => r.out_off>0 && (r.points/r.out_off)*100 >= 50).length;

  return (
    <>
      <Box sx={{ display:"flex", gap:2, flexWrap:"wrap", mb:2 }}>
        <StatCard label="Learners"   value={rows.length} color={TOKENS.text} />
        <StatCard label="Avg Score"  value={`${avg}%`}   color={TOKENS.accent} />
        <StatCard label="≥ 50% Pass" value={passed}       color={TOKENS.success.fill}
          sub={`${Math.round((passed/rows.length)*100)}%`} />
      </Box>

      <Box sx={{ display:"flex", justifyContent:"flex-end", mb:1.5 }}>
        <Button size="small" variant="outlined" startIcon={<DownloadIcon sx={{ fontSize:14 }} />}
          onClick={() => exportCsv(rows, csvCols, `${batchNo}_${assessmentLabel}.csv`)}
          sx={{ fontFamily:"'DM Sans', sans-serif", fontWeight:700, fontSize:12, textTransform:"none",
               borderRadius:"10px", borderColor: TOKENS.border, color: TOKENS.textSub,
               "&:hover": { borderColor: TOKENS.accent, color: TOKENS.accent } }}>
          Export CSV
        </Button>
      </Box>

      <Box sx={{ overflowX:"auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ background: TOKENS.surfaceAlt }}>
              <TableCell sx={colSx}>#</TableCell>
              <TableCell sx={colSx}>Name</TableCell>
              <TableCell sx={colSx}>Email</TableCell>
              <TableCell sx={colSx}>Assessment / Topic</TableCell>
              <TableCell sx={{ ...colSx, textAlign:"center" }}>Date</TableCell>
              <TableCell sx={{ ...colSx, textAlign:"center" }}>Points</TableCell>
              <TableCell sx={{ ...colSx, textAlign:"center" }}>Out Of</TableCell>
              <TableCell sx={{ ...colSx, textAlign:"center" }}>% Score</TableCell>
              <TableCell sx={{ ...colSx, textAlign:"center" }}>Grade</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r, i) => {
              const pct = r.out_off > 0 ? (r.points / r.out_off) * 100 : null;
              return (
                <TableRow key={i} hover sx={{ "&:nth-of-type(even)": { background: TOKENS.surfaceAlt } }}>
                  <TableCell sx={{ fontSize:12, color: TOKENS.textSub }}>{i+1}</TableCell>
                  <TableCell sx={{ fontSize:13, fontWeight:600, color: TOKENS.text, whiteSpace:"nowrap" }}>{r.learner_name}</TableCell>
                  <TableCell sx={{ fontSize:12, color: TOKENS.textSub }}>{r.email}</TableCell>
                  <TableCell sx={{ fontSize:12 }}>{r.assessment_name}</TableCell>
                  <TableCell align="center" sx={{ fontSize:12, color: TOKENS.textSub, whiteSpace:"nowrap" }}>{r.assessment_date?.slice(0,10) || "—"}</TableCell>
                  <TableCell align="center" sx={{ fontSize:13, fontWeight:700 }}>{r.points}</TableCell>
                  <TableCell align="center" sx={{ fontSize:12, color: TOKENS.textSub }}>{r.out_off}</TableCell>
                  <PctCell val={pct} />
                  <GradeCell grade={getGrade(pct)} />
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>
    </>
  );
}

/* ─── PDFT Scorecard table ───────────────────────────────────────────────── */
function PdftScorecardTable({ data, batchNo }) {
  const colSx = { fontWeight:700, fontSize:12, color: TOKENS.textSub, whiteSpace:"nowrap" };
  const csvCols = [
    { label: "Name",          get: r => r.name },
    { label: "Email",         get: r => r.email },
    { label: "Intermediate%", get: r => r.intermediate != null ? Math.round(r.intermediate*10)/10 : "" },
    { label: "Digital%",      get: r => r.digital  != null ? Math.round(r.digital*10)/10  : "" },
    { label: "CMOS%",         get: r => r.cmos     != null ? Math.round(r.cmos*10)/10     : "" },
    { label: "TCL%",          get: r => r.tcl      != null ? Math.round(r.tcl*10)/10      : "" },
    { label: "Physical%",     get: r => r.physical != null ? Math.round(r.physical*10)/10 : "" },
    { label: "Project%",      get: r => r.project  != null ? Math.round(r.project*10)/10  : "" },
    { label: "Viva%",         get: r => r.viva     != null ? Math.round(r.viva*10)/10     : "" },
    { label: "Overall%",      get: r => Math.round(r.overall*10)/10 },
    { label: "Grade",         get: r => r.grade },
    { label: "Certification", get: r => r.certification === true ? "Yes" : r.certification === false ? "No" : "" },
    { label: "Placement",     get: r => r.placement === true ? "Yes" : r.placement === false ? "No" : "" },
  ];
  return (
    <>
      <Box sx={{ display:"flex", justifyContent:"flex-end", mb:1.5 }}>
        <Button size="small" variant="outlined" startIcon={<DownloadIcon sx={{ fontSize:14 }} />}
          onClick={() => exportCsv(data, csvCols, `${batchNo}_pdft_scorecard.csv`)}
          sx={{ fontFamily:"'DM Sans', sans-serif", fontWeight:700, fontSize:12, textTransform:"none",
               borderRadius:"10px", borderColor: TOKENS.border, color: TOKENS.textSub,
               "&:hover": { borderColor: TOKENS.pdft.fill, color: TOKENS.pdft.fill } }}>
          Export CSV
        </Button>
      </Box>
      <Box sx={{ overflowX:"auto" }}>
        <Table size="small" sx={{ minWidth:920 }}>
          <TableHead>
            <TableRow sx={{ background: TOKENS.surfaceAlt }}>
              <TableCell sx={colSx}>#</TableCell>
              <TableCell sx={colSx}>Name</TableCell>
              <TableCell sx={{ ...colSx, textAlign:"center" }}>Intermediate<br/><span style={{ fontWeight:400, fontSize:10 }}>(10%)</span></TableCell>
              <TableCell sx={{ ...colSx, textAlign:"center" }}>Digital %</TableCell>
              <TableCell sx={{ ...colSx, textAlign:"center" }}>CMOS %<br/><span style={{ fontWeight:400, fontSize:10 }}>(Theory 20%)</span></TableCell>
              <TableCell sx={{ ...colSx, textAlign:"center" }}>TCL %</TableCell>
              <TableCell sx={{ ...colSx, textAlign:"center" }}>Physical %<br/><span style={{ fontWeight:400, fontSize:10 }}>(Design 30%)</span></TableCell>
              <TableCell sx={{ ...colSx, textAlign:"center" }}>Project<br/><span style={{ fontWeight:400, fontSize:10 }}>(30%)</span></TableCell>
              <TableCell sx={{ ...colSx, textAlign:"center" }}>Viva<br/><span style={{ fontWeight:400, fontSize:10 }}>(10%)</span></TableCell>
              <TableCell sx={{ ...colSx, textAlign:"center" }}>Overall %</TableCell>
              <TableCell sx={{ ...colSx, textAlign:"center" }}>Grade</TableCell>
              <TableCell sx={{ ...colSx, textAlign:"center" }}><EmojiEventsIcon sx={{ fontSize:13 }} /> Cert</TableCell>
              <TableCell sx={{ ...colSx, textAlign:"center" }}><WorkIcon sx={{ fontSize:13 }} /> Place</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((r, i) => (
              <TableRow key={r.id} hover sx={{ "&:nth-of-type(even)": { background: TOKENS.surfaceAlt } }}>
                <TableCell sx={{ fontSize:12, color: TOKENS.textSub }}>{i+1}</TableCell>
                <TableCell sx={{ fontSize:13, fontWeight:600, color: TOKENS.text, whiteSpace:"nowrap" }}>
                  {r.name}<br/><span style={{ fontSize:11, fontWeight:400, color: TOKENS.textSub }}>{r.email}</span>
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
                <BoolCell val={r.certification} />
                <BoolCell val={r.placement} />
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </>
  );
}

/* ─── DVFT Scorecard table ───────────────────────────────────────────────── */
function DvftScorecardTable({ data, batchNo }) {
  const colSx = { fontWeight:700, fontSize:12, color: TOKENS.textSub, whiteSpace:"nowrap" };
  const csvCols = [
    { label: "Name",          get: r => r.name },
    { label: "Email",         get: r => r.email },
    { label: "Intermediate%", get: r => r.intermediate != null ? Math.round(r.intermediate*10)/10 : "" },
    { label: "Digital%",      get: r => r.digital  != null ? Math.round(r.digital*10)/10  : "" },
    { label: "Verilog%",      get: r => r.verilog  != null ? Math.round(r.verilog*10)/10  : "" },
    { label: "SV%",           get: r => r.sv       != null ? Math.round(r.sv*10)/10       : "" },
    { label: "UVM%",          get: r => r.uvm      != null ? Math.round(r.uvm*10)/10      : "" },
    { label: "Python%",       get: r => r.python   != null ? Math.round(r.python*10)/10   : "" },
    { label: "Project%",      get: r => r.project  != null ? Math.round(r.project*10)/10  : "" },
    { label: "Viva%",         get: r => r.viva     != null ? Math.round(r.viva*10)/10     : "" },
    { label: "Overall%",      get: r => Math.round(r.overall*10)/10 },
    { label: "Grade",         get: r => r.grade },
    { label: "Certification", get: r => r.certification === true ? "Yes" : r.certification === false ? "No" : "" },
    { label: "Placement",     get: r => r.placement === true ? "Yes" : r.placement === false ? "No" : "" },
  ];
  return (
    <>
      <Box sx={{ display:"flex", justifyContent:"flex-end", mb:1.5 }}>
        <Button size="small" variant="outlined" startIcon={<DownloadIcon sx={{ fontSize:14 }} />}
          onClick={() => exportCsv(data, csvCols, `${batchNo}_dvft_scorecard.csv`)}
          sx={{ fontFamily:"'DM Sans', sans-serif", fontWeight:700, fontSize:12, textTransform:"none",
               borderRadius:"10px", borderColor: TOKENS.border, color: TOKENS.textSub,
               "&:hover": { borderColor: TOKENS.dvft.fill, color: TOKENS.dvft.fill } }}>
          Export CSV
        </Button>
      </Box>
      <Box sx={{ overflowX:"auto" }}>
        <Table size="small" sx={{ minWidth:1020 }}>
          <TableHead>
            <TableRow sx={{ background: TOKENS.surfaceAlt }}>
              <TableCell sx={colSx}>#</TableCell>
              <TableCell sx={colSx}>Name</TableCell>
              <TableCell sx={{ ...colSx, textAlign:"center" }}>Intermediate<br/><span style={{ fontWeight:400, fontSize:10 }}>(10%)</span></TableCell>
              <TableCell sx={{ ...colSx, textAlign:"center" }}>Digital %</TableCell>
              <TableCell sx={{ ...colSx, textAlign:"center" }}>Verilog %<br/><span style={{ fontWeight:400, fontSize:10 }}>(Grp1 20%)</span></TableCell>
              <TableCell sx={{ ...colSx, textAlign:"center" }}>SV %</TableCell>
              <TableCell sx={{ ...colSx, textAlign:"center" }}>UVM %</TableCell>
              <TableCell sx={{ ...colSx, textAlign:"center" }}>Python %<br/><span style={{ fontWeight:400, fontSize:10 }}>(Grp2 30%)</span></TableCell>
              <TableCell sx={{ ...colSx, textAlign:"center" }}>Project<br/><span style={{ fontWeight:400, fontSize:10 }}>(30%)</span></TableCell>
              <TableCell sx={{ ...colSx, textAlign:"center" }}>Viva<br/><span style={{ fontWeight:400, fontSize:10 }}>(10%)</span></TableCell>
              <TableCell sx={{ ...colSx, textAlign:"center" }}>Overall %</TableCell>
              <TableCell sx={{ ...colSx, textAlign:"center" }}>Grade</TableCell>
              <TableCell sx={{ ...colSx, textAlign:"center" }}><EmojiEventsIcon sx={{ fontSize:13 }} /> Cert</TableCell>
              <TableCell sx={{ ...colSx, textAlign:"center" }}><WorkIcon sx={{ fontSize:13 }} /> Place</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((r, i) => (
              <TableRow key={r.id} hover sx={{ "&:nth-of-type(even)": { background: TOKENS.surfaceAlt } }}>
                <TableCell sx={{ fontSize:12, color: TOKENS.textSub }}>{i+1}</TableCell>
                <TableCell sx={{ fontSize:13, fontWeight:600, color: TOKENS.text, whiteSpace:"nowrap" }}>
                  {r.name}<br/><span style={{ fontSize:11, fontWeight:400, color: TOKENS.textSub }}>{r.email}</span>
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
                <BoolCell val={r.certification} />
                <BoolCell val={r.placement} />
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </>
  );
}

/* ─── Weightage chips ────────────────────────────────────────────────────── */
function WeightageChips({ batchNo }) {
  const isPdft = isPdftBatch(batchNo);
  const isDvft = isDvftBatch(batchNo);
  if (!isPdft && !isDvft) return null;
  const { light, text } = isPdft ? TOKENS.pdft : TOKENS.dvft;
  const chips = isPdft
    ? ["Intermediate: 10%", "Digital + CMOS: 20%", "TCL + Physical: 30%", "Project: 30%", "Viva: 10%"]
    : ["Intermediate: 10%", "Digital + Verilog: 20%", "SV + UVM + Python: 30%", "Project: 30%", "Viva: 10%"];
  return (
    <Box sx={{ display:"flex", flexWrap:"wrap", gap:1, mb:2 }}>
      {chips.map(c => (
        <Chip key={c} size="small" label={c}
          sx={{ fontSize:11, background: light, color: text, fontWeight:600 }} />
      ))}
    </Box>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════════════ */
export default function MarksDashboard() {
  /* ── State ── */
  const [availableBatches, setAvailableBatches] = useState([]);
  const [loadingBatches,   setLoadingBatches]   = useState(true);
  const [batchNo,          setBatchNo]          = useState("");
  const [assessmentType,   setAssessmentType]   = useState("weekly");

  // periods for non-autoDate types
  const [periods,        setPeriods]        = useState([]);
  const [loadingPeriods, setLoadingPeriods] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState("");

  // marks for assessment view
  const [loadingMarks, setLoadingMarks] = useState(false);
  const [marksRows,    setMarksRows]    = useState([]);
  const [error,        setError]        = useState("");

  // scorecard for PDFT/DVFT
  const [scorecardRows,    setScorecardRows]    = useState([]);
  const [loadingScorecard, setLoadingScorecard] = useState(false);
  const [scorecardError,   setScorecardError]   = useState("");

  // tab: 0 = assessment view, 1 = scorecard
  const [tab, setTab] = useState(0);

  const isPdft         = isPdftBatch(batchNo);
  const isDvft         = isDvftBatch(batchNo);
  const isSpecialBatch = isPdft || isDvft;
  const accentColor    = isPdft ? TOKENS.pdft.fill : isDvft ? TOKENS.dvft.fill : TOKENS.accent;
  const cfg            = ASSESSMENT_MAP[assessmentType];

  /* ── Load batches ── */
  useEffect(() => {
    fetch(`${API_BASE}/api/batches`)
      .then(r => r.json())
      .then(data => setAvailableBatches(
        Array.isArray(data)
          ? [...new Set(data.map(b => typeof b === "string" ? b : b.batch_no))]
          : []
      ))
      .catch(() => {})
      .finally(() => setLoadingBatches(false));
  }, []);

  /* ── Load periods when batch + type changes ── */
  useEffect(() => {
    setPeriods([]); setSelectedPeriod(""); setMarksRows([]); setError("");
    if (!batchNo || cfg.autoDate) return;
    setLoadingPeriods(true);
    fetch(`${API_BASE}/apiperiods/${batchNo}/${cfg.api}`)
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data)) return;
        const seen = new Map();
        data.forEach(p => {
          const k = `${p.date}::${(p.topic_name||"").trim().toLowerCase()}`;
          if (!seen.has(k)) seen.set(k, p);
        });
        const sorted = Array.from(seen.values()).sort((a,b) => new Date(a.date) - new Date(b.date));
        setPeriods(sorted);
      })
      .catch(() => setPeriods([]))
      .finally(() => setLoadingPeriods(false));
  }, [batchNo, assessmentType]);

  /* ── Auto-load marks for autoDate types (Final Project, Viva) ── */
  useEffect(() => {
    setMarksRows([]); setError("");
    if (!batchNo || !cfg.autoDate) return;
    setLoadingMarks(true);
    fetch(`${API_BASE}/api/marks/${cfg.api}?batch_no=${batchNo}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(data => setMarksRows(Array.isArray(data) ? data : []))
      .catch(e => setError(`Failed to load marks: ${e.message}`))
      .finally(() => setLoadingMarks(false));
  }, [batchNo, assessmentType]);

  /* ── Load scorecard when batch changes ── */
  useEffect(() => {
    setScorecardRows([]); setScorecardError("");
    if (!batchNo || !isSpecialBatch) return;
    setLoadingScorecard(true);
    fetch(`${API_BASE}/api/scorecard/${encodeURIComponent(batchNo)}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => {
        if (!Array.isArray(data)) throw new Error("Unexpected response");
        if (isPdftBatch(batchNo))      setScorecardRows(calcPdftScorecard(data));
        else if (isDvftBatch(batchNo)) setScorecardRows(calcDvftScorecard(data));
      })
      .catch(e => setScorecardError(`Failed to load scorecard: ${e.message}`))
      .finally(() => setLoadingScorecard(false));
  }, [batchNo]);

  /* ── Load marks for a selected period ── */
  const loadMarksForPeriod = useCallback(async (plannerId, date) => {
    if (!batchNo || !date) return;
    setLoadingMarks(true); setError(""); setMarksRows([]);
    try {
      const url = `${API_BASE}/api/marks/${cfg.api}?batch_no=${batchNo}&course_planner_id=${plannerId || ""}&assessment_date=${date}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMarksRows(Array.isArray(data) ? data : []);
    } catch(e) {
      setError(`Failed to load marks: ${e.message}`);
    } finally {
      setLoadingMarks(false);
    }
  }, [batchNo, assessmentType]);

  /* ── Period select handler ── */
  const handlePeriodSelect = (val) => {
    setSelectedPeriod(val);
    if (!val) { setMarksRows([]); return; }
    const [plannerId, , date] = val.split("::");
    loadMarksForPeriod(plannerId, date);
  };

  /* ── Batch change ── */
  const handleBatchChange = (val) => {
    setBatchNo(val);
    setSelectedPeriod(""); setMarksRows([]); setPeriods([]); setError("");
    setTab(0);
  };

  /* ── Scorecard summary stats ── */
  const totalLearners = scorecardRows.length;
  const certified     = scorecardRows.filter(r => r.certification === true).length;
  const placed        = scorecardRows.filter(r => r.placement === true).length;
  const avgOverall    = totalLearners
    ? Math.round(scorecardRows.reduce((s,r)=>s+(r.overall||0),0)/totalLearners*10)/10
    : 0;
  const topPerf = scorecardRows.filter(r => r.overall >= 80).length;

  /* ── Render ── */
  return (
    <Box sx={{ minHeight:"100vh", background: TOKENS.bg, p:{ xs:2, md:3 }, fontFamily:"'DM Sans', sans-serif" }}>

      {/* Header */}
      <Box sx={{ display:"flex", alignItems:"center", gap:1.5, mb:3 }}>
        <BarChartIcon sx={{ fontSize:28, color: TOKENS.accent }} />
        <Typography sx={{ fontSize:22, fontWeight:800, color: TOKENS.text, fontFamily:"'DM Sans', sans-serif" }}>
          Marks Dashboard
        </Typography>
        {batchNo && <BatchPill batchNo={batchNo} />}
      </Box>

      {/* Controls */}
      <Box sx={{ ...cardSx, mb:2.5, display:"flex", alignItems:"center", gap:2.5, flexWrap:"wrap" }}>

        {/* Batch */}
        <Box sx={{ display:"flex", alignItems:"center", gap:1 }}>
          <GroupIcon sx={{ fontSize:18, color: TOKENS.textSub }} />
          <FormControl size="small" sx={{ minWidth:210 }}>
            <InputLabel sx={{ fontFamily:"'DM Sans', sans-serif", fontSize:13 }}>Select Batch</InputLabel>
            <Select value={batchNo} label="Select Batch"
              onChange={e => handleBatchChange(e.target.value)}
              disabled={loadingBatches}
              sx={{ fontFamily:"'DM Sans', sans-serif", fontSize:13, borderRadius:"12px", background: TOKENS.surfaceAlt }}>
              {availableBatches.map(b => (
                <MenuItem key={b} value={b} sx={{ fontFamily:"'DM Sans', sans-serif", fontSize:13 }}>{b}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {loadingBatches && <CircularProgress size={16} />}
        </Box>

        {/* Assessment type */}
        <Box sx={{ display:"flex", alignItems:"center", gap:1 }}>
          <AssignmentIcon sx={{ fontSize:18, color: TOKENS.textSub }} />
          <FormControl size="small" sx={{ minWidth:220 }} disabled={!batchNo}>
            <InputLabel sx={{ fontFamily:"'DM Sans', sans-serif", fontSize:13 }}>Assessment Type</InputLabel>
            <Select value={assessmentType} label="Assessment Type"
              onChange={e => { setAssessmentType(e.target.value); setSelectedPeriod(""); setMarksRows([]); setError(""); }}
              sx={{ fontFamily:"'DM Sans', sans-serif", fontSize:13, borderRadius:"12px", background: TOKENS.surfaceAlt }}>
              {Object.entries(ASSESSMENT_MAP).map(([key, val]) => (
                <MenuItem key={key} value={key} sx={{ fontFamily:"'DM Sans', sans-serif", fontSize:13 }}>
                  {val.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Period selector — only for non-autoDate types */}
        {batchNo && !cfg.autoDate && (
          <Box sx={{ display:"flex", alignItems:"center", gap:1 }}>
            <CalendarTodayIcon sx={{ fontSize:18, color: TOKENS.textSub }} />
            <FormControl size="small" sx={{ minWidth:290 }} disabled={loadingPeriods || !periods.length}>
              <InputLabel sx={{ fontFamily:"'DM Sans', sans-serif", fontSize:13 }}>
                {loadingPeriods ? "Loading periods…" : periods.length ? "Select Date / Period" : "No periods found"}
              </InputLabel>
              <Select value={selectedPeriod} label="Select Date / Period"
                onChange={e => handlePeriodSelect(e.target.value)}
                sx={{ fontFamily:"'DM Sans', sans-serif", fontSize:13, borderRadius:"12px", background: TOKENS.surfaceAlt }}>
                {periods.map(p => {
                  const planId = p.course_planner_id ?? p.id ?? `${p.date}-${p.topic_name}`;
                  const weekNo = p.week_no ?? p.module_no ?? "";
                  const val    = `${planId}::${weekNo}::${p.date}::${p.topic_name}`;
                  const wLabel = p.week_no ? `Week ${p.week_no}` : p.module_no ? `Mod ${p.module_no}` : "";
                  return (
                    <MenuItem key={val} value={val} sx={{ fontFamily:"'DM Sans', sans-serif", fontSize:13 }}>
                      {wLabel ? <><strong>{wLabel}</strong>&nbsp;—&nbsp;</> : ""}
                      {p.date} — {p.topic_name}
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>
            {loadingPeriods && <CircularProgress size={16} />}
          </Box>
        )}
      </Box>

      {/* Tabs */}
      {batchNo && (
        <Box sx={{ mb:2 }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)}
            sx={{
              "& .MuiTab-root": { fontFamily:"'DM Sans', sans-serif", fontSize:13, fontWeight:600, textTransform:"none" },
              "& .Mui-selected": { color:`${accentColor} !important` },
              "& .MuiTabs-indicator": { background: accentColor },
            }}>
            <Tab label="Assessment View" icon={<AssignmentIcon sx={{ fontSize:15 }} />} iconPosition="start" />
            {isSpecialBatch && (
              <Tab label={`${isPdft ? "PDFT" : "DVFT"} Scorecard`}
                icon={<StarIcon sx={{ fontSize:15 }} />} iconPosition="start" />
            )}
          </Tabs>
        </Box>
      )}

      {/* Error */}
      {error && (
        <Box sx={{ ...cardSx, mb:2, background: TOKENS.error.light, border:`1px solid ${TOKENS.error.fill}40` }}>
          <Typography sx={{ color: TOKENS.error.text, fontSize:13, fontWeight:600 }}>{error}</Typography>
        </Box>
      )}

      {/* ═══ TAB 0 — Assessment View ═══ */}
      {tab === 0 && (
        <Box>
          {!batchNo && (
            <Box sx={{ ...cardSx, textAlign:"center", color: TOKENS.textSub, py:6 }}>
              <Typography sx={{ fontSize:14 }}>Select a batch and assessment type to view marks.</Typography>
            </Box>
          )}

          {batchNo && !cfg.autoDate && !selectedPeriod && !loadingPeriods && (
            <Box sx={{ ...cardSx, textAlign:"center", color: TOKENS.textSub, py:5 }}>
              <Typography sx={{ fontSize:14 }}>
                {periods.length
                  ? "Select a date / period above to view marks."
                  : `No ${cfg.label} periods found for ${batchNo}.`}
              </Typography>
            </Box>
          )}

          {loadingMarks && (
            <Box sx={{ display:"flex", justifyContent:"center", mt:5 }}>
              <CircularProgress size={34} sx={{ color: accentColor }} />
            </Box>
          )}

          {!loadingMarks && batchNo && (cfg.autoDate || selectedPeriod) && (
            <Fade in>
              <Box sx={{ ...cardSx }}>
                <Box sx={{ mb:2 }}>
                  <Typography sx={{ fontSize:15, fontWeight:700, color: TOKENS.text, fontFamily:"'DM Sans', sans-serif" }}>
                    {cfg.label}
                    {selectedPeriod && (() => {
                      const parts = selectedPeriod.split("::");
                      const date  = parts[2];
                      const topic = parts.slice(3).join("::");
                      return <span style={{ color: TOKENS.textSub, fontWeight:400, fontSize:13 }}> — {date} · {topic}</span>;
                    })()}
                  </Typography>
                  <Typography sx={{ fontSize:12, color: TOKENS.textSub }}>{batchNo}</Typography>
                </Box>
                <AssessmentMarksTable rows={marksRows} assessmentLabel={cfg.label} batchNo={batchNo} />
              </Box>
            </Fade>
          )}
        </Box>
      )}

      {/* ═══ TAB 1 — Scorecard ═══ */}
      {tab === 1 && isSpecialBatch && (
        <Box>
          {scorecardError && (
            <Box sx={{ ...cardSx, mb:2, background: TOKENS.error.light, border:`1px solid ${TOKENS.error.fill}40` }}>
              <Typography sx={{ color: TOKENS.error.text, fontSize:13, fontWeight:600 }}>{scorecardError}</Typography>
            </Box>
          )}

          {loadingScorecard && (
            <Box sx={{ display:"flex", justifyContent:"center", mt:5 }}>
              <CircularProgress size={34} sx={{ color: accentColor }} />
            </Box>
          )}

          {!loadingScorecard && scorecardRows.length > 0 && (
            <Fade in>
              <Box>
                <WeightageChips batchNo={batchNo} />
                <Box sx={{ display:"flex", gap:2, flexWrap:"wrap", mb:2.5 }}>
                  <StatCard label="Total Learners"  value={totalLearners}    color={TOKENS.text} />
                  <StatCard label="Avg Overall"      value={`${avgOverall}%`} color={accentColor} />
                  <StatCard label="Top Performers"   value={topPerf}           color={TOKENS.success.fill} sub="≥ 80%" />
                  <StatCard label="Certified"        value={certified}
                    color={isPdft ? TOKENS.pdft.fill : TOKENS.dvft.fill}
                    sub={`${totalLearners ? Math.round((certified/totalLearners)*100) : 0}%`} />
                  <StatCard label="Placement Ready"  value={placed}            color={TOKENS.success.fill}
                    sub={`${totalLearners ? Math.round((placed/totalLearners)*100) : 0}%`} />
                </Box>
                <Box sx={{ ...cardSx }}>
                  {isPdft
                    ? <PdftScorecardTable data={scorecardRows} batchNo={batchNo} />
                    : <DvftScorecardTable data={scorecardRows} batchNo={batchNo} />}
                </Box>
              </Box>
            </Fade>
          )}

          {!loadingScorecard && scorecardRows.length === 0 && !scorecardError && (
            <Box sx={{ ...cardSx, textAlign:"center", color: TOKENS.textSub, py:5 }}>
              <Typography sx={{ fontSize:14, fontWeight:500 }}>
                No scorecard data yet for <strong>{batchNo}</strong>. Enter marks in the Mark Sheet first.
              </Typography>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}