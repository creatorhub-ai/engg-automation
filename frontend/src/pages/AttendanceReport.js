// AttendanceReport.js
import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import {
  Box, Paper, Typography, FormControl, InputLabel, Select, MenuItem,
  Button, Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  CircularProgress, Alert, Grid, Card, CardContent, Chip
} from "@mui/material";
import jsPDF from "jspdf";
import "jspdf-autotable";

const API_BASE = process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

export default function AttendanceReport({ user, token }) {
  const [batches, setBatches] = useState([]);
  const [batchNo, setBatchNo] = useState("");
  const [attendanceRows, setAttendanceRows] = useState([]);     // raw rows from backend
  const [totalSessions, setTotalSessions] = useState(0);        // total sessions for this batch
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const headers = { Authorization: `Bearer ${token}` };

  // Load batches
  useEffect(() => {
    const fetchBatches = async () => {
      try {
        const { data } = await axios.get(`${API_BASE}/api/batches`, { headers });
        const batchList = Array.isArray(data)
          ? data.map(b => String(b.batch_no || b.batchNo || b)).filter(Boolean)
          : [];
        const uniqueBatches = [...new Set(batchList)].sort();
        setBatches(uniqueBatches);
        if (uniqueBatches.length > 0) setBatchNo(uniqueBatches[0]);
      } catch (err) {
        console.error("Failed to load batches:", err);
      }
    };
    fetchBatches();
  }, [token]);

  // Load attendance for selected batch
  useEffect(() => {
    if (!batchNo) return;

    const fetchAttendance = async () => {
      setLoading(true);
      setError("");
      try {
        const { data } = await axios.get(`${API_BASE}/api/attendance-report`, {
          params: { batch_no: batchNo },
          headers
        });

        // Expecting shape: { total_sessions_for_batch, rows: [...] }
        let rows = [];
        let totalSess = 0;

        if (Array.isArray(data)) {
          // backward‑compat: old API returned array only
          rows = data;
        } else if (data && Array.isArray(data.rows)) {
          rows = data.rows;
          totalSess = Number(data.total_sessions_for_batch || 0);
        }

        setAttendanceRows(Array.isArray(rows) ? rows : []);
        setTotalSessions(totalSess);
      } catch (err) {
        setError("Failed to load attendance data");
        setAttendanceRows([]);
        setTotalSessions(0);
        console.error("Attendance fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAttendance();
  }, [batchNo, token, headers]);

  // Aggregate attendance data with session‑based percentage
  const summary = useMemo(() => {
    const learnerStats = {};

    attendanceRows.forEach(row => {
      const email = row.learner_email?.trim();
      if (!email) return;

      if (!learnerStats[email]) {
        learnerStats[email] = {
          name: email.split("@")[0].replace(/[._]/g, " "),
          email,
          // counts of actual sessions where this learner has any record
          totalMarked: 0,
          present: 0,
          leave: 0,
          absent: 0
        };
      }

      const stats = learnerStats[email];
      stats.totalMarked += 1;

      const status = String(row.status || "").toUpperCase();
      if (status === "P") stats.present += 1;
      else if (status === "L") stats.leave += 1;
      else if (status === "A" || status === "NA") stats.absent += 1;
    });

    const learners = Object.values(learnerStats);

    // If backend gave totalSessions (from course_planner_data), use that; otherwise
    // fall back to per‑learner totalMarked.
    const effectiveTotalSessions =
      totalSessions && totalSessions > 0 ? totalSessions : null;

    const avgAttendance =
      learners.length > 0
        ? learners.reduce((sum, l) => {
            const denom = effectiveTotalSessions || l.totalMarked || 1;
            const pct = (l.present / denom) * 100;
            return sum + pct;
          }, 0) / learners.length
        : 0;

    const roundedAvg = Math.round(avgAttendance * 10) / 10;

    const sortedLearners = learners.sort((a, b) => {
      const denomA = effectiveTotalSessions || a.totalMarked || 1;
      const denomB = effectiveTotalSessions || b.totalMarked || 1;
      return b.present / denomB - a.present / denomA;
    });

    return {
      learners: sortedLearners,
      totalLearners: learners.length,
      totalSessions: effectiveTotalSessions || 0,
      avgAttendance: roundedAvg
    };
  }, [attendanceRows, totalSessions]);

  const RadialProgress = ({ percentage }) => (
    <div style={{ width: 140, height: 140, position: "relative" }}>
      <svg viewBox="0 0 36 36" width="140" height="140">
        <path
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          stroke="#e5e5e5"
          strokeWidth="3"
        />
        <path
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          stroke="#4CAF50"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${percentage * 0.352}, 100`}
          transform="rotate(-90 18 18)"
        />
      </svg>
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          fontSize: "20px",
          fontWeight: "bold",
          color: percentage >= 75 ? "#4CAF50" : "#F44336"
        }}
      >
        {Math.round(percentage)}%
      </div>
    </div>
  );

  const formatTimestamp = () => {
    const now = new Date();
    return now.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });
  };

  const downloadPDF = () => {
    const doc = new jsPDF("landscape");

    const generatedAt = formatTimestamp();
    const title = `Attendance Report - ${batchNo}`;
    const overview = `Overall: ${summary.avgAttendance}% (${summary.totalLearners} learners)`;
    const sessionsInfo =
      summary.totalSessions > 0
        ? `Total Sessions (from planner): ${summary.totalSessions}`
        : "";

    doc.text(title, 14, 20);
    doc.text(overview, 14, 28);
    if (sessionsInfo) {
      doc.text(sessionsInfo, 14, 36);
      doc.text(`Generated at: ${generatedAt}`, 14, 44);
    } else {
      doc.text(`Generated at: ${generatedAt}`, 14, 36);
    }

    const tableData = summary.learners.map((learner, i) => {
      const denom =
        summary.totalSessions && summary.totalSessions > 0
          ? summary.totalSessions
          : learner.totalMarked || 1;
      const pct = (learner.present / denom) * 100;

      return [
        i + 1,
        learner.name.slice(0, 20),
        learner.email.slice(0, 25),
        denom, // total sessions basis
        learner.present,
        learner.leave,
        learner.absent,
        pct.toFixed(1)
      ];
    });

    doc.autoTable({
      head: [["#", "Name", "Email", "Total Sessions", "P", "L", "A", "%"]],
      body: tableData,
      startY: 52,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [41, 128, 185] }
    });

    doc.save(`attendance_${batchNo}.pdf`);
  };

  return (
    <Box sx={{ maxWidth: 1600, p: 3 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom align="center">
          📊 Attendance Report
        </Typography>

        <Box
          sx={{
            display: "flex",
            gap: 2,
            mb: 4,
            alignItems: "center",
            flexWrap: "wrap"
          }}
        >
          <FormControl sx={{ minWidth: 250 }}>
            <InputLabel>Batch</InputLabel>
            <Select
              value={batchNo}
              onChange={e => setBatchNo(e.target.value)}
              label="Batch"
            >
              {batches.map(batch => (
                <MenuItem key={batch} value={batch}>
                  {batch}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Box sx={{ flexGrow: 1 }} />
          <Button
            variant="contained"
            onClick={downloadPDF}
            disabled={summary.learners.length === 0}
            size="large"
          >
            Download PDF
          </Button>
        </Box>

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
            <CircularProgress size={40} />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : summary.learners.length === 0 ? (
          <Alert severity="info">No attendance data for {batchNo}</Alert>
        ) : (
          <>
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} lg={8}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 3 }}>
                      📈 {batchNo} - Overview
                    </Typography>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4
                      }}
                    >
                      <RadialProgress percentage={summary.avgAttendance} />
                      <Box>
                        <Typography
                          variant="h2"
                          sx={{ fontWeight: "bold" }}
                        >
                          {summary.avgAttendance}%
                        </Typography>
                        <Typography color="text.secondary">
                          Average Attendance
                        </Typography>
                        {summary.totalSessions > 0 && (
                          <Typography color="text.secondary">
                            Based on {summary.totalSessions} sessions
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} lg={4}>
                <Card>
                  <CardContent>
                    <Typography variant="h6">📊 Statistics</Typography>
                    <Box
                      sx={{
                        mt: 2,
                        display: "flex",
                        flexDirection: "column",
                        gap: 1
                      }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between"
                        }}
                      >
                        <span>Total Learners</span>
                        <strong>{summary.totalLearners}</strong>
                      </Box>
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between"
                        }}
                      >
                        <span>Total Sessions</span>
                        <strong>
                          {summary.totalSessions || "From attendance rows"}
                        </strong>
                      </Box>
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between"
                        }}
                      >
                        <span>Avg Attendance</span>
                        <Chip
                          label={`${summary.avgAttendance}%`}
                          color="primary"
                        />
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Paper sx={{ overflow: "hidden" }}>
              <Box sx={{ bgcolor: "primary.main", color: "white", p: 2 }}>
                <Typography variant="h6">📋 Detailed Report</Typography>
              </Box>
              <TableContainer sx={{ maxHeight: 600 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell
                        sx={{
                          bgcolor: "primary.dark",
                          color: "white",
                          fontWeight: "bold"
                        }}
                      >
                        #
                      </TableCell>
                      <TableCell
                        sx={{
                          bgcolor: "primary.dark",
                          color: "white",
                          fontWeight: "bold"
                        }}
                      >
                        Learner
                      </TableCell>
                      <TableCell
                        sx={{
                          bgcolor: "primary.dark",
                          color: "white",
                          fontWeight: "bold"
                        }}
                      >
                        Email
                      </TableCell>
                      <TableCell
                        sx={{
                          bgcolor: "primary.dark",
                          color: "white",
                          fontWeight: "bold",
                          textAlign: "right"
                        }}
                      >
                        Total Sessions
                      </TableCell>
                      <TableCell
                        sx={{
                          bgcolor: "primary.dark",
                          color: "white",
                          fontWeight: "bold",
                          textAlign: "right"
                        }}
                      >
                        P
                      </TableCell>
                      <TableCell
                        sx={{
                          bgcolor: "primary.dark",
                          color: "white",
                          fontWeight: "bold",
                          textAlign: "right"
                        }}
                      >
                        L
                      </TableCell>
                      <TableCell
                        sx={{
                          bgcolor: "primary.dark",
                          color: "white",
                          fontWeight: "bold",
                          textAlign: "right"
                        }}
                      >
                        A
                      </TableCell>
                      <TableCell
                        sx={{
                          bgcolor: "primary.dark",
                          color: "white",
                          fontWeight: "bold",
                          textAlign: "right"
                        }}
                      >
                        %
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {summary.learners.map((learner, index) => {
                      const denom =
                        summary.totalSessions && summary.totalSessions > 0
                          ? summary.totalSessions
                          : learner.totalMarked || 1;
                      const percentage =
                        denom > 0 ? (learner.present / denom) * 100 : 0;
                      const rowColor =
                        percentage >= 80
                          ? "#e8f5e8"
                          : percentage >= 60
                          ? "#fff3e0"
                          : "#ffebee";

                      return (
                        <TableRow
                          key={learner.email}
                          sx={{ bgcolor: rowColor }}
                        >
                          <TableCell>{index + 1}</TableCell>
                          <TableCell sx={{ fontWeight: 500 }}>
                            {learner.name}
                          </TableCell>
                          <TableCell
                            sx={{ maxWidth: 250, wordBreak: "break-all" }}
                          >
                            {learner.email}
                          </TableCell>
                          <TableCell align="right">
                            <strong>{denom}</strong>
                          </TableCell>
                          <TableCell
                            align="right"
                            sx={{ color: "#4caf50", fontWeight: "bold" }}
                          >
                            {learner.present}
                          </TableCell>
                          <TableCell align="right">
                            {learner.leave}
                          </TableCell>
                          <TableCell
                            align="right"
                            sx={{ color: "#f44336" }}
                          >
                            {learner.absent}
                          </TableCell>
                          <TableCell align="right">
                            <Chip
                              label={`${percentage.toFixed(1)}%`}
                              color={
                                percentage >= 80
                                  ? "success"
                                  : percentage >= 60
                                  ? "warning"
                                  : "error"
                              }
                              size="small"
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </>
        )}
      </Paper>
    </Box>
  );
}
