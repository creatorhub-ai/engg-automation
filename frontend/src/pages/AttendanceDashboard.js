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

const API_BASE = process.env.API_BASE || "http://localhost:5000";
const sessionsPerDay = 3;

export default function AttendanceDashboard({ token }) {
  const [domains, setDomains] = useState([]);
  const [domain, setDomain] = useState("");
  const [batches, setBatches] = useState([]);
  const [batchNo, setBatchNo] = useState("");
  const [learners, setLearners] = useState([]);
  const [dates, setDates] = useState([]);
  // attendance[learnerEmail][date][session] = { status: "", locked: false }
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
      setDates([]);
      setAttendance({});
      return;
    }
    axios.get(`${API_BASE}/api/get_batches_by_domain`, { params: { domain } }).then(res => setBatches(res.data || []));
  }, [domain]);

  useEffect(() => {
    if (!batchNo) {
      setLearners([]);
      setDates([]);
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

        // Generate date list
        const { start_date, end_date } = datesRes.data || {};
        const dateList = generateDateRange(start_date, end_date);
        setDates(dateList);

        // Fetch existing attendance for batch
        let serverAttendance = {};
        try {
          const attRes = await axios.get(`${API_BASE}/api/get_batch_attendance`, { params: { batch_no: batchNo } });
          serverAttendance = attRes.data || {};
        } catch (e) {}

        // Compose initial attendance state:
        const newAttendance = {};
        filteredLearners.forEach(learner => {
          newAttendance[learner.email] = {};
          dateList.forEach(date => {
            newAttendance[learner.email][date] = {};
            for (let session = 1; session <= sessionsPerDay; session++) {
              // Existing?
              let serverCell = undefined;
              if (serverAttendance[learner.email] && serverAttendance[learner.email][date] && serverAttendance[learner.email][date][session]) {
                serverCell = serverAttendance[learner.email][date][session];
              }
              if (serverCell) {
                newAttendance[learner.email][date][session] = {
                  status: serverCell.status,
                  locked: true
                };
              } else if (learner.status === "Disabled") {
                newAttendance[learner.email][date][session] = {
                  status: "NA",
                  locked: true
                };
              } else {
                newAttendance[learner.email][date][session] = {
                  status: "",
                  locked: false
                };
              }
            }
          });
        });
        setAttendance(newAttendance);
        setMessage("");
      } catch (e) {
        setMessage("Failed to load batch data");
        setLearners([]);
        setDates([]);
        setAttendance({});
      }
      setLoading(false);
    }
    fetchBatchDetails();
  }, [batchNo]);

  function generateDateRange(start, end) {
    const result = [];
    const startDate = new Date(start), endDate = new Date(end);
    for (let dt = new Date(startDate); dt <= endDate; dt.setDate(dt.getDate() + 1)) {
      result.push(dt.toISOString().slice(0, 10));
    }
    return result;
  }

  // Handler to mark Present, Absent, NA per session
  function markAttendance(learnerEmail, date, session, status) {
    setAttendance(prev => ({
      ...prev,
      [learnerEmail]: {
        ...prev[learnerEmail],
        [date]: {
          ...prev[learnerEmail][date],
          [session]: { status, locked: true }
        }
      }
    }));
  }

  async function saveAttendance() {
    setLoading(true);
    setMessage("");
    try {
      // Transform UI state to API format: { learnerEmail: { date: { session: status } } }
      const saveObj = {};
      Object.keys(attendance).forEach(email => {
        saveObj[email] = {};
        Object.keys(attendance[email]).forEach(date => {
          saveObj[email][date] = {};
          for (let session = 1; session <= sessionsPerDay; session++) {
            saveObj[email][date][session] = attendance[email][date][session]?.status || "";
          }
        });
      });
      await axios.post(
        `${API_BASE}/api/save_attendance_ui`,
        { batch_no: batchNo, attendance: saveObj },
        { headers: authHeaders() }
      );
      setMessage("✅ Attendance saved successfully");
    } catch (err) {
      setMessage("❌ Failed to save attendance");
      console.error(err);
    }
    setLoading(false);
  }

  // Render attendance cell per session
  function renderSessionCell(learner, date, session) {
    const cell = attendance[learner.email]?.[date]?.[session] || { status: "", locked: false };
    if (cell.locked) {
      if (cell.status === "P") return <Chip label="P" color="success" size="small" />;
      if (cell.status === "A") return <Chip label="A" color="error" size="small" />;
      if (cell.status === "NA") return <Chip label="NA" color="warning" size="small" />;
      return <Chip label="-" size="small" />;
    }
    return (
      <Box sx={{ display: "flex", gap: 1 }}>
        <Button
          onClick={() => markAttendance(learner.email, date, session, "P")}
          size="small"
          color="success"
          variant="outlined"
        >
          P
        </Button>
        <Button
          onClick={() => markAttendance(learner.email, date, session, "A")}
          size="small"
          color="error"
          variant="outlined"
        >
          A
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1400, mx: "auto", my: 4, px: 2 }}>
      <Typography variant="h4" gutterBottom>
        Attendance Dashboard
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
      {learners.length > 0 && dates.length > 0 && (
        <Table size="small" sx={{ overflowX: "auto", display: "block" }}>
          <TableHead>
            <TableRow>
              <TableCell>Sr No</TableCell>
              <TableCell>Learner Name</TableCell>
              <TableCell>Email</TableCell>
              {dates.map(date => (
                <TableCell key={date} align="center" colSpan={sessionsPerDay}>
                  {date}
                </TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell />
              <TableCell />
              <TableCell />
              {dates.flatMap(date =>
                Array.from({ length: sessionsPerDay }, (_, i) => (
                  <TableCell key={date + "_session" + (i + 1)} align="center">
                    S{i + 1}
                  </TableCell>
                ))
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {learners.map((learner, idx) => (
              <TableRow key={learner.email}>
                <TableCell>{idx + 1}</TableCell>
                <TableCell>{learner.name}</TableCell>
                <TableCell>{learner.email}</TableCell>
                {dates.flatMap(date =>
                  Array.from({ length: sessionsPerDay }, (_, i) =>
                    <TableCell key={learner.email + "_session" + (i + 1) + "_" + date} align="center">
                      {renderSessionCell(learner, date, i + 1)}
                    </TableCell>
                  )
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <Button variant="contained" onClick={saveAttendance} disabled={loading} sx={{ mt: 2 }}>
        {loading ? "Saving..." : "Save Attendance"}
      </Button>
      {message && <Alert sx={{ mt: 2 }}>{message}</Alert>}
    </Box>
  );
}
