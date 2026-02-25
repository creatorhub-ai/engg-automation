import React, { useEffect, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import {
  Paper,
  Typography,
  Button,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Box,
  Alert,
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
  Download as DownloadIcon,
  TableChart as TableChartIcon,
} from "@mui/icons-material";

const API_BASE =
  process.env.REACT_APP_API_URL ||
  "https://engg-automation.onrender.com";

export default function MarksDashboard({ user }) {
  const [batchNo, setBatchNo]               = useState("");
  const [assessmentType, setAssessmentType] = useState("weekly");
  const [marksData, setMarksData]           = useState([]);
  const [batches, setBatches]               = useState([]);
  const [fetchLoading, setFetchLoading]     = useState(false);
  const [message, setMessage]               = useState("");

  // ── Load batches ────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchBatches = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/batches`);
        if (Array.isArray(res.data)) setBatches(res.data);
      } catch {
        setMessage("Error loading batches");
      }
    };
    fetchBatches();
  }, []);

  // ── Fetch marks ─────────────────────────────────────────────────────────────
  const fetchMarks = async () => {
    if (!batchNo) { setMessage("⚠️ Please select batch"); return; }
    setFetchLoading(true);
    setMessage("");
    try {
      const url =
        assessmentType === "scorecard"
          ? `${API_BASE}/api/scorecard/${batchNo}`
          : `${API_BASE}/api/assessments/${batchNo}/${assessmentType}`;

      const res = await axios.get(url);
      if (res.data && Array.isArray(res.data.data)) {
        setMarksData(res.data.data);
        setMessage(`✅ Loaded ${res.data.data.length} records`);
      } else {
        setMarksData([]);
        setMessage("No data found");
      }
    } catch {
      setMarksData([]);
      setMessage("Error fetching data");
    } finally {
      setFetchLoading(false);
    }
  };

  // ── Column definitions for non-scorecard tables ──────────────────────────────
  // course_planner_id is intentionally excluded for all non-scorecard types.
  // learner_id is replaced by learner_name (enriched by backend).
  // assessment_name is replaced by topic_name (enriched by backend).
  const getNonScorecardColumns = () => {
    if (!marksData.length || assessmentType === "scorecard") return [];

    const sampleRow = marksData[0];
    const cols = [
      { key: "learner_name",  label: "Name"  },   // enriched in backend
      { key: "learner_email", label: "Email" },    // enriched in backend
      { key: "batch_no",      label: "Batch" },
    ];

    // Period identifier — module type uses module_no, everything else uses week_no
    if (assessmentType === "module") {
      if (sampleRow.module_no !== undefined) cols.push({ key: "module_no", label: "Module" });
    } else {
      if (sampleRow.week_no !== undefined)   cols.push({ key: "week_no",   label: "Week"  });
    }

    cols.push({ key: "assessment_date", label: "Date" });

    // Show resolved topic_name from course_planner_data (not raw assessment_name)
    cols.push({ key: "topic_name", label: "Assessment" });

    cols.push(
      { key: "out_off",    label: "Out Of"     },
      { key: "points",     label: "Points"     },
      { key: "percentage", label: "Percentage" },
    );

    return cols;
  };

  // ── Excel download ───────────────────────────────────────────────────────────
  const downloadExcel = () => {
    let exportData;
    if (assessmentType === "scorecard") {
      exportData = marksData.map((row) => ({
        Name:               row.name,
        Email:              row.email,
        "Intermediate (%)": row.intermediate,
        "Digital (%)":      row.breakdown?.digital,
        "CMOS (%)":         row.breakdown?.cmos,
        "TCL (%)":          row.breakdown?.tcl,
        "Theory Group (%)": row.theory,
        "Physical (%)":     row.breakdown?.physical,
        "Project (%)":      row.project,
        "Viva (%)":         row.viva,
        "Overall (%)":      row.overall,
        Grade:              row.grade,
        Certification:      row.certification,
        Placement:          row.placement,
      }));
    } else {
      const columns = getNonScorecardColumns();
      exportData = marksData.map((row) => {
        const obj = {};
        columns.forEach((col) => { obj[col.label] = row[col.key] ?? ""; });
        return obj;
      });
    }
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Marks Data");
    XLSX.writeFile(wb, `marks_${batchNo}_${assessmentType}.xlsx`);
  };

  // ── PDF download ─────────────────────────────────────────────────────────────
  const downloadPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text(`Marks Report - ${batchNo}`, 14, 20);

    if (assessmentType === "scorecard") {
      doc.autoTable({
        startY: 30,
        head: [[
          "Name", "Email",
          "Inter %", "Digital %", "CMOS %", "TCL %",
          "Theory %", "Physical %", "Project %", "Viva %",
          "Overall %", "Grade", "Cert", "Place",
        ]],
        body: marksData.map((row) => [
          row.name, row.email,
          row.intermediate,
          row.breakdown?.digital, row.breakdown?.cmos,
          row.breakdown?.tcl, row.theory,
          row.breakdown?.physical, row.project,
          row.viva, row.overall,
          row.grade, row.certification, row.placement,
        ]),
        styles: { fontSize: 7 },
      });
    } else {
      const columns = getNonScorecardColumns();
      doc.autoTable({
        startY: 30,
        head: [columns.map((c) => c.label)],
        body: marksData.map((row) => columns.map((c) => row[c.key] ?? "")),
        styles: { fontSize: 7 },
      });
    }
    doc.save(`marks_${batchNo}_${assessmentType}.pdf`);
  };

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const roleTitle   = user?.role
    ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
    : "Marks Dashboard";
  const welcomeName = user?.name || "User";

  const gradeColour = (grade) => {
    if (grade === "A") return "#2e7d32";
    if (grade === "B") return "#1565c0";
    if (grade === "C") return "#e65100";
    if (grade === "D") return "#6a1a4c";
    return "#b71c1c";
  };

  const YesNoChip = ({ value }) => (
    <Chip
      label={value}
      size="small"
      sx={{
        fontWeight: 700,
        bgcolor: value === "YES" ? "#e8f5e9" : "#ffebee",
        color:   value === "YES" ? "#2e7d32" : "#c62828",
        border:  `1px solid ${value === "YES" ? "#a5d6a7" : "#ef9a9a"}`,
      }}
    />
  );

  const PctCell = ({ value }) => {
    const n = parseFloat(value) || 0;
    let colour = "#c62828";
    if (n >= 80)      colour = "#2e7d32";
    else if (n >= 70) colour = "#1565c0";
    else if (n >= 60) colour = "#e65100";
    return (
      <TableCell align="center" sx={{ fontWeight: 600, color: colour, whiteSpace: "nowrap" }}>
        {n.toFixed(2)}
      </TableCell>
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ maxWidth: 1600, mx: "auto", my: 3, px: 2 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" mb={0.5}>{roleTitle}</Typography>
        <Typography mb={3} color="text.secondary">Welcome, {welcomeName}!</Typography>

        {/* ── Filters ── */}
        <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Select Batch</InputLabel>
            <Select
              value={batchNo}
              label="Select Batch"
              onChange={(e) => { setBatchNo(e.target.value); setMarksData([]); }}
            >
              <MenuItem value="">-- Select Batch --</MenuItem>
              {batches.map((b, i) => (
                <MenuItem key={i} value={b.batch_no}>{b.batch_no}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 220 }}>
            <InputLabel>Assessment Type</InputLabel>
            <Select
              value={assessmentType}
              label="Assessment Type"
              onChange={(e) => { setAssessmentType(e.target.value); setMarksData([]); }}
            >
              <MenuItem value="weekly">Weekly</MenuItem>
              <MenuItem value="intermediate">Intermediate</MenuItem>
              <MenuItem value="module">Module</MenuItem>
              <MenuItem value="final">Final Assessment</MenuItem>   {/* ← NEW */}
              <MenuItem value="scorecard">Scorecard</MenuItem>
            </Select>
          </FormControl>

          <Button
            variant="contained"
            onClick={fetchMarks}
            disabled={!batchNo || fetchLoading}
            startIcon={fetchLoading ? <CircularProgress size={18} /> : <TableChartIcon />}
          >
            Fetch Marks
          </Button>

          {marksData.length > 0 && (
            <>
              <Button variant="outlined" startIcon={<DownloadIcon />} onClick={downloadExcel}>
                Excel
              </Button>
              <Button variant="outlined" color="error" startIcon={<DownloadIcon />} onClick={downloadPDF}>
                PDF
              </Button>
            </>
          )}
        </Box>

        {/* ── SCORECARD TABLE ── */}
        {assessmentType === "scorecard" && marksData.length > 0 && (
          <>
            <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap" }}>
              {[
                { label: "Intermediate (10%)", tip: "All intermediate assessments combined → /100" },
                { label: "Theory (20%)",        tip: "Digital + CMOS + TCL combined → /100"        },
                { label: "Physical (30%)",       tip: "Physical Design → /100"                      },
                { label: "Project (30%)",        tip: "Final Project → /100"                        },
                { label: "Viva (10%)",           tip: "Viva → /100"                                 },
              ].map((item) => (
                <Chip key={item.label} label={item.label} size="small" variant="outlined"
                  title={item.tip} sx={{ fontSize: 11 }} />
              ))}
            </Box>

            <TableContainer sx={{ maxHeight: 600 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>Email</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, bgcolor: "#e3f2fd", whiteSpace: "nowrap" }}>Intermediate Assessment %</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, bgcolor: "#f3e5f5", whiteSpace: "nowrap" }}>Digital Assessment %</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, bgcolor: "#f3e5f5", whiteSpace: "nowrap" }}>CMOS Assessment %</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, bgcolor: "#f3e5f5", whiteSpace: "nowrap" }}>TCL Assessment %</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, bgcolor: "#e8f5e9", whiteSpace: "nowrap" }}>Theory Group %</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, bgcolor: "#fff3e0", whiteSpace: "nowrap" }}>Physical Assessment %</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, bgcolor: "#fce4ec", whiteSpace: "nowrap" }}>Project Assessment %</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, bgcolor: "#e0f7fa", whiteSpace: "nowrap" }}>Viva Assessment %</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>Overall Percentage %</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>Grade</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>Eligibility for Certification</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>Eligibility for Placement</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {marksData.map((row, i) => (
                    <TableRow key={i}
                      sx={{ "&:nth-of-type(odd)": { bgcolor: "#fafafa" }, "&:hover": { bgcolor: "#f0f4ff" } }}>
                      <TableCell sx={{ fontWeight: 500 }}>{row.name}</TableCell>
                      <TableCell sx={{ fontSize: 12, color: "text.secondary" }}>{row.email}</TableCell>
                      <PctCell value={row.intermediate            ?? 0} />
                      <PctCell value={row.breakdown?.digital      ?? 0} />
                      <PctCell value={row.breakdown?.cmos         ?? 0} />
                      <PctCell value={row.breakdown?.tcl          ?? 0} />
                      <PctCell value={row.theory                  ?? 0} />
                      <PctCell value={row.breakdown?.physical     ?? 0} />
                      <PctCell value={row.project                 ?? 0} />
                      <PctCell value={row.viva                    ?? 0} />
                      <TableCell align="center">
                        <Box sx={{
                          fontWeight: 700, fontSize: 14,
                          color: parseFloat(row.overall) >= 80 ? "#2e7d32"
                               : parseFloat(row.overall) >= 70 ? "#1565c0"
                               : "#c62828",
                        }}>
                          {parseFloat(row.overall || 0).toFixed(2)}
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Chip label={row.grade} size="small" sx={{
                          fontWeight: 700,
                          bgcolor: gradeColour(row.grade) + "22",
                          color:   gradeColour(row.grade),
                          border:  `1px solid ${gradeColour(row.grade)}55`,
                        }} />
                      </TableCell>
                      <TableCell align="center"><YesNoChip value={row.certification} /></TableCell>
                      <TableCell align="center"><YesNoChip value={row.placement}     /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Box sx={{ mt: 2, p: 2, bgcolor: "#f5f5f5", borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary">
                <strong>Weightage:</strong>&nbsp;
                Intermediate 10% + Theory (Digital+CMOS+TCL) 20% + Physical Design 30% + Final Project 30% + Viva 10% = 100%
                &nbsp;|&nbsp;<strong>Certification:</strong> Overall ≥ 70%
                &nbsp;|&nbsp;<strong>Placement:</strong> Overall ≥ 80%
              </Typography>
            </Box>
          </>
        )}

        {/* ── NON-SCORECARD TABLE ── */}
        {assessmentType !== "scorecard" && marksData.length > 0 && (() => {
          const columns = getNonScorecardColumns();
          return (
            <TableContainer sx={{ maxHeight: 600 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: "#f0f4ff" }}>
                    {columns.map((col) => (
                      <TableCell key={col.key} sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                        {col.label}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {marksData.map((row, i) => (
                    <TableRow key={i}
                      sx={{ "&:nth-of-type(odd)": { bgcolor: "#fafafa" }, "&:hover": { bgcolor: "#f0f4ff" } }}>
                      {columns.map((col) => (
                        <TableCell key={col.key} sx={{ whiteSpace: "nowrap" }}>
                          {col.key === "percentage"
                            ? (row[col.key] != null ? `${parseFloat(row[col.key]).toFixed(2)}%` : "—")
                            : (row[col.key] ?? "—")}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          );
        })()}

        <Fade in={!!message}>
          <Box mt={2}>
            {message && (
              <Alert severity={
                message.startsWith("✅") ? "success"
                : message.startsWith("⚠️") ? "warning"
                : "error"
              }>
                {message}
              </Alert>
            )}
          </Box>
        </Fade>
      </Paper>
    </Box>
  );
}