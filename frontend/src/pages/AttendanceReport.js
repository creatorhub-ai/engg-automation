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

  // Load attendance data from learner_attendance table
  useEffect(() => {
    if (!batchNo) return;

    const fetchData = async () => {
      setLoading(true);
      setError("");
      
      try {
        console.log(`🔄 Loading attendance for batch: ${batchNo}`);
        
        // Fetch attendance data from learner_attendance table
        const attendanceRes = await axios.get(`${API_BASE}/api/learner-attendance`, {
          params: { 
            batch_no: batchNo
          },
          headers,
          timeout: 10000
        });

        const rawAttendance = Array.isArray(attendanceRes.data) ? attendanceRes.data : [];
        console.log(`📊 Raw attendance records: ${rawAttendance.length}`);
        console.log("Sample data:", rawAttendance.slice(0, 3));

        // Store raw attendance data with proper field mapping
        setAttendanceData(rawAttendance.map(row => ({
          learner_email: row.learner_email,
          batch_no: row.batch_no,
          date: row.date,
          session: parseInt(row.session),
          status: row.status,
          marked_by: row.marked_by,
          marked_at: row.marked_at,
          // Add computed topic_name if needed (you can join with session table later)
          topic_name: `Session ${row.session}`
        })));

        // Fetch distinct learners for this batch
        const learnersRes = await axios.get(`${API_BASE}/api/learners`, {
          params: { batch_no: batchNo },
          headers,
          timeout: 5000
        });

        const learners = Array.isArray(learnersRes.data) ? learnersRes.data : [];
        setLearnersData(learners.map(l => ({
          email: l.learner_email || l.email,
          name: l.learner_name || l.name || l.learner_email?.split('@')[0] || 'Unknown'
        })));

        console.log(`✅ Loaded ${rawAttendance.length} attendance records, ${learners.length} learners`);

      } catch (err) {
        console.error('🔥 Attendance API Error:', err.response?.status, err.message);
        
        // Try alternative endpoint if main one fails
        try {
          console.log('🔄 Trying alternative endpoint...');
          const altRes = await axios.get(`${API_BASE}/api/session-attendance-report`, {
            params: { batch_no: batchNo },
            headers,
            timeout: 5000
          });
          
          const altData = Array.isArray(altRes.data) ? altRes.data : [];
          setAttendanceData(altData);
          setLearnersData([{name: 'Fallback Learner', email: 'fallback@example.com'}]);
          console.log(`✅ Fallback data loaded: ${altData.length} records`);
          
        } catch (altErr) {
          console.error('🔥 Both APIs failed:', altErr.message);
          setError(`Failed to load attendance data: ${err.response?.data?.message || err.message}`);
          setAttendanceData([]);
          setLearnersData([]);
        }
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
      const sessionKey = `${row.date}-${row.session}`;
      
      if (!stat.sessions.has(sessionKey)) {
        stat.sessions.add(sessionKey);
        stat.totalSessions++;
      }

      if (row.status?.toUpperCase() === 'P' || row.status === 'Present') {
        stat.present++;
      } else {
        stat.absent++;
      }
    });

    const learners = Object.values(stats);
    const totalLearners = learners.length;
    const avgAttendance = totalLearners > 0 
      ? learners.reduce((sum, l) => sum + (l.totalSessions > 0 ? l.present / l.totalSessions * 100 : 0), 0) / totalLearners 
      : 0;

    return {
      learners: learners.sort((a, b) => 
        (b.totalSessions > 0 ? b.present / b.totalSessions : 0) - 
        (a.totalSessions > 0 ? a.present / a.totalSessions : 0)
      ),
      totalLearners,
      avgAttendance: Math.round(avgAttendance * 10) / 10
    };
  }, [attendanceData, learnersData]);

  const handleLearnerClick = (learner) => {
    setSelectedLearner(learner);
    setDetailDialogOpen(true);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress size={60} />
        <Typography sx={{ ml: 2 }}>Loading attendance data...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 3 }}>
        <strong>{error}</strong>
        <br />
        <small>Batch: {batchNo} | Records: {attendanceData.length}</small>
      </Alert>
    );
  }

  return (
    <Box sx={{ maxWidth: 1600, p: 3 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom align="center">
          📊 Attendance Report - {batchNo || 'Select Batch'}
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, mb: 4 }}>
          <FormControl sx={{ minWidth: 250 }}>
            <InputLabel>Batch</InputLabel>
            <Select 
              value={batchNo} 
              onChange={e => setBatchNo(e.target.value)} 
              label="Batch"
              disabled={loading}
            >
              {batches.map(batch => (
                <MenuItem key={batch} value={batch}>{batch}</MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <Box sx={{ ml: 'auto' }}>
            <Typography variant="body2" color="text.secondary">
              Last Updated: {new Date().toLocaleString()}
            </Typography>
          </Box>
        </Box>

        {summary.learners.length === 0 ? (
          <Alert severity="info" sx={{ mb: 3 }}>
            <div>
              No attendance data found for <strong>{batchNo}</strong>
              <br />
              <small>
                Raw records: <strong>{attendanceData.length}</strong> | 
                Learners: <strong>{learnersData.length}</strong>
              </small>
            </div>
          </Alert>
        ) : (
          <>
            {/* SUMMARY CARDS */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>📈 Average Attendance</Typography>
                    <Typography variant="h2" color="primary">
                      {summary.avgAttendance}%
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>👥 Total Learners</Typography>
                    <Typography variant="h4">{summary.totalLearners}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>📅 Total Sessions</Typography>
                    <Typography variant="h4">
                      {Math.max(...attendanceData.map(r => r.session || 0), 0)}
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

      {/* Detail Dialog - Basic implementation */}
      <Dialog open={detailDialogOpen} onClose={() => setDetailDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Attendance Details - {selectedLearner?.name}</DialogTitle>
        <DialogContent>
          {selectedLearner && (
            <Typography>Coming soon: Detailed attendance breakdown for {selectedLearner.email}</Typography>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
