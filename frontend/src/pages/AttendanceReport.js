import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import {
  Box, Paper, Typography, FormControl, InputLabel, Select, MenuItem,
  Button, Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  CircularProgress, Alert, Grid, Card, CardContent, Chip,
  Dialog, DialogTitle, DialogContent, ToggleButtonGroup, ToggleButton
} from "@mui/material";

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

  // Load attendance data
  useEffect(() => {
    if (!batchNo) return;

    const fetchData = async () => {
      setLoading(true);
      setError("");
      
      try {
        console.log(`🔄 Loading PDFT17 data...`);

        // 1. Get attendance - NO FILTERS, RAW DATA
        const attendanceRes = await axios.get(`${API_BASE}/api/session-attendance-report`, {
          params: { batch_no: batchNo },
          headers,
          timeout: 10000
        });
        
        let rawAttendance = Array.isArray(attendanceRes.data) ? attendanceRes.data : [];
        console.log(`📊 RAW ATTENDANCE (${rawAttendance.length} records):`, rawAttendance.slice(0, 2));

        // 2. MINIMAL CLEANING - WILL ACCEPT ALL YOUR DATA
        const attendanceData = rawAttendance.map(row => ({
          learner_email: String(row.learner_email || '').trim(),
          status: String(row.status || 'P').toUpperCase(),
          session: Number(row.session) || 1,
          date: row.date || '2026-01-21',
          topic_name: row.topic_name || 'Session',
          learner_name: row.learner_name || 'Learner'
        })).filter(row => row.learner_email); // ONLY REQUIRE email

        console.log(`✅ CLEAN ATTENDANCE (${attendanceData.length} records)`);

        // 3. Get learners
        const learnersRes = await axios.get(`${API_BASE}/api/learners`, {
          params: { batch_no: batchNo },
          headers,
          timeout: 10000
        });
        const rawLearners = Array.isArray(learnersRes.data) ? learnersRes.data : [];
        const learnersData = rawLearners.map(row => ({
          name: String(row.name || '').trim(),
          email: String(row.email || '').trim(),
          batch_no: batchNo
        })).filter(row => row.name);

        console.log(`✅ CLEAN LEARNERS (${learnersData.length} records)`);

        setAttendanceData(attendanceData);
        setLearnersData(learnersData);
        setError("");

      } catch (err) {
        console.error("Fetch error:", err);
        setError(`Failed to load data: ${err.message}`);
        setAttendanceData([]);
        setLearnersData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [batchNo, token]);

  // Calculate attendance summary
  const summary = useMemo(() => {
    const stats = {};

    // Process each attendance record
    attendanceData.forEach(row => {
      const email = row.learner_email;
      if (!stats[email]) {
        const learner = learnersData.find(l => l.email === email);
        stats[email] = {
          name: learner?.name || email.split('@')[0],
          email,
          totalSessions: 0,
          present: 0,
          absent: 0,
          sessions: new Set()
        };
      }

      const stat = stats[email];
      if (!stat.sessions.has(row.session)) {
        stat.sessions.add(row.session);
        stat.totalSessions++;
      }

      if (row.status === 'P') stat.present++;
      else stat.absent++;
    });

    const learners = Object.values(stats);
    const totalLearners = learners.length;
    const avgAttendance = totalLearners > 0 
      ? learners.reduce((sum, l) => sum + (l.present / l.totalSessions * 100), 0) / totalLearners 
      : 0;

    return {
      learners: learners.sort((a, b) => b.present / b.totalSessions - a.present / a.totalSessions),
      totalLearners,
      avgAttendance: Math.round(avgAttendance * 10) / 10
    };
  }, [attendanceData, learnersData]);

  const handleLearnerClick = (learner) => {
    setSelectedLearner(learner);
    setDetailDialogOpen(true);
  };

  if (loading) return <div style={{textAlign: 'center', padding: '50px'}}><CircularProgress /></div>;
  if (error) return <Alert severity="error">{error}</Alert>;

  return (
    <Box sx={{ maxWidth: 1600, p: 3 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom align="center">
          📊 Attendance Report - {batchNo}
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, mb: 4 }}>
          <FormControl sx={{ minWidth: 250 }}>
            <InputLabel>Batch</InputLabel>
            <Select value={batchNo} onChange={e => setBatchNo(e.target.value)} label="Batch">
              {batches.map(batch => (
                <MenuItem key={batch} value={batch}>{batch}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {summary.learners.length === 0 ? (
          <Alert severity="warning">
            No attendance data found for {batchNo} 
            <br/>
            <small>Raw records: {attendanceData.length} | Learners: {learnersData.length}</small>
          </Alert>
        ) : (
          <>
            {/* SUMMARY CARDS */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent>
                    <Typography variant="h6">📈 Average Attendance</Typography>
                    <Typography variant="h2">{summary.avgAttendance}%</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent>
                    <Typography variant="h6">👥 Total Learners</Typography>
                    <Typography variant="h4">{summary.totalLearners}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent>
                    <Typography variant="h6">📅 Sessions Covered</Typography>
                    <Typography variant="h4">
                      {Math.max(...attendanceData.map(r => r.session)) || 0}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* ATTENDANCE TABLE */}
            <Paper sx={{ overflow: 'hidden' }}>
              <TableContainer sx={{ maxHeight: 600 }}>
                <Table stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ bgcolor: 'primary.main', color: 'white', fontWeight: 'bold' }}>#</TableCell>
                      <TableCell sx={{ bgcolor: 'primary.main', color: 'white', fontWeight: 'bold' }}>Name</TableCell>
                      <TableCell sx={{ bgcolor: 'primary.main', color: 'white', fontWeight: 'bold' }}>Email</TableCell>
                      <TableCell sx={{ bgcolor: 'primary.main', color: 'white', fontWeight: 'bold', textAlign: 'right' }}>Sessions</TableCell>
                      <TableCell sx={{ bgcolor: 'primary.main', color: 'white', fontWeight: 'bold', textAlign: 'right' }}>Present</TableCell>
                      <TableCell sx={{ bgcolor: 'primary.main', color: 'white', fontWeight: 'bold', textAlign: 'right' }}>%</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {summary.learners.map((learner, index) => {
                      const percentage = learner.totalSessions > 0 ? (learner.present / learner.totalSessions * 100) : 0;
                      return (
                        <TableRow 
                          key={learner.email} 
                          sx={{ 
                            cursor: 'pointer',
                            bgcolor: percentage >= 80 ? '#e8f5e8' : percentage >= 60 ? '#fff3e0' : '#ffebee'
                          }}
                          onClick={() => handleLearnerClick(learner)}
                        >
                          <TableCell>{index + 1}</TableCell>
                          <TableCell sx={{ fontWeight: 500 }}>{learner.name}</TableCell>
                          <TableCell sx={{ maxWidth: 250, wordBreak: 'break-all' }}>{learner.email}</TableCell>
                          <TableCell align="right"><strong>{learner.totalSessions}</strong></TableCell>
                          <TableCell align="right" sx={{ color: '#4caf50', fontWeight: 'bold' }}>{learner.present}</TableCell>
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
          </>
        )}
      </Paper>
    </Box>
  );
}
