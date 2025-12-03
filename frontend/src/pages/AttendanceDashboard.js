import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  Box,
  Paper,
  Typography,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Button,
  Alert,
  CircularProgress,
  Chip,
  Fade,
  ButtonGroup,
} from "@mui/material";

const API_BASE = process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";
const sessionsPerDay = 3;

export default function AttendanceDashboard({ token }) {
  const [domains, setDomains] = useState([]);
  const [domain, setDomain] = useState("");
  const [batches, setBatches] = useState([]);
  const [batchNo, setBatchNo] = useState("");
  const [learners, setLearners] = useState([]);
  const [todayDate, setTodayDate] = useState("");
  const [courseStartDate, setCourseStartDate] = useState("");
  const [courseEndDate, setCourseEndDate] = useState("");
  // attendance[learnerEmail][todayDate][session] = { status: "", locked: false }
  const [attendance, setAttendance] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const authHeaders = () => (token ? { Authorization: `Bearer ${token}` } : {});

  // Load domains
  useEffect(() => {
    axios.get(`${API_BASE}/api/get_domains`).then(res => setDomains(res.data || []));
  }, []);

  // Load batches for domain
  useEffect(() => {
    if (!domain) {
      setBatches([]);
      setBatchNo("");
      setLearners([]);
      setTodayDate("");
      setCourseStartDate("");
      setCourseEndDate("");
      setAttendance({});
      return;
    }
    axios
      .get(`${API_BASE}/api/get_batches_by_domain`, { params: { domain } })
      .then(res => setBatches(res.data || []));
  }, [domain]);

  // Load learners, course dates, and build today's attendance grid
  useEffect(() => {
    if (!batchNo) {
      setLearners([]);
      setTodayDate("");
      setCourseStartDate("");
      setCourseEndDate("");
      setAttendance({});
      return;
    }
    async function fetchBatchDetails() {
      setLoading(true);
      try {
        const [learnersRes, datesRes] = await Promise.all([
          axios.get(`${API_BASE}/api/get_learners`, { params: { batch_no: batchNo } }),
          axios.get(`${API_BASE}/api/get_batch_dates`, { params: { batch_no: batchNo } }),
        ]);

        const filteredLearners = (learnersRes.data || []).filter(l => l.status !== "Dropout");
        setLearners(filteredLearners);

        const { start_date, end_date } = datesRes.data || {};
        setCourseStartDate(start_date);
        setCourseEndDate(end_date);

        const today = new Date().toISOString().slice(0, 10);
        setTodayDate(today);

        // Allow marking only if today is within course dates
        if (!start_date || !end_date || today < start_date || today > end_date) {
          setMessage("Today is outside the course duration. You can view but not mark attendance.");
          setAttendance({});
          setLoading(false);
          return;
        }

        // Existing attendance from server (for the batch)
        let serverAttendance = {};
        try {
          const attRes = await axios.get(`${API_BASE}/api/get_batch_attendance`, {
            params: { batch_no: batchNo },
          });
          serverAttendance = attRes.data || {};
        } catch (_) {}

        // Build attendance state for today only
        const newAttendance = {};
        filteredLearners.forEach(learner => {
          newAttendance[learner.email] = {};
          newAttendance[learner.email][today] = {};
          for (let session = 1; session <= sessionsPerDay; session++) {
            let serverCell;
            if (
              serverAttendance[learner.email] &&
              serverAttendance[learner.email][today] &&
              serverAttendance[learner.email][today][session]
            ) {
              serverCell = serverAttendance[learner.email][today][session];
            }
            if (serverCell) {
              newAttendance[learner.email][today][session] = {
                status: serverCell.status,
                locked: true,
              };
            } else if (learner.status === "Disabled") {
              newAttendance[learner.email][today][session] = {
                status: "NA",
                locked: true,
              };
            } else {
              newAttendance[learner.email][today][session] = {
                status: "",
                locked: false,
              };
            }
          }
        });
        setAttendance(newAttendance);
        setMessage("");
      } catch (e) {
        setMessage("Failed to load batch data");
        setLearners([]);
        setTodayDate("");
        setCourseStartDate("");
        setCourseEndDate("");
        setAttendance({});
      }
      setLoading(false);
    }
    fetchBatchDetails();
  }, [batchNo]);

  // Mark handler (P/A/L)
  function markAttendance(learnerEmail, session, status) {
    setAttendance(prev => ({
      ...prev,
      [learnerEmail]: {
        ...prev[learnerEmail],
        [todayDate]: {
          ...prev[learnerEmail]?.[todayDate],
          [session]: { status, locked: true },
        },
      },
    }));
  }

  // Save and send course dates for backend percentage calculation/storage
  async function saveAttendance() {
    setLoading(true);
    setMessage("");
    try {
      const saveObj = {};
      Object.keys(attendance).forEach(email => {
        saveObj[email] = {};
        saveObj[email][todayDate] = {};
        for (let session = 1; session <= sessionsPerDay; session++) {
          saveObj[email][todayDate][session] =
            attendance[email][todayDate][session]?.status || "";
        }
      });

      await axios.post(
        `${API_BASE}/api/save_attendance_ui`,
        {
          batch_no: batchNo,
          attendance: saveObj,
          course_start_date: courseStartDate,
          course_end_date: courseEndDate,
        },
        { headers: authHeaders() }
      );

      setMessage("✅ Today's attendance saved successfully");
    } catch (err) {
      console.error(err);
      setMessage("❌ Failed to save attendance");
    }
    setLoading(false);
  }

  // Horizontal options renderer using ButtonGroup; show Chip once locked
  function renderSessionCell(learner, session) {
    const cell =
      attendance[learner.email]?.[todayDate]?.[session] || { status: "", locked: false };

    if (cell.locked) {
      if (cell.status === "P") return <Chip label="P" color="success" size="small" />;
      if (cell.status === "A") return <Chip label="A" color="error" size="small" />;
      if (cell.status === "L") return <Chip label="L" color="warning" size="small" />;
      if (cell.status === "NA") return <Chip label="NA" size="small" />;
      return <Chip label="-" size="small" />;
    }

    return (
      <ButtonGroup variant="outlined" size="small" aria-label="attendance options">
        <Button color="success" onClick={() => markAttendance(learner.email, session, "P")}>
          P
        </Button>
        <Button color="error" onClick={() => markAttendance(learner.email, session, "A")}>
          A
        </Button>
        <Button color="warning" onClick={() => markAttendance(learner.email, session, "L")}>
          L
        </Button>
      </ButtonGroup>
    );
  }

  return (
    <Box sx={{ maxWidth: 980, mx: "auto", my: 3, px: 2 }}>
      <Paper elevation={5} sx={{ p: 3, borderRadius: 3 }}>
        <Typography variant="h4" color="primary" gutterBottom>
          Attendance Dashboard
        </Typography>

        <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 2 }}>
          {courseStartDate && courseEndDate
            ? `Course: ${courseStartDate} to ${courseEndDate} · Marking for today only`
            : "Select a domain and batch to begin"}
        </Typography>

        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Domain</InputLabel>
              <Select
                label="Domain"
                value={domain}
                onChange={e => setDomain(e.target.value)}
              >
                {domains.map(d => (
                  <MenuItem key={d} value={d}>
                    {d}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth disabled={!domain}>
              <InputLabel>Batch No</InputLabel>
              <Select
                label="Batch No"
                value={batchNo}
                onChange={e => setBatchNo(e.target.value)}
              >
                {batches.map(b => (
                  <MenuItem key={b} value={b}>
                    {b}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        {todayDate && (
          <Typography variant="h6" sx={{ mb: 2 }}>
            Today ({todayDate})
          </Typography>
        )}

        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
            <CircularProgress />
          </Box>
        )}

        {!loading && learners.length > 0 && todayDate && (
          <Table size="small" sx={{ overflowX: "auto", display: "block", mb: 2 }}>
            <TableHead>
              <TableRow>
                <TableCell>Sr No</TableCell>
                <TableCell>Learner Name</TableCell>
                <TableCell>Email</TableCell>
                {Array.from({ length: sessionsPerDay }, (_, i) => (
                  <TableCell key={`s_head_${i + 1}`} align="center">
                    S{i + 1}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {learners.map((learner, idx) => (
                <TableRow key={learner.email}>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell>{learner.name}</TableCell>
                  <TableCell sx={{ maxWidth: 260, wordBreak: "break-all" }}>
                    {learner.email}
                  </TableCell>
                  {Array.from({ length: sessionsPerDay }, (_, i) => (
                    <TableCell key={`cell_${learner.email}_${i + 1}`} align="center">
                      {renderSessionCell(learner, i + 1)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Button
          variant="contained"
          color="primary"
          fullWidth
          onClick={saveAttendance}
          disabled={loading || !todayDate || learners.length === 0}
          sx={{ py: 1.5, fontWeight: "bold", fontSize: "1rem", boxShadow: 4 }}
        >
          {loading ? "Saving..." : "Save Today’s Attendance"}
        </Button>

        <Fade in={!!message}>
          <Box sx={{ mt: 2 }}>
            {message && (
              <Alert severity={message.startsWith("✅") ? "success" : "info"}>
                {message}
              </Alert>
            )}
          </Box>
        </Fade>
      </Paper>
    </Box>
  );
}
