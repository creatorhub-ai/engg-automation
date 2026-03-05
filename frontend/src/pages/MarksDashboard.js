import React, { useEffect, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import {
  Typography,
  Button,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Box,
  Fade,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Chip,
} from "@mui/material";
import {
  Download        as DownloadIcon,
  TableChart      as TableChartIcon,
  BarChart        as BarChartIcon,
  Person          as PersonIcon,
  CheckCircle     as CheckCircleIcon,
  Error           as ErrorIcon,
  InfoOutlined    as InfoOutlinedIcon,
  EmojiEvents     as TrophyIcon,
  School          as SchoolIcon,
  WorkspacePremium as CertIcon,
} from "@mui/icons-material";

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
};

const cardSx = {
  background:   TOKENS.surface,
  border:       `1px solid ${TOKENS.border}`,
  borderRadius: "16px",
  boxShadow:    "0 2px 12px rgba(0,0,0,0.06)",
  overflow:     "hidden",
};

const labelSx = {
  fontFamily:    "'DM Sans', sans-serif",
  fontSize:      11,
  fontWeight:    700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color:         TOKENS.textSub,
};

const inputSx = {
  fontFamily: "'DM Sans', sans-serif",
  fontSize: 13,
  borderRadius: "10px",
  "& .MuiOutlinedInput-notchedOutline": { borderColor: TOKENS.border },
  "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: TOKENS.accent },
  "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: TOKENS.accent },
};

const tableHeadSx = {
  fontFamily:    "'DM Sans', sans-serif",
  fontSize:      11,
  fontWeight:    700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color:         TOKENS.textSub,
  borderBottom:  `2px solid ${TOKENS.border}`,
  py:            1.4,
  whiteSpace:    "nowrap",
  background:    TOKENS.surfaceAlt,
};

