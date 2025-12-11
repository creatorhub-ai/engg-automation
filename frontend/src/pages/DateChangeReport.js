// DateChangeReport.js
import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  Box,
  Paper,
  Typography,
  MenuItem,
  FormControl,
  Select,
  InputLabel,
  Table,
  TableHead,
  TableBody,
  TableCell,
  TableRow,
  TableContainer,
  Chip,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Button,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const API_BASE =
  process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

export default function DateChangeReport({ user, token }) {
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState("");
  const [reportData, setReportData] = useState([]);
  const [batchSummary, setBatchSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadBatches() {
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await axios.get(`${API_BASE}/api/batches`, { headers });
        if (res.data && Array.isArray(res.data)) {
          setBatches(res.data);
        } else {
          setBatches([]);
        }
      } catch (err) {
        console.error("Error loading batches:", err);
        setError("Error loading batches");
      }
    }
    loadBatches();
  }, [token]);

  useEffect(() => {
    if (selectedBatch) {
      loadReport();
    } else {
      setReportData([]);
      setBatchSummary(null);
    }

    async function loadReport() {
      if (!selectedBatch) {
        setError("Please select a batch first.");
        return;
      }

      setLoading(true);
      setError("");
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const reportRes = await axios.get(
          `${API_BASE}/api/date-change-report/${selectedBatch}`,
          { headers }
        );

        const summaryRes = await axios.get(
          `${API_BASE}/api/batch-date-summary/${selectedBatch}`,
          { headers }
        );

        setReportData(reportRes.data || []);
        setBatchSummary(summaryRes.data || null);
      } catch (err) {
        console.error("Error loading report:", err);
        setError("Error loading report data");
      } finally {
        setLoading(false);
      }
    }
  }, [selectedBatch, token]);

  const downloadPDF = () => {
    const doc = new jsPDF("l", "mm", "a4");
    const timestamp = new Date().toLocaleString("en-IN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    doc.setFontSize(18);
    doc.setTextColor(40);
    doc.text("Date Change Report", 14, 20);

    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Batch: ${selectedBatch}`, 14, 28);
    doc.text(`Generated: ${timestamp}`, 14, 34);

    if (batchSummary) {
      doc.setFontSize(12);
      doc.setTextColor(40);
      doc.text("Summary Statistics", 14, 44);
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(
        `Delayed Topics: ${batchSummary.delayed_count || 0}`,
        14,
        50
      );
      doc.text(
        `Early Completion: ${batchSummary.early_count || 0}`,
        70,
        50
      );
      doc.text(
        `On Time: ${batchSummary.ontime_count || 0}`,
        126,
        50
      );
      doc.text(
        `Avg Difference: ${
          batchSummary.avg_difference
            ? parseFloat(batchSummary.avg_difference).toFixed(1)
            : "0"
        } days`,
        182,
        50
      );
    }

    const tableData = reportData.map((row) => [
      row.module_name || "N/A",
      row.topic_name || "N/A",
      row.trainer_name || "N/A",
      new Date(row.planned_date).toLocaleDateString("en-IN"),
      new Date(row.actual_date).toLocaleDateString("en-IN"),
      row.date_difference > 0
        ? `+${row.date_difference}d`
        : row.date_difference < 0
        ? `${row.date_difference}d`
        : "On time",
      row.topic_status || "N/A",
      row.changed_by || "N/A",
      new Date(row.changed_at).toLocaleString("en-IN", {
        dateStyle: "short",
        timeStyle: "short",
      }),
      row.remarks || "-",
    ]);

    autoTable(doc, {
      startY: 56,
      head: [
        [
          "Module",
          "Topic Name",
          "Trainer",
          "Planned Date",
          "Actual Date",
          "Diff",
          "Status",
          "Changed By",
          "Changed At",
          "Remarks",
        ],
      ],
      body: tableData,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [102, 126, 234], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { top: 56 },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 35 },
        2: { cellWidth: 25 },
        3: { cellWidth: 22 },
        4: { cellWidth: 22 },
        5: { cellWidth: 15 },
        6: { cellWidth: 20 },
        7: { cellWidth: 25 },
        8: { cellWidth: 28 },
        9: { cellWidth: 30 },
      },
    });

    const filename = `DateChangeReport_${selectedBatch}_${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/:/g, "-")}.pdf`;
    doc.save(filename);
  };

  const roleTitle = user?.role
    ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
    : "Admin";
  const welcomeName = user?.name ? user.name : "User";

  return (
    <Box sx={{ maxWidth: 1600, mx: "auto", my: 3, px: 2 }}>
      <Paper elevation={4} sx={{ p: 3, borderRadius: 3, mb: 3 }}>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={2}
        >
          <Box>
            <Typography variant="h4" color="primary" gutterBottom>
              Date Change Report
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              Track and analyze training schedule changes across batches
            </Typography>
          </Box>

          {selectedBatch && reportData.length > 0 && (
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={downloadPDF}
              sx={{
                background:
                  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                "&:hover": {
                  background:
                    "linear-gradient(135deg, #764ba2 0%, #667eea 100%)",
                },
              }}
            >
              Download PDF
            </Button>
          )}
        </Box>

        <FormControl fullWidth sx={{ mb: 4, maxWidth: 400 }}>
          <InputLabel>Select Batch</InputLabel>
          <Select
            value={selectedBatch}
            label="Select Batch"
            onChange={(e) => setSelectedBatch(e.target.value)}
            displayEmpty
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

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {loading && (
          <Box display="flex" justifyContent="center" my={4}>
            <CircularProgress />
          </Box>
        )}

        {!loading && selectedBatch && batchSummary && (
          <>
            <Typography
              variant="h6"
              color="primary"
              gutterBottom
              sx={{ mt: 2 }}
            >
              Summary Statistics
            </Typography>
            <Grid container spacing={3} mb={4}>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ bgcolor: "#ffebee", height: "100%" }}>
                  <CardContent>
                    <Typography
                      color="text.secondary"
                      gutterBottom
                      variant="body2"
                    >
                      Delayed Topics
                    </Typography>
                    <Typography variant="h3" color="error.main">
                      {batchSummary.delayed_count || 0}
                    </Typography>
                    {batchSummary.max_delay > 0 && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                      >
                        Max delay: {batchSummary.max_delay} days
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ bgcolor: "#e8f5e9", height: "100%" }}>
                  <CardContent>
                    <Typography
                      color="text.secondary"
                      gutterBottom
                      variant="body2"
                    >
                      Early Completion
                    </Typography>
                    <Typography variant="h3" color="success.main">
                      {batchSummary.early_count || 0}
                    </Typography>
                    {batchSummary.max_early < 0 && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                      >
                        Max early: {Math.abs(batchSummary.max_early)} days
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ bgcolor: "#e3f2fd", height: "100%" }}>
                  <CardContent>
                    <Typography
                      color="text.secondary"
                      gutterBottom
                      variant="body2"
                    >
                      On Time
                    </Typography>
                    <Typography variant="h3" color="primary.main">
                      {batchSummary.ontime_count || 0}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                    >
                      Completed as planned
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ bgcolor: "#f3e5f5", height: "100%" }}>
                  <CardContent>
                    <Typography
                      color="text.secondary"
                      gutterBottom
                      variant="body2"
                    >
                      Average Difference
                    </Typography>
                    <Typography variant="h3" color="text.primary">
                      {batchSummary.avg_difference
                        ? `${parseFloat(
                            batchSummary.avg_difference
                          ).toFixed(1)}`
                        : "0"}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                    >
                      days (+ delayed / - early)
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Typography
              variant="h6"
              color="primary"
              gutterBottom
              sx={{ mt: 4 }}
            >
              Detailed Change Log
            </Typography>
            <TableContainer component={Paper} elevation={2}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: "#f5f5f5" }}>
                    <TableCell>
                      <strong>Module Name</strong>
                    </TableCell>
                    <TableCell>
                      <strong>Topic Name</strong>
                    </TableCell>
                    <TableCell align="center">
                      <strong>Trainer</strong>
                    </TableCell>
                    <TableCell align="center">
                      <strong>Planned Date</strong>
                    </TableCell>
                    <TableCell align="center">
                      <strong>Actual Date</strong>
                    </TableCell>
                    <TableCell align="center">
                      <strong>Difference</strong>
                    </TableCell>
                    <TableCell align="center">
                      <strong>Status</strong>
                    </TableCell>
                    <TableCell align="center">
                      <strong>Changed By</strong>
                    </TableCell>
                    <TableCell align="center">
                      <strong>Changed At</strong>
                    </TableCell>
                    <TableCell align="center">
                      <strong>Remarks</strong>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reportData.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                        <Typography
                          variant="body1"
                          color="text.secondary"
                        >
                          No date changes recorded for this batch yet.
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                        >
                          Date changes will appear here once trainers update
                          actual dates.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}

                  {reportData.map((row, idx) => (
                    <TableRow
                      key={idx}
                      sx={{
                        "&:nth-of-type(2n)": { bgcolor: "#fafafa" },
                      }}
                    >
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {row.module_name || "N/A"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {row.topic_name}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2">
                          {row.trainer_name || "N/A"}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        {new Date(
                          row.planned_date
                        ).toLocaleDateString("en-IN")}
                      </TableCell>
                      <TableCell align="center">
                        {new Date(
                          row.actual_date
                        ).toLocaleDateString("en-IN")}
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={
                            row.date_difference > 0
                              ? `+${row.date_difference} days`
                              : row.date_difference < 0
                              ? `${row.date_difference} days`
                              : "On time"
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
                          sx={{ fontWeight: "bold", minWidth: 90 }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={row.topic_status || "N/A"}
                          size="small"
                          variant="outlined"
                          color={
                            row.topic_status === "Completed"
                              ? "success"
                              : row.topic_status === "In Progress"
                              ? "primary"
                              : "default"
                          }
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2">
                          {row.changed_by || "N/A"}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2" color="text.secondary">
                          {new Date(row.changed_at).toLocaleString("en-IN", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography
                          variant="body2"
                          sx={{
                            maxWidth: 200,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={row.remarks || "-"}
                        >
                          {row.remarks || "-"}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}

        {!loading && selectedBatch && !batchSummary && reportData.length === 0 && (
          <Box textAlign="center" py={4}>
            <Typography variant="h6" color="text.secondary">
              No data available for this batch
            </Typography>
            <Typography variant="body2" color="text.secondary" mt={1}>
              Select a different batch or wait for trainers to update dates
            </Typography>
          </Box>
        )}

        {!selectedBatch && !loading && (
          <Box textAlign="center" py={6}>
            <Typography variant="h6" color="text.secondary">
              Please select a batch to view the report
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
