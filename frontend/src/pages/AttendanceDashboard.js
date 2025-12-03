import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  Box,
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

  useEffect(() => {
    axios.get(`${API_BASE}/api/get_domains`).then(res => setDomains(res.data || []));
  }, []);

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
    axios.get(`${API_BASE}/api/get_batches_by_domain`, { params: { domain } }).then(res => setBatches(res.data || []));
  }, [domain]);

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
        
        // Remove dropout learners
        const filteredLearners = (learnersRes.data || []).filter(l => l.status !== "Dropout");
        setLearners(filteredLearners);

        // Get course dates from API response
        const { start_date, end_date } = datesRes.data || {};
        setCourseStartDate(start_date);
        setCourseEndDate(end_date);

        // Set today's date in YYYY-MM-DD format
        const today = new Date().toISOString().slice(0, 10);
        setTodayDate(today);

        // Check if today is within course duration
        if (!start_date || !end_date || today < start_date || today > end_date) {
          setMessage("⚠️ Today is outside the course duration");
          setAttendance({});
          setLoading(false);
          return;
        }

        // Fetch existing attendance for today only
        let serverAttendance = {};
        try {
          const attRes = await axios.get(`${API_BASE}/api/get_batch_attendance`, { params: { batch_no: batchNo } });
          serverAttendance = attRes.data || {};
        } catch (e) {}

        // Compose attendance state only for today
        const newAttendance = {};
        filteredLearners.forEach(learner => {
          newAttendance[learner.email] = {};
          // Only today's date
          newAttendance[learner.email][today] = {};
          for (let session = 1; session <= sessionsPerDay; session++) {
            // Check existing attendance for today
            let serverCell = undefined;
            if (serverAttendance[learner.email] && serverAttendance[learner.email][today] && serverAttendance[learner.email][today][session]) {
              serverCell = serverAttendance[learner.email][today][session];
            }
            if (serverCell) {
              newAttendance[learner.email][today][session] = {
                status: serverCell.status,
                locked: true
              };
            } else if (learner.status === "Disabled") {
              newAttendance[learner.email][today][session] = {
                status: "NA",
                locked: true
              };
            } else {
              newAttendance[learner.email][today][session] = {
                status: "",
                locked: false
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

  // Handler to mark Present, Absent, Leave per session
  function markAttendance(learnerEmail, session, status) {
    setAttendance(prev => ({
      ...prev,
      [learnerEmail]: {
        ...prev[learnerEmail],
        [todayDate]: {
          ...prev[learnerEmail]?.[todayDate],
          [session]: { status, locked: true }
        }
      }
    }));
  }

  async function saveAttendance() {
    setLoading(true);
    setMessage("");
    try {
      // Transform UI state to API format for today only: { learnerEmail: { todayDate: { session: status } } }
      const saveObj = {};
      Object.keys(attendance).forEach(email => {
        saveObj[email] = {};
        saveObj[email][todayDate] = {};
        for (let session = 1; session <= sessionsPerDay; session++) {
          saveObj[email][todayDate][session] = attendance[email][todayDate][session]?.status || "";
        }
      });

      // Send attendance data along with batch info for percentage calculation
      await axios.post(
        `${API_BASE}/api/save_attendance_ui`,
        { 
          batch_no: batchNo, 
          attendance: saveObj,
          course_start_date: courseStartDate,
          course_end_date: courseEndDate
        },
        { headers: authHeaders() }
      );
      setMessage("✅ Today's attendance saved successfully");
    } catch (err) {
      setMessage("❌ Failed to save attendance");
      console.error(err);
    }
    setLoading(false);
  }

  // Render attendance cell per session for today only
  function renderSessionCell(learner, session) {
    const cell = attendance[learner.email]?.[todayDate]?.[session] || { status: "", locked: false };
    if (cell.locked) {
      if (cell.status === "P") return <Chip label="P" color="success" size="small" />;
      if (cell.status === "A") return <Chip label="A" color="error" size="small" />;
      if (cell.status === "L") return <Chip label="L" color="warning" size="small" />;
      if (cell.status === "NA") return <Chip label="NA" color="default" size="small" />;
      return <Chip label="-" size="small" />;
    }
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, p: 0.5 }}>
        <Button
          onClick={() => markAttendance(learner.email, session, "P")}
          size="small"
          color="success"
          variant="outlined"
          sx={{ minWidth: 28, fontSize: '0.7rem' }}
        >
          P
        </Button>
        <Button
          onClick={() => markAttendance(learner.email, session, "A")}
          size="small"
          color="error"
          variant="outlined"
          sx={{ minWidth: 28, fontSize: '0.7rem' }}
        >
          A
        </Button>
        <Button
          onClick={() => markAttendance(learner.email, session, "L")}
          size="small"
          color="warning"
          variant="outlined"
          sx={{ minWidth: 28, fontSize: '0.7rem' }}
        >
          L
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1400, mx: "auto", my: 4, px: 2 }}>
      <Typography variant="h4" gutterBottom>
        Attendance Dashboard - Today ({todayDate})
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Course: {courseStartDate} to {courseEndDate} | Marking attendance for today only
      </Typography>
      
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth>
            <InputLabel>Domain</InputLabel>
            <Select value={domain} onChange={e => setDomain(e.target.value)} label="Domain">
              {domains.map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth disabled={!domain}>
            <InputLabel>Batch No</InputLabel>
            <Select value={batchNo} onChange={e => setBatchNo(e.target.value)} label="Batch No">
              {batches.map((b) => <MenuItem key={b} value={b}>{b}</MenuItem>)}
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      {loading && <CircularProgress />}
      
      {learners.length > 0 && todayDate && courseStartDate && courseEndDate && (
        <>
          <Table size="small" sx={{ overflowX: "auto", display: "block", mb: 2 }}>
            <TableHead>
              <TableRow>
                <TableCell>Sr No</TableCell>
                <TableCell>Learner Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell align="center" colSpan={sessionsPerDay}>
                  Today ({todayDate})
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell />
                <TableCell />
                <TableCell />
                {Array.from({ length: sessionsPerDay }, (_, i) => (
                  <TableCell key={`session_${i + 1}`} align="center">
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
                  <TableCell sx={{ maxWidth: 200, wordBreak: 'break-all' }}>{learner.email}</TableCell>
                  {Array.from({ length: sessionsPerDay }, (_, i) =>
                    <TableCell key={`cell_${learner.email}_session_${i + 1}`} align="center">
                      {renderSessionCell(learner, i + 1)}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}

      <Button 
        variant="contained" 
        onClick={saveAttendance} 
        disabled={loading || !todayDate || learners.length === 0}
        sx={{ mt: 2 }}
      >
        {loading ? "Saving..." : "Save Today's Attendance"}
      </Button>
      {message && <Alert sx={{ mt: 2 }}>{message}</Alert>}
    </Box>
  );
}
