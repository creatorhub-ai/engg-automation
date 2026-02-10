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
  Dialog,
  DialogTitle,
  DialogContent,
  Divider,
} from "@mui/material";

const API_BASE =
  process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

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

  /* =========================
     LOAD BATCHES
  ========================== */
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
        console.error("Failed to load batches", err);
      }
    };

    fetchBatches();
  }, [token]);

  /* =========================
     LOAD ATTENDANCE DATA
  ========================== */
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
          }
        );

        setAttendanceData(attendanceRes.data.attendance || []);
        setTotalSessions(attendanceRes.data.total_sessions || 0);

        const learnersRes = await axios.get(`${API_BASE}/api/learners`, {
          params: { batch_no: batchNo },
          headers,
        });

        const mappedLearners = (learnersRes.data || [])
          .map(l => ({
            email: l.email || l.learner_email,
            name:
              l.name ||
              l.learner_name ||
              l.email?.split("@")[0] ||
              "Unknown",
          }))
          .filter(l => l.email);

        setLearnersData(mappedLearners);
      } catch (err) {
        console.error(err);
        setError("Failed to load attendance data");
        setAttendanceData([]);
        setLearnersData([]);
        setTotalSessions(0);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [batchNo, token]);

  /* =========================
     SUMMARY CALCULATION
  ========================== */
  const summary = useMemo(() => {
    const stats = {};

    attendanceData.forEach(row => {
      const email = row.learner_email;
      if (!email) return;

      if (!stats[email]) {
        const learner = learnersData.find(
          l => l.email.toLowerCase() === email.toLowerCase()
        );

        stats[email] = {
          email,
          name: learner?.name || email.split("@")[0],
          present: 0,
          attendedSessions: new Set(),
        };
      }

      const key = `${row.date}-${row.session}`;

      if (
        row.status?.toUpperCase() === "P" ||
        row.status === "Present"
      ) {
        if (!stats[email].attendedSessions.has(key)) {
          stats[email].attendedSessions.add(key);
          stats[email].present++;
        }
      }
    });

    const learners = Object.values(stats).map(l => {
      const percentage =
        totalSessions > 0 ? (l.present / totalSessions) * 100 : 0;

      return {
        ...l,
        percentage,
      };
    });

    const avgAttendance =
      learners.length > 0
        ? learners.reduce((s, l) => s + l.percentage, 0) /
          learners.length
        : 0;

    return {
      learners: learners.sort((a, b) => b.percentage - a.percentage),
      totalLearners: learners.length,
      avgAttendance: Math.round(avgAttendance * 10) / 10,
    };
  }, [attendanceData, learnersData, totalSessions]);

  /* =========================
     UI STATES
  ========================== */
  if (loading) {
    return (
      <Box
        sx={{
          minHeight: 400,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
        }}
      >
        <CircularProgress />
        <Typography>Loading attendance…</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 3 }}>
        {error}
      </Alert>
    );
  }

  /* =========================
     RENDER
  ========================== */
  return (
    <Box sx={{ maxWidth: 1600, p: 3 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" align="center" gutterBottom>
          📊 Attendance Report
        </Typography>

        <Typography
          align="center"
          color="text.secondary"
          sx={{ mb: 3 }}
        >
          Batch: <strong>{batchNo}</strong> · Sessions till today:{" "}
          <strong>{totalSessions}</strong>
        </Typography>

        <Box sx={{ display: "flex", gap: 2, mb: 4 }}>
          <FormControl sx={{ minWidth: 260 }}>
            <InputLabel>Batch</InputLabel>
            <Select
              value={batchNo}
              label="Batch"
              onChange={e => setBatchNo(e.target.value)}
            >
              {batches.map(b => (
                <MenuItem key={b} value={b}>
                  {b}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* SUMMARY CARDS */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography color="text.secondary">
                  Average Attendance
                </Typography>
                <Typography variant="h3" color="primary">
                  {summary.avgAttendance}%
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography color="text.secondary">
                  Total Learners
                </Typography>
                <Typography variant="h3">
                  {summary.totalLearners}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography color="text.secondary">
                  Sessions Till Today
                </Typography>
                <Typography variant="h3" color="info.main">
                  {totalSessions}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* TABLE */}
        <TableContainer component={Paper}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>Learner</TableCell>
                <TableCell>Email</TableCell>
                <TableCell align="right">
                  Present / {totalSessions}
                </TableCell>
                <TableCell align="right">%</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {summary.learners.map((l, idx) => (
                <TableRow
                  key={l.email}
                  hover
                  sx={{ cursor: "pointer" }}
                  onClick={() => {
                    setSelectedLearner(l);
                    setDetailDialogOpen(true);
                  }}
                >
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell sx={{ fontWeight: 500 }}>
                    {l.name}
                  </TableCell>
                  <TableCell>{l.email}</TableCell>
                  <TableCell align="right">
                    {l.present} / {totalSessions}
                  </TableCell>
                  <TableCell align="right">
                    <Chip
                      size="small"
                      label={`${l.percentage.toFixed(1)}%`}
                      color={
                        l.percentage >= 80
                          ? "success"
                          : l.percentage >= 60
                          ? "warning"
                          : "error"
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* DETAIL DIALOG */}
        <Dialog
          open={detailDialogOpen}
          onClose={() => setDetailDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Attendance Details</DialogTitle>
          <DialogContent>
            {selectedLearner && (
              <>
                <Typography>
                  <strong>Name:</strong> {selectedLearner.name}
                </Typography>
                <Typography>
                  <strong>Email:</strong> {selectedLearner.email}
                </Typography>
                <Divider sx={{ my: 2 }} />
                <Typography>
                  <strong>Present:</strong> {selectedLearner.present}
                </Typography>
                <Typography>
                  <strong>Total Sessions:</strong> {totalSessions}
                </Typography>
                <Typography variant="h6" sx={{ mt: 1 }}>
                  {selectedLearner.percentage.toFixed(1)}%
                </Typography>
              </>
            )}
          </DialogContent>
        </Dialog>
      </Paper>
    </Box>
  );
}
