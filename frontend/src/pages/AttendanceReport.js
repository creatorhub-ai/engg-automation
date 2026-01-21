// AttendanceReport.js
import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import {
  Box, Paper, Typography, FormControl, InputLabel, Select, MenuItem,
  Button, Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  CircularProgress, Alert, Grid, Card, CardContent, Chip,
  Dialog, DialogTitle, DialogContent, ToggleButtonGroup, ToggleButton
} from "@mui/material";
import jsPDF from "jspdf";
import "jspdf-autotable";

const API_BASE = process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

export default function AttendanceReport({ user, token }) {
  const [batches, setBatches] = useState([]);
  const [batchNo, setBatchNo] = useState("");
  const [attendanceData, setAttendanceData] = useState([]);
  const [learnersData, setLearnersData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedLearner, setSelectedLearner] = useState(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailFilter, setDetailFilter] = useState('all');
  const [detailFilteredData, setDetailFilteredData] = useState([]);

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

  // Load all required data for selected batch - FIXED
  useEffect(() => {
    if (!batchNo) return;

    const fetchAllData = async () => {
      setLoading(true);
      setError("");
      setAttendanceData([]);
      setLearnersData([]);

      try {
        console.log(`🔄 Loading data for batch: ${batchNo}`);

        // 1. Fetch attendance data
        let attendanceDataRaw = [];
        try {
          const attendanceRes = await axios.get(`${API_BASE}/api/session-attendance-report`, {
            params: { batch_no: batchNo },
            headers: headers,
            timeout: 10000
          });
          attendanceDataRaw = Array.isArray(attendanceRes.data) ? attendanceRes.data : [];
          console.log(`✅ Raw attendance: ${attendanceDataRaw.length} records`);
        } catch (attendanceErr) {
          console.warn('Attendance fetch failed:', attendanceErr.response?.status, attendanceErr.message);
        }

        // CLEAN & TRANSFORM attendance data
        const cleanAttendanceData = attendanceDataRaw
          .map(row => {
            // Extract clean email (handles mailto and raw emails)
            let email = String(row.learner_email || '').trim();
            email = email.replace(/\[mailto:([^\]]+)\]/, '$1'); // Remove mailto
            email = email.replace(/^\[.*\]\(([^)]+)\)/, '$1'); // Remove markdown links
            
            return {
              learner_email: email,
              status: String(row.status || '').toUpperCase().substring(0,1), // First char only
              session: parseInt(row.session) || 1,
              date: row.date || '2026-01-21',
              topic_name: row.topic_name || `Session ${row.session || 1}`,
              learner_name: row.learner_name || email.split('@')[0]
            };
          })
          // ✅ VERY LENIENT FILTERS - WILL ACCEPT YOUR DATA
          .filter(row => row.learner_email.length > 5) // Any valid-looking email
          .filter(row => row.status.length === 1 && ['P','A','L'].includes(row.status)); // Single char status

        console.log(`✅ Raw→Clean: ${attendanceDataRaw.length} → ${cleanAttendanceData.length}`);

        // 2. Fetch learners data
        let learnersDataRaw = [];
        try {
          const learnersRes = await axios.get(`${API_BASE}/api/learners`, {
            params: { batch_no: batchNo },
            headers: headers,
            timeout: 10000
          });
          learnersDataRaw = Array.isArray(learnersRes.data) ? learnersRes.data : [];
          console.log(`✅ Raw learners: ${learnersDataRaw.length} records`);
        } catch (learnersErr) {
          console.warn('Learners fetch failed:', learnersErr.response?.status, learnersErr.message);
        }

        // CLEAN learners data
        const cleanLearnersData = learnersDataRaw
          .map(row => ({
            name: String(row.name || '').trim(),
            email: String(row.email || '').trim(),
            batch_no: row.batch_no || batchNo,
            id: row.id
          }))
          .filter(row => row.name && row.email && row.email.includes('@'));

        console.log(`✅ Clean learners: ${cleanLearnersData.length} records`);

        setAttendanceData(cleanAttendanceData);
        setLearnersData(cleanLearnersData);

        if (cleanAttendanceData.length === 0 && cleanLearnersData.length > 0) {
          setError(`No valid attendance records found for ${batchNo} (${cleanLearnersData.length} learners exist)`);
        } else if (cleanAttendanceData.length === 0 && cleanLearnersData.length === 0) {
          setError(`No data found for batch ${batchNo}`);
        } else {
          setError("");
        }

      } catch (err) {
        console.error("CRITICAL fetch error:", err);
        setError("Failed to connect to server");
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [batchNo, token]); // FIXED: Properly closed useEffect

  // Aggregate attendance data by sessions
  const summary = useMemo(() => {
    const learnerStats = {};

    attendanceData.forEach(row => {
      const email = row.learner_email?.trim();
      if (!email) return;

      if (!learnerStats[email]) {
        const learnerInfo = learnersData.find(l => l.email === email);
        learnerStats[email] = {
          name: learnerInfo?.name || email.split('@')[0].replace(/[._]/g, ' '),
          email,
          totalSessions: 0,
          present: 0,
          leave: 0,
          absent: 0,
          sessions: new Set()
        };
      }

      const stats = learnerStats[email];

      // Count unique sessions per learner
      if (!stats.sessions.has(row.session)) {
        stats.sessions.add(row.session);
        stats.totalSessions += 1;
      }

      const status = String(row.status || '').toUpperCase();
      if (status === 'P') stats.present += 1;
      else if (status === 'L') stats.leave += 1;
      else if (status === 'A' || status === 'NA') stats.absent += 1;
    });

    const learners = Object.values(learnerStats);
    const totalLearners = learners.length;
    const avgAttendance = totalLearners > 0 
      ? learners.reduce((sum, l) => sum + (l.present / l.totalSessions * 100), 0) / totalLearners 
      : 0;

    return {
      learners: learners.sort((a, b) => (b.present / b.totalSessions) - (a.present / a.totalSessions)),
      totalLearners,
      totalSessions: Math.max(...Object.values(learnerStats).map(l => l.totalSessions)) || 0,
      avgAttendance: Math.round(avgAttendance * 10) / 10
    };
  }, [attendanceData, learnersData]);

  // Filter details for selected learner
  useEffect(() => {
    if (!selectedLearner) return;
    
    const filterData = () => {
      let filtered = attendanceData.filter(row => row.learner_email === selectedLearner.email);
      
      if (detailFilter === 'present') {
        filtered = filtered.filter(row => String(row.status || '').toUpperCase() === 'P');
      } else if (detailFilter === 'leave') {
        filtered = filtered.filter(row => String(row.status || '').toUpperCase() === 'L');
      } else if (detailFilter === 'absent') {
        filtered = filtered.filter(row => ['A', 'NA'].includes(String(row.status || '').toUpperCase()));
      }
      
      setDetailFilteredData(filtered);
    };
    
    filterData();
  }, [selectedLearner, detailFilter, attendanceData]);

  const RadialProgress = ({ percentage }) => (
    <div style={{ width: 140, height: 140, position: 'relative' }}>
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
      <div style={{
        position: 'absolute', 
        top: '50%', 
        left: '50%', 
        transform: 'translate(-50%, -50%)',
        fontSize: '20px', 
        fontWeight: 'bold', 
        color: percentage >= 75 ? '#4CAF50' : '#F44336'
      }}>
        {Math.round(percentage)}%
      </div>
    </div>
  );

  const downloadPDF = () => {
    const now = new Date();
    const timestamp = now.toLocaleString('en-IN', { 
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).replace(/[,]/g, '').replace(/:/g, '-');
    
    const doc = new jsPDF('landscape');
    doc.text(`Attendance Report - ${batchNo}`, 14, 20);
    doc.text(`Generated: ${timestamp}`, 14, 35);
    doc.text(`Overall: ${summary.avgAttendance}% (${summary.totalLearners} learners)`, 14, 50);

    const tableData = summary.learners.map((learner, i) => [
      i + 1,
      learner.name.slice(0, 20),
      learner.email.slice(0, 25),
      learner.totalSessions,
      learner.present,
      learner.leave,
      learner.absent,
      ((learner.present / learner.totalSessions) * 100).toFixed(1)
    ]);

    doc.autoTable({
      head: [['#', 'Name', 'Email', 'Sessions', 'P', 'L', 'A', '%']],
      body: tableData,
      startY: 65,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [41, 128, 185] }
    });

    doc.save(`attendance_${batchNo}_${timestamp}.pdf`);
  };

  const handleLearnerClick = (learner) => {
    setSelectedLearner(learner);
    setDetailDialogOpen(true);
  };

  return (
    <Box sx={{ maxWidth: 1600, p: 3 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom align="center">
          📊 Attendance Report (Session-based)
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, mb: 4, alignItems: 'center', flexWrap: 'wrap' }}>
          <FormControl sx={{ minWidth: 250 }}>
            <InputLabel>Batch</InputLabel>
            <Select value={batchNo} onChange={e => setBatchNo(e.target.value)} label="Batch">
              {batches.map(batch => (
                <MenuItem key={batch} value={batch}>{batch}</MenuItem>
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
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
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
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <RadialProgress percentage={summary.avgAttendance} />
                      <Box>
                        <Typography variant="h2" sx={{ fontWeight: 'bold' }}>
                          {summary.avgAttendance}%
                        </Typography>
                        <Typography color="text.secondary">
                          Average Attendance (Sessions)
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} lg={4}>
                <Card>
                  <CardContent>
                    <Typography variant="h6">📊 Statistics</Typography>
                    <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Total Learners</span>
                        <strong>{summary.totalLearners}</strong>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Total Sessions</span>
                        <strong>{summary.totalSessions}</strong>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Avg Attendance</span>
                        <Chip label={`${summary.avgAttendance}%`} color="primary" />
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Paper sx={{ overflow: 'hidden' }}>
              <Box sx={{ bgcolor: 'primary.main', color: 'white', p: 2 }}>
                <Typography variant="h6">📋 Detailed Report (Click learner for session details)</Typography>
              </Box>
              <TableContainer sx={{ maxHeight: 600 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ bgcolor: 'primary.dark', color: 'white', fontWeight: 'bold' }}>#</TableCell>
                      <TableCell sx={{ bgcolor: 'primary.dark', color: 'white', fontWeight: 'bold' }}>Learner Name</TableCell>
                      <TableCell sx={{ bgcolor: 'primary.dark', color: 'white', fontWeight: 'bold' }}>Email</TableCell>
                      <TableCell sx={{ bgcolor: 'primary.dark', color: 'white', fontWeight: 'bold', textAlign: 'right' }}>Sessions</TableCell>
                      <TableCell sx={{ bgcolor: 'primary.dark', color: 'white', fontWeight: 'bold', textAlign: 'right' }}>P</TableCell>
                      <TableCell sx={{ bgcolor: 'primary.dark', color: 'white', fontWeight: 'bold', textAlign: 'right' }}>L</TableCell>
                      <TableCell sx={{ bgcolor: 'primary.dark', color: 'white', fontWeight: 'bold', textAlign: 'right' }}>A</TableCell>
                      <TableCell sx={{ bgcolor: 'primary.dark', color: 'white', fontWeight: 'bold', textAlign: 'right' }}>%</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {summary.learners.map((learner, index) => {
                      const percentage = learner.totalSessions > 0 ? (learner.present / learner.totalSessions) * 100 : 0;
                      const rowColor = percentage >= 80 ? '#e8f5e8' : percentage >= 60 ? '#fff3e0' : '#ffebee';
                      
                      return (
                        <TableRow 
                          key={learner.email} 
                          sx={{ bgcolor: rowColor, cursor: 'pointer' }}
                          onClick={() => handleLearnerClick(learner)}
                        >
                          <TableCell>{index + 1}</TableCell>
                          <TableCell sx={{ fontWeight: 500 }}>{learner.name}</TableCell>
                          <TableCell sx={{ maxWidth: 250, wordBreak: 'break-all' }}>{learner.email}</TableCell>
                          <TableCell align="right"><strong>{learner.totalSessions}</strong></TableCell>
                          <TableCell align="right" sx={{ color: '#4caf50', fontWeight: 'bold' }}>{learner.present}</TableCell>
                          <TableCell align="right">{learner.leave}</TableCell>
                          <TableCell align="right" sx={{ color: '#f44336' }}>{learner.absent}</TableCell>
                          <TableCell align="right">
                            <Chip 
                              label={`${percentage.toFixed(1)}%`}
                              color={percentage >= 80 ? 'success' : percentage >= 60 ? 'warning' : 'error'}
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

            {/* Learner Detail Dialog */}
            <Dialog open={detailDialogOpen} onClose={() => setDetailDialogOpen(false)} maxWidth="md" fullWidth>
              <DialogTitle>
                Session Details - {selectedLearner?.name} ({selectedLearner?.email})
              </DialogTitle>
              <DialogContent>
                <Box sx={{ mb: 2 }}>
                  <ToggleButtonGroup
                    value={detailFilter}
                    exclusive
                    onChange={(e, newFilter) => newFilter && setDetailFilter(newFilter)}
                    sx={{ mb: 2 }}
                  >
                    <ToggleButton value="all">All ({detailFilteredData.length})</ToggleButton>
                    <ToggleButton value="present">Present ({selectedLearner?.present || 0})</ToggleButton>
                    <ToggleButton value="leave">Leave ({selectedLearner?.leave || 0})</ToggleButton>
                    <ToggleButton value="absent">Absent ({selectedLearner?.absent || 0})</ToggleButton>
                  </ToggleButtonGroup>
                </Box>
                <TableContainer sx={{ maxHeight: 400 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Session</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell sx={{ width: 200 }}>Topic</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {detailFilteredData.map((row, index) => (
                        <TableRow key={`${row.date}-${row.session}`}>
                          <TableCell>{new Date(row.date).toLocaleDateString('en-IN')}</TableCell>
                          <TableCell>{row.session}</TableCell>
                          <TableCell>
                            <Chip 
                              label={row.status} 
                              color={row.status === 'P' ? 'success' : row.status === 'L' ? 'warning' : 'error'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>{row.topic_name}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </DialogContent>
            </Dialog>
          </>
        )}
      </Paper>
    </Box>
  );
}
