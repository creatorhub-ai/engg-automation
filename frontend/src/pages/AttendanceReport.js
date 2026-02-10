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

export default function AttendanceReport({ token }) {
  const [batches, setBatches] = useState([]);
  const [batchNo, setBatchNo] = useState("");
  const [attendanceData, setAttendanceData] = useState([]);
  const [learnersData, setLearnersData] = useState([]);
  const [totalSessions, setTotalSessions] = useState(0);
  const [loading, setLoading] = useState(false);
  const [batchLoading, setBatchLoading] = useState(true);
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
        setBatchLoading(true);

        const { data } = await axios.get(`${API_BASE}/api/batches`, {
          headers,
        });

        const list = Array.isArray(data)
          ? data
              .map(b => String(b.batch_no))
              .filter(Boolean)
              .sort()
          : [];

        setBatches(list);
      } catch (err) {
        console.error("❌ Failed to load batches", err);
        setError("Failed to load batches");
      } finally {
        setBatchLoading(false);
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

        const mapped = (learnersRes.data || [])
          .map(l => ({
            email: l.email || l.learner_email,
            name:
              l.name ||
              l.learner_name ||
              l.email?.split("@")[0] ||
              "Unknown",
          }))
          .filter(l => l.email);

        setLearnersData(mapped);
      } catch (err) {
        console.error("❌ Attendance load failed", err);
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
     SUMMARY
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

      const key = `${row.attendance_date}-${row.session_no}`;

      if (
        row.attendance === "P" ||
        row.attendance === "Present"
      ) {
        if (!stats[email].attendedSessions.has(key)) {
          stats[email].attendedSessions.add(key);
          stats[email].present++;
        }
      }
    });

    const learners = Object.values(stats).map(l => ({
      ...l,
      percentage:
        totalSessions > 0 ? (l.present / totalSessions) * 100 : 0,
    }));

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
  if (batchLoading) {
    return (
      <Box sx={{ p: 5, textAlign: "center" }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Loading batches…</Typography>
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

        <Box sx={{ display: "flex", justifyContent: "center", mb: 4 }}>
          <FormControl sx={{ minWidth: 280 }}>
            <InputLabel>Select Batch</InputLabel>
            <Select
              value={batchNo}
              label="Select Batch"
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

        {!batchNo && (
          <Typography align="center" color="text.secondary">
            Please select a batch to view attendance
          </Typography>
        )}

        {loading && (
          <Box sx={{ textAlign: "center", mt: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {!loading && batchNo && (
          <>
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
                      Sessions Till Today
                    </Typography>
                    <Typography variant="h3">
                      {totalSessions}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

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
                  {summary.learners.map((l, i) => (
                    <TableRow
                      key={l.email}
                      hover
                      sx={{ cursor: "pointer" }}
                      onClick={() => {
                        setSelectedLearner(l);
                        setDetailDialogOpen(true);
                      }}
                    >
                      <TableCell>{i + 1}</TableCell>
                      <TableCell>{l.name}</TableCell>
                      <TableCell>{l.email}</TableCell>
                      <TableCell align="right">
                        {l.present} / {totalSessions}
                      </TableCell>
                      <TableCell align="right">
                        <Chip
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
          </>
        )}

        <Dialog
          open={detailDialogOpen}
          onClose={() => setDetailDialogOpen(false)}
          fullWidth
          maxWidth="sm"
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
              </>
            )}
          </DialogContent>
        </Dialog>
      </Paper>
    </Box>
  );
}
