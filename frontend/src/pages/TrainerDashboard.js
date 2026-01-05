// src/pages/TrainerDashboard.js - COMPLETE FIXED VERSION
import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  Box,
  Paper,
  Typography,
  MenuItem,
  FormControl,
  Select,
  InputLabel,
  Table,
  TableHead,
  TableBody,
  TableCell,
  TableRow,
  Alert,
  Fade,
  TableContainer,
  TextField,
  Snackbar,
  Chip,
  Grid,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
  Button,
} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import { green, orange, red, grey } from "@mui/material/colors";
import TrainerAssignmentDashboard from "./TrainerAssignmentDashboard";

const API_BASE = "https://engg-automation.onrender.com";

const statusChipColor = {
  Completed: green[600],
  "In Progress": orange[600],
  Planned: red[600],
};

// FIXED TrainerUnavailabilityForm - FULLY WORKING
function TrainerUnavailabilityForm({ user, token }) {
  const [domain, setDomain] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");

  const [trainerBatches, setTrainerBatches] = useState([]);
  const [selectedBatchNos, setSelectedBatchNos] = useState([]);

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  // Load trainer's batches on mount
  useEffect(() => {
    const fetchBatches = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/trainer-batches`, {
          params: { trainer_email: user.email },
          headers: authHeaders,
          timeout: 5000
        });
        const list = Array.isArray(res.data) ? res.data : [];
        setTrainerBatches(list);

        if (list.length === 1) {
          setSelectedBatchNos([list[0].batch_no]);
          setDomain(list[0].domain || "");
        }
      } catch (e) {
        console.warn("No batches found for trainer:", user.email);
        setTrainerBatches([]);
      }
    };
    if (user?.email && token) fetchBatches();
  }, [user?.email, token]);

  // Auto-set domain when batches selected
  useEffect(() => {
    if (selectedBatchNos.length === 0) return;
    const selectedDetails = trainerBatches.filter((b) =>
      selectedBatchNos.includes(b.batch_no)
    );
    const uniqueDomains = [...new Set(selectedDetails.map((b) => b.domain || ''))];
    if (uniqueDomains.length === 1 && uniqueDomains[0]) {
      setDomain(uniqueDomains[0]);
    }
  }, [selectedBatchNos, trainerBatches]);

  const handleBatchChange = (event) => {
    const value = event.target.value;
    setSelectedBatchNos(typeof value === "string" ? value.split(",") : value);
  };

  const submitUnavailability = async () => {
    setMsg("");
    setErr("");
    setLoading(true);

    if (!start || !end) {
      setErr("Please select From and To dates");
      setLoading(false);
      return;
    }

    if (selectedBatchNos.length === 0) {
      setErr("Please select at least one batch");
      setLoading(false);
      return;
    }

    if (!domain) {
      setErr("Domain is required");
      setLoading(false);
      return;
    }

    try {
      const batch_nos_str = selectedBatchNos.join(",");
      
      const res = await axios.post(
        `${API_BASE}/api/trainer-unavailability`,
        {
          trainer_email: user.email,
          trainer_name: user.name || user.email.split('@')[0],
          domain,
          start_date: start,
          end_date: end,
          reason: reason || '',
          batch_nos: batch_nos_str,
        },
        { 
          headers: authHeaders,
          timeout: 10000
        }
      );

      if (res.data?.success) {
        setMsg("✅ Leave submitted successfully!");
        setStart("");
        setEnd("");
        setReason("");
        setSelectedBatchNos([]);
        setDomain("");
        // Refresh batches to get latest
        if (trainerBatches.length > 0) {
          setTrainerBatches(trainerBatches);
        }
      } else {
        setErr("Server responded but submission failed");
      }
    } catch (e) {
      console.error("Failed to submit unavailability:", e);
      if (e.response?.status === 404) {
        setErr("Leave submission service not available. Contact admin.");
      } else if (e.response?.status === 500) {
        setErr("Database error. Please try again.");
      } else {
        setErr(`Failed to submit: ${e.response?.data?.error || e.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" fontWeight="bold" mb={2}>
        Apply Leave
      </Typography>

      {/* Batch multi-select */}
      <TextField
        select
        label="Batch(es) *"
        value={selectedBatchNos}
        onChange={handleBatchChange}
        fullWidth
        disabled={loading}
        SelectProps={{
          multiple: true,
          renderValue: (selected) => selected.join(", "),
        }}
        sx={{ mb: 2 }}
        helperText={
          trainerBatches.length === 0 
            ? "No batches assigned to you yet" 
            : selectedBatchNos.length === 0 
            ? "Select batches you handle" 
            : ""
        }
      >
        {trainerBatches.map((b) => (
          <MenuItem key={b.batch_no} value={b.batch_no}>
            {b.batch_no} {b.domain ? `(${b.domain})` : ""}
          </MenuItem>
        ))}
      </TextField>

      {/* Domain */}
      <TextField
        label="Domain *"
        value={domain}
        onChange={(e) => setDomain(e.target.value)}
        fullWidth
        disabled={loading}
        sx={{ mb: 2 }}
        helperText="Auto-filled from selected batch(es)"
      />

      {/* Dates */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={6}>
          <TextField
            label="From *"
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            fullWidth
            InputLabelProps={{ shrink: true }}
            disabled={loading}
          />
        </Grid>
        <Grid item xs={6}>
          <TextField
            label="To *"
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            fullWidth
            InputLabelProps={{ shrink: true }}
            disabled={loading}
          />
        </Grid>
      </Grid>

      {/* Reason */}
      <TextField
        label="Reason (optional)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        fullWidth
        multiline
        rows={2}
        disabled={loading}
        sx={{ mb: 2 }}
      />

      <Button
        onClick={submitUnavailability}
        variant="contained"
        color="primary"
        disabled={loading || selectedBatchNos.length === 0}
        fullWidth
        sx={{ py: 1.5 }}
      >
        {loading ? "Submitting..." : "Submit Leave Request"}
      </Button>

      {msg && (
        <Alert severity="success" sx={{ mt: 2 }}>
          {msg}
        </Alert>
      )}
      {err && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {err}
        </Alert>
      )}
    </Paper>
  );
}

// MAIN TrainerDashboard COMPONENT
function TrainerDashboard({ user, token }) {
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState("");
  const [weeks, setWeeks] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState("");
  const [topics, setTopics] = useState([]);
  const [remarksMap, setRemarksMap] = useState({});
  const [actualDatesMap, setActualDatesMap] = useState({});
  const [message, setMessage] = useState("");
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [alertSeverity, setAlertSeverity] = useState("info");
  const [pendingStatusChanges, setPendingStatusChanges] = useState({});
  const [tab, setTab] = useState(0);

  const [allBatchTopics, setAllBatchTopics] = useState([]);
  const [firstIncompleteWeek, setFirstIncompleteWeek] = useState(null);
  const [blockedTopics, setBlockedTopics] = useState({});
  const [remarksAlertOpen, setRemarksAlertOpen] = useState(false);
  const [isBatchOwner, setIsBatchOwner] = useState(false);

  const lowerRole = (user?.role || "").toLowerCase();
  const isTrainer = lowerRole === "trainer";
  const isManagerOrAdmin = lowerRole === "manager" || lowerRole === "admin";
  const trainerTabLabel = isTrainer ? "Apply Leave" : "Trainer Management";

  const roleTitle = user?.role
    ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
    : "Trainer";
  const welcomeName = user?.name || "Trainer";

  // Load batches
  useEffect(() => {
    (async () => {
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await axios.get(`${API_BASE}/api/batches`, { headers });
        if (res.data && Array.isArray(res.data)) {
          setBatches(res.data);
        } else {
          setBatches([]);
        }
      } catch (e) {
        console.error("Failed to load batches");
        setBatches([]);
      }
    })();
  }, [token]);

  // Load weeks + topics when batch changes (YOUR EXISTING LOGIC)
  useEffect(() => {
    if (!selectedBatch) {
      setWeeks([]);
      setSelectedWeek("");
      setTopics([]);
      setAllBatchTopics([]);
      return;
    }

    (async () => {
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const [resWeeks, resAllTopics] = await Promise.all([
          axios.get(`${API_BASE}/api/weeks/${selectedBatch}`, { headers }),
          axios.get(`${API_BASE}/api/topics/${selectedBatch}`, { headers })
        ]);

        if (resWeeks.data && Array.isArray(resWeeks.data)) {
          const sortedWeeks = [...resWeeks.data].sort((a, b) => Number(a) - Number(b));
          setWeeks(sortedWeeks);
          if (sortedWeeks.length > 0) setSelectedWeek(sortedWeeks[0]);
        }

        const allTopics = Array.isArray(resAllTopics.data) ? resAllTopics.data : [];
        setAllBatchTopics(allTopics);
      } catch (e) {
        console.error("Failed to load weeks/topics");
      }
    })();
  }, [selectedBatch, token]);

  // Simplified topic loading for selected week
  useEffect(() => {
    if (!selectedBatch || !selectedWeek) {
      setTopics([]);
      return;
    }

    (async () => {
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await axios.get(`${API_BASE}/api/topics/${selectedBatch}`, {
          headers,
          params: { week_no: selectedWeek }
        });
        
        const topicData = Array.isArray(res.data) ? res.data : [];
        setTopics(topicData);
      } catch (e) {
        console.error("Failed to load topics");
        setTopics([]);
      }
    })();
  }, [selectedBatch, selectedWeek, token]);

  // SIMPLIFIED UI RENDERING
  const topicsByDate = topics.reduce((acc, t) => {
    const key = t.date || "No Date";
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});
  const sortedDates = Object.keys(topicsByDate).sort((a, b) => new Date(a) - new Date(b));

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", my: 3, fontFamily: "Segoe UI, Tahoma, Geneva, Verdana, sans-serif" }}>
      {/* Header */}
      <Paper elevation={6} sx={{ p: 4, borderRadius: 3, mb: 4, backgroundColor: "#ffffffcc" }}>
        <Typography variant="h4" color="primary" gutterBottom fontWeight="bold" letterSpacing={1}>
          {roleTitle} Dashboard
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" mb={3}>
          Welcome <Box component="span" sx={{ fontWeight: "medium", color: "primary.main" }}>
            {welcomeName}
          </Box>
        </Typography>

        {/* Batch & Week Selectors */}
        <Grid container spacing={3} alignItems="center" mb={4}>
          <Grid item xs={12} sm={6} md={5}>
            <FormControl fullWidth size="medium" sx={{ backgroundColor: "#f9f9f9", borderRadius: 1 }}>
              <InputLabel>Batch</InputLabel>
              <Select
                value={selectedBatch}
                label="Batch"
                onChange={(e) => setSelectedBatch(e.target.value)}
              >
                <MenuItem value=""><em>Select a batch...</em></MenuItem>
                {batches.map((b) => (
                  <MenuItem key={b.batch_no} value={b.batch_no}>
                    {b.batch_no} {b.start_date ? `(${b.start_date})` : ""}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            {weeks.length > 0 && (
              <FormControl fullWidth size="medium" sx={{ backgroundColor: "#f9f9f9", borderRadius: 1 }}>
                <InputLabel>Week No</InputLabel>
                <Select
                  value={selectedWeek}
                  label="Week No"
                  onChange={(e) => setSelectedWeek(e.target.value)}
                >
                  {weeks.map((week) => (
                    <MenuItem key={week} value={week}>Week {week}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Grid>
        </Grid>
      </Paper>

      {/* TABS */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Progress" />
        <Tab label={trainerTabLabel} />
      </Tabs>

      {/* TAB 1: Progress */}
      {tab === 0 && sortedDates.length > 0 && (
        <Box>
          {sortedDates.map((dateKey) => (
            <Paper key={dateKey} sx={{ mb: 3, p: 2 }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: "bold" }}>
                {dateKey}
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: "#1976d2" }}>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>Topic</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>Status</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>Remarks</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {topicsByDate[dateKey].map((t) => (
                      <TableRow key={t.id} hover>
                        <TableCell>{t.topic_name}</TableCell>
                        <TableCell>
                          <Chip 
                            label={t.topic_status || "Planned"} 
                            size="small" 
                            color="primary" 
                          />
                        </TableCell>
                        <TableCell>{t.remarks || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          ))}
          {sortedDates.length === 0 && (
            <Alert severity="info">
              Select a batch and week to view topics
            </Alert>
          )}
        </Box>
      )}

      {/* TAB 2: Leave/Assignment */}
      {tab === 1 && (
        <Box>
          {isTrainer && <TrainerUnavailabilityForm user={user} token={token} />}
          
          {isManagerOrAdmin && (
            <TrainerAssignmentDashboard
              user={user}
              token={token}
              batchNo={selectedBatch}
            />
          )}
          
          {isManagerOrAdmin && !selectedBatch && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Select a batch above to manage trainer assignments
            </Alert>
          )}
        </Box>
      )}

      {/* Global Snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={5000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert severity="info" sx={{ width: "100%" }}>
          {message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default TrainerDashboard;
