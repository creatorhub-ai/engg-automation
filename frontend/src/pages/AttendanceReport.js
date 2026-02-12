import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import {
  Box, Paper, Typography, FormControl, InputLabel, Select, MenuItem,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  CircularProgress, Dialog, DialogTitle, DialogContent
} from "@mui/material";

const API_BASE = process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

export default function AttendanceReport({ user, token }) {

  const [batches, setBatches] = useState([]);
  const [batchNo, setBatchNo] = useState("");

  const [attendanceData, setAttendanceData] = useState([]);
  const [learnersData, setLearnersData] = useState([]);
  const [plannerDates, setPlannerDates] = useState([]);

  const [totalBatchSessions, setTotalBatchSessions] = useState(0);
  const [sessionsTillToday, setSessionsTillToday] = useState(0);

  const [loading, setLoading] = useState(false);

  const [selectedLearner, setSelectedLearner] = useState(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  // ================= LOAD BATCHES =================
  useEffect(() => {
    const fetchBatches = async () => {
      const { data } = await axios.get(`${API_BASE}/api/batches`, { headers });

      const batchList = Array.isArray(data)
        ? data.map(b => String(b.batch_no || b)).filter(Boolean)
        : [];

      const unique = [...new Set(batchList)].sort();
      setBatches(unique);
      if (unique.length > 0) setBatchNo(unique[0]);
    };

    fetchBatches();
  }, [token]);

  // ================= LOAD DATA =================
  useEffect(() => {
    if (!batchNo) return;

    const fetchData = async () => {
      setLoading(true);

      try {
        const attendanceRes = await axios.get(
          `${API_BASE}/api/learner-attendance`,
          { params: { batch_no: batchNo }, headers }
        );

        const {
          attendance,
          total_batch_sessions,
          sessions_till_today,
          planner_dates
        } = attendanceRes.data;

        setAttendanceData(attendance || []);
        setTotalBatchSessions(total_batch_sessions || 0);
        setSessionsTillToday(sessions_till_today || 0);

        // ✅ IMPORTANT FIX HERE
        // Extract only date strings (handle object or string safely)
        const cleanedPlannerDates = (planner_dates || []).map(d =>
          typeof d === "string" ? d : d.date
        );

        setPlannerDates(cleanedPlannerDates);

        const learnersRes = await axios.get(
          `${API_BASE}/api/learners`,
          { params: { batch_no: batchNo }, headers }
        );

        setLearnersData(learnersRes.data || []);

      } catch (err) {
        console.error(err);
        setAttendanceData([]);
        setLearnersData([]);
        setPlannerDates([]);
        setTotalBatchSessions(0);
        setSessionsTillToday(0);
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

    attendanceData.forEach(row => {
      if (!row.learner_email || row.date > today) return;

      const email = row.learner_email.trim().toLowerCase();

      if (!stats[email]) {
        stats[email] = {
          name: "",
          email: row.learner_email,
          present: 0
        };
      }

      if (row.status?.toUpperCase() === "P" ||
          row.status?.toUpperCase() === "PRESENT") {
        stats[email].present++;
      }
    });

    Object.keys(stats).forEach(emailKey => {
      const learner = learnersData.find(
        l => l.email?.trim().toLowerCase() === emailKey
      );
      stats[emailKey].name = learner?.name || emailKey.split("@")[0];
    });

    return {
      learners: Object.values(stats)
    };

  }, [attendanceData, learnersData]);

  // ================= DAY CALCULATION (FIXED) =================
  const calculateLearnerDetails = (learnerEmail) => {

    const today = new Date().toISOString().split("T")[0];
    const email = learnerEmail.trim().toLowerCase();

    // ✅ Remove duplicates correctly
    const distinctDates = [...new Set(plannerDates)];

    const totalBatchDays = distinctDates.length;

    const totalDaysTillToday = distinctDates.filter(d => d <= today).length;

    const learnerAttendance = attendanceData.filter(r =>
      r.learner_email?.trim().toLowerCase() === email &&
      r.date <= today
    );

    // ✅ DISTINCT PRESENT DAYS
    const presentDays = new Set(
      learnerAttendance
        .filter(r =>
          r.status?.toUpperCase() === "P" ||
          r.status?.toUpperCase() === "PRESENT"
        )
        .map(r => r.date)
    ).size;

    return {
      totalBatchSessions,
      sessionsTillToday,
      sessionsPresent:
        summary.learners.find(l => l.email === learnerEmail)?.present || 0,
      totalBatchDays,
      totalDaysTillToday,
      presentDays
    };
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 5 }}>
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
                <TableCell align="right">
                  Present / {sessionsTillToday}
                </TableCell>
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
