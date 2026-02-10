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
  const [sessionsCompleted, setSessionsCompleted] = useState(0); // ✅ NEW
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

  // Load attendance + session counts
  useEffect(() => {
    if (!batchNo) return;

    const fetchData = async () => {
      setLoading(true);
      setError("");

      try {
        const attendanceRes = await axios.get(
          `${API_BASE}/api/learner-attendance`,
          {
            params: { batch_no: batchNo },
            headers,
            timeout: 15000
          }
        );

        const {
          attendance,
          total_sessions,
          sessions_completed
        } = attendanceRes.data;

        setAttendanceData(attendance || []);
        setTotalSessions(total_sessions || 0);
        setSessionsCompleted(sessions_completed || 0); // ✅ IMPORTANT

        const learnersRes = await axios.get(`${API_BASE}/api/learners`, {
          params: { batch_no: batchNo },
          headers,
          timeout: 5000
        });

        const mappedLearners = (learnersRes.data || [])
          .map(l => ({
            name: l.name || l.learner_name || l.email?.split("@")[0] || "Unknown",
            email: l.email || l.learner_email
          }))
          .filter(l => l.email);

        setLearnersData(mappedLearners);

      } catch (err) {
        console.error("API Error:", err);
        setError(err.response?.data?.error || err.message);
        setAttendanceData([]);
        setTotalSessions(0);
        setSessionsCompleted(0);
        setLearnersData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [batchNo, token]);

  // Attendance summary (BASED ON SESSIONS COMPLETED)
  const summary = useMemo(() => {
    const stats = {};

    attendanceData.forEach(row => {
      const email = row.learner_email;

      if (!stats[email]) {
        const learner = learnersData.find(
          l => l.email.toLowerCase() === email.toLowerCase()
        );

        stats[email] = {
          name: learner?.name || email.split("@")[0],
          email,
          present: 0,
          totalSessions: sessionsCompleted,
          attendedSessions: new Set()
        };
      }

      const sessionKey = `${row.date}-${row.session}`;

      if (
        (row.status?.toUpperCase() === "P" || row.status === "Present") &&
        !stats[email].attendedSessions.has(sessionKey)
      ) {
        stats[email].attendedSessions.add(sessionKey);
        stats[email].present++;
      }
    });

    const learners = Object.values(stats);

    const avgAttendance =
      learners.length > 0
        ? learners.reduce(
            (sum, l) =>
              sum +
              (sessionsCompleted > 0
                ? (l.present / sessionsCompleted) * 100
                : 0),
            0
          ) / learners.length
        : 0;

    return {
      learners,
      totalLearners: learners.length,
      totalSessions,
      sessionsCompleted,
      avgAttendance: Math.round(avgAttendance * 10) / 10
    };
  }, [attendanceData, learnersData, sessionsCompleted, totalSessions]);

  const handleLearnerClick = learner => {
    setSelectedLearner(learner);
    setDetailDialogOpen(true);
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  return (
    <Box sx={{ maxWidth: 1600, p: 3 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" align="center" gutterBottom>
          📊 Attendance Report – {batchNo}
          <Typography variant="h6" component="span" sx={{ ml: 2, color: "text.secondary" }}>
            ({sessionsCompleted} / {totalSessions} Sessions Completed)
          </Typography>
        </Typography>

        <FormControl sx={{ minWidth: 250, mb: 3 }}>
          <InputLabel>Batch</InputLabel>
          <Select value={batchNo} label="Batch" onChange={e => setBatchNo(e.target.value)}>
            {batches.map(b => (
              <MenuItem key={b} value={b}>{b}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* TABLE */}
        <TableContainer component={Paper}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>Learner</TableCell>
                <TableCell>Email</TableCell>
                <TableCell align="right">Present / {sessionsCompleted}</TableCell>
                <TableCell align="right">%</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {summary.learners.map((l, i) => {
                const percentage =
                  sessionsCompleted > 0
                    ? (l.present / sessionsCompleted) * 100
                    : 0;

                return (
                  <TableRow key={l.email} onClick={() => handleLearnerClick(l)}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>{l.name}</TableCell>
                    <TableCell>{l.email}</TableCell>
                    <TableCell align="right">{l.present}</TableCell>
                    <TableCell align="right">
                      <Chip
                        label={`${percentage.toFixed(1)}%`}
                        color={
                          percentage >= 80 ? "success" :
                          percentage >= 60 ? "warning" : "error"
                        }
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        {/* DETAILS DIALOG */}
        <Dialog open={detailDialogOpen} onClose={() => setDetailDialogOpen(false)}>
          <DialogTitle>{selectedLearner?.name}</DialogTitle>
          <DialogContent>
            {selectedLearner && (
              <>
                <Typography>Email: {selectedLearner.email}</Typography>
                <Typography>Present: {selectedLearner.present}</Typography>
                <Typography>
                  Attendance:{" "}
                  {sessionsCompleted > 0
                    ? ((selectedLearner.present / sessionsCompleted) * 100).toFixed(1)
                    : 0}
                  %
                </Typography>
              </>
            )}
          </DialogContent>
        </Dialog>
      </Paper>
    </Box>
  );
}
