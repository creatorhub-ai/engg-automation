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

  const [totalBatchSessions, setTotalBatchSessions] = useState(0);
  const [sessionsTillToday, setSessionsTillToday] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [selectedLearner, setSelectedLearner] = useState(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  // ================= LOAD BATCHES =================
  useEffect(() => {
    const fetchBatches = async () => {
      try {
        const { data } = await axios.get(`${API_BASE}/api/batches`, { headers });

        const batchList = Array.isArray(data)
          ? data.map(b => String(b.batch_no || b)).filter(Boolean)
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

  // ================= LOAD DATA =================
  useEffect(() => {
    if (!batchNo) return;

    const fetchData = async () => {
      setLoading(true);
      setError("");

      try {
        const attendanceRes = await axios.get(`${API_BASE}/api/learner-attendance`, {
          params: { batch_no: batchNo },
          headers
        });

        const {
          attendance,
          total_batch_sessions,
          sessions_till_today
        } = attendanceRes.data;

        setAttendanceData(attendance || []);
        setTotalBatchSessions(total_batch_sessions || 0);
        setSessionsTillToday(sessions_till_today || 0);

        const learnersRes = await axios.get(`${API_BASE}/api/learners`, {
          params: { batch_no: batchNo },
          headers
        });

        setLearnersData(learnersRes.data || []);

      } catch (err) {
        setError("Failed to load data");
        setAttendanceData([]);
        setTotalBatchSessions(0);
        setSessionsTillToday(0);
        setLearnersData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [batchNo, token]);

  // ================= SUMMARY =================
  const summary = useMemo(() => {

    const today = new Date().toISOString().split("T")[0];
    const stats = {};

    learnersData.forEach(learner => {
      if (!learner.email) return;
      const email = learner.email.trim().toLowerCase();

      stats[email] = {
        name: learner.name,
        email: learner.email,
        present: 0
      };
    });

    attendanceData.forEach(row => {
      if (!row.learner_email || !row.date) return;
      if (row.date > today) return;

      const email = row.learner_email.trim().toLowerCase();
      if (!stats[email]) return;

      if (row.status?.toUpperCase() === "P" || row.status === "Present") {
        stats[email].present++;
      }
    });

    const learners = Object.values(stats);

    const avgAttendance =
      learners.length > 0
        ? learners.reduce((sum, l) =>
            sum + (sessionsTillToday > 0 ? (l.present / sessionsTillToday) * 100 : 0),
            0
          ) / learners.length
        : 0;

    return {
      learners,
      avgAttendance: Math.round(avgAttendance * 10) / 10
    };

  }, [attendanceData, learnersData, sessionsTillToday]);

  // ================= DAY CALCULATION FUNCTION =================
  const calculateLearnerDetails = (learnerEmail) => {

    const today = new Date().toISOString().split("T")[0];

    const email = learnerEmail.trim().toLowerCase();

    const learnerAttendance = attendanceData.filter(row =>
      row.learner_email?.trim().toLowerCase() === email
    );

    const allDates = [...new Set(attendanceData.map(r => r.date))];
    const totalBatchDays = allDates.length;
    const totalDaysTillToday = allDates.filter(d => d <= today).length;

    let presentDays = 0;

    allDates.forEach(date => {

      if (date > today) return;

      const sessionsOfDay = learnerAttendance.filter(r => r.date === date);

      if (sessionsOfDay.length === 0) return;

      const totalSessionsInDay = attendanceData.filter(r => r.date === date).length;
      const absentSessions = sessionsOfDay.filter(r =>
        !(r.status?.toUpperCase() === "P" || r.status === "Present")
      ).length;

      // ✅ RULE: If absent ≥ 2 sessions → Day Absent
      if (absentSessions < 2) {
        presentDays++;
      }

    });

    const sessionsPresent = summary.learners.find(
      l => l.email === learnerEmail
    )?.present || 0;

    return {
      totalBatchSessions,
      sessionsTillToday,
      sessionsPresent,
      totalBatchDays,
      totalDaysTillToday,
      presentDays
    };
  };

  // ================= UI =================
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 5 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1500, p: 3 }}>
      <Paper sx={{ p: 4 }}>

        <Typography variant="h4" align="center" gutterBottom>
          📊 Attendance Report - {batchNo}
        </Typography>

        <Typography align="center" sx={{ mb: 3 }}>
          Conducted Sessions: <strong>{sessionsTillToday}</strong> / {totalBatchSessions}
        </Typography>

        <FormControl sx={{ minWidth: 250, mb: 4 }}>
          <InputLabel>Batch</InputLabel>
          <Select value={batchNo} onChange={e => setBatchNo(e.target.value)}>
            {batches.map(batch => (
              <MenuItem key={batch} value={batch}>{batch}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>S. No</TableCell>
                <TableCell>Learner</TableCell>
                <TableCell>Email</TableCell>
                <TableCell align="right">Present / {sessionsTillToday}</TableCell>
                <TableCell align="right">Percentage %</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {summary.learners.map((learner, index) => {
                const percentage =
                  sessionsTillToday > 0
                    ? (learner.present / sessionsTillToday) * 100
                    : 0;

                return (
                  <TableRow
                    key={learner.email}
                    sx={{ cursor: "pointer" }}
                    onClick={() => {
                      setSelectedLearner(learner);
                      setDetailDialogOpen(true);
                    }}
                  >
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{learner.name}</TableCell>
                    <TableCell>{learner.email}</TableCell>
                    <TableCell align="right">
                      {learner.present} / {sessionsTillToday}
                    </TableCell>
                    <TableCell align="right">
                      {percentage.toFixed(1)}%
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        {/* ================= DETAIL DIALOG ================= */}
        <Dialog
          open={detailDialogOpen}
          onClose={() => setDetailDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            Attendance Details - {selectedLearner?.name}
          </DialogTitle>

          <DialogContent>
            {selectedLearner && (() => {
              const details = calculateLearnerDetails(selectedLearner.email);

              return (
                <Box sx={{ mt: 2 }}>
                  <Typography><strong>Total Batch Sessions:</strong> {details.totalBatchSessions}</Typography>
                  <Typography><strong>Sessions Till Today:</strong> {details.sessionsTillToday}</Typography>
                  <Typography><strong>Sessions Present:</strong> {details.sessionsPresent}</Typography>

                  <Box sx={{ mt: 3 }} />

                  <Typography><strong>Total Batch Days:</strong> {details.totalBatchDays}</Typography>
                  <Typography><strong>Days Till Today:</strong> {details.totalDaysTillToday}</Typography>
                  <Typography><strong>Days Present:</strong> {details.presentDays}</Typography>
                </Box>
              );
            })()}
          </DialogContent>
        </Dialog>

      </Paper>
    </Box>
  );
}
