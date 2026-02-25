import React, { useEffect, useState } from "react";
import axios from "axios";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import {
  Paper,
  Typography,
  Button,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Box,
  TextField,
  Alert,
  Fade,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  CircularProgress,
} from "@mui/material";
import {
  Download as DownloadIcon,
  TableChart as TableChartIcon,
} from "@mui/icons-material";

const API_BASE = process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

export default function MarksDashboard({ user }) {
  const [batchNo, setBatchNo] = useState("");
  const [assessmentType, setAssessmentType] = useState("weekly");
  const [marksData, setMarksData] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");

  // Fetch batches on mount
  useEffect(() => {
    const fetchBatches = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/batches`);
        if (res.data && Array.isArray(res.data)) {
          setBatches(res.data);
        } else {
          setMessage("No batches found");
        }
      } catch (error) {
        console.error("Failed to fetch batches:", error);
        setMessage("Error loading batches. See console for details.");
      }
    };
    fetchBatches();
  }, []);

  const fetchMarks = async () => {
    if (!batchNo) {
      setMessage("⚠️ Please select batch");
      return;
    }

    setFetchLoading(true);
    setMessage("");

    try {
      let url =
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
    } catch (error) {
      console.error(error);
      setMarksData([]);
      setMessage("Error fetching data");
    } finally {
      setFetchLoading(false);
    }
  };

  // ✅ CLIENT-SIDE CSV/XLSX DOWNLOAD
  const downloadExcel = () => {
    try {
      const ws = XLSX.utils.json_to_sheet(marksData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Marks Data");
      
      const filename = `marks_${batchNo}_${assessmentType}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, filename);
      
      setMessage(`✅ XLSX downloaded: ${marksData.length} records`);
    } catch (error) {
      console.error("Excel download failed:", error);
      setMessage("❌ Excel download failed");
    }
  };

  // ✅ CLIENT-SIDE PDF DOWNLOAD
  const downloadPDF = () => {
    try {
      const doc = new jsPDF();
      const date = new Date().toLocaleDateString();
      
      // Title
      doc.setFontSize(16);
      doc.text(`Marks Report - ${batchNo} (${assessmentType})`, 14, 20);
      doc.setFontSize(10);
      doc.text(`Generated: ${date}`, 14, 28);

      // Dynamic columns based on data
      const sampleRow = marksData[0] || {};
      const columns = [
        { header: 'Learner ID', dataKey: 'learner_id' },
        { header: 'Course ID', dataKey: 'course_planner_id' },
        { header: 'Batch', dataKey: 'batch_no' },
      ];

      if (sampleRow.week_no !== undefined) columns.push({ header: 'Week', dataKey: 'week_no' });
      if (sampleRow.module_no !== undefined) columns.push({ header: 'Module', dataKey: 'module_no' });
      
      columns.push(
        { header: 'Date', dataKey: 'assessment_date' },
        ...(sampleRow.assessment_name ? [{ header: 'Assessment', dataKey: 'assessment_name' }] : []),
        { header: 'Out Of', dataKey: 'out_off' },
        { header: 'Points', dataKey: 'points' },
        { header: 'Percentage', dataKey: 'percentage' }
      );

      // Prepare table data
      const tableData = marksData.map(row => ({
        learner_id: row.learner_id,
        course_planner_id: row.course_planner_id,
        batch_no: row.batch_no,
        week_no: row.week_no || '',
        module_no: row.module_no || '',
        assessment_date: row.assessment_date || '',
        assessment_name: row.assessment_name || '',
        out_off: row.out_off,
        points: row.points,
        percentage: row.percentage ? `${row.percentage.toFixed(2)}%` : '-'
      }));

      // Generate table
      doc.autoTable({
        startY: 35,
        head: columns.map(col => [col.header]),
        body: tableData.map(row => columns.map(col => row[col.dataKey] || '-')),
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [66, 139, 202], textColor: 255, fontStyle: 'bold' },
        margin: { top: 35 }
      });

      const filename = `marks_${batchNo}_${assessmentType}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(filename);
      
      setMessage(`✅ PDF downloaded: ${marksData.length} records`);
    } catch (error) {
      console.error("PDF download failed:", error);
      setMessage("❌ PDF download failed");
    }
  };

  // Role-based title and welcome
  const roleTitle = user?.role 
    ? user.role.charAt(0).toUpperCase() + user.role.slice(1) 
    : "Marks Dashboard";
  const welcomeName = user?.name || "User";

  const formatPercentage = (percentage) => {
    return percentage ? `${percentage.toFixed(2)}%` : "-";
  };

  const getDynamicColumns = () => {
    if (marksData.length === 0) return [];

    // ✅ Scorecard case
    if (assessmentType === "scorecard") {
      return Object.keys(marksData[0]).map((key) => ({
        key,
        label: key,
        numeric: key.includes("%") || key.includes("Marks")
      }));
    }

    // Existing logic
    const sampleRow = marksData[0];
    const columns = [
      { key: "learner_id", label: "Learner ID", numeric: true },
      { key: "course_planner_id", label: "Course ID", numeric: true },
      { key: "batch_no", label: "Batch", numeric: false },
    ];

    if (sampleRow.week_no !== undefined)
      columns.push({ key: "week_no", label: "Week", numeric: true });

    if (sampleRow.module_no !== undefined)
      columns.push({ key: "module_no", label: "Module", numeric: true });

    columns.push(
      { key: "assessment_date", label: "Date", numeric: false },
      sampleRow.assessment_name
        ? { key: "assessment_name", label: "Assessment", numeric: false }
        : null,
      { key: "out_off", label: "Out Of", numeric: true },
      { key: "points", label: "Points", numeric: true },
      { key: "percentage", label: "Percentage", numeric: true }
    );

    return columns.filter(Boolean);
  };

  return (
    <Box sx={{ maxWidth: 1400, mx: "auto", my: 3 }}>
      <Paper elevation={5} sx={{ p: 4, borderRadius: 3 }}>
        <Typography variant="h4" color="primary" gutterBottom>
          {roleTitle}
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" mb={3}>
          Welcome, {welcomeName}!
        </Typography>

        <Typography variant="h6" color="primary" sx={{ mb: 3 }}>
          📊 Marks Dashboard
        </Typography>

        {/* Filters */}
        <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap", mb: 3 }}>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Select Batch</InputLabel>
            <Select
              label="Select Batch"
              value={batchNo}
              onChange={(e) => setBatchNo(e.target.value)}
            >
              <MenuItem value="">-- Select Batch --</MenuItem>
              {batches.map((b, idx) => (
                <MenuItem key={idx} value={b.batch_no}>
                  {b.batch_no} ({b.start_date})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 220 }}>
            <InputLabel>Assessment Type</InputLabel>
            <Select
              label="Assessment Type"
              value={assessmentType}
              onChange={(e) => setAssessmentType(e.target.value)}
            >
              <MenuItem value="weekly">Weekly Assessment</MenuItem>
              <MenuItem value="intermediate">Intermediate Assessment</MenuItem>
              <MenuItem value="module">Module Level Assessment</MenuItem>
              <MenuItem value="scorecard">Scorecard</MenuItem>
            </Select>
          </FormControl>

          <Button
            variant="contained"
            color="primary"
            onClick={fetchMarks}
            disabled={!batchNo || fetchLoading}
            startIcon={fetchLoading ? <CircularProgress size={20} /> : <TableChartIcon />}
            sx={{ py: 1.5, fontWeight: "bold", fontSize: "1rem", boxShadow: 4 }}
          >
            {fetchLoading ? "Loading..." : "Fetch Marks"}
          </Button>
        </Box>

        {/* ✅ Download Buttons - CLIENT-SIDE */}
        {marksData.length > 0 && (
          <Box sx={{ display: "flex", gap: 2, mb: 3 }}>
            <Button
              variant="outlined"
              color="success"
              startIcon={<DownloadIcon />}
              onClick={downloadExcel}
              sx={{ fontWeight: "bold" }}
            >
              Download XLSX
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DownloadIcon />}
              onClick={downloadPDF}
              sx={{ fontWeight: "bold" }}
            >
              Download PDF
            </Button>
          </Box>
        )}

        {assessmentType === "scorecard" && marksData.length > 0 && (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>

                  {batchNo.includes("PDFT") ? (
                    <>
                      <TableCell>Digital Design</TableCell>
                      <TableCell>CMOS</TableCell>
                      <TableCell>TCL</TableCell>
                      <TableCell>Physical Design</TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell>Digital</TableCell>
                      <TableCell>Verilog</TableCell>
                      <TableCell>SV</TableCell>
                      <TableCell>UVM</TableCell>
                      <TableCell>Python</TableCell>
                    </>
                  )}

                  <TableCell>Project</TableCell>
                  <TableCell>Overall %</TableCell>
                  <TableCell>Grade</TableCell>
                  <TableCell>Certification</TableCell>
                  <TableCell>Placement</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {marksData.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.email}</TableCell>

                    {Object.values(row.breakdown || {}).map((val, idx) => (
                      <TableCell key={idx}>{val.toFixed(2)}</TableCell>
                    ))}

                    <TableCell>{row.project}</TableCell>
                    <TableCell>{row.overall}</TableCell>
                    <TableCell>{row.grade}</TableCell>
                    <TableCell>{row.certification}</TableCell>
                    <TableCell>{row.placement}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Results Table */}
        {marksData.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="h6" color="primary" gutterBottom>
              📋 Results: {marksData.length} records found
            </Typography>
            <TableContainer sx={{ maxHeight: 600, borderRadius: 2, boxShadow: 2 }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    {getDynamicColumns().map((col) => (
                      <TableCell 
                        key={col.key} 
                        sx={{ 
                          fontWeight: "bold", 
                          backgroundColor: "primary.light",
                          color: "white",
                          ...(col.numeric && { textAlign: "right" })
                        }}
                      >
                        {col.label}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {marksData.map((row, idx) => (
                    <TableRow key={idx} hover>
                      {getDynamicColumns().map((col) => (
                        <TableCell 
                          key={col.key}
                          sx={{ 
                            ...(col.numeric && { textAlign: "right" })
                          }}
                        >
                          {col.key === "percentage" 
                            ? formatPercentage(row[col.key])
                            : row[col.key] || "-"
                          }
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Messages */}
        <Fade in={!!message}>
          <Box>
            {message && (
              <Alert 
                severity={
                  message.startsWith("✅") || message.startsWith("📥") 
                    ? "success" 
                    : message.startsWith("⚠️") || message.startsWith("❌")
                    ? "warning" 
                    : "info"
                }
              >
                {message}
              </Alert>
            )}
          </Box>
        </Fade>
      </Paper>
    </Box>
  );
}
