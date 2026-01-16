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

  // Load distinct batch numbers DIRECTLY from learner_attendance table
  useEffect(() => {
    async function loadBatches() {
      try {
        setLoading(true);
        console.log("Loading batches from learner_attendance table...");
        
        // Direct query to get DISTINCT batch_no from learner_attendance
        const res = await axios.get(`${API_BASE}/api/attendance/batches`, {
          headers: authHeaders(),
          timeout: 10000,
        });

        let batchData = res.data || [];
        if (!Array.isArray(batchData)) batchData = [];

        const normalized = Array.from(new Set(
          batchData.map(b => String(b.batch_no || b).trim()).filter(b => b)
        )).sort();

        setBatches(normalized);
        if (normalized.length && !batchNo) {
          setBatchNo(normalized[0]);
        }
        setLoading(false);
      } catch (e) {
        console.error("Failed to load batches:", e);
        // Fallback: try to get batches from any working endpoint
        try {
          const fallbackRes = await axios.get(`${API_BASE}/api/batches`, {
            headers: authHeaders(),
            timeout: 5000,
          });
          const fallbackBatches = Array.from(new Set(
            (fallbackRes.data || []).map(b => String(b.batch_no || b.batchNo || b).trim()).filter(b => b)
          )).sort();
          setBatches(fallbackBatches);
          if (fallbackBatches.length && !batchNo) {
            setBatchNo(fallbackBatches[0]);
          }
        } catch (e2) {
          console.error("All batch endpoints failed:", e2);
          setMsg("No batches found. Please ensure learner_attendance table has data.");
        }
        setLoading(false);
      }
    }
    loadBatches();
  }, [token]);

  // Load attendance data DIRECTLY matching your table structure
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
        
        // DIRECT QUERY for learner_attendance table with your exact columns
        const res = await axios.get(`${API_BASE}/api/learner_attendance`, {
          params: {
            batch_no: batchNo,
            select: "id,learner_email,batch_no,date,session,status,marked_by,marked_at"
          },
          headers: authHeaders(),
          timeout: 15000,
        });

        let attendanceData = Array.isArray(res.data) ? res.data : [];
        
        console.log(`✅ Loaded ${attendanceData.length} attendance records for ${batchNo}`);
        
        if (attendanceData.length === 0) {
          setMsg(`No attendance records found for batch "${batchNo}".`);
        }
        
        setRawAttendance(attendanceData);
      } catch (e) {
        console.error("Failed to load attendance:", e);
        
        // Try alternative endpoints with exact table structure
        const altEndpoints = [
          `${API_BASE}/api/attendance/by_batch?batch_no=${batchNo}`,
          `${API_BASE}/api/attendance?batch_no=${batchNo}`,
        ];
        
        for (const endpoint of altEndpoints) {
          try {
            const altRes = await axios.get(endpoint, { headers: authHeaders(), timeout: 5000 });
            if (Array.isArray(altRes.data)) {
              setRawAttendance(altRes.data);
              console.log(`✅ Fallback success: ${altRes.data.length} records`);
              return;
            }
          } catch (altErr) {
            console.warn(`Fallback failed: ${endpoint}`);
          }
        }
        
        setMsg(`No attendance data found for "${batchNo}". Please check learner_attendance table.`);
        setRawAttendance([]);
      } finally {
        setLoading(false);
      }
    }

    loadAttendance();
  }, [batchNo, token]);

  // Aggregate attendance per learner - MATCHES YOUR TABLE STRUCTURE
  const aggregatedRows = useMemo(() => {
    if (!rawAttendance.length) return [];

    const map = new Map(); // key: learner_email

    rawAttendance.forEach((row) => {
      const email = String(row.learner_email || "").trim();
      if (!email) return;

      const key = email.toLowerCase();

      if (!map.has(key)) {
        map.set(key, {
          name: email.split('@')[0].replace(/\./g, ' ').replace(/_/g, ' '), // Generate name from email
          email,
          total_days: 0,
          present_days: 0,
          leave_days: 0,
          absent_days: 0,
          sessions: new Set(), // Track unique sessions per day
        });
      }

      const agg = map.get(key);
      
      // Create unique session identifier: date + session
      const sessionKey = `${row.date || ''}-${row.session || ''}`;
      if (!agg.sessions.has(sessionKey)) {
        agg.sessions.add(sessionKey);
        agg.total_days += 1;

        // Map your exact status values: P, A, NA, L
        const status = String(row.status || "").toUpperCase().trim();
        if (status === "P") agg.present_days += 1;
        else if (status === "L") agg.leave_days += 1;
        else if (status === "A" || status === "NA") agg.absent_days += 1;
      }
    });

    const result = Array.from(map.values()).map((r) => {
      const pct = r.total_days > 0 ? Math.round((r.present_days / r.total_days) * 100 * 100) / 100 : 0;
      return { 
        ...r, 
        attendance_percentage: pct,
        total_days: r.total_days,
        present_days: r.present_days,
        leave_days: r.leave_days,
        absent_days: r.absent_days
      };
    });

    // Sort by percentage descending, then by name
    return result.sort((a, b) => {
      if ((b.attendance_percentage || 0) !== (a.attendance_percentage || 0)) {
        return (b.attendance_percentage || 0) - (a.attendance_percentage || 0);
      }
      return a.email.localeCompare(b.email);
    });
  }, [rawAttendance]);

  // Batch statistics
  const batchStats = useMemo(() => {
    if (!aggregatedRows.length) {
      return { batchPercentage: 0, totalLearners: 0, totalSessions: 0, presentSessions: 0 };
    }

    const totalLearners = aggregatedRows.length;
    const totalSessions = rawAttendance.length;
    const presentSessions = rawAttendance.filter(r => 
      String(r.status || "").toUpperCase() === "P"
    ).length;
    const avgPct = aggregatedRows.reduce((sum, r) => sum + (r.attendance_percentage || 0), 0) / totalLearners;

    return {
      batchPercentage: Math.round(avgPct * 100) / 100,
      totalLearners,
      totalSessions,
      presentSessions,
    };
  }, [aggregatedRows, rawAttendance]);

  // Radial Progress Component
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
          strokeDasharray={`${Math.min(percentage, 100) * 0.3525 * 100}, 100`}
          strokeLinecap="round"
          transform="rotate(-90 18 18)"
        />
      </svg>
      <div style={{
        position: 'absolute',
        fontSize: '18px',
        fontWeight: 'bold',
        color: percentage >= 80 ? '#4CAF50' : percentage >= 60 ? '#FF9800' : '#F44336',
        textAlign: 'center'
      }}>
        {Math.round(percentage)}%
      </div>
    </div>
  );

  // Download PDF
  const handleDownloadPdf = () => {
    if (!aggregatedRows.length) return;

    const doc = new jsPDF("landscape");
    doc.setFontSize(18);
    doc.text(`Attendance Report - Batch ${batchNo}`, 14, 20);
    doc.setFontSize(12);
    doc.text(`Overall: ${batchStats.batchPercentage.toFixed(1)}% | Learners: ${batchStats.totalLearners} | Sessions: ${batchStats.totalSessions}`, 14, 35);

    const head = [["#", "Learner", "Email", "Total", "Present", "Leave", "Absent", "%"]];
    const body = aggregatedRows.map((row, idx) => [
      idx + 1,
      row.name.substring(0, 20),
      row.email.substring(0, 25),
      row.total_days || 0,
      row.present_days || 0,
      row.leave_days || 0,
      row.absent_days || 0,
      row.attendance_percentage.toFixed(1),
    ]);

    doc.autoTable({
      head, body,
      startY: 45,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [25, 118, 210] },
      columnStyles: { 1: { cellWidth: 20 }, 2: { cellWidth: 30 } }
    });

    doc.save(`attendance_${batchNo}_${new Date().toISOString().slice(0,10)}.pdf`);
  };

  return (
    <Box sx={{ maxWidth: 1700, p: 2 }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
        <Typography variant="h5" color="primary" gutterBottom align="center">
          📊 Attendance Report Dashboard
        </Typography>

        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 4, alignItems: "center" }}>
          <FormControl sx={{ minWidth: 220 }}>
            <InputLabel>Select Batch</InputLabel>
            <Select value={batchNo} onChange={(e) => setBatchNo(e.target.value)} label="Select Batch">
              {batches.map((b) => (
                <MenuItem key={b} value={b}>{b}</MenuItem>
              ))}
              {batches.length === 0 && <MenuItem disabled>No batches</MenuItem>}
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
          <Alert severity="info" sx={{ mb: 3 }}>
            {msg}
          </Alert>
        )}

        {aggregatedRows.length > 0 && (
          <>
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} md={8}>
                <Card elevation={3}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
                      📈 Batch {batchNo} Overview ({batchStats.totalLearners} learners)
                    </Typography>
                    <Box sx={{ display: "flex", gap: 4, alignItems: "center", justifyContent: "center", flexDirection: { xs: "column", md: "row" } }}>
                      <Box sx={{ textAlign: "center" }}>
                        <RadialProgress percentage={batchStats.batchPercentage} size={160} />
                        <Typography variant="h4" sx={{ mt: 2, fontWeight: "bold" }}>
                          {batchStats.batchPercentage.toFixed(1)}%
                        </Typography>
                        <Typography variant="body1" color="text.secondary">Overall Attendance</Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={4}>
                <Card elevation={3}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>📊 Stats</Typography>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Overall %</span>
                        <Chip label={`${batchStats.batchPercentage.toFixed(1)}%`} color="primary" />
                      </Box>
                      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Total Learners</span>
                        <Typography variant="h6">{batchStats.totalLearners}</Typography>
                      </Box>
                      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Total Sessions</span>
                        <Typography variant="h6">{batchStats.totalSessions}</Typography>
                      </Box>
                      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Present Sessions</span>
                        <Typography variant="h6" color="success.main">{batchStats.presentSessions}</Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Paper elevation={2} sx={{ overflow: "hidden" }}>
              <Box sx={{ bgcolor: "primary.main", color: "white", p: 2 }}>
                <Typography variant="h6">📋 Detailed Report ({aggregatedRows.length} learners)</Typography>
              </Box>
              <TableContainer sx={{ maxHeight: 600 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: "primary.main" }}>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>#</TableCell>
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
                        key={row.email}
                        sx={{ 
                          bgcolor: row.attendance_percentage >= 80 ? "#E8F5E8" : 
                                 row.attendance_percentage >= 60 ? "#FFF3E0" : "#FFEBEE" 
                        }}
                      >
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell sx={{ fontWeight: 500 }}>{row.name}</TableCell>
                        <TableCell sx={{ maxWidth: 250, wordBreak: "break-all" }}>{row.email}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: "bold" }}>{row.total_days}</TableCell>
                        <TableCell align="right" sx={{ color: "#4CAF50", fontWeight: "bold" }}>{row.present_days}</TableCell>
                        <TableCell align="right">{row.leave_days}</TableCell>
                        <TableCell align="right" sx={{ color: "#F44336" }}>{row.absent_days}</TableCell>
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
