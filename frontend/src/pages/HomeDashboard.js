import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  CircularProgress,
  Alert,
  Fade
} from '@mui/material';
import Papa from 'papaparse';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

// New component to resend failed emails for selected batch
function ResendFailedEmails({ batchNo }) {
  const [message, setMessage] = useState("");

  const handleResend = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/resend-failed-emails`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch_no: batchNo }),
      });
      const data = await res.json();
      if (res.ok) setMessage(data.message || "✅ Resent failed emails successfully");
      else setMessage("❌ Failed to resend: " + (data.error || "Unknown error"));
    } catch (err) {
      setMessage("❌ Error: " + err.message);
    }
  };

  return (
    <Box mt={3}>
      <Button variant="outlined" disabled={!batchNo} onClick={handleResend}>
        Resend Failed Emails
      </Button>
      {message && <Typography mt={1} color={message.startsWith("✅") ? "green" : "error.main"}>{message}</Typography>}
    </Box>
  );
}

export default function HomeDashboard({ user }) {
  // --- Upload Learners ---
  const [learnersFile, setLearnersFile] = useState(null);
  const [uploadMsg, setUploadMsg] = useState("");

  // --- Upload Course Planner ---
  const [plannerFile, setPlannerFile] = useState(null);
  const [plannerMsg, setPlannerMsg] = useState("");

  // --- Schedule Emails ---
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState("");
  const [mode, setMode] = useState("Online");
  const [batchType, setBatchType] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [offsetValue, setOffsetValue] = useState("");
  const [classRoom, setClassRoom] = useState("");
  const [mockInterviewOffset, setMockInterviewOffset] = useState("7");

  // Fetch batches on mount for ScheduleEmails dropdowns etc.
  useEffect(() => {
    fetch(`${API_BASE}/api/batches`)
      .then(res => res.json())
      .then(data => setBatches(data))
      .catch(() => setMessage("❌ Failed to fetch batches"));
  }, []);

  // --- Handler: Upload Learners ---
  const handleUploadLearners = () => {
    if (!learnersFile) return alert('Please choose CSV file');
    Papa.parse(learnersFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const json = results.data.map(r => ({
          name: r.name || r.Name || r['Learner Name'] || '',
          email: r.email || r.Email || '',
          phone: r.phone || r.Phone || '',
          batch_no: r.batch_no || r.Batch || r.batch || ''
        }));
        try {
          const res = await axios.post(`${API_BASE}/upload-learners`, { learners: json });
          setUploadMsg(res.data.message);
        } catch (err) {
          setUploadMsg('Upload failed: ' + (err.response?.data?.error || err.message));
        }
      },
      error: (err) => setUploadMsg('CSV parse error: ' + err.message)
    });
  };

  // --- Handler: Upload Course Planner ---
  const handleUploadPlanner = () => {
    if (!plannerFile) return alert('Please choose CSV file');
    Papa.parse(plannerFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const json = results.data.map(r => ({
          batch_no: r.batch_no || r.Batch || r.batch || '',
          domain: r.domain || '',
          mode: r.mode || '',
          week_no: r.week_no || r.week || '',
          date: r.date || r.Date || '',
          start_time: r.start_time || r['start time'] || r.StartTime || '',
          end_time: r.end_time || '',
          module_name: r.module_name || '',
          module_topic: r.module_topic || '',
          topic_name: r.topic_name || '',
          trainer_name: r.trainer_name || '',
          trainer_email: r.trainer_email || '',
          topic_status: r.topic_status || '',
          remarks: r.remarks || '',
          batch_type: r.batch_type || ''
        }));
        try {
          const res = await axios.post(`${API_BASE}/upload-course-planner`, { courses: json });
          setPlannerMsg(res.data.message);
        } catch (err) {
          setPlannerMsg('Upload failed: ' + (err.response?.data?.error || err.message));
        }
      },
      error: (err) => setPlannerMsg('CSV parse error: ' + err.message)
    });
  };

  // --- Handler: Schedule Emails ---
  const handleSchedule = async () => {
    if (!selectedBatch || !mode) {
      setMessage("⚠️ Please select batch and mode");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(`${API_BASE}/api/schedule-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batch_no: selectedBatch,
          mode,
          batch_type: mode === "Offline" ? batchType : null,
          class_room: classRoom,
          mock_interview_offset: Number(mockInterviewOffset) || 7,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(`❌ Failed: ${data.error || "Unknown error"}`);
      } else {
        setMessage(`✅ Scheduled ${data.scheduled} emails and ${data.mock_interview_reminders_scheduled || 0} mock interview reminders for ${data.batch_no} (Start: ${data.start_date})`);
      }
    } catch (err) {
      setMessage(`❌ Network error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // New function to update offsets in email_templates
  const handleUpdateOffsets = async () => {
    if (!selectedBatch || !mode || (mode === "Offline" && !batchType)) {
      setMessage("⚠️ Select batch, mode, and batch type (if offline) before updating offsets");
      return;
    }
    if (offsetValue === "" || isNaN(Number(offsetValue))) {
      setMessage("⚠️ Please enter a valid offset value (number)");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(`${API_BASE}/api/update-offsets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batch_no: selectedBatch,
          mode,
          batch_type: mode === "Offline" ? batchType : null,
          base_offset: Number(offsetValue),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(`❌ Offset update failed: ${data.error || "Unknown error"}`);
      } else {
        setMessage(`✅ Updated offset for ${data.updatedCount} templates successfully`);
      }
    } catch (err) {
      setMessage(`❌ Offset update error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // --- Get display role title (capitalizing first letter of each word) ---
  function getRoleTitle(role) {
    if (!role) return "Dashboard";
    // Split by space, capitalize each word, rejoin
    return role
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  const roleTitle = getRoleTitle(user?.role);
  const welcomeName = user?.name ? user.name : "User";

  return (
    <Box maxWidth={900} mx="auto" my={4}>
      <Paper elevation={4} sx={{ p: { xs: 2, sm: 4 }, mb: 5, borderRadius: 3 }}>
        <Typography variant="h4" color="primary" gutterBottom>
          {roleTitle} Dashboard
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" mb={2}>
          Welcome, {welcomeName}!
        </Typography>

        <Box display="grid" gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr' }} gap={5} mb={4}>
          {/* ---- Upload Learners ---- */}
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h6" color="secondary" gutterBottom>
              Upload Learners
            </Typography>
            <TextField
              type="file"
              inputProps={{ accept: ".csv" }}
              onChange={e => setLearnersFile(e.target.files[0])}
              sx={{ mb: 2 }}
              fullWidth
            />
            <Button variant="contained" onClick={handleUploadLearners}>
              Upload
            </Button>
            <Fade in={!!uploadMsg}>
              <Box mt={2}>
                {uploadMsg && <Alert severity={uploadMsg.startsWith("✅") ? "success" : "warning"}>{uploadMsg}</Alert>}
              </Box>
            </Fade>
          </Paper>

          {/* ---- Upload Course Planner ---- */}
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h6" color="secondary" gutterBottom>
              Upload Course Planner
            </Typography>
            <TextField
              type="file"
              inputProps={{ accept: ".csv" }}
              onChange={e => setPlannerFile(e.target.files[0])}
              sx={{ mb: 2 }}
              fullWidth
            />
            <Button variant="contained" onClick={handleUploadPlanner}>
              Upload
            </Button>
            <Fade in={!!plannerMsg}>
              <Box mt={2}>
                {plannerMsg && <Alert severity={plannerMsg.startsWith("✅") ? "success" : "warning"}>{plannerMsg}</Alert>}
              </Box>
            </Fade>
          </Paper>
        </Box>

        {/* ---- Schedule Emails ---- */}
        <Paper elevation={2} sx={{ p: 3 }}>
          <Typography variant="h6" color="secondary" gutterBottom>
            📧 Schedule Emails
          </Typography>
          {/* Batch Dropdown */}
          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel>Select Batch</InputLabel>
            <Select
              value={selectedBatch}
              label="Select Batch"
              onChange={e => setSelectedBatch(e.target.value)}
            >
              <MenuItem value="">-- Choose Batch --</MenuItem>
              {batches.map((b, i) => (
                <MenuItem key={i} value={b.batch_no}>
                  {b.batch_no} ({b.start_date})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {/* Mode Dropdown */}
          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel>Mode</InputLabel>
            <Select
              value={mode}
              label="Mode"
              onChange={e => setMode(e.target.value)}
            >
              <MenuItem value="Online">Online</MenuItem>
              <MenuItem value="Offline">Offline</MenuItem>
            </Select>
          </FormControl>
          {/* Batch Type Dropdown for offline */}
          {mode === "Offline" && (
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Batch Type</InputLabel>
              <Select
                value={batchType}
                label="Batch Type"
                onChange={e => setBatchType(e.target.value)}
              >
                <MenuItem value="">-- Choose Batch Type --</MenuItem>
                <MenuItem value="Morning Batch">Morning Batch</MenuItem>
                <MenuItem value="Afternoon Batch">Afternoon Batch</MenuItem>
              </Select>
            </FormControl>
          )}

          {/*Class Room Name*/}
          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel>Class Room Name</InputLabel>
            <Select
              value={classRoom}
              label="Class Room Name"
              onChange={e => setClassRoom(e.target.value)}
            >
              <MenuItem value="">-- Choose Class Room --</MenuItem>
              <MenuItem value="Ganga (5th Floor)">Ganga (5th Floor)</MenuItem>
              <MenuItem value="Kaveri (5th Floor)">Kaveri (5th Floor)</MenuItem>
              <MenuItem value="Yamuna (1st Floor)">Yamuna (1st Floor)</MenuItem>
            </Select>
          </FormControl>

          {/* Offset Input */}
          <TextField
            label="Offset Value (if there is any change in the start date of the course)"
            type="number"
            value={offsetValue}
            onChange={e => setOffsetValue(e.target.value)}
            fullWidth
            placeholder="Enter new base offset value (e.g. -2 for before start date)"
            sx={{ mb: 2 }}
          />

          {/* Buttons */}
          <Box mt={2} display="flex" gap={2} flexWrap="wrap">
            <Button variant="contained" onClick={handleSchedule} disabled={loading} sx={{ flexGrow: 1, minWidth: 170 }}>
              {loading ? "Scheduling..." : "Schedule Emails"}
            </Button>
            <Button variant="outlined" onClick={handleUpdateOffsets} disabled={loading || !offsetValue} sx={{ flexGrow: 1, minWidth: 170 }}>
              {loading ? "Updating Offsets..." : "Update Template Offsets"}
            </Button>
          </Box>

          <ResendFailedEmails batchNo={selectedBatch} />

          <Fade in={!!message}>
            <Box mt={2}>
              {message && <Alert severity={message.startsWith("✅") ? "success" : "warning"}>{message}</Alert>}
            </Box>
          </Fade>
        </Paper>
      </Paper>
    </Box>
  );
}
