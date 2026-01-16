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
  const [debugData, setDebugData] = useState([]);

  const authHeaders = () => (token ? { Authorization: `Bearer ${token}` } : {});

  // Load batches using the ORIGINAL WORKING /api/batches endpoint
  useEffect(() => {
    async function loadBatches() {
      try {
        const res = await axios.get(`${API_BASE}/api/batches`, {
          headers: authHeaders(),
        });
        
        let normalized = [];
        const data = res.data || [];
        
        if (Array.isArray(data)) {
          normalized = data
            .map((item) => {
              if (!item) return null;
              if (typeof item === "string") return item.trim();
              if (typeof item === "object") {
                const v = item.batch_no || item.batchNo || item.batch || "";
                return String(v).trim();
              }
              return null;
            })
            .filter((v) => v);
        }

        normalized = Array.from(new Set(normalized)).sort();
        setBatches(normalized);

        if (normalized.length && !batchNo) {
          setBatchNo(normalized[0]);
        }
      } catch (e) {
        console.error("Failed to load batches", e);
        setMsg("Failed to load batches");
        setBatches([]);
      }
    }
    loadBatches();
  }, [token]);

  // Load attendance with MAXIMUM FALLBACKS + DEBUG MODE
  useEffect(() => {
    if (!batchNo) {
      setRawAttendance([]);
      setDebugData([]);
      return;
    }

    async function loadAttendance() {
      setLoading(true);
      setMsg("");
      setDebugData([]);
      
      try {
        console.log(`🔍 Loading attendance for batch: "${batchNo}"`);
        
        // TRY 1: Original endpoint that was in your first code
        try {
          console.log("🧪 TRY 1: Original /api/attendance/by_batch");
          const res1 = await axios.get(`${API_BASE}/api/attendance/by_batch`, {
            params: { batch_no: batchNo },
            headers: authHeaders(),
            timeout: 10000,
          });
          const data1 = Array.isArray(res1.data) ? res1.data : [];
          if (data1.length > 0) {
            console.log(`✅ SUCCESS: ${data1.length} records from TRY 1`);
            setRawAttendance(data1);
            return;
          }
        } catch (e1) {
          console.log("❌ TRY 1 failed:", e1.response?.status);
        }

        // TRY 2: Simple /api/attendance with query param
        try {
          console.log("🧪 TRY 2: /api/attendance?batch_no=");
          const res2 = await axios.get(`${API_BASE}/api/attendance`, {
            params: { batch_no: batchNo },
            headers: authHeaders(),
            timeout: 5000,
          });
          const data2 = Array.isArray(res2.data) ? res2.data : [];
          if (data2.length > 0) {
            console.log(`✅ SUCCESS: ${data2.length} records from TRY 2`);
            setRawAttendance(data2);
            return;
          }
        } catch (e2) {
          console.log("❌ TRY 2 failed:", e2.response?.status);
        }

        // TRY 3: DEBUG - Get ALL attendance to see structure
        console.log("🧪 TRY 3: DEBUG - Get ALL attendance (first 50 records)");
        try {
          const debugRes = await axios.get(`${API_BASE}/api/attendance`, {
            headers: authHeaders(),
            timeout: 5000,
          });
          
          const allData = Array.isArray(debugRes.data) ? debugRes.data.slice(0, 50) : [];
          const filteredData = allData.filter(row => 
            String(row.batch_no || row.batchNo || "").includes(batchNo)
          );
          
          setDebugData(allData.slice(0, 10)); // Show first 10 for debug
          
          if (filteredData.length > 0) {
            console.log(`✅ DEBUG SUCCESS: Found ${filteredData.length} matching records`);
            setRawAttendance(filteredData);
            return;
          }
          
          console.log("ℹ️ No matching batch_no found in debug data");
        } catch (e3) {
          console.log("❌ DEBUG failed:", e3.response?.status);
        }

        setMsg(`No attendance data found for "${batchNo}". Check debug table below.`);
        setRawAttendance([]);

      } catch (e) {
        console.error("All attempts failed:", e);
        setMsg(`Unable to load data for "${batchNo}". All endpoints failed.`);
        setRawAttendance([]);
      } finally {
        setLoading(false);
      }
    }

    loadAttendance();
  }, [batchNo, token]);

  // Aggregate attendance data
  const aggregatedRows = useMemo(() => {
    if (!rawAttendance.length) return [];

    const map = new Map();

    rawAttendance.forEach((row, index) => {
      // Try all possible email fields
      const email = (row.learner_email || row.email || row.learner_email_id || "").toString().trim();
      if (!email) {
        console.log(`⚠️ Row ${index} has no email:`, row);
        return;
      }

      const key = email.toLowerCase();
      const name = email.split('@')[0].replace(/\./g, ' ').replace(/_/g, ' ');

      if (!map.has(key)) {
        map.set(key, {
          name,
          email,
          total_days: 0,
          present_days: 0,
          leave_days: 0,
          absent_days: 0,
        });
      }

      const agg = map.get(key);
      agg.total_days += 1;

      // Handle all possible status formats
      const status = String(row.status || "").toUpperCase().trim();
      if (["P", "PRESENT"].includes(status)) agg.present_days += 1;
      else if (["L", "LEAVE"].includes(status)) agg.leave_days += 1;
      else if (["A", "ABSENT", "NA"].includes(status)) agg.absent_days += 1;
    });

    return Array.from(map.values())
      .map((r) => ({
        ...r,
        attendance_percentage: r.total_days > 0 ? Math.round((r.present_days / r.total_days) * 100 * 100) / 100 : 0,
      }))
      .sort((a, b) => b.attendance_percentage - a.attendance_percentage);
  }, [rawAttendance]);

  // Batch stats
  const batchStats = useMemo(() => {
    if (!aggregatedRows.length) return { batchPercentage: 0, totalLearners: 0, totalSessions: 0 };
    
    const totalLearners = aggregatedRows.length;
    const totalSessions = rawAttendance.length;
    const avgPct = aggregatedRows.reduce((sum, r) => sum + r.attendance_percentage, 0) / totalLearners;
    
    return {
      batchPercentage: Math.round(avgPct * 100) / 100,
      totalLearners,
      totalSessions,
    };
  }, [aggregatedRows, rawAttendance]);

  const RadialProgress = ({ percentage, size = 120 }) => (
    <div style={{
      width: size, height: size, position: 'relative', display: 'flex',
      alignItems: 'center', justifyContent: 'center'
    }}>
      <svg width={size} height={size} viewBox="0 0 36 36">
        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
              fill="none" stroke="#e5e5e5" strokeWidth="3"/>
        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
              fill="none" stroke="#4CAF50" strokeWidth="3"
              strokeDasharray={`${Math.min(percentage, 100) * 0.3525 * 100}, 100`}
              strokeLinecap="round" transform="rotate(-90 18 18)"/>
      </svg>
      <div style={{
        position: 'absolute', fontSize: '18px', fontWeight: 'bold',
        color: percentage >= 80 ? '#4CAF50' : percentage >= 60 ? '#FF9800' : '#F44336'
      }}>
        {Math.round(percentage)}%
      </div>
    </div>
  );

  const handleDownloadPdf = () => {
    if (!aggregatedRows.length) return;
    
    const doc = new jsPDF("landscape");
    doc.setFontSize(18);
    doc.text(`Attendance Report - ${batchNo}`, 14, 20);
    doc.text(`Overall: ${batchStats.batchPercentage.toFixed(1)}% (${batchStats.totalLearners} learners)`, 14, 35);

    const head = [["#", "Name", "Email", "Total", "Present", "Leave", "Absent", "%"]];
    const body = aggregatedRows.map((row, i) => [
      i + 1, row.name.slice(0, 20), row.email.slice(0, 25),
      row.total_days, row.present_days, row.leave_days, row.absent_days,
      row.attendance_percentage.toFixed(1)
    ]);

    doc.autoTable({ head, body, startY: 45, styles: { fontSize: 7 }, 
      headStyles: { fillColor: [25, 118, 210] } });
    doc.save(`attendance_${batchNo}.pdf`);
  };

  return (
    <Box sx={{ maxWidth: 1700, p: 2 }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
        <Typography variant="h5" color="primary" gutterBottom align="center">
          📊 Attendance Report
        </Typography>

        <Box sx={{ display: "flex", gap: 2, mb: 3, alignItems: "center", flexWrap: "wrap" }}>
          <FormControl sx={{ minWidth: 220 }}>
            <InputLabel>Batch</InputLabel>
            <Select value={batchNo} onChange={(e) => setBatchNo(e.target.value)} label="Batch">
              {batches.map(b => <MenuItem key={b} value={b}>{b}</MenuItem>)}
              {!batches.length && <MenuItem disabled>No batches</MenuItem>}
            </Select>
          </FormControl>
          <Box sx={{ flexGrow: 1 }} />
          <Button variant="contained" onClick={handleDownloadPdf} disabled={!aggregatedRows.length}>
            📥 PDF
          </Button>
        </Box>

        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6, alignItems: "center", gap: 2 }}>
            <CircularProgress size={30} />
            <Typography>Loading...</Typography>
          </Box>
        )}

        {!loading && msg && !rawAttendance.length && (
          <>
            <Alert severity="warning" sx={{ mb: 2 }}>
              {msg}
            </Alert>
            
            {/* DEBUG TABLE - Shows exactly what data structure we get */}
            {debugData.length > 0 && (
              <Paper sx={{ p: 2, mb: 2 }}>
                <Typography variant="h6" gutterBottom>🔍 DEBUG: Raw Data Sample</Typography>
                <TableContainer sx={{ maxHeight: 300 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Index</TableCell>
                        <TableCell>batch_no</TableCell>
                        <TableCell>learner_email</TableCell>
                        <TableCell>status</TableCell>
                        <TableCell>Raw Object</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {debugData.map((row, i) => (
                        <TableRow key={i}>
                          <TableCell>{i}</TableCell>
                          <TableCell>{String(row.batch_no || row.batchNo || "-")}</TableCell>
                          <TableCell>{String(row.learner_email || row.email || "-")}</TableCell>
                          <TableCell>{String(row.status || "-")}</TableCell>
                          <TableCell sx={{ fontSize: "0.7rem", maxWidth: 300 }}>
                            <code>{JSON.stringify(row).slice(0, 100)}...</code>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            )}
          </>
        )}

        {aggregatedRows.length > 0 && (
          <>
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} md={8}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 3 }}>
                      📈 {batchNo} Overview
                    </Typography>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 4, flexDirection: { xs: "column", md: "row" } }}>
                      <Box sx={{ textAlign: "center" }}>
                        <RadialProgress percentage={batchStats.batchPercentage} size={140} />
                        <Typography variant="h4" sx={{ mt: 1, fontWeight: "bold" }}>
                          {batchStats.batchPercentage.toFixed(1)}%
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Stats</Typography>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Average %</span>
                        <Chip label={`${batchStats.batchPercentage.toFixed(1)}%`} color="primary" />
                      </Box>
                      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Learners</span><strong>{batchStats.totalLearners}</strong>
                      </Box>
                      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Sessions</span><strong>{batchStats.totalSessions}</strong>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Paper>
              <TableContainer sx={{ maxHeight: 500 }}>
                <Table stickyHeader size="small">
                  <TableHead sx={{ bgcolor: "primary.main" }}>
                    <TableRow>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>#</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>Learner</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>Email</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold", textAlign: "right" }}>Total</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold", textAlign: "right" }}>P</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold", textAlign: "right" }}>L</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold", textAlign: "right" }}>A</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold", textAlign: "right" }}>%</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {aggregatedRows.map((row, i) => (
                      <TableRow key={row.email} sx={{
                        bgcolor: row.attendance_percentage >= 80 ? "#E8F5E8" : 
                               row.attendance_percentage >= 60 ? "#FFF3E0" : "#FFEBEE"
                      }}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell sx={{ fontWeight: 500 }}>{row.name}</TableCell>
                        <TableCell sx={{ maxWidth: 200, wordBreak: "break-word" }}>{row.email}</TableCell>
                        <TableCell align="right">{row.total_days}</TableCell>
                        <TableCell align="right" sx={{ color: "#4CAF50", fontWeight: "bold" }}>{row.present_days}</TableCell>
                        <TableCell align="right">{row.leave_days}</TableCell>
                        <TableCell align="right" sx={{ color: "#F44336" }}>{row.absent_days}</TableCell>
                        <TableCell align="right">
                          <Chip label={`${row.attendance_percentage.toFixed(1)}%`} size="small"
                            color={row.attendance_percentage >= 80 ? "success" : row.attendance_percentage >= 60 ? "warning" : "error"} />
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
