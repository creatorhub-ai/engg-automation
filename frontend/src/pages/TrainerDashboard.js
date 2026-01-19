import React, { useEffect, useState, useCallback } from "react";
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
  CircularProgress,
} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import { green, orange, red, grey } from "@mui/material/colors";
import ManagerLeaveDashboard from "./ManagerLeaveDashboard";
import TrainerAssignmentDashboard from "./TrainerAssignmentDashboard";

const API_BASE = process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

const statusChipColor = {
  Completed: green[600],
  "In Progress": orange[600],
  Planned: red[600],
};

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
  const [submitting, setSubmitting] = useState(false);

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  const fetchBatches = useCallback(async () => {
    if (!user?.email) return;
    
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}/api/trainer-batches`, {
        params: { trainer_email: user.email },
        headers: authHeaders,
        timeout: 10000,
      });
      
      const list = Array.isArray(res.data) ? res.data : [];
      setTrainerBatches(list);

      if (list.length === 1) {
        setSelectedBatchNos([list[0].batch_no || list[0].batchno]);
        setDomain(list[0].domain || "");
      }
    } catch (e) {
      console.error("Error loading trainer batches:", e);
      setErr("Failed to load batches. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, [user?.email, token]);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  useEffect(() => {
    if (selectedBatchNos.length === 0) return;

    const selectedDetails = trainerBatches.filter((b) => {
      const bn = b.batch_no || b.batchno;
      return selectedBatchNos.includes(bn);
    });

    const uniqueDomains = Array.from(
      new Set(selectedDetails.map((b) => b.domain || ""))
    );

    if (uniqueDomains.length === 1) setDomain(uniqueDomains[0]);
  }, [selectedBatchNos, trainerBatches]);

  const handleBatchChange = (event) => {
    const value = event.target.value;
    setSelectedBatchNos(typeof value === "string" ? value.split(",") : value);
  };

  const submitUnavailability = async () => {
    setMsg("");
    setErr("");
    setSubmitting(true);

    if (!start || !end) {
      setErr("Please select From and To dates");
      setSubmitting(false);
      return;
    }

    if (new Date(start) > new Date(end)) {
      setErr("End date must be after start date");
      setSubmitting(false);
      return;
    }

    if (selectedBatchNos.length === 0) {
      setErr("Please select at least one batch");
      setSubmitting(false);
      return;
    }

    if (!domain) {
      setErr("Domain is required");
      setSubmitting(false);
      return;
    }

    try {
      const batch_nos_str = selectedBatchNos.join(",");
      
      const response = await axios.post(
        `${API_BASE}/api/trainer-leaves`,
        {
          trainer_email: user?.email,
          trainer_name: user?.name,
          domain,
          start_date: start,
          end_date: end,
          reason,
          batch_nos: batch_nos_str,
        },
        { 
          headers: authHeaders,
          timeout: 10000,
        }
      );

      if (response.data.success) {
        setMsg("✅ Leave request submitted successfully!");
        setStart("");
        setEnd("");
        setReason("");
        setSelectedBatchNos([]);
        setDomain("");
        fetchBatches();
      }
    } catch (e) {
      console.error("Submit failed:", e);
      
      if (e.response?.status === 404) {
        setErr("🚫 API not found. Backend needs /api/trainer-leaves endpoint.");
      } else if (e.response?.status === 400) {
        setErr(`Validation error: ${e.response.data.error}`);
      } else if (e.code === 'ECONNABORTED') {
        setErr("⏰ Request timeout. Please try again.");
      } else {
        setErr(`Failed: ${e.response?.data?.error || e.message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" fontWeight="bold" mb={2}>
        📅 Apply Leave
      </Typography>

      {loading && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 2 }}>
          <CircularProgress size={20} />
          <Typography variant="body2">Loading your batches...</Typography>
        </Box>
      )}

      <TextField
        select
        label="Select Batch(es)"
        value={selectedBatchNos}
        onChange={handleBatchChange}
        fullWidth
        disabled={loading || submitting}
        SelectProps={{
          multiple: true,
          renderValue: (selected) => 
            selected.length > 0 ? selected.join(", ") : "No batch selected",
        }}
        sx={{ mb: 2 }}
        helperText={selectedBatchNos.length === 0 ? "Select batches you want to apply leave for" : ""}
      >
        {trainerBatches.map((b) => {
          const bn = b.batch_no || b.batchno;
          return (
            <MenuItem key={bn} value={bn}>
              {bn} {b.domain ? `(${b.domain})` : ""}
            </MenuItem>
          );
        })}
        {trainerBatches.length === 0 && !loading && (
          <MenuItem disabled>No batches found</MenuItem>
        )}
      </TextField>

      <TextField
        label="Domain *"
        value={domain}
        onChange={(e) => setDomain(e.target.value)}
        fullWidth
        disabled={loading || submitting}
        required
        error={!domain && selectedBatchNos.length > 0}
        helperText={!domain && selectedBatchNos.length > 0 ? "Domain is required" : ""}
        sx={{ mb: 2 }}
      />

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6}>
          <TextField
            label="From Date *"
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            fullWidth
            InputLabelProps={{ shrink: true }}
            disabled={loading || submitting}
            required
            error={!start}
            helperText={!start ? "Required" : ""}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="To Date *"
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            fullWidth
            InputLabelProps={{ shrink: true }}
            disabled={loading || submitting}
            required
            error={!end || (start && new Date(start) > new Date(end))}
            helperText={!end ? "Required" : (start && new Date(start) > new Date(end)) ? "End date must be after start date" : ""}
          />
        </Grid>
      </Grid>

      <TextField
        label="Reason (Optional)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        fullWidth
        multiline
        rows={2}
        disabled={loading || submitting}
        sx={{ mb: 2 }}
      />

      <Button 
        onClick={submitUnavailability} 
        variant="contained" 
        color="primary"
        disabled={loading || submitting || selectedBatchNos.length === 0}
        startIcon={submitting ? <CircularProgress size={20} /> : null}
        fullWidth
        sx={{ py: 1.5, fontWeight: 600 }}
      >
        {submitting ? "Submitting..." : "Submit Leave Request"}
      </Button>

      {msg && (
        <Alert severity="success" sx={{ mt: 2 }} onClose={() => setMsg("")}>
          {msg}
        </Alert>
      )}
      {err && (
        <Alert severity="error" sx={{ mt: 2 }} onClose={() => setErr("")}>
          {err}
        </Alert>
      )}
    </Paper>
  );
}

