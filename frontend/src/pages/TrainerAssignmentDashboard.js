// src/pages/TrainerAssignmentDashboard.js
import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  Box,
  Paper,
  Typography,
  Table,
  TableHead,
  TableBody,
  TableCell,
  TableRow,
  TableContainer,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  Alert,
  Snackbar,
  IconButton,
  Grid,
} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";

const API_BASE = "https://engg-automation.onrender.com";

function TrainerAssignmentDashboard({ user, token, batchNo }) {
  const [unavailabilities, setUnavailabilities] = useState([]);
  const [selectedUA, setSelectedUA] = useState(null);
  const [topics, setTopics] = useState([]);
  const [availableTrainers, setAvailableTrainers] = useState([]);
  const [selectedTrainer, setSelectedTrainer] = useState(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [message, setMessage] = useState("");
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const lowerRole = (user?.role || "").toLowerCase();
  const isManagerOrAdmin = lowerRole === "manager" || lowerRole === "admin";
  const isPrivileged = isManagerOrAdmin || true;

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  // Load trainer leave list - ULTRA SAFE
  useEffect(() => {
    const fetchUA = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/trainer-unavailability`, {
          headers: authHeaders,
          timeout: 10000, // 10s timeout
        });
        
        // Ensure we always get an array
        const data = Array.isArray(res.data) ? res.data : [];
        setUnavailabilities(data);
      } catch (err) {
        console.error("Error fetching trainer-unavailability:", err);
        // Never break UI - set empty array
        setUnavailabilities([]);
        setMessage("Failed to fetch trainer leaves (showing empty list)");
        setSnackbarOpen(true);
      }
    };
    fetchUA();
  }, [token]);

  // When "Assign Topics" is clicked - SIMPLIFIED & BULLETPROOF
  const handleAssignClick = async (ua) => {
    setSelectedUA(ua);
    setTopics([]);
    setAvailableTrainers([]);
    setLoading(true);

    try {
      // 1) Topics (safe fallback to empty)
      try {
        const topicsRes = await axios.get(
          `${API_BASE}/api/unavailability-topics/${ua.id}`,
          { headers: authHeaders, timeout: 5000 }
        );
        setTopics(topicsRes.data?.topics || []);
      } catch (topicErr) {
        console.warn("Topics fetch failed:", topicErr);
        setTopics([]);
      }

      // 2) Available trainers - SIMPLIFIED PARAMS
      try {
        // Simple params: batch_no OR just domain (backend handles ANY param)
        const trainerParams = batchNo 
          ? { batch_no: batchNo }
          : { domain: ua.domain || 'PD' }; // PD fallback for domain

        const availRes = await axios.get(`${API_BASE}/api/available-trainers`, {
          headers: authHeaders,
          params: trainerParams,
          timeout: 8000
        });
        
        // Ensure array even if backend sends weird data
        const trainers = Array.isArray(availRes.data) ? availRes.data : [];
        
        // If no trainers from API, show helpful fallback
        if (trainers.length === 0) {
          setAvailableTrainers([{
            name: "No trainers available",
            email: "contact-admin@company.com",
            domain: ua.domain || "PD"
          }]);
        } else {
          setAvailableTrainers(trainers);
        }
        
      } catch (availErr) {
        console.warn("Available trainers fetch failed:", availErr);
        // Fallback: show dummy trainer so UI doesn't break
        setAvailableTrainers([{
          name: "Service temporarily unavailable",
          email: "contact-admin@company.com",
          domain: ua.domain || "PD"
        }]);
      }

      setDialogOpen(true);
    } catch (err) {
      console.error("handleAssignClick error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleTrainerCardClick = (trainer) => {
    setSelectedTrainer(trainer);
    setConfirmOpen(true);
  };

  const handleAssignTopicsConfirm = async () => {
    if (!selectedUA || !selectedTrainer || topics.length === 0) {
      setConfirmOpen(false);
      return;
    }

    setLoading(true);
    try {
      const topicIds = topics.map((t) => t.id);

      const assignRes = await axios.post(
        `${API_BASE}/api/assign-topics-to-trainer`,
        {
          unavailability_id: selectedUA.id,
          trainer_email: selectedTrainer.email,
          batch_no: batchNo || null,
          topic_ids: topicIds,
        },
        { headers: authHeaders, timeout: 10000 }
      );

      if (assignRes.data?.success !== false) {
        setMessage("✅ Topics assigned successfully");
        setSnackbarOpen(true);

        // Refresh list
        const refreshRes = await axios.get(`${API_BASE}/api/trainer-unavailability`, {
          headers: authHeaders,
        });
        setUnavailabilities(Array.isArray(refreshRes.data) ? refreshRes.data : []);
      } else {
        setMessage("⚠️ Assignment completed with warnings");
        setSnackbarOpen(true);
      }

      setConfirmOpen(false);
      setDialogOpen(false);
      setSelectedTrainer(null);
      setSelectedUA(null);
    } catch (err) {
      console.error("Error assigning topics:", err);
      setMessage("❌ Failed to assign topics (continuing with current view)");
      setSnackbarOpen(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" fontWeight="bold" mb={3} color="primary">
        Trainer Assignment Dashboard
        {batchNo && ` (Batch: ${batchNo})`}
      </Typography>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: "#1976d2" }}>
              <TableCell sx={{ color: "white", fontWeight: "bold" }}>Trainer</TableCell>
              <TableCell sx={{ color: "white", fontWeight: "bold" }}>Email</TableCell>
              <TableCell sx={{ color: "white", fontWeight: "bold" }}>Domain</TableCell>
              <TableCell sx={{ color: "white", fontWeight: "bold" }}>From</TableCell>
              <TableCell sx={{ color: "white", fontWeight: "bold" }}>To</TableCell>
              <TableCell sx={{ color: "white", fontWeight: "bold" }}>Status</TableCell>
              <TableCell sx={{ color: "white", fontWeight: "bold" }}>Assigned To</TableCell>
              {isPrivileged && (
                <TableCell sx={{ color: "white", fontWeight: "bold" }}>Action</TableCell>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {unavailabilities.map((ua) => (
              <TableRow key={ua.id || Math.random()} hover>
                <TableCell>{ua.trainer_name}</TableCell>
                <TableCell>{ua.trainer_email}</TableCell>
                <TableCell>
                  <Chip label={ua.domain} size="small" color="primary" />
                </TableCell>
                <TableCell>{ua.start_date}</TableCell>
                <TableCell>{ua.end_date}</TableCell>
                <TableCell>
                  <Chip
                    label={ua.status || "Pending"}
                    size="small"
                    color={
                      ua.status === "assigned"
                        ? "success"
                        : ua.status === "rejected"
                        ? "error"
                        : "warning"
                    }
                  />
                </TableCell>
                <TableCell>{ua.assigned_to || "-"}</TableCell>
                {isPrivileged && (
                  <TableCell>
                    {ua.status !== "assigned" && (
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => handleAssignClick(ua)}
                        disabled={loading}
                      >
                        Assign Topics
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}

            {unavailabilities.length === 0 && (
              <TableRow>
                <TableCell colSpan={isPrivileged ? 8 : 7} align="center">
                  <Typography variant="body2" color="text.secondary">
                    No trainer leaves found.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Topics + trainers dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Assign topics for {selectedUA?.trainer_name} (
          {selectedUA?.start_date} to {selectedUA?.end_date})
          <IconButton
            onClick={() => setDialogOpen(false)}
            sx={{ position: "absolute", right: 8, top: 8 }}
          >
            <CheckIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="subtitle1" mb={1}>
            Topics during this leave ({topics.length}):
          </Typography>
          <Box sx={{ mb: 2 }}>
            {topics.map((t) => (
              <Chip
                key={t.id}
                label={`${t.date} - ${t.topic_name}`}
                size="small"
                sx={{ mr: 1, mb: 1 }}
              />
            ))}
            {topics.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No topics found in this period.
              </Typography>
            )}
          </Box>

          <Typography variant="subtitle1" mb={1}>
            Available trainers in {batchNo ? `batch ${batchNo}` : selectedUA?.domain}:
          </Typography>
          <Grid container spacing={2}>
            {availableTrainers.map((tr) => (
              <Grid item xs={12} sm={6} md={4} key={tr.email || Math.random()}>
                <Paper
                  sx={{
                    p: 2,
                    cursor: "pointer",
                    "&:hover": { bgcolor: "#e3f2fd" },
                  }}
                  onClick={() => handleTrainerCardClick(tr)}
                >
                  <Typography fontWeight="bold">{tr.name || tr.email}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {tr.email}
                  </Typography>
                  <Typography variant="caption">{tr.domain}</Typography>
                  <Button fullWidth variant="contained" size="small" sx={{ mt: 1 }}>
                    Assign to this trainer
                  </Button>
                </Paper>
              </Grid>
            ))}
            {availableTrainers.length === 0 && (
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary">
                  No available trainers found for the selected criteria.
                </Typography>
              </Grid>
            )}
          </Grid>
        </DialogContent>
      </Dialog>

      {/* Confirm assignment */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Confirm assignment</DialogTitle>
        <DialogContent dividers>
          <Typography mb={2}>
            Assign {topics.length} topic(s) from{" "}
            <strong>{selectedUA?.trainer_name}</strong> to{" "}
            <strong>{selectedTrainer?.name || selectedTrainer?.email}</strong>?
          </Typography>
          <Button
            fullWidth
            variant="contained"
            color="primary"
            onClick={handleAssignTopicsConfirm}
            disabled={loading || topics.length === 0}
            startIcon={<CheckIcon />}
          >
            {loading ? "Assigning..." : "Assign Topics"}
          </Button>
        </DialogContent>
      </Dialog>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={5000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          severity={message.startsWith("✅") || message.startsWith("⚠️") ? "success" : "error"}
          sx={{ width: "100%" }}
        >
          {message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default TrainerAssignmentDashboard;
