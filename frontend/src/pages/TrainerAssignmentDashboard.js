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
  const [batchOwner, setBatchOwner] = useState(null);
  const [canAssign, setCanAssign] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const lowerRole = (user?.role || "").toLowerCase();
  const requesterEmail = user?.email || "";
  const requesterRole = lowerRole;
  const authHeaders = {
    Authorization: `Bearer ${token}`,
    "x-user-email": requesterEmail,
    "x-user-role": requesterRole,
  };

  // Load unavailabilities
  useEffect(() => {
    const fetchUA = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/trainer-unavailability`, {
          headers: authHeaders,
          timeout: 10000,
        });
        setUnavailabilities(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Fetch UA error:", err);
        setUnavailabilities([]);
        setMessage("Failed to fetch trainer leaves");
        setSnackbarOpen(true);
      }
    };
    if (token) fetchUA();
  }, [token]);

  const handleAssignClick = async (ua) => {
    setSelectedUA(ua);
    setTopics([]);
    setAvailableTrainers([]);
    setLoading(true);

    try {
      // 1. Fetch topics (with batch_owner)
      const topicsRes = await axios.get(`${API_BASE}/api/unavailability-topics/${ua.id}`, {
        headers: authHeaders,
        timeout: 10000,
      });
      const topicList = Array.isArray(topicsRes.data.topics) ? topicsRes.data.topics : [];
      setTopics(topicList);
      setBatchOwner(topicsRes.data.batch_owner);

      // Check authorization
      const isAuthorized = 
        batchOwner?.toLowerCase() === requesterEmail.toLowerCase() || 
        requesterRole === "admin";
      setCanAssign(isAuthorized);

      if (!topicList.length) {
        setLoading(false);
        return;
      }

      // 2. Get available trainers (using FIRST topic's date/time as sample)
      const sampleTopic = topicList[0];
      const trainerParams = {
        batch_no: batchNo || sampleTopic?.batch_no,
        domain: ua.domain,
        date: sampleTopic?.date,
        start_time: sampleTopic?.start_time,
        end_time: sampleTopic?.end_time,
      };

      const availRes = await axios.get(`${API_BASE}/api/available-trainers`, {
        headers: authHeaders,
        params: trainerParams,
        timeout: 10000,
      });

      const trainers = Array.isArray(availRes.data) ? availRes.data : [];
      setAvailableTrainers(trainers.length ? trainers : [{
        name: "No trainers available at this time slot",
        email: "contact-admin@company.com",
        domain: ua.domain,
      }]);

      setDialogOpen(true);
    } catch (err) {
      console.error("handleAssignClick error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleTrainerCardClick = (trainer) => {
    if (!canAssign) return;
    setSelectedTrainer(trainer);
    setConfirmOpen(true);
  };

  const handleAssignTopicsConfirm = async () => {
    if (!selectedUA || !selectedTrainer || !canAssign || topics.length === 0) {
      setConfirmOpen(false);
      return;
    }

    setLoading(true);
    try {
      const topicIds = topics.map(t => t.id).filter(Boolean);

      await axios.post(`${API_BASE}/api/assign-topics-to-trainer`, {
        unavailability_id: selectedUA.id,
        trainer_email: selectedTrainer.email,
        batch_no: batchNo || topics[0]?.batch_no,
        topic_ids: topicIds,
      }, {
        headers: authHeaders,
        timeout: 15000,
      });

      setMessage("✅ Topics assigned successfully");
      setSnackbarOpen(true);

      // Refresh list
      const refreshRes = await axios.get(`${API_BASE}/api/trainer-unavailability`, {
        headers: authHeaders,
      });
      setUnavailabilities(Array.isArray(refreshRes.data) ? refreshRes.data : []);

      // Reset
      setConfirmOpen(false);
      setDialogOpen(false);
      setSelectedTrainer(null);
      setSelectedUA(null);
    } catch (err) {
      console.error("Assign error:", err);
      setMessage("❌ Failed to assign topics");
      setSnackbarOpen(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" fontWeight="bold" mb={3} color="primary">
        Trainer Assignment Dashboard {batchNo && `(Batch: ${batchNo})`}
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
              <TableCell sx={{ color: "white", fontWeight: "bold" }}>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {unavailabilities.map((ua) => (
              <TableRow key={ua.id} hover>
                <TableCell>{ua.trainername}</TableCell>
                <TableCell>{ua.traineremail}</TableCell>
                <TableCell><Chip label={ua.domain} size="small" color="primary" /></TableCell>
                <TableCell>{ua.startdate}</TableCell>
                <TableCell>{ua.enddate}</TableCell>
                <TableCell>
                  <Chip
                    label={ua.status || "Pending"}
                    size="small"
                    color={ua.status === "assigned" ? "success" : "warning"}
                  />
                </TableCell>
                <TableCell>{ua.assignedto || "-"}</TableCell>
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
              </TableRow>
            ))}
            {unavailabilities.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <Typography variant="body2" color="text.secondary">
                    No trainer leaves found.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Assignment Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Assign Topics: {selectedUA?.trainername} ({selectedUA?.startdate} to {selectedUA?.end_date})
          {!canAssign && (
            <Chip label="Not Authorized" color="error" size="small" sx={{ ml: 2 }} />
          )}
          <IconButton onClick={() => setDialogOpen(false)} sx={{ position: "absolute", right: 8, top: 8 }}>
            <CheckIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography variant="subtitle1" mb={1}>
            Topics ({topics.length}): {batchOwner && `Batch Owner: ${batchOwner}`}
          </Typography>
          
          <Box sx={{ mb: 3 }}>
            {topics.map((t) => (
              <Chip
                key={t.id}
                label={`${t.date} ${t.start_time}-${t.end_time}: ${t.topic_name}`}
                size="small"
                sx={{ mr: 1, mb: 1 }}
              />
            ))}
            {topics.length === 0 && (
              <Typography color="text.secondary">No topics found.</Typography>
            )}
          </Box>

          <Typography variant="subtitle1" mb={2}>
            Available trainers ({availableTrainers.length}):
          </Typography>
          
          <Grid container spacing={2}>
            {availableTrainers.map((tr) => (
              <Grid item xs={12} sm={6} md={4} key={tr.email}>
                <Paper
                  sx={{
                    p: 2,
                    cursor: canAssign ? "pointer" : "default",
                    bgcolor: canAssign ? "inherit" : "grey.100",
                    "&:hover": canAssign ? { bgcolor: "#e3f2fd" } : {},
                  }}
                  onClick={() => handleTrainerCardClick(tr)}
                >
                  <Typography fontWeight="bold">{tr.name}</Typography>
                  <Typography variant="body2" color="text.secondary">{tr.email}</Typography>
                  <Typography variant="caption">{tr.domain}</Typography>
                  <Button 
                    fullWidth 
                    variant="contained" 
                    size="small" 
                    sx={{ mt: 1 }}
                    disabled={!canAssign}
                  >
                    Assign
                  </Button>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Confirm Assignment</DialogTitle>
        <DialogContent>
          <Typography mb={2}>
            Assign {topics.length} topics to <strong>{selectedTrainer?.name}</strong>?
          </Typography>
          <Button
            fullWidth
            variant="contained"
            onClick={handleAssignTopicsConfirm}
            disabled={loading || !canAssign}
            startIcon={<CheckIcon />}
          >
            {loading ? "Assigning..." : "Confirm Assign"}
          </Button>
        </DialogContent>
      </Dialog>

      <Snackbar open={snackbarOpen} autoHideDuration={5000} onClose={() => setSnackbarOpen(false)}>
        <Alert severity={message.includes("✅") ? "success" : "error"} sx={{ width: "100%" }}>
          {message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default TrainerAssignmentDashboard;
