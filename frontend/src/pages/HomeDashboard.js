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
  Alert,
  Fade
} from '@mui/material';
import Papa from 'papaparse';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

// --- validation helpers ---
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email) {
  return !!email && emailRegex.test(email);
}

// Generic international phone check
function validatePhone(phone) {
  if (!phone) return false;
  const normalized = String(phone).replace(/\s|-/g, '');
  if (!normalized.startsWith('+')) return false;
  const digits = normalized.slice(1);
  return /^\d{8,15}$/.test(digits);
}

// Resend component
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
      {message && (
        <Typography mt={1} color={message.startsWith("✅") ? "green" : "error.main"}>
          {message}
        </Typography>
      )}
    </Box>
  );
}

export default function HomeDashboard({ user }) {
  // --- Upload Learners ---
  const [learnersFile, setLearnersFile] = useState(null);
  const [uploadMsg, setUploadMsg] = useState("");
  const [learnerRows, setLearnerRows] = useState([]);
  const [showLearnerPreview, setShowLearnerPreview] = useState(false);

  // --- Upload Course Planner ---
  const [plannerFile, setPlannerFile] = useState(null);
  const [plannerMsg, setPlannerMsg] = useState("");
  const [plannerRows, setPlannerRows] = useState([]);
  const [showPlannerPreview, setShowPlannerPreview] = useState(false);

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

  // Fetch batches
  useEffect(() => {
    fetch(`${API_BASE}/api/batches`)
      .then(res => res.json())
      .then(data => setBatches(data))
      .catch(() => setMessage("❌ Failed to fetch batches"));
  }, []);

  // NEW: when selectedBatch changes, fetch planner meta from backend
  useEffect(() => {
    const fetchPlannerMeta = async () => {
      if (!selectedBatch) return;

      try {
        const res = await fetch(
          `${API_BASE}/api/course-planner-meta/${encodeURIComponent(selectedBatch)}`
        );
        const data = await res.json();

        if (!res.ok) {
          // No planner for this batch: clear related fields
          setMode("Online");
          setBatchType("");
          setClassRoom("");
          return;
        }

        if (data.mode) {
          setMode(data.mode); // "Online" or "Offline"
        }

        if (data.classroom_name) {
          setClassRoom(data.classroom_name);
        }

        if (data.mode && data.mode.toLowerCase() === "offline" && data.batch_type) {
          setBatchType(data.batch_type);
        } else if (data.mode && data.mode.toLowerCase() !== "offline") {
          setBatchType("");
        }
      } catch (err) {
        console.error("Error fetching planner meta:", err);
      }
    };

    fetchPlannerMeta();
  }, [selectedBatch]);

  // --- Upload Learners ---
  const handleUploadLearners = () => {
    setUploadMsg("");
    if (!learnersFile) {
      alert('Please choose CSV file');
      return;
    }

    Papa.parse(learnersFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const parsed = results.data.map((r, index) => {
          const row = {
            name: r.name || r.Name || r['Learner Name'] || '',
            email: r.email || r.Email || '',
            phone: r.phone || r.Phone || '',
            batch_no: r.batch_no || r.Batch || r.batch || '',
            status: r.status || r.Status || '',
            __rowIndex: index + 2,
          };

          const errors = [];
          if (!row.name) errors.push("Name required");
          if (!row.batch_no) errors.push("Batch no required");
          if (!validateEmail(row.email)) errors.push("Invalid email");
          if (!validatePhone(row.phone)) errors.push("Invalid phone");

          return { ...row, __errors: errors, __duplicate: null };
        });

        setLearnerRows(parsed);

        const validRows = parsed.filter(r => !r.__errors || r.__errors.length === 0);

        if (validRows.length === 0) {
          setUploadMsg("❌ All rows have validation errors; fix and reupload");
          return;
        }

        try {
          const res = await axios.post(`${API_BASE}/upload-learners`, { learners: validRows });
          const data = res.data || {};
          setUploadMsg(data.message || "✅ Uploaded successfully");

          const alreadyInDb = data.alreadyInDb || [];
          const inFileDuplicates = data.inFileDuplicates || [];

          const key = (l) =>
            `${(l.name || '').trim().toLowerCase()}|${(l.email || '').trim().toLowerCase()}|${(l.batch_no || '').trim()}`;

          const alreadySet = new Set(alreadyInDb.map(key));
          const inFileSet = new Set(inFileDuplicates.map(key));

          setLearnerRows(prev =>
            prev.map(r => {
              const k = key(r);
              if (alreadySet.has(k)) return { ...r, __duplicate: "Already in database" };
              if (inFileSet.has(k)) return { ...r, __duplicate: "Duplicate in file" };
              return r;
            })
          );
        } catch (err) {
          setUploadMsg('❌ Upload failed: ' + (err.response?.data?.error || err.message));
        }
      },
      error: (err) => setUploadMsg('CSV parse error: ' + err.message)
    });
  };

  // --- Course Planner: choose file (for upload + preview only) ---
  const handlePlannerFileChange = (e) => {
    const file = e.target.files[0];
    setPlannerFile(file);
    setPlannerMsg("");
    setPlannerRows([]);
    setShowPlannerPreview(false);
  };

  // --- Upload Course Planner using parsed rows ---
  const handleUploadPlanner = () => {
    if (!plannerFile) {
      alert("Please choose CSV file");
      return;
    }

    Papa.parse(plannerFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const json = results.data.map((r, index) => ({
          classroom_name: r.classroom_name || r.classroom || "",
          batch_no: r.batch_no || r.Batch || r.batch || "",
          domain: r.domain || "",
          mode: r.mode || "",
          week_no: r.week_no || r.week || "",
          date: r.date || r.Date || "",
          start_time: r.start_time || r["start time"] || r.StartTime || "",
          end_time: r.end_time || "",
          module_name: r.module_name || "",
          module_topic: r.module_topic || "",
          topic_name: r.topic_name || "",
          trainer_name: r.trainer_name || "",
          trainer_email: r.trainer_email || "",
          topic_status: r.topic_status || "",
          remarks: r.remarks || "",
          batch_type: r.batch_type || "",
          actual_date: r.actual_date || "",
          date_difference: r.date_difference || "",
          date_changed_by: r.date_changed_by || "",
          date_changed_at: r.date_changed_at || "",
          __rowIndex: index + 2,
        }));

        setPlannerRows(json);

        try {
          const res = await axios.post(
            `${API_BASE}/upload-course-planner`,
            {
              courses: json.map(({ __rowIndex, ...rest }) => rest)
            }
          );
          const data = res.data || {};
          if (data.alreadyPresent) {
            setPlannerMsg(`⚠️ Planner for ${data.batch_no} is already in database`);
          } else {
            setPlannerMsg(data.message || "✅ Uploaded successfully");
          }
        } catch (err) {
          setPlannerMsg("❌ Upload failed: " + (err.response?.data?.error || err.message));
        }
      },
      error: (err) => setPlannerMsg("CSV parse error: " + err.message),
    });
  };

  // --- Schedule Emails ---
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
        setMessage(
          `✅ Scheduled ${data.scheduled} emails and ${
            data.mock_interview_reminders_scheduled || 0
          } mock interview reminders for ${data.batch_no} (Start: ${data.start_date})`
        );
      }
    } catch (err) {
      setMessage(`❌ Network error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

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

  function getRoleTitle(role) {
    if (!role) return "Dashboard";
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
            <Box display="flex" gap={2}>
              <Button variant="contained" onClick={handleUploadLearners}>
                Upload
              </Button>
              <Button
                variant="outlined"
                onClick={() => setShowLearnerPreview(true)}
                disabled={learnerRows.length === 0}
              >
                View Uploaded List
              </Button>
            </Box>
            <Fade in={!!uploadMsg}>
              <Box mt={2}>
                {uploadMsg && (
                  <Alert severity={uploadMsg.startsWith("✅") ? "success" : "warning"}>
                    {uploadMsg}
                  </Alert>
                )}
              </Box>
            </Fade>

            {showLearnerPreview && learnerRows.length > 0 && (
              <Box mt={3} sx={{ maxHeight: 300, overflow: "auto" }}>
                <Typography variant="subtitle1" gutterBottom>
                  Uploaded Learners Preview
                </Typography>
                <Box component="table" sx={{ width: "100%", borderCollapse: "collapse" }}>
                  <Box component="thead" sx={{ bgcolor: "#f5f5f5" }}>
                    <Box component="tr">
                      {["Row", "Name", "Email", "Phone", "Batch No", "Status", "Errors", "Duplicate"].map(h => (
                        <Box
                          component="th"
                          key={h}
                          sx={{ border: "1px solid #ddd", p: 1, fontSize: 13 }}
                        >
                          {h}
                        </Box>
                      ))}
                    </Box>
                  </Box>
                  <Box component="tbody">
                    {learnerRows.map((row, idx) => {
                      const hasErrors = row.__errors && row.__errors.length > 0;
                      const isDup = !!row.__duplicate;
                      return (
                        <Box
                          key={idx}
                          component="tr"
                          sx={{
                            bgcolor: hasErrors
                              ? "#ffebee"
                              : isDup
                              ? "#fff3e0"
                              : "inherit",
                          }}
                        >
                          <Box component="td" sx={{ border: "1px solid #eee", p: 1, fontSize: 13 }}>
                            {row.__rowIndex}
                          </Box>
                          <Box component="td" sx={{ border: "1px solid #eee", p: 1, fontSize: 13 }}>
                            {row.name}
                          </Box>
                          <Box component="td" sx={{ border: "1px solid #eee", p: 1, fontSize: 13 }}>
                            {row.email}
                          </Box>
                          <Box component="td" sx={{ border: "1px solid #eee", p: 1, fontSize: 13 }}>
                            {row.phone}
                          </Box>
                          <Box component="td" sx={{ border: "1px solid #eee", p: 1, fontSize: 13 }}>
                            {row.batch_no}
                          </Box>
                          <Box component="td" sx={{ border: "1px solid #eee", p: 1, fontSize: 13 }}>
                            {row.status}
                          </Box>
                          <Box
                            component="td"
                            sx={{ border: "1px solid #eee", p: 1, fontSize: 13, color: "error.main" }}
                          >
                            {row.__errors?.join(", ")}
                          </Box>
                          <Box
                            component="td"
                            sx={{ border: "1px solid #eee", p: 1, fontSize: 13, color: "warning.main" }}
                          >
                            {row.__duplicate || ""}
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              </Box>
            )}
          </Paper>

          {/* ---- Upload Course Planner ---- */}
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h6" color="secondary" gutterBottom>
              Upload Course Planner
            </Typography>
            <TextField
              type="file"
              inputProps={{ accept: ".csv" }}
              onChange={handlePlannerFileChange}
              sx={{ mb: 2 }}
              fullWidth
            />
            <Box display="flex" gap={2}>
              <Button variant="contained" onClick={handleUploadPlanner}>
                Upload
              </Button>
              <Button
                variant="outlined"
                onClick={() => setShowPlannerPreview(true)}
                disabled={plannerRows.length === 0}
              >
                View Uploaded List
              </Button>
            </Box>
            <Fade in={!!plannerMsg}>
              <Box mt={2}>
                {plannerMsg && (
                  <Alert
                    severity={
                      plannerMsg.startsWith("✅")
                        ? "success"
                        : plannerMsg.startsWith("⚠️")
                        ? "warning"
                        : "error"
                    }
                  >
                    {plannerMsg}
                  </Alert>
                )}
              </Box>
            </Fade>

            {showPlannerPreview && plannerRows.length > 0 && (
              <Box mt={3} sx={{ maxHeight: 300, overflow: "auto" }}>
                <Typography variant="subtitle1" gutterBottom>
                  Uploaded Course Planner Preview
                </Typography>
                <Box component="table" sx={{ width: "100%", borderCollapse: "collapse" }}>
                  <Box component="thead" sx={{ bgcolor: "#f5f5f5" }}>
                    <Box component="tr">
                      {[
                        "Row",
                        "Classroom",
                        "Batch No",
                        "Mode",
                        "Week",
                        "Date",
                        "Start",
                        "End",
                        "Module",
                        "Topic",
                        "Trainer",
                      ].map((h) => (
                        <Box
                          key={h}
                          component="th"
                          sx={{ border: "1px solid #ddd", p: 1, fontSize: 13 }}
                        >
                          {h}
                        </Box>
                      ))}
                    </Box>
                  </Box>
                  <Box component="tbody">
                    {plannerRows.map((row, idx) => (
                      <Box key={idx} component="tr">
                        <Box component="td" sx={{ border: "1px solid #eee", p: 1, fontSize: 13 }}>
                          {row.__rowIndex}
                        </Box>
                        <Box component="td" sx={{ border: "1px solid #eee", p: 1, fontSize: 13 }}>
                          {row.classroom_name}
                        </Box>
                        <Box component="td" sx={{ border: "1px solid #eee", p: 1, fontSize: 13 }}>
                          {row.batch_no}
                        </Box>
                        <Box component="td" sx={{ border: "1px solid #eee", p: 1, fontSize: 13 }}>
                          {row.mode}
                        </Box>
                        <Box component="td" sx={{ border: "1px solid #eee", p: 1, fontSize: 13 }}>
                          {row.week_no}
                        </Box>
                        <Box component="td" sx={{ border: "1px solid #eee", p: 1, fontSize: 13 }}>
                          {row.date}
                        </Box>
                        <Box component="td" sx={{ border: "1px solid #eee", p: 1, fontSize: 13 }}>
                          {row.start_time}
                        </Box>
                        <Box component="td" sx={{ border: "1px solid #eee", p: 1, fontSize: 13 }}>
                          {row.end_time}
                        </Box>
                        <Box component="td" sx={{ border: "1px solid #eee", p: 1, fontSize: 13 }}>
                          {row.module_name}
                        </Box>
                        <Box component="td" sx={{ border: "1px solid #eee", p: 1, fontSize: 13 }}>
                          {row.topic_name}
                        </Box>
                        <Box component="td" sx={{ border: "1px solid #eee", p: 1, fontSize: 13 }}>
                          {row.trainer_name}
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Box>
            )}
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

          {/* Class Room Name */}
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
            <Button
              variant="contained"
              onClick={handleSchedule}
              disabled={loading}
              sx={{ flexGrow: 1, minWidth: 170 }}
            >
              {loading ? "Scheduling..." : "Schedule Emails"}
            </Button>
            <Button
              variant="outlined"
              onClick={handleUpdateOffsets}
              disabled={loading || !offsetValue}
              sx={{ flexGrow: 1, minWidth: 170 }}
            >
              {loading ? "Updating Offsets..." : "Update Template Offsets"}
            </Button>
          </Box>

          <ResendFailedEmails batchNo={selectedBatch} />

          <Fade in={!!message}>
            <Box mt={2}>
              {message && (
                <Alert severity={message.startsWith("✅") ? "success" : "warning"}>
                  {message}
                </Alert>
              )}
            </Box>
          </Fade>
        </Paper>
      </Paper>
    </Box>
  );
}
