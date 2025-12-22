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

const API_BASE =
  process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

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
  const isManagerOrAdmin =
    lowerRole === "manager" || lowerRole === "admin";
  const isPrivileged = isManagerOrAdmin || true; // UI only – backend enforces real auth

  // Only send Authorization to avoid CORS issues
  const authHeaders = token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {};

  // Load unavailability list (simple: no batch filter, matches backend route)
  useEffect(() => {
    const fetchUA = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/trainer-unavailability`, {
          headers: authHeaders,
        });
        setUnavailabilities(res.data || []);
      } catch (err) {
        console.error("Error fetching trainer-unavailability:", err);
        setMessage("Failed to fetch trainer leaves");
        setSnackbarOpen(true);
      }
    };
    fetchUA();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // When "Assign Topics" is clicked
  const handleAssignClick = async (ua) => {
    setSelectedUA(ua);
    setLoading(true);

    try {
      // 1) Fetch topics affected by this leave
      const topicsRes = await axios.get(
        `${API_BASE}/api/unavailability-topics/${ua.id}`,
        { headers: authHeaders }
      );
      setTopics(topicsRes.data?.topics || []);

      // 2) Fetch available trainers for same domain & date range
      const availRes = await axios.get(
        `${API_BASE}/api/available-trainers`,
        {
          headers: authHeaders,
          params: {
            domain: ua.domain,
            start_date: ua.start_date,
            end_date: ua.end_date,
          },
        }
      );
      setAvailableTrainers(availRes.data || []);

      setDialogOpen(true);
    } catch (err) {
      console.error("Error loading topics/trainers:", err);
      setMessage("Error loading topics / trainers");
      setSnackbarOpen(true);
    }

    setLoading(false);
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

      await axios.post(
        `${API_BASE}/api/assign-topics-to-trainer`,
        {
          unavailability_id: selectedUA.id,
          trainer_email: selectedTrainer.email,
          batch_no: batchNo,
          topic_ids: topicIds,
        },
        { headers: authHeaders }
      );

      setMessage("✅ Topics assigned successfully");
      setSnackbarOpen(true);

      setConfirmOpen(false);
      setDialogOpen(false);
      setSelectedTrainer(null);
      setSelectedUA(null);

      // refresh list
      const res = await axios.get(`${API_BASE}/api/trainer-unavailability`, {
        headers: authHeaders,
      });
      setUnavailabilities(res.data || []);
    } catch (err) {
      console.error("Error assigning topics:", err);
      setMessage("❌ Failed to assign topics");
      setSnackbarOpen(true);
    }
    setLoading(false);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" fontWeight="bold" mb={3} color="primary">
        Trainer Assignment Dashboard
      </Typography>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: "#1976d2" }}>
              <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                Trainer
              </TableCell>
              <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                Email
              </TableCell>
              <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                Domain
              </TableCell>
              <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                From
              </TableCell>
              <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                To
              </TableCell>
              <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                Status
              </TableCell>
              <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                Assigned To
              </TableCell>
              {isPrivileged && (
                <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                  Action
                </TableCell>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {unavailabilities.map((ua) => (
              <TableRow key={ua.id} hover>
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

      {/* Dialog: show topics + available trainers */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
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
            Available trainers in {selectedUA?.domain}:
          </Typography>
          <Grid container spacing={2}>
            {availableTrainers.map((tr) => (
              <Grid item xs={12} sm={6} md={4} key={tr.email}>
                <Paper
                  sx={{
                    p: 2,
                    cursor: "pointer",
                    "&:hover": { bgcolor: "#e3f2fd" },
                  }}
                  onClick={() => handleTrainerCardClick(tr)}
                >
                  <Typography fontWeight="bold">{tr.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {tr.email}
                  </Typography>
                  <Typography variant="caption">{tr.domain}</Typography>
                  <Button
                    fullWidth
                    variant="contained"
                    size="small"
                    sx={{ mt: 1 }}
                  >
                    Assign to this trainer
                  </Button>
                </Paper>
              </Grid>
            ))}
            {availableTrainers.length === 0 && (
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary">
                  No available trainers found for this domain and dates.
                </Typography>
              </Grid>
            )}
          </Grid>
        </DialogContent>
      </Dialog>

      {/* Confirm assign dialog */}
      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Confirm assignment</DialogTitle>
        <DialogContent dividers>
          <Typography mb={2}>
            Assign {topics.length} topic(s) from{" "}
            <strong>{selectedUA?.trainer_name}</strong> to{" "}
            <strong>{selectedTrainer?.name}</strong> (
            {selectedTrainer?.email})?
          </Typography>
          <Button
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
          severity={message.startsWith("✅") ? "success" : "error"}
          sx={{ width: "100%" }}
          onClose={() => setSnackbarOpen(false)}
        >
          {message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default TrainerAssignmentDashboard;
