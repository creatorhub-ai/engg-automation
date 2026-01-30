import React, { useEffect, useState } from "react";
import axios from "axios";
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
      const res = await axios.get(
        `${API_BASE}/api/assessments/${batchNo}/${assessmentType}`
      );
      
      if (res.data && Array.isArray(res.data.data)) {
        setMarksData(res.data.data);
        setMessage(`✅ Loaded ${res.data.data.length} assessment records`);
      } else {
        setMarksData([]);
        setMessage("No assessment data found for selected criteria");
      }
    } catch (error) {
      console.error("Failed to fetch marks:", error);
      setMarksData([]);
      setMessage(
        error.response?.data?.error || "Error fetching assessment data"
      );
    } finally {
      setFetchLoading(false);
    }
  };

  const handleDownload = async (format) => {
    try {
      setMessage(`📥 Downloading ${format.toUpperCase()}...`);
      const res = await axios.get(
        `${API_BASE}/api/download/${format}/${batchNo}/${assessmentType}`,
        { responseType: "blob" }
      );
      
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `marks_${batchNo}_${assessmentType}_${format}_${new Date().toISOString().split('T')[0]}.${format === 'csv' ? 'xlsx' : 'pdf'}`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      setMessage(`✅ ${format.toUpperCase()} downloaded successfully!`);
    } catch (error) {
      console.error(`Download failed:`, error);
      setMessage(`❌ Failed to download ${format.toUpperCase()}`);
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
    
    const sampleRow = marksData[0];
    const columns = [
      { key: "learner_id", label: "Learner ID", numeric: true },
      { key: "course_planner_id", label: "Course ID", numeric: true },
      { key: "batch_no", label: "Batch", numeric: false },
    ];

    if (sampleRow.week_no !== undefined) {
      columns.push({ key: "week_no", label: "Week", numeric: true });
    }
    if (sampleRow.module_no !== undefined) {
      columns.push({ key: "module_no", label: "Module", numeric: true });
    }

    columns.push(
      { key: "assessment_date", label: "Date", numeric: false },
      sampleRow.assessment_name ? 
        { key: "assessment_name", label: "Assessment", numeric: false } : null,
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

        {/* Download Buttons */}
        {marksData.length > 0 && (
          <Box sx={{ display: "flex", gap: 2, mb: 3 }}>
            <Button
              variant="outlined"
              color="success"
              startIcon={<DownloadIcon />}
              onClick={() => handleDownload("csv")}
              sx={{ fontWeight: "bold" }}
            >
              Download CSV/XLSX
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DownloadIcon />}
              onClick={() => handleDownload("pdf")}
              sx={{ fontWeight: "bold" }}
            >
              Download PDF
            </Button>
          </Box>
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