function TrainerDashboard({ user, token }) {
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState("");
  const [weeks, setWeeks] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState("");
  const [topics, setTopics] = useState([]);
  const [remarksMap, setRemarksMap] = useState({});
  const [actualDatesMap, setActualDatesMap] = useState({});
  const [message, setMessage] = useState("");
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarSeverity, setSnackbarSeverity] = useState("info");
  const [remarksSnackbarOpen, setRemarksSnackbarOpen] = useState(false);
  const [remarksSnackbarMessage, setRemarksSnackbarMessage] = useState("");
  const [remarksSnackbarSeverity, setRemarksSnackbarSeverity] = useState("warning");
  const [pendingStatusChanges, setPendingStatusChanges] = useState({});
  const [tab, setTab] = useState(0);
  const [allBatchTopics, setAllBatchTopics] = useState([]);
  const [firstIncompleteWeek, setFirstIncompleteWeek] = useState(null);
  const [blockedTopics, setBlockedTopics] = useState({});
  const [isBatchOwner, setIsBatchOwner] = useState(false);
  // NEW: Track pending actual date saves
  const [pendingDateSaves, setPendingDateSaves] = useState({});

  const lowerRole = (user?.role || "").toLowerCase();
  const isTrainer = lowerRole === "trainer";
  const isManagerOrAdmin = lowerRole === "manager" || lowerRole === "admin";
  const trainerTabLabel = isTrainer ? "Apply Leave" : "Trainer Management";

  const roleTitle = user?.role
    ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
    : "Trainer";
  const welcomeName = user?.name || "Trainer";

  const showSnackbar = (msg, severity = "info") => {
    setSnackbarMessage(msg || "");
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const showRemarksSnackbar = (msg, severity = "warning") => {
    setRemarksSnackbarMessage(msg || "");
    setRemarksSnackbarSeverity(severity);
    setRemarksSnackbarOpen(true);
  };

  // NEW: Debounced save function for actual dates
  const debounceSave = useCallback((func, wait) => {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await axios.get(`${API_BASE}/api/batches`, { headers });
        if (Array.isArray(res.data)) setBatches(res.data);
        else {
          setBatches([]);
          setMessage("No batches found");
        }
      } catch {
        setMessage("Error loading batches");
      }
    })();
  }, [token]);

  useEffect(() => {
    if (!selectedBatch) {
      setWeeks([]);
      setSelectedWeek("");
      setTopics([]);
      setAllBatchTopics([]);
      setFirstIncompleteWeek(null);
      setBlockedTopics({});
      return;
    }

    (async () => {
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const resWeeks = await axios.get(
          `${API_BASE}/api/weeks/${selectedBatch}`,
          { headers }
        );

        if (Array.isArray(resWeeks.data) && resWeeks.data.length > 0) {
          const sortedWeeks = [...resWeeks.data].sort(
            (a, b) => Number(a) - Number(b)
          );
          setWeeks(sortedWeeks);
          setSelectedWeek(sortedWeeks[0]);
        } else {
          setWeeks([]);
          setSelectedWeek("");
          setTopics([]);
          setMessage("No weeks found for selected batch");
        }

        const resAllTopics = await axios.get(
          `${API_BASE}/api/topics/${selectedBatch}`,
          { headers }
        );

        const all = Array.isArray(resAllTopics.data) ? resAllTopics.data : [];
        setAllBatchTopics(all);

        if (all.length > 0) {
          const weekStatus = {};
          all.forEach((t) => {
            const w = Number(t.week_no ?? t.weekno);
            if (!weekStatus[w]) weekStatus[w] = { hasNotCompleted: false };
            if ((t.topic_status ?? t.topicstatus) !== "Completed") {
              weekStatus[w].hasNotCompleted = true;
            }
          });

          const candidateWeeks = Object.keys(weekStatus)
            .map((w) => Number(w))
            .filter((w) => weekStatus[w].hasNotCompleted);

          setFirstIncompleteWeek(
            candidateWeeks.length > 0 ? Math.min(...candidateWeeks) : null
          );
        } else {
          setFirstIncompleteWeek(null);
        }
      } catch {
        setWeeks([]);
        setSelectedWeek("");
        setTopics([]);
        setAllBatchTopics([]);
        setMessage("Error loading weeks/topics");
        setFirstIncompleteWeek(null);
      }
    })();
  }, [selectedBatch, token]);

  useEffect(() => {
    const checkBatchOwner = async () => {
      if (!selectedBatch || !token || (lowerRole !== "manager" && lowerRole !== "admin")) {
        setIsBatchOwner(false);
        return;
      }

      try {
        const headers = { Authorization: `Bearer ${token}` };
        const res = await axios.get(
          `${API_BASE}/api/course_planner_data?batch_no=${selectedBatch}`,
          { headers }
        );

        const first = Array.isArray(res.data) ? res.data[0] : null;
        setIsBatchOwner(!!first && first.batch_owner === user?.email);
      } catch {
        setIsBatchOwner(false);
      }
    };

    checkBatchOwner();
  }, [selectedBatch, token, user?.email, lowerRole]);

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
          params: { week_no: selectedWeek },
        });

        if (Array.isArray(res.data)) {
          const sortedTopics = [...res.data].sort((a, b) => {
            const dA = new Date(a.date);
            const dB = new Date(b.date);
            const cmp = dA - dB;
            if (cmp !== 0) return cmp;

            const aMod = a.module_name || "";
            const bMod = b.module_name || "";
            return aMod.localeCompare(bMod);
          });

          setTopics(sortedTopics);

          const newRemarks = {};
          const newActualDates = {};
          sortedTopics.forEach((t) => {
            newRemarks[t.id] = t.remarks || "";
            newActualDates[t.id] = t.actual_date || t.actualdate || t.date || "";
          });

          setRemarksMap(newRemarks);
          setActualDatesMap(newActualDates);
          setPendingStatusChanges({});
          setBlockedTopics({});
          setPendingDateSaves({});
          setMessage("");
        } else {
          setTopics([]);
          setMessage("No topics");
        }
      } catch {
        setTopics([]);
        setMessage("Error loading topics");
      }
    })();
  }, [selectedBatch, selectedWeek, token]);

  const getStatusForTopic = (topicId, confirmedStatus) =>
    pendingStatusChanges[topicId] ?? confirmedStatus;

  const isActionFrozen = (topic) => (topic.topic_status ?? topic.topicstatus) === "Completed";

  const canEditWeek = (weekNo) => {
    const w = Number(weekNo);
    if (!w) return false;
    if (firstIncompleteWeek == null) return true;
    return w === firstIncompleteWeek;
  };

  const isBlocked = (topicId) => !!blockedTopics[topicId];

  const topicsByDate = topics.reduce((acc, t) => {
    const key = t.date || "No Date";
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  const sortedDates = Object.keys(topicsByDate).sort(
    (a, b) => new Date(a) - new Date(b)
  );

  function handlePendingStatusChange(topicId, value) {
    setPendingStatusChanges((prev) => ({ ...prev, [topicId]: value }));
  }

  // UPDATED: Fixed actual date save with validation and proper persistence
  const handleActualDateChange = (topicId, newDate, plannedDate) => {
    setActualDatesMap((prev) => ({
      ...prev,
      [topicId]: newDate,
    }));
    
    // Immediately mark as pending save
    setPendingDateSaves((prev) => ({ ...prev, [topicId]: true }));
    
    // Save with debounce
    const debouncedSave = debounceSave(async () => {
      await saveActualDate(topicId, newDate, plannedDate);
    }, 1000);
    
    debouncedSave();
  };

  // NEW: Save actual date function with remarks validation
  const saveActualDate = async (topicId, actualDate, plannedDate) => {
    try {
      if (!plannedDate || !actualDate) {
        setPendingDateSaves((prev) => {
          const copy = { ...prev };
          delete copy[topicId];
          return copy;
        });
        return;
      }

      const planned = new Date(plannedDate);
      const actual = new Date(actualDate);
      
      // NEW: Check if actual date crosses planned date
      const crossesPlannedDate = actual > planned;
      const remarks = (remarksMap[topicId] || "").trim();

      // NEW: Validate remarks if date crosses planned date
      if (crossesPlannedDate && !remarks) {
        showRemarksSnackbar(
          "⚠️ Actual date is after planned date. Remarks are mandatory. Please add remarks first.",
          "warning"
        );
        // Revert the date change if no remarks
        setActualDatesMap((prev) => {
          const topic = topics.find(t => t.id === topicId);
          const originalDate = topic?.actual_date || topic?.actualdate || topic?.date || "";
          const copy = { ...prev };
          copy[topicId] = originalDate;
          return copy;
        });
        setPendingDateSaves((prev) => {
          const copy = { ...prev };
          delete copy[topicId];
          return copy;
        });
        return;
      }

      const daysDiff = Math.round((actual - planned) / (1000 * 60 * 60 * 24));

      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.post(
        `${API_BASE}/api/update-actual-date`,
        {
          topic_id: topicId,
          actual_date: actualDate,
          changed_by: user?.email || user?.name || "Trainer",
        },
        { headers }
      );

      if (res.data && res.data.success) {
        // Update topics state to persist the change
        setTopics((prev) =>
          prev.map((t) =>
            t.id === topicId 
              ? { ...t, actual_date: actualDate, date_difference: daysDiff } 
              : t
          )
        );

        // Clear pending save status
        setPendingDateSaves((prev) => {
          const copy = { ...prev };
          delete copy[topicId];
          return copy;
        });

        // Show appropriate feedback
        if (daysDiff > 2) {
          showSnackbar(`⚠️ Exceeding topic by ${daysDiff} day(s)! Remarks: "${remarks}"`, "warning");
        } else if (daysDiff > 0) {
          showSnackbar(`Topic completed ${daysDiff} day(s) later. Remarks: "${remarks}"`, "warning");
        } else if (daysDiff < 0) {
          showSnackbar(`✅ Finished ${Math.abs(daysDiff)} day(s) early!`, "success");
        } else {
          showSnackbar("✅ On planned date recorded.", "success");
        }

        // Block actions if date changed without remarks (for non-crossing dates)
        if (daysDiff !== 0 && !remarks) {
          setBlockedTopics((prev) => ({ ...prev, [topicId]: true }));
          showRemarksSnackbar(
            "Date changed without remarks. Add remarks to unlock other actions.",
            "warning"
          );
        }
      } else {
        setMessage("❌ Failed to save actual date");
      }
    } catch (error) {
      console.error("Error saving actual date:", error);
      setMessage("❌ Error saving actual date");
      // Revert on error
      const topic = topics.find(t => t.id === topicId);
      const originalDate = topic?.actual_date || topic?.actualdate || topic?.date || "";
      setActualDatesMap((prev) => ({
        ...prev,
        [topicId]: originalDate,
      }));
    }
  };

  async function handleStatusConfirm(topicId) {
    const newStatus = pendingStatusChanges[topicId];
    if (!newStatus) {
      setMessage("No status change to confirm.");
      return;
    }

    const topic = topics.find((t) => t.id === topicId);
    const plannedDate = topic?.date;
    const actualDate =
      actualDatesMap[topicId] || topic?.actual_date || topic?.actualdate || plannedDate;

    const planned = plannedDate ? new Date(plannedDate) : null;
    const actual = actualDate ? new Date(actualDate) : null;
    
    let daysDiff = 0;
    if (planned && actual) {
      daysDiff = Math.round((actual - planned) / (1000 * 60 * 60 * 24));
    }

    const remarks = (remarksMap[topicId] || "").trim();

    if (daysDiff !== 0 && !remarks) {
      setBlockedTopics((prev) => ({ ...prev, [topicId]: true }));
      showRemarksSnackbar(
        "Without entering remarks, status / other actions are locked for this topic. Please add remarks and save again.",
        "warning"
      );
      return;
    }

    await performStatusUpdate(topicId, newStatus);
  }

  async function performStatusUpdate(topicId, newStatus) {
    setTopics((prev) =>
      prev.map((t) => (t.id === topicId ? { ...t, _pending: true } : t))
    );

    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.post(
        `${API_BASE}/api/update-topic-status`,
        { topic_id: topicId, status: newStatus },
        { headers }
      );

      if (res.data && (res.data.success || res.status === 200)) {
        setTopics((prev) =>
          prev.map((t) =>
            t.id === topicId ? { ...t, topic_status: newStatus, _pending: false } : t
          )
        );

        setPendingStatusChanges((prev) => {
          const copy = { ...prev };
          delete copy[topicId];
          return copy;
        });

        setMessage("✅ Status updated");

        const nextAll = allBatchTopics.map((t) =>
          t.id === topicId ? { ...t, topic_status: newStatus } : t
        );
        setAllBatchTopics(nextAll);

        const weekStatus = {};
        nextAll.forEach((t) => {
          const w = Number(t.week_no ?? t.weekno);
          if (!weekStatus[w]) weekStatus[w] = { hasNotCompleted: false };
          if ((t.topic_status ?? t.topicstatus) !== "Completed") {
            weekStatus[w].hasNotCompleted = true;
          }
        });
        const candidateWeeks = Object.keys(weekStatus)
          .map((w) => Number(w))
          .filter((w) => weekStatus[w].hasNotCompleted);

        setFirstIncompleteWeek(candidateWeeks.length > 0 ? Math.min(...candidateWeeks) : null);
      } else {
        throw new Error(res.data?.error || "Update failed");
      }
    } catch {
      setMessage("❌ Error updating status");
      setTopics((prev) =>
        prev.map((t) => (t.id === topicId ? { ...t, _pending: false } : t))
      );
    }
  }

  async function handleRemarksSave(topicId, value) {
    const trimmed = (value || "").trim();
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.post(
        `${API_BASE}/api/update-remarks`,
        { topic_id: topicId, remarks: trimmed },
        { headers }
      );

      if (res.data && res.data.success && trimmed) {
        setBlockedTopics((prev) => {
          const copy = { ...prev };
          delete copy[topicId];
          return copy;
        });
      }
    } catch {
      // Silent fail for remarks
    }
  }

  function getDateCellStyle(daysDiff) {
    if (daysDiff == null || daysDiff === 0) return { color: grey[700] };
    if (daysDiff > 2) return { color: red[700], fontWeight: "bold" };
    if (daysDiff > 0) return { color: orange[700], fontWeight: "bold" };
    if (daysDiff < 0) return { color: green[700], fontWeight: "bold" };
    return { color: grey[700] };
  }

  return (
    <Box
      sx={{
        maxWidth: 1200,
        mx: "auto",
        my: 3,
        fontFamily: "Segoe UI, Tahoma, Geneva, Verdana, sans-serif",
      }}
    >
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Progress" />
        <Tab label={trainerTabLabel} />
      </Tabs>

      {tab === 0 && (
        <Paper
          elevation={6}
          sx={{
            p: 4,
            borderRadius: 3,
            mb: 4,
            backgroundColor: "#ffffffcc",
          }}
        >
          <Typography
            variant="h4"
            color="primary"
            gutterBottom
            fontWeight="bold"
            letterSpacing={1}
          >
            {roleTitle} Dashboard
          </Typography>

          <Typography variant="subtitle1" color="text.secondary" mb={3}>
            Welcome{" "}
            <Box component="span" sx={{ fontWeight: "medium", color: "primary.main" }}>
              {welcomeName}
            </Box>
          </Typography>

          <Grid container spacing={3} alignItems="center" mb={4}>
            <Grid item xs={12} sm={6} md={5}>
              <FormControl
                fullWidth
                size="medium"
                sx={{ backgroundColor: "#f9f9f9", borderRadius: 1 }}
              >
                <InputLabel>Batch</InputLabel>
                <Select
                  value={selectedBatch}
                  label="Batch"
                  onChange={(e) => setSelectedBatch(e.target.value)}
                  MenuProps={{ PaperProps: { sx: { maxHeight: 300 } } }}
                  sx={{
                    "& .MuiSelect-outlined": { paddingLeft: 1.5, paddingRight: 0.5 },
                    fontWeight: 600,
                  }}
                >
                  <MenuItem value="">
                    <em>Select a batch...</em>
                  </MenuItem>
                  {batches.map((b) => {
                    const bn = b.batch_no || b.batchno;
                    const sd = b.start_date || b.startdate;
                    return (
                      <MenuItem key={bn} value={bn}>
                        {bn} {sd ? `(${sd})` : ""}
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              {weeks.length > 0 && (
                <FormControl
                  fullWidth
                  size="medium"
                  sx={{ backgroundColor: "#f9f9f9", borderRadius: 1 }}
                >
                  <InputLabel>Week No</InputLabel>
                  <Select
                    value={selectedWeek}
                    label="Week No"
                    onChange={(e) => setSelectedWeek(e.target.value)}
                    MenuProps={{ PaperProps: { sx: { maxHeight: 250 } } }}
                  >
                    {weeks.map((week) => (
                      <MenuItem key={week} value={week}>
                        Week {week}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Grid>
          </Grid>

          {Object.keys(topicsByDate).length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No topics to display.
            </Typography>
          )}

          {sortedDates.map((dateKey) => {
            const dateTopics = topicsByDate[dateKey] || [];
            const weekNoForBlock = dateTopics[0]?.week_no ?? dateTopics[0]?.weekno ?? selectedWeek;
            const weekEditable = canEditWeek(weekNoForBlock);

            return (
              <Box
                key={dateKey}
                sx={{
                  mb: 5,
                  boxShadow: 3,
                  borderRadius: 3,
                  backgroundColor: "#fefefe",
                  p: 2,
                }}
              >
                <Typography
                  variant="h6"
                  sx={{
                    mb: 2,
                    px: 1,
                    fontWeight: "bold",
                    letterSpacing: 0.5,
                    borderLeft: 6,
                    borderColor: "primary.main",
                    bgcolor: "#e3f2fd",
                    borderRadius: "4px",
                  }}
                >
                  {dateKey}
                </Typography>

                <TableContainer>
                  <Table size="small" sx={{ borderRadius: 2 }}>
                    <TableHead>
                      <TableRow
                        sx={{
                          bgcolor: "#1976d2",
                          "& th": { color: "white", fontWeight: "bold" },
                        }}
                      >
                        <TableCell>Topic</TableCell>
                        <TableCell align="center">Planned Date</TableCell>
                        <TableCell align="center">Actual Date</TableCell>
                        <TableCell align="center">Difference</TableCell>
                        <TableCell align="center">Status</TableCell>
                        <TableCell align="center">Action</TableCell>
                        <TableCell align="center">Remarks</TableCell>
                      </TableRow>
                    </TableHead>

                    <TableBody>
                      {dateTopics.map((t) => {
                        const daysDiff = t.date_difference ?? t.datedifference ?? 0;
                        const confirmedStatus = t.topic_status ?? t.topicstatus;
                        const currentStatus = getStatusForTopic(t.id, confirmedStatus);

                        const frozen = isActionFrozen(t);
                        const blocked = isBlocked(t.id);
                        const editable = weekEditable && !frozen && !blocked;
                        const isSavingDate = pendingDateSaves[t.id];

                        return (
                          <TableRow
                            key={t.id}
                            sx={{
                              backgroundColor: grey[50],
                              transition: "background-color 0.3s",
                              "&:hover": {
                                backgroundColor: "#bbdefb",
                                boxShadow: "0 4px 8px rgba(25, 118, 210, 0.3)",
                              },
                            }}
                          >
                            <TableCell
                              sx={{
                                fontWeight: 600,
                                color: "#1976d2",
                                letterSpacing: 0.4,
                              }}
                            >
                              {t.topic_name || t.topicname || `Topic ${t.id}`}
                            </TableCell>

                            <TableCell align="center" sx={{ fontWeight: "medium" }}>
                              {t.date}
                            </TableCell>

                            {/* UPDATED: Fixed Actual Date field */}
                            <TableCell align="center">
                              <TextField
                                type="date"
                                size="small"
                                value={actualDatesMap[t.id] || ""}
                                onChange={(e) => handleActualDateChange(t.id, e.target.value, t.date)}
                                InputProps={{ 
                                  style: { 
                                    ...getDateCellStyle(daysDiff),
                                    ...(isSavingDate && { opacity: 0.7 })
                                  },
                                  endAdornment: isSavingDate ? (
                                    <CircularProgress size={16} color="primary" />
                                  ) : null
                                }}
                                sx={{ maxWidth: 140 }}
                                helperText={
                                  daysDiff !== 0
                                    ? daysDiff > 0
                                      ? `Delayed by ${daysDiff} day(s)`
                                      : `Early by ${Math.abs(daysDiff)} day(s)`
                                    : "On time"
                                }
                                FormHelperTextProps={{
                                  sx: { fontStyle: "italic", fontSize: 10, color: grey[600] },
                                }}
                                disabled={!editable}
                              />
                            </TableCell>

                            <TableCell align="center">
                              {daysDiff !== 0 ? (
                                <Chip
                                  label={daysDiff > 0 ? `+${daysDiff} days` : `${daysDiff} days`}
                                  size="small"
                                  sx={{
                                    fontWeight: "600",
                                    bgcolor:
                                      daysDiff > 2
                                        ? red[100]
                                        : daysDiff > 0
                                        ? orange[100]
                                        : green[100],
                                    color:
                                      daysDiff > 2
                                        ? red[700]
                                        : daysDiff > 0
                                        ? orange[700]
                                        : green[700],
                                  }}
                                />
                              ) : (
                                <Typography variant="caption" color="success.main" fontWeight="bold">
                                  On time
                                </Typography>
                              )}
                            </TableCell>

                            <TableCell align="center">
                              <Chip
                                label={confirmedStatus}
                                size="small"
                                sx={{
                                  fontWeight: "bold",
                                  bgcolor: statusChipColor[confirmedStatus] || grey[300],
                                  color: confirmedStatus === "Planned" ? grey[900] : "white",
                                  letterSpacing: 0.5,
                                  px: 1.5,
                                }}
                              />
                            </TableCell>

                            <TableCell
                              align="center"
                              sx={{
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                                gap: 1,
                                opacity: editable ? 1 : 0.6,
                                pointerEvents: editable ? "auto" : "none",
                              }}
                            >
                              <Tooltip
                                title={
                                  !weekEditable
                                    ? "Complete all topics of the current editable week before moving to the next week"
                                    : frozen
                                    ? "This topic is completed and cannot be changed"
                                    : blocked
                                    ? "Date changed without remarks. Please add remarks to unlock."
                                    : "Change Status"
                                }
                              >
                                <span>
                                  <FormControl size="small" sx={{ minWidth: 140 }}>
                                    <Select
                                      value={currentStatus}
                                      disabled={!editable || !!t._pending}
                                      onChange={(e) =>
                                        handlePendingStatusChange(t.id, e.target.value)
                                      }
                                      sx={{
                                        backgroundColor: editable ? "#e3f2fd" : "#f5f5f5",
                                        color: editable ? "#0d47a1" : grey[600],
                                        fontWeight: "600",
                                      }}
                                    >
                                      <MenuItem value="Planned">Planned</MenuItem>
                                      <MenuItem value="In Progress">In Progress</MenuItem>
                                      <MenuItem value="Completed">Completed</MenuItem>
                                    </Select>
                                  </FormControl>
                                </span>
                              </Tooltip>

                              {pendingStatusChanges[t.id] &&
                                pendingStatusChanges[t.id] !== confirmedStatus &&
                                !t._pending && (
                                  <Tooltip title="Confirm Status Change">
                                    <IconButton
                                      size="small"
                                      color="primary"
                                      onClick={() => handleStatusConfirm(t.id)}
                                      disabled={t._pending}
                                      aria-label="Confirm status change"
                                    >
                                      <CheckIcon />
                                    </IconButton>
                                  </Tooltip>
                                )}
                            </TableCell>

                            <TableCell align="center">
                              <TextField
                                size="small"
                                value={remarksMap[t.id] || ""}
                                onChange={(e) =>
                                  setRemarksMap((prev) => ({ ...prev, [t.id]: e.target.value }))
                                }
                                onBlur={() => handleRemarksSave(t.id, remarksMap[t.id])}
                                placeholder="Add remarks"
                                variant="outlined"
                                sx={{ bgcolor: "#fafafa", borderRadius: 1 }}
                                inputProps={{ style: { fontSize: 13 } }}
                                disabled={!weekEditable || frozen}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            );
          })}

          {message && (
            <Fade in={!!message}>
              <Box mt={1}>
                <Alert
                  severity={
                    message.startsWith("✅")
                      ? "success"
                      : message.startsWith("❌")
                      ? "error"
                      : "warning"
                  }
                  sx={{ fontWeight: "medium" }}
                >
                  {message}
                </Alert>
              </Box>
            </Fade>
          )}
        </Paper>
      )}

      {tab === 1 && (
        <Box>
          {isTrainer && <TrainerUnavailabilityForm user={user} token={token} />}

          {isManagerOrAdmin && isBatchOwner && (
            <TrainerAssignmentDashboard user={user} token={token} batchNo={selectedBatch} />
          )}

          {isManagerOrAdmin && !isBatchOwner && (
            <ManagerLeaveDashboard user={user} token={token} />
          )}

          {!isTrainer && !isManagerOrAdmin && (
            <Alert severity="warning" sx={{ mt: 3 }}>
              Trainer Management is only available to trainers, managers, or admins.
            </Alert>
          )}
        </Box>
      )}

      <Snackbar
        open={remarksSnackbarOpen}
        autoHideDuration={6000}
        onClose={() => setRemarksSnackbarOpen(false)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          onClose={() => setRemarksSnackbarOpen(false)}
          severity={remarksSnackbarSeverity}
          sx={{ width: "100%", fontSize: "1rem", fontWeight: "medium" }}
        >
          {remarksSnackbarMessage ||
            "Without entering remarks, other actions will remain frozen for this topic."}
        </Alert>
      </Snackbar>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity={snackbarSeverity}
          sx={{ width: "100%", fontSize: "1.1rem", fontWeight: "medium" }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default TrainerDashboard;
