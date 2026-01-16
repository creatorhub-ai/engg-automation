// AttendanceReport.js
import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import {
  Box,
  Paper,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  CircularProgress,
  Alert,
  Grid,
  Card,
  CardContent,
  Chip,
} from "@mui/material";
import jsPDF from "jspdf";
import "jspdf-autotable";

const API_BASE = process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

export default function AttendanceReport({ user, token }) {
  const [batches, setBatches] = useState([]);
  const [batchNo, setBatchNo] = useState("");
  const [rawAttendance, setRawAttendance] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const authHeaders = () => (token ? { Authorization: `Bearer ${token}` } : {});

  // Load distinct batch numbers from multiple possible endpoints
  useEffect(() => {
    async function loadBatches() {
      try {
        const endpoints = [
          `${API_BASE}/api/batches`,
          `${API_BASE}/api/batch-list`,
          `${API_BASE}/api/batches/list`,
        ];

        let batchData = [];
        for (const endpoint of endpoints) {
          try {
            const res = await axios.get(endpoint, { headers: authHeaders(), timeout: 5000 });
            if (res.data && Array.isArray(res.data)) {
              batchData = res.data;
              break;
            }
          } catch (e) {
            console.warn(`Failed ${endpoint}:`, e.message);
            continue;
          }
        }

        let normalized = [];
        if (Array.isArray(batchData)) {
          normalized = batchData
            .map((item) => {
              if (!item) return null;
              if (typeof item === "string") return item.trim();
              if (typeof item === "object") {
                const v = item.batch_no || item.batchNo || item.batch || item.name || "";
                return String(v).trim();
              }
              return null;
            })
            .filter((v) => v && v.length > 0);
        }

        normalized = Array.from(new Set(normalized)).sort();
        setBatches(normalized);

        if (normalized.length && !batchNo) {
          setBatchNo(normalized[0]);
        }
      } catch (e) {
        console.error("Failed to load batches", e);
        setMsg("No batches available. Please check backend configuration.");
        setBatches([]);
      }
    }
    loadBatches();
  }, [token]);

  // Load attendance data with fallback and better error handling
  useEffect(() => {
    if (!batchNo) {
      setRawAttendance([]);
      setMsg("");
      return;
    }

    async function loadAttendance() {
      setLoading(true);
      setMsg("");
      
      try {
        console.log(`Loading attendance for batch: ${batchNo}`);
        
        const endpoints = [
          { url: `${API_BASE}/api/attendance/by_batch`, params: { batch_no: batchNo } },
          { url: `${API_BASE}/api/attendance/batch/${batchNo}`, params: {} },
          { url: `${API_BASE}/api/attendance?batch_no=${batchNo}`, params: {} },
          { url: `${API_BASE}/api/learners/${batchNo}/attendance`, params: {} },
        ];

        let attendanceData = [];
        for (const endpoint of endpoints) {
          try {
            console.log(`Trying endpoint: ${endpoint.url}`);
            const res = await axios.get(endpoint.url, {
              params: endpoint.params,
              headers: authHeaders(),
              timeout: 10000,
            });
            
            if (res.data && (Array.isArray(res.data) || Array.isArray(res.data.data))) {
              attendanceData = Array.isArray(res.data) ? res.data : res.data.data || [];
              console.log(`✅ Success with ${endpoint.url}:`, attendanceData.length, "records");
              break;
            }
          } catch (endpointError) {
            console.warn(`❌ Failed ${endpoint.url}:`, endpointError.response?.status, endpointError.message);
            continue;
          }
        }

        if (attendanceData.length === 0) {
          setMsg(`No attendance records found for batch "${batchNo}". This might be normal if no sessions have been marked.`);
        }

        setRawAttendance(attendanceData);
      } catch (e) {
        console.error("All attendance endpoints failed:", e);
        setMsg(
          `Unable to load attendance data for "${batchNo}". ` +
          `Backend error. Please check server logs or contact admin.`
        );
        setRawAttendance([]);
      } finally {
        setLoading(false);
      }
    }

    loadAttendance();
  }, [batchNo, token]);

  // Aggregate attendance data per learner
  const aggregatedRows = useMemo(() => {
    if (!rawAttendance.length) return [];

    const map = new Map();

    rawAttendance.forEach((row) => {
      const email = (row.learner_email || row.email || row.learner_email_id || "").trim();
      if (!email) return;

      const name = (row.learner_name || row.name || row.learner_name || row.full_name || "").trim();
      const key = email.toLowerCase();

      if (!map.has(key)) {
        map.set(key, {
          name: name || `Learner (${email})`,
          email,
          total_days: 0,
          present_days: 0,
          leave_days: 0,
          absent_days: 0,
        });
      }

      const agg = map.get(key);
      agg.total_days += 1;

      const status = (row.status || "").toString().toLowerCase().trim();
      if (["present", "p", "yes"].includes(status)) agg.present_days += 1;
      else if (["leave", "onleave", "on_leave", "l", "lv"].includes(status)) agg.leave_days += 1;
      else if (["absent", "a", "no"].includes(status)) agg.absent_days += 1;
    });

    const result = Array.from(map.values()).map((r) => {
      const pct = r.total_days > 0 ? Math.round((r.present_days / r.total_days) * 100 * 100) / 100 : 0;
      return { ...r, attendance_percentage: pct };
    });

    return result.sort((a, b) => (b.attendance_percentage || 0) - (a.attendance_percentage || 0));
  }, [rawAttendance]);

  // Batch-level statistics
  const batchStats = useMemo(() => {
    if (!aggregatedRows.length) {
      return {
        batchPercentage: 0,
        totalLearners: 0,
        totalSessions: 0,
        presentSessions: 0,
      };
    }

    const totalLearners = aggregatedRows.length;
    const totalSessions = rawAttendance.length;
    const totalPresentSessions = rawAttendance.filter(r => 
      ["present", "p", "yes"].includes((r.status || "").toLowerCase())
    ).length;
    const avgPct = aggregatedRows.reduce((sum, r) => sum + (r.attendance_percentage || 0), 0) / totalLearners;

    return {
      batchPercentage: Math.round(avgPct * 100) / 100,
      totalLearners,
      totalSessions,
      presentSessions: totalPresentSessions,
    };
  }, [aggregatedRows, rawAttendance]);

  // Radial Progress Component (Pure CSS/SVG)
  const RadialProgress = ({ percentage, size = 120 }) => (
    <div 
      style={{
        width: size,
        height: size,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <svg width={size} height={size} viewBox="0 0 36 36">
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
          strokeDasharray={`${percentage * 0.3525 * 100}, 100`}
          strokeLinecap="round"
          transform="rotate(-90 18 18)"
        />
      </svg>
      <div style={{
        position: 'absolute',
        fontSize: '18px',
        fontWeight: 'bold',
        color: percentage >= 80 ? '#4CAF50' : percentage >= 60 ? '#FF9800' : '#F44336'
      }}>
        {Math.round(percentage)}%
      </div>
    </div>
  );

  // Download PDF
  const handleDownloadPdf = () => {
    if (!aggregatedRows.length) return;

    const doc = new jsPDF("landscape");
    const title = `Attendance Report - Batch ${batchNo}`;
    
    doc.setFontSize(18);
    doc.text(title, 14, 20);
    
    doc.setFontSize(12);
    doc.text(`Overall Attendance: ${batchStats.batchPercentage.toFixed(1)}%`, 14, 35);
    doc.text(`Total Learners: ${batchStats.totalLearners} | Total Sessions: ${batchStats.totalSessions}`, 14, 45);

    const head = [["Sr", "Name", "Email", "Total", "Present", "Leave", "Absent", "%"]];
    const body = aggregatedRows.map((row, idx) => [
      idx + 1,
      row.name.substring(0, 25),
      row.email.substring(0, 30),
      row.total_days,
      row.present_days,
      row.leave_days,
      row.absent_days,
      row.attendance_percentage.toFixed(1),
    ]);

    doc.autoTable({
      head,
      body,
      startY: 55,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [25, 118, 210], fontSize: 8 },
      columnStyles: { 1: { cellWidth: 25 }, 2: { cellWidth: 35 } },
    });

    doc.save(`attendance_${batchNo}_${new Date().toISOString().slice(0,10)}.pdf`);
  };

  return (
    <Box sx={{ maxWidth: 1700, p: 2 }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
        <Typography variant="h5" color="primary" gutterBottom align="center">
          📊 Attendance Report Dashboard
        </Typography>

        {/* Controls */}
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 4, alignItems: "center" }}>
          <FormControl sx={{ minWidth: 220 }}>
            <InputLabel>Select Batch</InputLabel>
            <Select
              label="Select Batch"
              value={batchNo}
              onChange={(e) => setBatchNo(e.target.value)}
            >
              {batches.map((b) => (
                <MenuItem key={b} value={b}>
                  {b}
                </MenuItem>
              ))}
              {batches.length === 0 && (
                <MenuItem disabled>No batches available</MenuItem>
              )}
            </Select>
          </FormControl>

          <Box sx={{ flexGrow: 1 }} />

          <Button
            variant="contained"
            disabled={!aggregatedRows.length}
            onClick={handleDownloadPdf}
            startIcon="📥"
          >
            Download PDF
          </Button>
        </Box>

        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6, flexDirection: "column", alignItems: "center" }}>
            <CircularProgress size={40} />
            <Typography sx={{ mt: 2 }}>Loading attendance data...</Typography>
          </Box>
        )}

        {!loading && msg && !rawAttendance.length && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            {msg}
          </Alert>
        )}

        {/* Summary Cards + Chart */}
        {aggregatedRows.length > 0 && (
          <>
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} md={8}>
                <Card elevation={3} sx={{ height: "100%" }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
                      📈 Batch {batchNo} Attendance Overview
                    </Typography>
                    <Box sx={{ 
                      display: "flex", 
                      flexDirection: { xs: "column", md: "row" }, 
                      gap: 4, 
                      alignItems: "center",
                      justifyContent: "center"
                    }}>
                      <Box sx={{ textAlign: "center" }}>
                        <RadialProgress 
                          percentage={batchStats.batchPercentage} 
                          size={160}
                        />
                        <Typography variant="h4" sx={{ mt: 2, fontWeight: "bold" }}>
                          {batchStats.batchPercentage.toFixed(1)}%
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                          Overall Attendance
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={4}>
                <Card elevation={3}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>📊 Quick Stats</Typography>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <Typography>Overall %</Typography>
                        <Chip label={`${batchStats.batchPercentage.toFixed(1)}%`} color="primary" />
                      </Box>
                      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                        <Typography>Total Learners</Typography>
                        <Typography variant="h6">{batchStats.totalLearners}</Typography>
                      </Box>
                      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                        <Typography>Total Sessions</Typography>
                        <Typography variant="h6">{batchStats.totalSessions}</Typography>
                      </Box>
                      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                        <Typography>Present Sessions</Typography>
                        <Typography variant="h6" color="success.main">{batchStats.presentSessions}</Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Detailed Table */}
            <Paper elevation={2} sx={{ overflow: "hidden" }}>
              <Box sx={{ bgcolor: "primary.main", color: "white", p: 2 }}>
                <Typography variant="h6">📋 Detailed Attendance Report</Typography>
              </Box>
              <TableContainer sx={{ maxHeight: 600 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: "primary.main" }}>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>Sr</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>Learner</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>Email</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold", textAlign: "right" }}>Total</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold", textAlign: "right" }}>Present</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold", textAlign: "right" }}>Leave</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold", textAlign: "right" }}>Absent</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold", textAlign: "right" }}>%</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {aggregatedRows.map((row, idx) => (
                      <TableRow 
                        key={row.email || idx}
                        sx={{ 
                          bgcolor: row.attendance_percentage >= 80 ? "#E8F5E8" : 
                                 row.attendance_percentage >= 60 ? "#FFF3E0" : "#FFEBEE" 
                        }}
                      >
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell sx={{ fontWeight: 500 }}>{row.name}</TableCell>
                        <TableCell sx={{ maxWidth: 250, wordBreak: "break-all" }}>
                          {row.email}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: "bold" }}>
                          {row.total_days}
                        </TableCell>
                        <TableCell align="right" sx={{ color: "#4CAF50", fontWeight: "bold" }}>
                          {row.present_days}
                        </TableCell>
                        <TableCell align="right">{row.leave_days}</TableCell>
                        <TableCell align="right" sx={{ color: "#F44336" }}>
                          {row.absent_days}
                        </TableCell>
                        <TableCell align="right">
                          <Chip 
                            label={`${row.attendance_percentage.toFixed(1)}%`}
                            color={row.attendance_percentage >= 80 ? "success" : 
                                   row.attendance_percentage >= 60 ? "warning" : "error"}
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
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
