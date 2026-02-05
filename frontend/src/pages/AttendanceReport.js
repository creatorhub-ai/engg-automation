import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import {
  Box, Paper, Typography, FormControl, InputLabel, Select, MenuItem,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  CircularProgress, Alert, Grid, Card, CardContent, Chip,
  Dialog, DialogTitle, DialogContent
} from "@mui/material";

const API_BASE = process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

export default function AttendanceReport({ user, token }) {
  const [batches, setBatches] = useState([]);
  const [batchNo, setBatchNo] = useState("");
  const [attendanceData, setAttendanceData] = useState([]);
  const [learnersData, setLearnersData] = useState([]);
  const [totalSessions, setTotalSessions] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedLearner, setSelectedLearner] = useState(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

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

  // FIXED: Load attendance + planner data with PROPER total sessions calculation
  useEffect(() => {
    if (!batchNo) return;

    const fetchData = async () => {
      setLoading(true);
      setError("");
      
      try {
        console.log(`🔄 Loading data for batch: ${batchNo}`);

        // 1. Fetch attendance + total sessions
        const attendanceRes = await axios.get(`${API_BASE}/api/learner-attendance`, {
          params: { batch_no: batchNo },
          headers,
          timeout: 15000
        });

        console.log("📊 Full API Response:", attendanceRes.data);
        const { attendance, total_sessions } = attendanceRes.data;
        
        setAttendanceData(attendance || []);
        setTotalSessions(total_sessions || 0);
        console.log(`✅ Attendance: ${attendance?.length || 0} | Total Sessions: ${total_sessions}`);

        // 2. Fetch learners with CORRECT name mapping
        const learnersRes = await axios.get(`${API_BASE}/api/learners`, {
          params: { batch_no: batchNo },
          headers,
          timeout: 5000
        });

        // FIXED: Proper learner data mapping
        const mappedLearners = (learnersRes.data || []).map(l => ({
          name: l.name || l.learner_name || l.email?.split('@')[0] || 'Unknown',
          email: l.email || l.learner_email
        })).filter(l => l.email);

        setLearnersData(mappedLearners);
        console.log(`✅ Learners loaded: ${mappedLearners.length}`);

      } catch (err) {
        console.error('🔥 API Error:', err.response?.status, err.message);
        setError(`Failed to load data: ${err.response?.data?.error || err.message}`);
        setAttendanceData([]);
        setTotalSessions(0);
        setLearnersData([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [batchNo, token]);

  // FIXED: Proper percentage calculation using totalSessions
  const summary = useMemo(() => {
    const stats = {};

    // Process attendance records
    attendanceData.forEach(row => {
      const email = row.learner_email;
      if (!stats[email]) {
        // FIXED: Case-insensitive email matching + proper name lookup
        const learner = learnersData.find(l => 
          l.email.toLowerCase() === email.toLowerCase()
        );
        stats[email] = {
          name: learner?.name || email.split('@')[0] || 'Unknown',
          email,
          totalSessions: totalSessions, // CRITICAL: Use TOTAL batch sessions
          present: 0,
          attendedSessions: new Set()
        };
      }

      const stat = stats[email];
      const sessionKey = `${row.date}-${row.session}`;
      
      // Count PRESENT sessions only
      if (row.status?.toUpperCase() === 'P' || row.status === 'Present') {
        if (!stat.attendedSessions.has(sessionKey)) {
          stat.attendedSessions.add(sessionKey);
          stat.present++;
        }
      }
    });

    const learners = Object.values(stats);
    const totalLearners = learners.length;
    
    const avgAttendance = totalLearners > 0 
      ? learners.reduce((sum, l) => sum + (l.totalSessions > 0 ? (l.present / l.totalSessions) * 100 : 0), 0) / totalLearners 
      : 0;

    return {
      learners: learners.sort((a, b) => 
        (b.totalSessions > 0 ? b.present / b.totalSessions : 0) - 
        (a.totalSessions > 0 ? a.present / a.totalSessions : 0)
      ),
      totalLearners,
      totalSessions,
      avgAttendance: Math.round(avgAttendance * 10) / 10
    };
  }, [attendanceData, learnersData, totalSessions]);

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
        <small>Batch: {batchNo} | Records: {attendanceData.length} | Sessions: {totalSessions}</small>
      </Alert>
    );
  }

  return (
    <Box sx={{ maxWidth: 1600, p: 3 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom align="center">
          📊 Attendance Report - {batchNo || 'Select Batch'}
          {totalSessions > 0 && (
            <Typography 
              variant="h6" 
              component="span" 
              sx={{ ml: 2, color: 'text.secondary' }}
            >
              ({totalSessions} Total Sessions)
            </Typography>
          )}
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

        {summary.totalLearners === 0 ? (
          <Alert severity="info" sx={{ mb: 3 }}>
            <div>
              No attendance data for <strong>{batchNo}</strong>
              <br />
              <small>
                Records: <strong>{attendanceData.length}</strong> | 
                Total Sessions: <strong>{totalSessions}</strong> | 
                Learners found: <strong>{learnersData.length}</strong>
              </small>
            </div>
          </Alert>
        ) : (
          <>
            {/* SUMMARY CARDS */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>📈 Average Attendance</Typography>
                    <Typography variant="h3" color="primary">
                      {summary.avgAttendance}%
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>👥 Total Learners</Typography>
                    <Typography variant="h4">{summary.totalLearners}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>📅 Total Sessions</Typography>
                    <Typography variant="h4" color="info.main">
                      {summary.totalSessions}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>✅ Avg Present</Typography>
                    <Typography variant="h4">
                      {Math.round(
                        summary.learners.reduce((sum, l) => sum + l.present, 0) / summary.totalLearners
                      ) || 0}
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
                      <TableCell sx={{ bgcolor: 'primary.main', color: 'white', fontWeight: 'bold' }}>Learner</TableCell>
                      <TableCell sx={{ bgcolor: 'primary.main', color: 'white', fontWeight: 'bold' }}>Email</TableCell>
                      <TableCell sx={{ bgcolor: 'primary.main', color: 'white', fontWeight: 'bold', textAlign: 'right' }}>
                        Present / {totalSessions}
                      </TableCell>
                      <TableCell sx={{ bgcolor: 'primary.main', color: 'white', fontWeight: 'bold', textAlign: 'right' }}>%</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {summary.learners.map((learner, index) => {
                      const percentage = totalSessions > 0 ? (learner.present / totalSessions * 100) : 0;
                      return (
                        <TableRow 
                          key={learner.email} 
                          sx={{ 
                            cursor: 'pointer',
                            bgcolor: percentage >= 80 ? '#e8f5e8' : 
                                   percentage >= 60 ? '#fff3e0' : '#ffebee'
                          }}
                          onClick={() => handleLearnerClick(learner)}
                        >
                          <TableCell>{index + 1}</TableCell>
                          <TableCell sx={{ fontWeight: 500 }}>{learner.name}</TableCell>
                          <TableCell sx={{ maxWidth: 250, wordBreak: 'break-all' }}>{learner.email}</TableCell>
                          <TableCell align="right">
                            <strong style={{ color: '#4caf50' }}>{learner.present}</strong> / {totalSessions}
                          </TableCell>
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

        {/* Detail Dialog */}
        <Dialog open={detailDialogOpen} onClose={() => setDetailDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>Attendance Details - {selectedLearner?.name}</DialogTitle>
          <DialogContent>
            {selectedLearner ? (
              <div>
                <Typography><strong>Name:</strong> {selectedLearner.name}</Typography>
                <Typography><strong>Email:</strong> {selectedLearner.email}</Typography>
                <Typography><strong>Total Sessions:</strong> {selectedLearner.totalSessions}</Typography>
                <Typography><strong>Present:</strong> {selectedLearner.present}</Typography>
                <Typography variant="h6">
                  <strong>{(selectedLearner.present / selectedLearner.totalSessions * 100).toFixed(1)}%</strong>
                </Typography>
              </div>
            ) : (
              <Typography>Select a learner to see details</Typography>
            )}
          </DialogContent>
        </Dialog>
      </Paper>
    </Box>
  );
}
