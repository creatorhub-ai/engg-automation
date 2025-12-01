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
  Button
} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import { green, orange, red, grey } from "@mui/material/colors";

const API_BASE = process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

const statusChipColor = {
  Completed: green[600],
  "In Progress": orange[600],
  Planned: red[600],
};

// --- Component: TrainerUnavailabilityForm ---
function TrainerUnavailabilityForm({ user }) {
  const [domain, setDomain] = useState(user.domain || "");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function submitUnavailability() {
    if (!domain || !start || !end) {
      setErr("Please fill all fields");
      return;
    }
    try {
      await axios.post(`${API_BASE}/api/trainer-unavailability`, {
        trainer_email: user.email,
        trainer_name: user.name,
        domain,
        start_date: start,
        end_date: end,
        reason,
      });
      setMsg("Unavailability submitted");
      setErr("");
      setStart("");
      setEnd("");
      setReason("");
    } catch (error) {
      setErr("Failed to submit unavailability");
    }
  }

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" fontWeight="bold" mb={1}>
        Mark Unavailability
      </Typography>
      <TextField
        label="Domain"
        value={domain}
        onChange={(e) => setDomain(e.target.value)}
        fullWidth
        sx={{ mb: 1 }}
      />
      <TextField
        label="From"
        type="date"
        value={start}
        onChange={(e) => setStart(e.target.value)}
        fullWidth
        InputLabelProps={{ shrink: true }}
        sx={{ mb: 1 }}
      />
      <TextField
        label="To"
        type="date"
        value={end}
        onChange={(e) => setEnd(e.target.value)}
        fullWidth
        InputLabelProps={{ shrink: true }}
        sx={{ mb: 1 }}
      />
      <TextField
        label="Reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        fullWidth
        sx={{ mb: 1 }}
      />
      <Button onClick={submitUnavailability} variant="contained" color="primary">
        Submit
      </Button>
      {msg && <Alert severity="success" sx={{ mt: 1 }}>{msg}</Alert>}
      {err && <Alert severity="error" sx={{ mt: 1 }}>{err}</Alert>}
    </Paper>
  );
}

