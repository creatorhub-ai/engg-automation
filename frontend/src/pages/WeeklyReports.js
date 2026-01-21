// WeeklyReports.js
import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  Box,
  Paper,
  Typography,
  FormControl,
  Select,
  InputLabel,
  MenuItem,
  Grid,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Chip,
  CircularProgress,
  Alert,
  Button,
} from "@mui/material";
import FileDownloadIcon from "@mui/icons-material/FileDownload";

const API_BASE =
  process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

export default function WeeklyReports({ user, token }) {
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState("");
  const [weeks, setWeeks] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  // load distinct batches
  useEffect(() => {
    async function loadBatches() {
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await axios.get(`${API_BASE}/api/batches`, { headers });
        setBatches(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Error loading batches:", err);
        setError("Error loading batches");
      }
    }
    loadBatches();
  }, [token]);

  // when batch changes: load weeks for that batch
  useEffect(() => {
    if (!selectedBatch) {
      setWeeks([]);
      setSelectedWeek("");
      setRows([]);
      return;
    }

    async function loadWeeks() {
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await axios.get(
          `${API_BASE}/api/weeks/${selectedBatch}`,
          { headers }
        );
        const list = Array.isArray(res.data) ? res.data : [];
        const sorted = [...list].sort((a, b) => Number(a) - Number(b));
        setWeeks(sorted);
        setSelectedWeek(sorted[0] || "");
      } catch (err) {
        console.error("Error loading weeks:", err);
        setError("Error loading weeks");
        setWeeks([]);
        setSelectedWeek("");
        setRows([]);
      }
    }

    loadWeeks();
  }, [selectedBatch, token]);

  // when batch or week changes: load weekly date‑change data
  useEffect(() => {
    if (!selectedBatch || !selectedWeek) {
      setRows([]);
      return;
    }

    async function loadWeeklyReport() {
      setLoading(true);
      setError("");
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await axios.get(
          `${API_BASE}/api/weekly-date-report/${selectedBatch}`,
          {
            headers,
            params: { week_no: selectedWeek },
          }
        );
        setRows(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Error loading weekly report:", err);
        setError("Error loading weekly report");
        setRows([]);
      } finally {
        setLoading(false);
      }
    }

    loadWeeklyReport();
  }, [selectedBatch, selectedWeek, token]);

  // Generate IST timestamp for filename (backend handles PDF content timestamp)
  const generateFileTimestamp = () => {
    const now = new Date();
    return now.toLocaleString('en-IN', { 
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).replace(/[,]/g, '').replace(/:/g, '-');
  };

  // handle PDF download
  const handleDownloadPDF = async () => {
    if (!selectedBatch || !selectedWeek) {
      alert("Please select a batch and week first");
      return;
    }

    setDownloading(true);
    try {
      const fileTimestamp = generateFileTimestamp();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get(
        `${API_BASE}/api/weekly-date-report/${selectedBatch}/pdf`,
        {
          headers,
          params: { week_no: selectedWeek },
          responseType: "blob",
        }
      );

      // create blob and download with correct timestamp filename
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `Weekly_Report_${selectedBatch}_Week${selectedWeek}_${fileTimestamp}.pdf`
      );
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error downloading PDF:", err);
      alert("Error downloading PDF");
    } finally {
      setDownloading(false);
    }
  };

  const welcomeName = user?.name || "User";

  return (
    <Box sx={{ maxWidth: 1600, mx: "auto", my: 2 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <Box>
          <Typography variant="h5" color="primary" gutterBottom>
            Weekly Reports - CMS
          </Typography>
          <Typography variant="subtitle2" color="text.secondary">
            Hello {welcomeName}, view date change statistics week‑wise for each batch.
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="primary"
          startIcon={<FileDownloadIcon />}
          onClick={handleDownloadPDF}
          disabled={!selectedBatch || !selectedWeek || downloading || loading}
          sx={{ mt: 1 }}
        >
          {downloading ? "Downloading..." : "Download PDF"}
        </Button>
      </Box>

      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} md={4}>
          <FormControl fullWidth size="small">
            <InputLabel>Batch</InputLabel>
            <Select
              label="Batch"
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
            >
              <MenuItem value="">
                <em>Select Batch</em>
              </MenuItem>
              {batches.map((b) => (
                <MenuItem key={b.batch_no} value={b.batch_no}>
                  {b.batch_no} {b.start_date ? `(${b.start_date})` : ""}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <FormControl fullWidth size="small" disabled={!weeks.length}>
            <InputLabel>Week No</InputLabel>
            <Select
              label="Week No"
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
            >
              {weeks.length === 0 && (
                <MenuItem value="">
                  <em>No weeks</em>
                </MenuItem>
              )}
              {weeks.map((w) => (
                <MenuItem key={w} value={w}>
                  Week {w}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading && (
        <Box display="flex" justifyContent="center" my={4}>
          <CircularProgress />
        </Box>
      )}

      {!loading && selectedBatch && selectedWeek && (
        <Paper elevation={2} sx={{ p: 0, overflow: 'hidden' }}>
          {/* Full-width header - STRETCHED */}
          <Box sx={{ 
            bgcolor: "primary.main", 
            color: "white", 
            p: 2.5,
            width: '100%',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              📋 Week {selectedWeek} – Date Change Details (Batch: {selectedBatch})
            </Typography>
          </Box>

          <Box sx={{ p: 2 }}>
            <TableContainer sx={{ maxHeight: 600, width: '100%' }}>
              <Table size="small" sx={{ 
                tableLayout: 'fixed', 
                width: '100%',
                fontSize: '0.8rem'
              }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: "#f5f5f5 !important" }}>
                    <TableCell sx={{ 
                      width: '8%', 
                      fontWeight: 'bold !important',
                      fontSize: '0.85rem',
                      p: 0.5,
                      border: '1px solid #ddd'
                    }}>Module</TableCell>
                    <TableCell sx={{ 
                      width: '14%', 
                      fontWeight: 'bold !important',
                      fontSize: '0.85rem',
                      p: 0.5,
                      border: '1px solid #ddd'
                    }}>Topic</TableCell>
                    <TableCell sx={{ 
                      width: '11%', 
                      fontWeight: 'bold !important',
                      fontSize: '0.85rem',
                      p: 0.5,
                      textAlign: 'center',
                      border: '1px solid #ddd'
                    }}>Planned</TableCell>
                    <TableCell sx={{ 
                      width: '11%', 
                      fontWeight: 'bold !important',
                      fontSize: '0.85rem',
                      p: 0.5,
                      textAlign: 'center',
                      border: '1px solid #ddd'
                    }}>Actual</TableCell>
                    <TableCell sx={{ 
                      width: '10%', 
                      fontWeight: 'bold !important',
                      fontSize: '0.85rem',
                      p: 0.5,
                      textAlign: 'center',
                      border: '1px solid #ddd'
                    }}>Diff</TableCell>
                    <TableCell sx={{ 
                      width: '10%', 
                      fontWeight: 'bold !important',
                      fontSize: '0.85rem',
                      p: 0.5,
                      textAlign: 'center',
                      border: '1px solid #ddd'
                    }}>Status</TableCell>
                    <TableCell sx={{ 
                      width: '12%', 
                      fontWeight: 'bold !important',
                      fontSize: '0.85rem',
                      p: 0.5,
                      textAlign: 'center',
                      border: '1px solid #ddd'
                    }}>By</TableCell>
                    <TableCell sx={{ 
                      width: '14%', 
                      fontWeight: 'bold !important',
                      fontSize: '0.85rem',
                      p: 0.5,
                      textAlign: 'center',
                      border: '1px solid #ddd'
                    }}>Date</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 3 }}>
                        <Typography variant="body2" color="text.secondary">
                          No date changes recorded for this batch and week.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}

                  {rows.map((row, index) => (
                    <TableRow key={row.id || index} hover>
                      <TableCell sx={{ 
                        fontSize: '0.8rem',
                        p: 0.5,
                        border: '1px solid #eee',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {row.module_name || "N/A"}
                      </TableCell>
                      <TableCell sx={{ 
                        fontSize: '0.8rem',
                        p: 0.5,
                        border: '1px solid #eee',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {row.topic_name}
                      </TableCell>
                      <TableCell sx={{ 
                        fontSize: '0.8rem',
                        p: 0.5,
                        textAlign: 'center',
                        border: '1px solid #eee'
                      }}>
                        {new Date(row.planned_date).toLocaleDateString("en-IN")}
                      </TableCell>
                      <TableCell sx={{ 
                        fontSize: '0.8rem',
                        p: 0.5,
                        textAlign: 'center',
                        border: '1px solid #eee'
                      }}>
                        {new Date(row.actual_date).toLocaleDateString("en-IN")}
                      </TableCell>
                      <TableCell sx={{ 
                        p: 0.25,
                        textAlign: 'center',
                        border: '1px solid #eee'
                      }}>
                        <Chip
                          label={
                            row.date_difference > 0
                              ? `+${row.date_difference}`
                              : row.date_difference < 0
                              ? `${row.date_difference}`
                              : "0"
                          }
                          size="small"
                          color={
                            row.date_difference > 2
                              ? "error"
                              : row.date_difference > 0
                              ? "warning"
                              : row.date_difference < 0
                              ? "success"
                              : "default"
                          }
                          sx={{ 
                            fontSize: '0.7rem',
                            height: 22,
                            fontWeight: "bold"
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ 
                        p: 0.25,
                        textAlign: 'center',
                        border: '1px solid #eee'
                      }}>
                        <Chip
                          label={
                            row.topic_status === "Completed"
                              ? "Done"
                              : row.topic_status === "In Progress"
                              ? "Prog"
                              : "N/A"
                          }
                          size="small"
                          variant="outlined"
                          color={
                            row.topic_status === "Completed"
                              ? "success"
                              : row.topic_status === "In Progress"
                              ? "primary"
                              : "default"
                          }
                          sx={{ 
                            fontSize: '0.7rem',
                            height: 22 
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ 
                        fontSize: '0.8rem',
                        p: 0.5,
                        textAlign: 'center',
                        border: '1px solid #eee',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {row.changed_by ? row.changed_by.split('@')[0] : "N/A"}
                      </TableCell>
                      <TableCell sx={{ 
                        fontSize: '0.75rem',
                        p: 0.5,
                        textAlign: 'center',
                        border: '1px solid #eee',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {row.changed_at ? new Date(row.changed_at).toLocaleString("en-IN", {
                          dateStyle: "short",
                          timeStyle: "short",
                        }).split(',')[0] : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </Paper>
      )}

      {!loading && (!selectedBatch || !selectedWeek) && (
        <Box mt={3}>
          <Typography variant="body2" color="text.secondary">
            Please select a batch and week to view weekly date‑change details.
          </Typography>
        </Box>
      )}
    </Box>
  );
}
