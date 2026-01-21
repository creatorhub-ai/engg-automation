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
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");


  const headers = { Authorization: `Bearer ${token}` };

<<<<<<< Updated upstream
  // Load batches
=======

  // 🚀 SMOOTH BATCHES LOAD
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
  }, [token]);

  // Load attendance for selected batch
=======
  }, []);


  // 🚀 SMOOTH ATTENDANCE LOAD
  const fetchAttendance = useCallback(async (batch) => {
    if (!batch) return;
    
    setLoading(true);
    setError("");
    setAttendanceRows([]);
    setTotalSessions(0);


    try {
      const { data } = await axios.get(`${API_BASE}/api/attendance-report`, {
        params: { batch_no: batch },
        headers,
        timeout: 15000
      });


      // Handle both old array format and new structured response
      let rows = [];
      let totalSess = 0;


      if (Array.isArray(data)) {
        rows = data;
      } else if (data && Array.isArray(data.rows)) {
        rows = data.rows;
        totalSess = Number(data.total_sessions_for_batch || 0);
      } else if (data && data.learners) {
        // Use pre-calculated learners if backend provides them
        rows = data.rows || [];
        totalSess = data.total_sessions_for_batch || 0;
      }


      setAttendanceRows(Array.isArray(rows) ? rows : []);
      setTotalSessions(totalSess);
    } catch (err) {
      setError("Failed to load attendance data");
      setAttendanceRows([]);
      setTotalSessions(0);
      console.error("Attendance error:", err.response?.status, err.message);
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, [headers]);


>>>>>>> Stashed changes
  useEffect(() => {
    if (!batchNo) return;

<<<<<<< Updated upstream
    const fetchAttendance = async () => {
      setLoading(true);
      setError("");
      try {
        const { data } = await axios.get(`${API_BASE}/api/attendance-report`, {
          params: { batch_no: batchNo },
          headers
        });
        setAttendanceData(Array.isArray(data) ? data : []);
      } catch (err) {
        setError("Failed to load attendance data");
        setAttendanceData([]);
        console.error("Attendance fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAttendance();
  }, [batchNo, token]);

  // Aggregate attendance data
  const summary = useMemo(() => {
    const learnerStats = {};

    attendanceData.forEach(row => {
      const email = row.learner_email?.trim();
=======

  // 🚀 OPTIMIZED SUMMARY CALCULATION
  const summary = useMemo(() => {
    const learnerStats = {};


    attendanceRows.forEach(row => {
      const email = row.learner_email?.trim()?.toLowerCase();
>>>>>>> Stashed changes
      if (!email) return;


      if (!learnerStats[email]) {
        learnerStats[email] = {
          name: email.split('@')[0].replace(/[._]/g, ' '),
          email,
          total: 0,
          present: 0,
          leave: 0,
          absent: 0
        };
      }


      const stats = learnerStats[email];
      stats.total += 1;


      const status = String(row.status || '').toUpperCase();
      if (status === 'P') stats.present += 1;
      else if (status === 'L') stats.leave += 1;
      else if (status === 'A' || status === 'NA') stats.absent += 1;
    });


    const learners = Object.values(learnerStats);
    const totalLearners = learners.length;
    const avgAttendance = totalLearners > 0 
      ? learners.reduce((sum, l) => sum + (l.present / l.total * 100), 0) / totalLearners 
      : 0;


    return {
      learners: learners.sort((a, b) => b.present / b.total - a.present / a.total),
      totalLearners,
      totalSessions: attendanceData.length,
      avgAttendance: Math.round(avgAttendance * 10) / 10
    };
  }, [attendanceData]);

<<<<<<< Updated upstream
  const RadialProgress = ({ percentage }) => (
    <div style={{ 
      width: 140, height: 140, position: 'relative' 
    }}>
      <svg viewBox="0 0 36 36" width="140" height="140">
        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
              fill="none" stroke="#e5e5e5" strokeWidth="3"/>
        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
              fill="none" stroke="#4CAF50" strokeWidth="3" strokeLinecap="round"
              strokeDasharray={`${percentage * 0.352}, 100`}
              transform="rotate(-90 18 18)"/>
      </svg>
      <div style={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        fontSize: '20px', fontWeight: 'bold', color: percentage >= 75 ? '#4CAF50' : '#F44336'
      }}>
        {Math.round(percentage)}%
      </div>
    </div>
  );

  const downloadPDF = () => {
    const doc = new jsPDF('landscape');
    doc.text(`Attendance Report - ${batchNo}`, 14, 20);
    doc.text(`Overall: ${summary.avgAttendance}% (${summary.totalLearners} learners)`, 14, 40);

    const tableData = summary.learners.map((learner, i) => [
      i + 1,
      learner.name.slice(0, 20),
      learner.email.slice(0, 25),
      learner.total,
      learner.present,
      learner.leave,
      learner.absent,
      ((learner.present / learner.total) * 100).toFixed(1)
    ]);
=======

  // 🚀 GENERATE FORMATTED TIMESTAMP (IST)
  const getFormattedTimestamp = useCallback(() => {
    const now = new Date();
    const options = {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    };
    return now.toLocaleString('en-IN', options);
  }, []);


  // 🚀 SMOOTH PDF DOWNLOAD WITH ENHANCED TIMESTAMP
  const downloadPDF = useCallback(() => {
    const doc = new jsPDF('landscape');
    const timestamp = getFormattedTimestamp();
    
    // Page dimensions
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    
    // Header Section
    doc.setFontSize(20);
    doc.setTextColor(41, 128, 185);
    doc.text(`Attendance Report - ${batchNo}`, margin, 20);
    
    // Timestamp Section (Prominent)
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(`Generated on: ${timestamp} (IST)`, margin, 32);
    
    // Summary Stats
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(`Average Attendance: ${summary.avgAttendance}%`, margin, 44);
    doc.text(`Total Learners: ${summary.totalLearners} | Total Sessions: ${summary.totalSessions}`, margin, 52);
    
    // Divider line
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, 57, pageWidth - margin, 57);


    // Table Data
    const tableData = summary.learners.map((l, i) => {
      const pct = summary.totalSessions > 0 ? (l.present / summary.totalSessions * 100) : 0;
      return [
        String(i + 1),
        l.name.slice(0, 20),
        l.email.slice(0, 25),
        String(summary.totalSessions),
        String(l.present),
        String(l.leave),
        String(l.absent),
        `${pct.toFixed(1)}`
      ];
    });
>>>>>>> Stashed changes


    // Generate Table
    doc.autoTable({
      head: [['#', 'Name', 'Email', 'Total', 'P', 'L', 'A', '%']],
      body: tableData,
      startY: 60,
      styles: {
        fontSize: 8,
        cellPadding: 3,
        overflow: 'hidden'
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      },
      margin: { left: margin, right: margin }
    });

<<<<<<< Updated upstream
    doc.save(`attendance_${batchNo}.pdf`);
  };
=======

    // Footer with timestamp on every page
    const totalPages = doc.internal.pages.length - 1;
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      
      // Page number and timestamp at bottom
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(
        `Page ${i} of ${totalPages} | Report Generated: ${timestamp}`,
        margin,
        pageHeight - 8
      );
    }


    // Save PDF with timestamp in filename
    const sanitizedTimestamp = timestamp.replace(/[:\s]/g, '-');
    doc.save(`attendance_${batchNo}_${sanitizedTimestamp}.pdf`);
  }, [batchNo, summary, getFormattedTimestamp]);


  // 🚀 SMOOTH RADIAL PROGRESS
  const RadialProgress = ({ percentage }) => (
    <Fade in={true} timeout={600}>
      <div style={{ width: 140, height: 140, position: 'relative' }}>
        <svg viewBox="0 0 36 36" width="140" height="140">
          <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                fill="none" stroke="#e5e5e5" strokeWidth="3"/>
          <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                fill="none" stroke="#4CAF50" strokeWidth="3" strokeLinecap="round"
                strokeDasharray={`${percentage * 0.352}, 100`}
                transform="rotate(-90 18 18)"/>
        </svg>
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          fontSize: '20px', fontWeight: 'bold', 
          color: percentage >= 75 ? '#4CAF50' : '#F44336'
        }}>
          {Math.round(percentage)}%
        </div>
      </div>
    </Fade>
  );


  // 🚀 INITIAL LOADING SCREEN
  if (initialLoad) {
    return (
      <Box sx={{ maxWidth: 1600, p: 3 }}>
        <Paper sx={{ p: 4 }}>
          <Fade in={true} timeout={800}>
            <Box sx={{ textAlign: 'center', py: 12 }}>
              <CircularProgress size={60} sx={{ mb: 3 }} />
              <Typography variant="h6" color="text.secondary">
                Loading Attendance Report...
              </Typography>
            </Box>
          </Fade>
        </Paper>
      </Box>
    );
  }
>>>>>>> Stashed changes


  return (
    <Box sx={{ maxWidth: 1600, p: 3 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom align="center">
          📊 Attendance Report
        </Typography>

<<<<<<< Updated upstream
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
=======

        {/* 🚀 SMOOTH CONTROLS */}
        <Fade in={!loading} timeout={600}>
          <Box sx={{ display: 'flex', gap: 2, mb: 4, alignItems: 'center', flexWrap: 'wrap' }}>
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
            <Box sx={{ flexGrow: 1 }} />
            <Button 
              variant="contained" 
              onClick={downloadPDF} 
              disabled={summary.learners.length === 0 || loading}
              size="large"
            >
              Download PDF
            </Button>
          </Box>
        </Fade>


        {/* 🚀 LOADING OVERLAY */}
        {loading && (
          <Box sx={{ 
            position: 'absolute', 
            top: 0, left: 0, right: 0, bottom: 0, 
            display: 'flex', flexDirection: 'column', alignItems: 'center', 
            justifyContent: 'center', bgcolor: 'rgba(255,255,255,0.9)',
            zIndex: 10 
          }}>
            <CircularProgress size={60} sx={{ mb: 2 }} />
            <Typography color="text.secondary">
              Loading {batchNo} attendance...
            </Typography>
            <Skeleton variant="rectangular" width="80%" height={200} sx={{ mt: 2 }} />
          </Box>
        )}


        {/* 🚀 ERROR STATE */}
        {error && !loading && (
          <Fade in={true}>
            <Alert severity="error" sx={{ mt: 2 }} action={
              <Button color="inherit" size="small" onClick={() => fetchAttendance(batchNo)}>
                Retry
              </Button>
            }>
              {error}
            </Alert>
          </Fade>
        )}


        {/* 🚀 NO DATA STATE */}
        {summary.learners.length === 0 && !loading && !error && (
          <Fade in={true}>
            <Alert severity="info" sx={{ mt: 2 }}>
              No attendance data for <strong>{batchNo}</strong>
            </Alert>
          </Fade>
        )}


        {/* 🚀 DATA DISPLAY */}
        {summary.learners.length > 0 && !loading && (
>>>>>>> Stashed changes
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
                          Average Attendance
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

<<<<<<< Updated upstream
            <Paper sx={{ overflow: 'hidden' }}>
              <Box sx={{ bgcolor: 'primary.main', color: 'white', p: 2 }}>
                <Typography variant="h6">📋 Detailed Report</Typography>
              </Box>
              <TableContainer sx={{ maxHeight: 600 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ bgcolor: 'primary.dark', color: 'white', fontWeight: 'bold' }}>#</TableCell>
                      <TableCell sx={{ bgcolor: 'primary.dark', color: 'white', fontWeight: 'bold' }}>Learner</TableCell>
                      <TableCell sx={{ bgcolor: 'primary.dark', color: 'white', fontWeight: 'bold' }}>Email</TableCell>
                      <TableCell sx={{ bgcolor: 'primary.dark', color: 'white', fontWeight: 'bold', textAlign: 'right' }}>Total</TableCell>
                      <TableCell sx={{ bgcolor: 'primary.dark', color: 'white', fontWeight: 'bold', textAlign: 'right' }}>P</TableCell>
                      <TableCell sx={{ bgcolor: 'primary.dark', color: 'white', fontWeight: 'bold', textAlign: 'right' }}>L</TableCell>
                      <TableCell sx={{ bgcolor: 'primary.dark', color: 'white', fontWeight: 'bold', textAlign: 'right' }}>A</TableCell>
                      <TableCell sx={{ bgcolor: 'primary.dark', color: 'white', fontWeight: 'bold', textAlign: 'right' }}>%</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {summary.learners.map((learner, index) => {
                      const percentage = learner.total > 0 ? (learner.present / learner.total) * 100 : 0;
                      const rowColor = percentage >= 80 ? '#e8f5e8' : percentage >= 60 ? '#fff3e0' : '#ffebee';
                      
                      return (
                        <TableRow key={learner.email} sx={{ bgcolor: rowColor }}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell sx={{ fontWeight: 500 }}>{learner.name}</TableCell>
                          <TableCell sx={{ maxWidth: 250, wordBreak: 'break-all' }}>{learner.email}</TableCell>
                          <TableCell align="right"><strong>{learner.total}</strong></TableCell>
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
=======

            {/* 🚀 DETAILED TABLE */}
            <Fade in={true} timeout={1200}>
              <Paper sx={{ overflow: 'hidden' }}>
                <Box sx={{ bgcolor: 'primary.main', color: 'white', p: 2 }}>
                  <Typography variant="h6">📋 Detailed Report</Typography>
                </Box>
                <TableContainer sx={{ maxHeight: 600 }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ bgcolor: 'primary.dark', color: 'white', fontWeight: 'bold' }}>#</TableCell>
                        <TableCell sx={{ bgcolor: 'primary.dark', color: 'white', fontWeight: 'bold' }}>Learner</TableCell>
                        <TableCell sx={{ bgcolor: 'primary.dark', color: 'white', fontWeight: 'bold' }}>Email</TableCell>
                        <TableCell sx={{ bgcolor: 'primary.dark', color: 'white', fontWeight: 'bold', textAlign: 'right' }}>Total</TableCell>
                        <TableCell sx={{ bgcolor: 'primary.dark', color: 'white', fontWeight: 'bold', textAlign: 'right' }}>P</TableCell>
                        <TableCell sx={{ bgcolor: 'primary.dark', color: 'white', fontWeight: 'bold', textAlign: 'right' }}>L</TableCell>
                        <TableCell sx={{ bgcolor: 'primary.dark', color: 'white', fontWeight: 'bold', textAlign: 'right' }}>A</TableCell>
                        <TableCell sx={{ bgcolor: 'primary.dark', color: 'white', fontWeight: 'bold', textAlign: 'right' }}>%</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {summary.learners.map((learner, index) => {
                        const percentage = summary.totalSessions > 0 ? (learner.present / summary.totalSessions) * 100 : 0;
                        const rowColor = percentage >= 80 ? '#e8f5e8' : percentage >= 60 ? '#fff3e0' : '#ffebee';
                        
                        return (
                          <TableRow key={learner.email} sx={{ bgcolor: rowColor }}>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell sx={{ fontWeight: 500 }}>{learner.name}</TableCell>
                            <TableCell sx={{ maxWidth: 250, wordBreak: 'break-all' }}>{learner.email}</TableCell>
                            <TableCell align="right"><strong>{summary.totalSessions}</strong></TableCell>
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
            </Fade>
>>>>>>> Stashed changes
          </>
        )}
      </Paper>
    </Box>
  );
}