const tableCellSx = {
  fontFamily:   "'DM Sans', sans-serif",
  fontSize:     13,
  color:        TOKENS.text,
  borderBottom: `1px solid ${TOKENS.border}`,
  whiteSpace:   "nowrap",
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function formatTimestamp(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
function fileTimestamp(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}
function resolveIntermediateTopic(topicName, assessmentName) {
  if (assessmentName && assessmentName.trim()) return assessmentName.trim();
  if (topicName && topicName.toLowerCase().includes("intermediate")) return topicName;
  return "Intermediate Assessment";
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */
function SectionHeader({ icon, title, subtitle, right }) {
  return (
    <Box sx={{ px: 3, py: 2.5, background: `linear-gradient(135deg, ${TOKENS.accent}0d 0%, ${TOKENS.accentLight} 100%)`, borderBottom: `1px solid ${TOKENS.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5, flexWrap: "wrap" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <Box sx={{ color: TOKENS.accent, display: "flex" }}>{icon}</Box>
        <Box>
          <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 800, color: TOKENS.text, letterSpacing: "-0.02em" }}>{title}</Typography>
          {subtitle && <Typography sx={{ ...labelSx, fontSize: 10, mt: 0.2 }}>{subtitle}</Typography>}
        </Box>
      </Box>
      {right && <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>{right}</Box>}
    </Box>
  );
}

function StatusBanner({ message }) {
  if (!message) return null;
  const isSuccess = message.startsWith("✅");
  const isWarning = message.startsWith("⚠️");
  const colors = isSuccess ? TOKENS.success : isWarning ? TOKENS.warning : TOKENS.error;
  const Icon = isSuccess ? CheckCircleIcon : isWarning ? InfoOutlinedIcon : ErrorIcon;
  return (
    <Fade in>
      <Box sx={{ mt: 2, px: 2.5, py: 1.5, borderRadius: "10px", background: colors.light, border: `1px solid ${colors.fill}44`, display: "flex", alignItems: "center", gap: 1.5 }}>
        <Icon sx={{ fontSize: 16, color: colors.fill, flexShrink: 0 }} />
        <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: colors.text }}>{message}</Typography>
      </Box>
    </Fade>
  );
}

/* Percentage cell with colour-coded pill */
function PctCell({ value }) {
  const n = parseFloat(value) || 0;
  const color =
    n >= 80 ? TOKENS.success.fill :
    n >= 70 ? TOKENS.accent :
    n >= 60 ? TOKENS.warning.fill :
              TOKENS.error.fill;
  return (
    <TableCell align="center" sx={{ ...tableCellSx, py: 0.8 }}>
      <Box sx={{ display: "inline-flex", alignItems: "center", px: 1.2, py: 0.3, borderRadius: "20px", background: `${color}18`, border: `1px solid ${color}44` }}>
        <Typography sx={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700, color }}>{n.toFixed(2)}%</Typography>
      </Box>
    </TableCell>
  );
}

/* Yes/No eligibility chip */
function YesNoChip({ value }) {
  const yes = value === "YES";
  return (
    <Chip
      label={value}
      size="small"
      sx={{
        fontFamily: "'DM Sans', sans-serif",
        fontWeight: 700,
        fontSize:   11,
        background: yes ? TOKENS.success.light : TOKENS.error.light,
        color:      yes ? TOKENS.success.text  : TOKENS.error.text,
        border:     `1px solid ${yes ? TOKENS.success.fill : TOKENS.error.fill}44`,
      }}
    />
  );
}

/* Grade chip */
const gradeColor = (grade) => {
  if (grade === "A") return TOKENS.success.fill;
  if (grade === "B") return TOKENS.accent;
  if (grade === "C") return TOKENS.warning.fill;
  if (grade === "D") return "#8b5cf6";
  return TOKENS.error.fill;
};
function GradeChip({ grade }) {
  const c = gradeColor(grade);
  return (
    <Chip label={grade} size="small" sx={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 800, fontSize: 12, background: `${c}18`, color: c, border: `1px solid ${c}44`, minWidth: 32 }} />
  );
}

/* Scorecard column group header */
function ColGroupHeader({ label, color, colSpan }) {
  return (
    <TableCell
      align="center"
      colSpan={colSpan}
      sx={{ ...tableHeadSx, background: color, color: TOKENS.text, borderRight: `1px solid ${TOKENS.border}`, textAlign: "center" }}
    >
      {label}
    </TableCell>
  );
}

/* ─── Main Component ─────────────────────────────────────────────────────── */
export default function MarksDashboard({ user }) {
  const [batchNo,       setBatchNo]       = useState("");
  const [assessmentType,setAssessmentType]= useState("weekly");
  const [marksData,     setMarksData]     = useState([]);
  const [batches,       setBatches]       = useState([]);
  const [fetchLoading,  setFetchLoading]  = useState(false);
  const [message,       setMessage]       = useState("");

  const welcomeName = user?.name || "User";
  const roleTitle   = user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "Dashboard";

  /* ── Load batches ── */
  useEffect(() => {
    axios.get(`${API_BASE}/api/batches`)
      .then(res => { if (Array.isArray(res.data)) setBatches(res.data); })
      .catch(() => setMessage("Error loading batches"));
  }, []);

  /* ── Fetch marks ── */
  const fetchMarks = async () => {
    if (!batchNo) { setMessage("⚠️ Please select a batch"); return; }
    setFetchLoading(true); setMessage("");
    try {
      const url = assessmentType === "scorecard"
        ? `${API_BASE}/api/scorecard/${batchNo}`
        : `${API_BASE}/api/assessments/${batchNo}/${assessmentType}`;
      const res = await axios.get(url);
      if (res.data && Array.isArray(res.data.data)) {
        const processed = res.data.data.map(row =>
          assessmentType === "intermediate"
            ? { ...row, topic_name: resolveIntermediateTopic(row.topic_name, row.assessment_name) }
            : row
        );
        setMarksData(processed);
        setMessage(`✅ Loaded ${processed.length} record${processed.length !== 1 ? "s" : ""}`);
      } else {
        setMarksData([]); setMessage("No data found");
      }
    } catch {
      setMarksData([]); setMessage("Error fetching data");
    } finally {
      setFetchLoading(false);
    }
  };

  /* ── Column definitions ── */
  const getNonScorecardColumns = () => {
    if (!marksData.length || assessmentType === "scorecard") return [];
    const sample = marksData[0];
    const cols = [
      { key: "learner_name",  label: "Name"  },
      { key: "learner_email", label: "Email" },
      { key: "batch_no",      label: "Batch" },
    ];
    if (assessmentType === "module") {
      if (sample.module_no !== undefined) cols.push({ key: "module_no", label: "Module" });
    } else {
      if (sample.week_no !== undefined) cols.push({ key: "week_no", label: "Week" });
    }
    cols.push(
      { key: "assessment_date", label: "Date"       },
      { key: "topic_name",      label: "Assessment" },
      { key: "out_off",         label: "Out Of"     },
      { key: "points",          label: "Points"     },
      { key: "percentage",      label: "Percentage" },
    );
    return cols;
  };

  /* ── Downloads ── */
  const downloadExcel = () => {
    const now = new Date();
    const tsDisplay = formatTimestamp(now), tsFile = fileTimestamp(now);
    let exportData;
    if (assessmentType === "scorecard") {
      exportData = marksData.map(row => ({
        Name: row.name, Email: row.email,
        "Intermediate (%)": row.intermediate,
        "Digital (%)": row.breakdown?.digital, "CMOS (%)": row.breakdown?.cmos,
        "TCL (%)": row.breakdown?.tcl, "Theory Group (%)": row.theory,
        "Physical (%)": row.breakdown?.physical, "Project (%)": row.project,
        "Viva (%)": row.viva, "Overall (%)": row.overall,
        Grade: row.grade, Certification: row.certification, Placement: row.placement,
      }));
    } else {
      const cols = getNonScorecardColumns();
      exportData = marksData.map(row => { const obj = {}; cols.forEach(c => { obj[c.label] = row[c.key] ?? ""; }); return obj; });
    }
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([]);
    XLSX.utils.sheet_add_aoa(ws, [[`Batch: ${batchNo}  |  Type: ${assessmentType.toUpperCase()}  |  Downloaded: ${tsDisplay}`]], { origin: "A1" });
    XLSX.utils.sheet_add_json(ws, exportData, { origin: "A3" });
    XLSX.utils.book_append_sheet(wb, ws, "Marks Data");
    XLSX.writeFile(wb, `marks_${batchNo}_${assessmentType}_${tsFile}.xlsx`);
  };

  const downloadPDF = () => {
    const now = new Date();
    const tsDisplay = formatTimestamp(now), tsFile = fileTimestamp(now);
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14); doc.setFont(undefined, "bold");
    doc.text(`Marks Report — ${batchNo}`, 14, 16);
    doc.setFontSize(9); doc.setFont(undefined, "normal"); doc.setTextColor(100);
    doc.text(`Assessment Type: ${assessmentType.toUpperCase()}   |   Downloaded: ${tsDisplay}`, 14, 23);
    doc.setTextColor(0);
    if (assessmentType === "scorecard") {
      doc.autoTable({
        startY: 30,
        head: [["Name","Email","Inter %","Digital %","CMOS %","TCL %","Theory %","Physical %","Project %","Viva %","Overall %","Grade","Cert","Place"]],
        body: marksData.map(row => [row.name, row.email, row.intermediate, row.breakdown?.digital, row.breakdown?.cmos, row.breakdown?.tcl, row.theory, row.breakdown?.physical, row.project, row.viva, row.overall, row.grade, row.certification, row.placement]),
        styles: { fontSize: 7 }, headStyles: { fillColor: [61, 90, 254], textColor: 255, fontStyle: "bold" }, alternateRowStyles: { fillColor: [245, 247, 255] },
      });
    } else {
      const cols = getNonScorecardColumns();
      doc.autoTable({
        startY: 30,
        head: [cols.map(c => c.label)],
        body: marksData.map(row => cols.map(c => c.key === "percentage" && row[c.key] != null ? `${parseFloat(row[c.key]).toFixed(2)}%` : (row[c.key] ?? ""))),
        styles: { fontSize: 7 }, headStyles: { fillColor: [61, 90, 254], textColor: 255, fontStyle: "bold" }, alternateRowStyles: { fillColor: [245, 247, 255] },
      });
    }
    const pages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i); doc.setFontSize(7); doc.setTextColor(150);
      doc.text(`Page ${i} of ${pages}   |   Downloaded: ${tsDisplay}`, doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 6, { align: "center" });
    }
    doc.save(`marks_${batchNo}_${assessmentType}_${tsFile}.pdf`);
  };

  const isScorecard = assessmentType === "scorecard";

  /* ─── Render ──────────────────────────────────────────────────────────── */
  return (
    <Box sx={{ minHeight: "100vh", background: TOKENS.bg, p: { xs: 2, md: 4 }, fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');`}</style>

      <Box sx={{ maxWidth: 1600, mx: "auto" }}>

        {/* ── Page Header ── */}
        <Box sx={{ mb: 4, display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
          <Box>
            <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: { xs: 24, md: 30 }, fontWeight: 800, color: TOKENS.text, letterSpacing: "-0.03em", mb: 0.5 }}>
              {roleTitle} — Marks Dashboard
            </Typography>
            <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: TOKENS.textSub }}>
              Welcome back, <strong style={{ color: TOKENS.accent }}>{welcomeName}</strong>
            </Typography>
          </Box>
          {marksData.length > 0 && (
            <Box sx={{ display: "flex", gap: 1.5 }}>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon sx={{ fontSize: 16 }} />}
                onClick={downloadExcel}
                sx={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 12, borderRadius: "10px", textTransform: "none", borderColor: TOKENS.border, color: TOKENS.textSub, "&:hover": { borderColor: TOKENS.accent, color: TOKENS.accent, background: TOKENS.accentLight } }}
              >
                Excel
              </Button>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon sx={{ fontSize: 16 }} />}
                onClick={downloadPDF}
                sx={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 12, borderRadius: "10px", textTransform: "none", borderColor: `${TOKENS.error.fill}44`, color: TOKENS.error.fill, "&:hover": { borderColor: TOKENS.error.fill, background: TOKENS.error.light } }}
              >
                PDF
              </Button>
            </Box>
          )}
        </Box>

        {/* ── Filters Card ── */}
        <Box sx={{ ...cardSx, mb: 3 }}>
          <SectionHeader
            icon={<BarChartIcon sx={{ fontSize: 20 }} />}
            title="Assessment Filters"
            subtitle="Select batch and assessment type to load marks"
          />
          <Box sx={{ p: 3, display: "flex", gap: 2, flexWrap: "wrap", alignItems: "flex-end" }}>
            {/* Batch */}
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>Select Batch</InputLabel>
              <Select
                value={batchNo}
                label="Select Batch"
                onChange={e => { setBatchNo(e.target.value); setMarksData([]); }}
                sx={inputSx}
              >
                <MenuItem value="" sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: TOKENS.textSub }}>— Select Batch —</MenuItem>
                {batches.map((b, i) => (
                  <MenuItem key={i} value={b.batch_no} sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>{b.batch_no}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Assessment Type */}
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>Assessment Type</InputLabel>
              <Select
                value={assessmentType}
                label="Assessment Type"
                onChange={e => { setAssessmentType(e.target.value); setMarksData([]); }}
                sx={inputSx}
              >
                {[
                  { v: "weekly",       l: "Weekly"             },
                  { v: "intermediate", l: "Intermediate"        },
                  { v: "module",       l: "Module"              },
                  { v: "final",        l: "Final Assessment"    },
                  { v: "scorecard",    l: "Scorecard"           },
                ].map(item => (
                  <MenuItem key={item.v} value={item.v} sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>{item.l}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Fetch Button */}
            <Button
              variant="contained"
              onClick={fetchMarks}
              disabled={!batchNo || fetchLoading}
              startIcon={fetchLoading ? <CircularProgress size={14} color="inherit" /> : <TableChartIcon sx={{ fontSize: 16 }} />}
              sx={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 13, borderRadius: "10px", textTransform: "none", px: 3, py: 1.1, background: TOKENS.accent, "&:hover": { background: "#2a3fd4" }, "&:disabled": { opacity: 0.5 } }}
            >
              {fetchLoading ? "Loading…" : "Fetch Marks"}
            </Button>

            {/* Record count pill */}
            {marksData.length > 0 && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, py: 0.8, borderRadius: "10px", background: TOKENS.accentLight, border: `1px solid ${TOKENS.accent}33` }}>
                <PersonIcon sx={{ fontSize: 14, color: TOKENS.accent }} />
                <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700, color: TOKENS.accent }}>{marksData.length} records</Typography>
              </Box>
            )}
          </Box>

          <StatusBanner message={message} />
          {message && <Box sx={{ pb: 1 }} />}
        </Box>

        {/* ── Scorecard Table ── */}
        {isScorecard && marksData.length > 0 && (
          <Box sx={{ ...cardSx }}>
            <SectionHeader
              icon={<TrophyIcon sx={{ fontSize: 20 }} />}
              title="Scorecard"
              subtitle={`Batch ${batchNo} · ${marksData.length} learners`}
              right={
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                  {[
                    { label: "Intermediate 10%",  color: "#e3f2fd" },
                    { label: "Theory 20%",         color: "#f3e5f5" },
                    { label: "Physical 30%",       color: "#fff3e0" },
                    { label: "Project 30%",        color: "#fce4ec" },
                    { label: "Viva 10%",           color: "#e0f7fa" },
                  ].map(item => (
                    <Chip key={item.label} label={item.label} size="small" sx={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 10, background: item.color, border: `1px solid ${TOKENS.border}` }} />
                  ))}
                </Box>
              }
            />
            <TableContainer sx={{ maxHeight: 600 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  {/* Group row */}
                  <TableRow>
                    <TableCell colSpan={2} sx={{ ...tableHeadSx, background: TOKENS.surfaceAlt }} />
                    <ColGroupHeader label="Intermediate"  color="#e3f2fd" colSpan={1} />
                    <ColGroupHeader label="Theory Group"  color="#f3e5f5" colSpan={4} />
                    <ColGroupHeader label="Physical"      color="#fff3e0" colSpan={1} />
                    <ColGroupHeader label="Project"       color="#fce4ec" colSpan={1} />
                    <ColGroupHeader label="Viva"          color="#e0f7fa" colSpan={1} />
                    <TableCell colSpan={3} sx={{ ...tableHeadSx, background: TOKENS.surfaceAlt, borderRight: `1px solid ${TOKENS.border}` }} />
                  </TableRow>
                  {/* Label row */}
                  <TableRow>
                    {[
                      { l: "Name",                   align: "left"   },
                      { l: "Email",                  align: "left"   },
                      { l: "Intermediate %",         align: "center", bg: "#e3f2fd" },
                      { l: "Digital %",              align: "center", bg: "#f3e5f5" },
                      { l: "CMOS %",                 align: "center", bg: "#f3e5f5" },
                      { l: "TCL %",                  align: "center", bg: "#f3e5f5" },
                      { l: "Theory Group %",         align: "center", bg: "#f3e5f5" },
                      { l: "Physical %",             align: "center", bg: "#fff3e0" },
                      { l: "Project %",              align: "center", bg: "#fce4ec" },
                      { l: "Viva %",                 align: "center", bg: "#e0f7fa" },
                      { l: "Overall %",              align: "center"  },
                      { l: "Grade",                  align: "center"  },
                      { l: "Certification",          align: "center"  },
                      { l: "Placement",              align: "center"  },
                    ].map(h => (
                      <TableCell key={h.l} align={h.align} sx={{ ...tableHeadSx, background: h.bg || TOKENS.surfaceAlt }}>{h.l}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {marksData.map((row, i) => (
                    <TableRow
                      key={i}
                      sx={{ "&:nth-of-type(even)": { background: TOKENS.surfaceAlt }, "&:hover": { background: `${TOKENS.accent}08`, transition: "background 0.15s" } }}
                    >
                      <TableCell sx={{ ...tableCellSx, fontWeight: 600 }}>{row.name}</TableCell>
                      <TableCell sx={{ ...tableCellSx, color: TOKENS.textSub, fontSize: 12 }}>{row.email}</TableCell>
                      <PctCell value={row.intermediate            ?? 0} />
                      <PctCell value={row.breakdown?.digital      ?? 0} />
                      <PctCell value={row.breakdown?.cmos         ?? 0} />
                      <PctCell value={row.breakdown?.tcl          ?? 0} />
                      <PctCell value={row.theory                  ?? 0} />
                      <PctCell value={row.breakdown?.physical     ?? 0} />
                      <PctCell value={row.project                 ?? 0} />
                      <PctCell value={row.viva                    ?? 0} />
                      {/* Overall with larger display */}
                      <TableCell align="center" sx={{ ...tableCellSx }}>
                        {(() => {
                          const n = parseFloat(row.overall || 0);
                          const c = n >= 80 ? TOKENS.success.fill : n >= 70 ? TOKENS.accent : TOKENS.error.fill;
                          return (
                            <Box sx={{ display: "inline-flex", alignItems: "center", px: 1.5, py: 0.4, borderRadius: "20px", background: `${c}18`, border: `1px solid ${c}44` }}>
                              <Typography sx={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 800, color: c }}>{n.toFixed(2)}%</Typography>
                            </Box>
                          );
                        })()}
                      </TableCell>
                      <TableCell align="center" sx={{ ...tableCellSx }}><GradeChip grade={row.grade} /></TableCell>
                      <TableCell align="center" sx={{ ...tableCellSx }}><YesNoChip value={row.certification} /></TableCell>
                      <TableCell align="center" sx={{ ...tableCellSx }}><YesNoChip value={row.placement} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {/* Legend footer */}
            <Box sx={{ px: 3, py: 2, background: TOKENS.surfaceAlt, borderTop: `1px solid ${TOKENS.border}`, display: "flex", gap: 3, flexWrap: "wrap", alignItems: "center" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <CertIcon sx={{ fontSize: 14, color: TOKENS.textSub }} />
                <Typography sx={{ ...labelSx, fontSize: 10 }}>Certification: Project ≥ 70% AND Overall ≥ 70%</Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <SchoolIcon sx={{ fontSize: 14, color: TOKENS.textSub }} />
                <Typography sx={{ ...labelSx, fontSize: 10 }}>Placement: Project ≥ 70% AND Viva ≥ 70% AND Overall ≥ 80%</Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography sx={{ ...labelSx, fontSize: 10 }}>Weightage: Intermediate 10% · Theory 20% · Physical 30% · Project 30% · Viva 10%</Typography>
              </Box>
            </Box>
          </Box>
        )}

        {/* ── Non-Scorecard Table ── */}
        {!isScorecard && marksData.length > 0 && (() => {
          const columns = getNonScorecardColumns();
          return (
            <Box sx={{ ...cardSx }}>
              <SectionHeader
                icon={<TableChartIcon sx={{ fontSize: 20 }} />}
                title={`${assessmentType.charAt(0).toUpperCase() + assessmentType.slice(1)} Assessment Marks`}
                subtitle={`Batch ${batchNo} · ${marksData.length} records`}
                right={
                  <Chip
                    label={`${marksData.length} records`}
                    size="small"
                    sx={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 11, background: TOKENS.accentLight, color: TOKENS.accent, border: `1px solid ${TOKENS.accent}33` }}
                  />
                }
              />
              <TableContainer sx={{ maxHeight: 600 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ ...tableHeadSx, width: 36 }}>#</TableCell>
                      {columns.map(col => (
                        <TableCell key={col.key} sx={tableHeadSx}>{col.label}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {marksData.map((row, i) => (
                      <TableRow
                        key={i}
                        sx={{ "&:nth-of-type(even)": { background: TOKENS.surfaceAlt }, "&:hover": { background: `${TOKENS.accent}08`, transition: "background 0.15s" } }}
                      >
                        <TableCell sx={{ ...tableCellSx, color: TOKENS.textSub, fontFamily: "'DM Mono', monospace", fontSize: 11 }}>{i + 1}</TableCell>
                        {columns.map(col => {
                          if (col.key === "percentage") {
                            const n = parseFloat(row[col.key]);
                            if (!isNaN(n)) return <PctCell key={col.key} value={n} />;
                            return <TableCell key={col.key} sx={tableCellSx}>—</TableCell>;
                          }
                          const isName  = col.key === "learner_name";
                          const isEmail = col.key === "learner_email";
                          const isNum   = ["points","out_off","week_no","module_no"].includes(col.key);
                          return (
                            <TableCell key={col.key} sx={{
                              ...tableCellSx,
                              fontWeight:  isName ? 600 : 400,
                              color:       isEmail ? TOKENS.textSub : TOKENS.text,
                              fontSize:    isEmail ? 12 : 13,
                              fontFamily:  isNum ? "'DM Mono', monospace" : "'DM Sans', sans-serif",
                            }}>
                              {row[col.key] ?? "—"}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          );
        })()}

      </Box>
    </Box>
  );
}