// --- Component: TrainerUnavailabilityManagerDashboard ---
function TrainerUnavailabilityManagerDashboard() {
  const [unavail, setUnavail] = useState([]);
  const [selectedReq, setSelectedReq] = useState(null);
  const [availableTrainers, setAvailableTrainers] = useState([]);
  const [assignMsg, setAssignMsg] = useState("");

  useEffect(() => {
    async function fetchUnavailability() {
      try {
        const res = await axios.get(`${API_BASE}/api/unavailability-requests`);
        setUnavail(res.data || []);
      } catch {
        setUnavail([]);
      }
    }
    fetchUnavailability();
  }, []);

  async function handleViewAvailable(req) {
    setSelectedReq(req);
    setAssignMsg("");
    setAvailableTrainers([]);
    try {
      const res = await axios.get(`${API_BASE}/api/available-trainers`, {
        params: {
          domain: req.domain,
          start_date: req.start_date,
          end_date: req.end_date,
        },
      });
      if (!res.data || res.data.length === 0) {
        alert("No trainers found available for the selected criteria.");
        setAvailableTrainers([]);
      } else {
        setAvailableTrainers(res.data);
      }
    } catch (error) {
      alert(
        "Failed to fetch available trainers. " +
          (error.response?.data?.error || error.message)
      );
      setAvailableTrainers([]);
    }
  }

  async function handleReassign(trainer, assignment) {
    try {
      await axios.post(`${API_BASE}/api/reassign-topic`, {
        batch_no: assignment.batch_no,
        topic_id: assignment.id,
        new_trainer_email: trainer.email,
        new_trainer_name: trainer.name,
      });
      setAssignMsg(`Assigned "${assignment.topic_name}" to ${trainer.name}`);
    } catch {
      setAssignMsg("Failed to reassign topic");
    }
  }

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" fontWeight="bold" mb={1}>
        Unavailability Requests
      </Typography>
      <TableContainer sx={{ mb: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Trainer</TableCell>
              <TableCell>Domain</TableCell>
              <TableCell>From/To</TableCell>
              <TableCell>Reason</TableCell>
              <TableCell>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {unavail.map((req) => (
              <TableRow key={req.id}>
                <TableCell>{req.trainer_name}</TableCell>
                <TableCell>{req.domain}</TableCell>
                <TableCell>
                  {req.start_date} - {req.end_date}
                </TableCell>
                <TableCell>{req.reason}</TableCell>
                <TableCell>
                  <Button
                    variant="outlined"
                    onClick={() => handleViewAvailable(req)}
                  >
                    List Trainers
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {selectedReq && availableTrainers.length > 0 && (
        <Box>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 2 }}
          >
            Available trainers for domain "{selectedReq.domain}"
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Batches / Assignments</TableCell>
                  <TableCell>Assign Topic</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {availableTrainers.map((tr) => (
                  <TableRow key={tr.email}>
                    <TableCell>{tr.name}</TableCell>
                    <TableCell>{tr.email}</TableCell>
                    <TableCell>
                      {(tr.assignments || []).map((a, i) => (
                        <div key={i}>
                          {a.batch_no} | {a.topic_name} | {a.start_time}-
                          {a.end_time}
                        </div>
                      ))}
                    </TableCell>
                    <TableCell>
                      {(tr.assignments || []).map((a, i) => (
                        <Button
                          key={i}
                          variant="contained"
                          color="success"
                          size="small"
                          onClick={() => handleReassign(tr, a)}
                        >
                          Assign "{a.topic_name}"
                        </Button>
                      ))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {assignMsg && (
            <Alert severity="success" sx={{ mt: 1 }}>
              {assignMsg}
            </Alert>
          )}
        </Box>
      )}
    </Paper>
  );
}

// --- Main Component
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

  // NEW: to enforce "previous week must be completed"
  const [firstIncompleteWeek, setFirstIncompleteWeek] = useState(null);

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
          setMessage("No batches found");
        }
      } catch {
        setMessage("Error loading batches");
      }
    })();
  }, [token]);

  // Load weeks on batch change + compute firstIncompleteWeek
  useEffect(() => {
    if (!selectedBatch) {
      setWeeks([]);
      setSelectedWeek("");
      setTopics([]);
      setFirstIncompleteWeek(null);
      return;
    }
    (async () => {
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await axios.get(
          `${API_BASE}/api/weeks/${selectedBatch}`,
          { headers }
        );
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          const sortedWeeks = [...res.data].sort(
            (a, b) => Number(a) - Number(b)
          );
          setWeeks(sortedWeeks);
          setSelectedWeek(sortedWeeks[0]);

          // NEW: ask backend which is the first incomplete week for this batch
          try {
            const res2 = await axios.get(
              `${API_BASE}/api/first-incomplete-week/${selectedBatch}`,
              { headers }
            );
            // expected: { first_incomplete_week: <number or null> }
            setFirstIncompleteWeek(
              res2.data?.first_incomplete_week ?? null
            );
          } catch {
            // if API not available, fallback: allow all weeks
            setFirstIncompleteWeek(null);
          }
        } else {
          setWeeks([]);
          setSelectedWeek("");
          setTopics([]);
          setMessage("No weeks found for selected batch");
          setFirstIncompleteWeek(null);
        }
      } catch {
        setWeeks([]);
        setSelectedWeek("");
        setTopics([]);
        setMessage("Error loading weeks");
        setFirstIncompleteWeek(null);
      }
    })();
  }, [selectedBatch, token]);

  // Load topics based on batch and week
  useEffect(() => {
    if (!selectedBatch || !selectedWeek) {
      setTopics([]);
      return;
    }
    (async () => {
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await axios.get(
          `${API_BASE}/api/topics/${selectedBatch}`,
          {
            headers,
            params: { week_no: selectedWeek },
          }
        );
        if (res.data && Array.isArray(res.data)) {
          // Sort topics by date ascending (and then by module_name just for stability)
          const sortedTopics = [...res.data].sort((a, b) => {
            const dA = new Date(a.date);
            const dB = new Date(b.date);
            const cmp = dA - dB;
            if (cmp !== 0) return cmp;
            if (a.module_name && b.module_name) {
              return a.module_name.localeCompare(b.module_name);
            }
            return 0;
          });

          setTopics(sortedTopics);

          // Prepare remarks and actual date maps
          const newRemarks = {};
          const newActualDates = {};
          sortedTopics.forEach((t) => {
            newRemarks[t.id] = t.remarks || "";
            newActualDates[t.id] = t.actual_date || t.date;
          });
          setRemarksMap(newRemarks);
          setActualDatesMap(newActualDates);
          setPendingStatusChanges({});
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

  // Utility: get current status (pending or confirmed)
  const getStatusForTopic = (topicId, confirmedStatus) =>
    pendingStatusChanges[topicId] ?? confirmedStatus;

  // Freeze row only when confirmed Completed
  const isActionFrozen = (topic) => topic.topic_status === "Completed";

  // NEW: can the trainer edit this topic based on week rule?
  const canEditWeek = (topicWeekNo) => {
    if (firstIncompleteWeek == null) return true; // backend not enforcing: allow all
    const weekNum = Number(topicWeekNo || selectedWeek);
    return weekNum <= Number(firstIncompleteWeek);
  };

  // Group topics by date (YYYY-MM-DD), dates sorted ascending
  const topicsByDate = topics.reduce((acc, t) => {
    const key = t.date || "No Date";
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});
  const sortedDates = Object.keys(topicsByDate).sort(
    (a, b) => new Date(a) - new Date(b)
  );

  // Handlers
  function handlePendingStatusChange(topicId, value) {
    setPendingStatusChanges((prev) => ({ ...prev, [topicId]: value }));
  }

  async function handleStatusConfirm(topicId) {
    const newStatus = pendingStatusChanges[topicId];
    if (!newStatus) {
      setMessage("No status change to confirm.");
      return;
    }
    setTopics((prev) =>
      prev.map((t) =>
        t.id === topicId ? { ...t, _pending: true } : t
      )
    );
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.post(
        `${API_BASE}/api/update-topic-status`,
        {
          topic_id: topicId,
          status: newStatus,
        },
        { headers }
      );

      if (res.data && (res.data.success || res.status === 200)) {
        setTopics((prev) =>
          prev.map((t) =>
            t.id === topicId
              ? { ...t, topic_status: newStatus, _pending: false }
              : t
          )
        );
        setPendingStatusChanges((prev) => {
          const copy = { ...prev };
          delete copy[topicId];
          return copy;
        });
        setMessage("✅ Status updated");
      } else {
        throw new Error(res.data?.error || "Update failed");
      }
    } catch (err) {
      setMessage("❌ Error updating status");
      setTopics((prev) =>
        prev.map((t) =>
          t.id === topicId ? { ...t, _pending: false } : t
        )
      );
    }
  }

  async function handleRemarksSave(topicId, value) {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.post(
        `${API_BASE}/api/update-remarks`,
        {
          topic_id: topicId,
          remarks: value,
        },
        { headers }
      );
      if (res.data && res.data.success) {
        setMessage("✅ Remarks updated");
      } else {
        setMessage("❌ Failed to update remarks");
      }
    } catch {
      setMessage("❌ Error updating remarks");
    }
  }

  async function handleActualDateSave(topicId, actualDate, plannedDate) {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const planned = new Date(plannedDate);
      const actual = new Date(actualDate);
      const daysDiff = Math.round(
        (actual - planned) / (1000 * 60 * 60 * 24)
      );
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
        setTopics((prev) =>
          prev.map((t) =>
            t.id === topicId
              ? { ...t, actual_date: actualDate, date_difference: daysDiff }
              : t
          )
        );
        if (daysDiff > 2) {
          setAlertMessage(`⚠️ You are exceeding the topic by ${daysDiff} days!`);
          setAlertSeverity("error");
        } else if (daysDiff > 0) {
          setAlertMessage(
            `Topic completed ${daysDiff} day(s) later than planned.`
          );
          setAlertSeverity("warning");
        } else if (daysDiff < 0) {
          setAlertMessage(
            `🎉 You finished ${Math.abs(daysDiff)} day(s) earlier!`
          );
          setAlertSeverity("success");
        } else {
          setAlertMessage("✅ Topic completed on the planned date.");
          setAlertSeverity("success");
        }
        setAlertOpen(true);
      } else {
        setMessage("❌ Failed to update actual date");
      }
    } catch {
      setMessage("❌ Error updating actual date");
    }
  }

  function getDateCellStyle(daysDiff) {
    if (daysDiff == null || daysDiff === 0) return { color: grey[700] };
    if (daysDiff > 2) return { color: red[700], fontWeight: "bold" };
    if (daysDiff > 0) return { color: orange[700], fontWeight: "bold" };
    if (daysDiff < 0) return { color: green[700], fontWeight: "bold" };
    return { color: grey[700] };
  }

  const roleTitle = user?.role
    ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
    : "Trainer";
  const welcomeName = user?.name || "Trainer";

  return (
    <Box
      sx={{
        maxWidth: 1200,
        mx: "auto",
        my: 3,
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      }}
    >
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Progress" />
        <Tab label="Trainer Management" />
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
            Welcome,{" "}
            <Box
              component="span"
              sx={{ fontWeight: "medium", color: "primary.main" }}
            >
              {welcomeName}
            </Box>
            !
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
                    "& .MuiSelect-outlined": {
                      paddingLeft: 1.5,
                      paddingRight: 0.5,
                    },
                    fontWeight: 600,
                  }}
                >
                  <MenuItem value="">
                    <em>Select a batch...</em>
                  </MenuItem>
                  {batches.map((b) => (
                    <MenuItem key={b.batch_no} value={b.batch_no}>
                      {b.batch_no}{" "}
                      {b.start_date ? `(${b.start_date})` : ""}
                    </MenuItem>
                  ))}
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

          {/* Group by date (sorted) */}
          {sortedDates.map((dateKey) => {
            const dateTopics = topicsByDate[dateKey] || [];
            const weekNoForBlock =
              dateTopics[0]?.week_no || selectedWeek;
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
                          "& th": {
                            color: "white",
                            fontWeight: "bold",
                          },
                        }}
                      >
                        <TableCell>Topic</TableCell>
                        <TableCell align="center">
                          Planned Date
                        </TableCell>
                        <TableCell align="center">
                          Actual Date
                        </TableCell>
                        <TableCell align="center">
                          Difference
                        </TableCell>
                        <TableCell align="center">Status</TableCell>
                        <TableCell align="center">Action</TableCell>
                        <TableCell align="center">Remarks</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {dateTopics.map((t) => {
                        const daysDiff = t.date_difference || 0;
                        const currentStatus =
                          pendingStatusChanges[t.id] ??
                          t.topic_status;
                        const frozen = isActionFrozen(t);
                        const editable =
                          weekEditable && !frozen; // NEW: week rule

                        return (
                          <TableRow
                            key={t.id}
                            sx={{
                              backgroundColor: (theme) =>
                                theme.palette.mode === "light"
                                  ? grey[50]
                                  : grey[900],
                              transition: "background-color 0.3s",
                              "&:hover": {
                                backgroundColor: "#bbdefb",
                                boxShadow:
                                  "0 4px 8px rgba(25, 118, 210, 0.3)",
                              },
                            }}
                          >
                            <TableCell
                              sx={{
                                fontWeight: "600",
                                color: "#1976d2",
                                letterSpacing: 0.4,
                              }}
                            >
                              {t.topic_name || `Topic ${t.id}`}
                            </TableCell>
                            <TableCell
                              align="center"
                              sx={{ fontWeight: "medium" }}
                            >
                              {t.date}
                            </TableCell>
                            <TableCell align="center">
                              <TextField
                                type="date"
                                size="small"
                                value={actualDatesMap[t.id] || ""}
                                onChange={(e) =>
                                  setActualDatesMap((prev) => ({
                                    ...prev,
                                    [t.id]: e.target.value,
                                  }))
                                }
                                onBlur={() =>
                                  handleActualDateSave(
                                    t.id,
                                    actualDatesMap[t.id],
                                    t.date
                                  )
                                }
                                InputProps={{
                                  style: getDateCellStyle(daysDiff),
                                }}
                                sx={{ maxWidth: 140 }}
                                helperText={
                                  daysDiff !== 0
                                    ? daysDiff > 0
                                      ? `Delayed by ${daysDiff} day(s)`
                                      : `Early by ${Math.abs(
                                          daysDiff
                                        )} day(s)`
                                    : "On time"
                                }
                                FormHelperTextProps={{
                                  sx: {
                                    fontStyle: "italic",
                                    fontSize: 10,
                                    color: grey[600],
                                  },
                                }}
                                disabled={!editable}
                              />
                            </TableCell>
                            <TableCell align="center">
                              {daysDiff !== 0 ? (
                                <Chip
                                  label={
                                    daysDiff > 0
                                      ? `+${daysDiff} days`
                                      : `${daysDiff} days`
                                  }
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
                                <Typography
                                  variant="caption"
                                  color="text.disabled"
                                >
                                  On time
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell align="center">
                              <Chip
                                label={t.topic_status}
                                size="small"
                                sx={{
                                  fontWeight: "bold",
                                  bgcolor:
                                    statusChipColor[t.topic_status] ??
                                    grey[300],
                                  color:
                                    t.topic_status === "Planned"
                                      ? grey[900]
                                      : "white",
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
                                pointerEvents: editable
                                  ? "auto"
                                  : "none",
                              }}
                            >
                              <Tooltip
                                title={
                                  !weekEditable
                                    ? "Complete current week before editing next week"
                                    : frozen
                                    ? "This topic is completed and cannot be changed"
                                    : "Change Status"
                                }
                              >
                                <span>
                                  <FormControl
                                    size="small"
                                    sx={{ minWidth: 140 }}
                                  >
                                    <Select
                                      value={currentStatus}
                                      disabled={
                                        !editable || !!t._pending
                                      }
                                      onChange={(e) =>
                                        handlePendingStatusChange(
                                          t.id,
                                          e.target.value
                                        )
                                      }
                                      sx={{
                                        backgroundColor: editable
                                          ? "#e3f2fd"
                                          : "#f5f5f5",
                                        color: editable
                                          ? "#0d47a1"
                                          : grey[600],
                                        fontWeight: "600",
                                      }}
                                    >
                                      <MenuItem value="Planned">
                                        Planned
                                      </MenuItem>
                                      <MenuItem value="In Progress">
                                        In Progress
                                      </MenuItem>
                                      <MenuItem value="Completed">
                                        Completed
                                      </MenuItem>
                                    </Select>
                                  </FormControl>
                                </span>
                              </Tooltip>

                              {pendingStatusChanges[t.id] &&
                                pendingStatusChanges[t.id] !==
                                  t.topic_status &&
                                !t._pending && (
                                  <Tooltip title="Confirm Status Change">
                                    <IconButton
                                      size="small"
                                      color="primary"
                                      onClick={() =>
                                        handleStatusConfirm(t.id)
                                      }
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
                                  setRemarksMap((prev) => ({
                                    ...prev,
                                    [t.id]: e.target.value,
                                  }))
                                }
                                onBlur={() =>
                                  handleRemarksSave(
                                    t.id,
                                    remarksMap[t.id]
                                  )
                                }
                                placeholder="Add remarks"
                                variant="outlined"
                                sx={{
                                  bgcolor: "#fafafa",
                                  borderRadius: 1,
                                }}
                                inputProps={{ style: { fontSize: 13 } }}
                                disabled={!editable}
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
                    message.startsWith("✅") ? "success" : "warning"
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
          {user?.role === "trainer" && (
            <TrainerUnavailabilityForm user={user} />
          )}
          {(user?.role === "manager" || user?.role === "admin") && (
            <TrainerUnavailabilityManagerDashboard />
          )}
          {!["trainer", "manager", "admin"].includes(user?.role) && (
            <Alert severity="warning" sx={{ mt: 3 }}>
              Trainer Management is only available to trainers, managers,
              or admins. Please ensure your account has the correct role.
            </Alert>
          )}
        </Box>
      )}
      <Snackbar
        open={alertOpen}
        autoHideDuration={6000}
        onClose={() => setAlertOpen(false)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          onClose={() => setAlertOpen(false)}
          severity={alertSeverity}
          sx={{ width: "100%", fontSize: "1.1rem", fontWeight: "medium" }}
        >
          {alertMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default TrainerDashboard;
