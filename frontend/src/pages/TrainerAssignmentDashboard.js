import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  Box, Paper, Typography, Table, TableHead, TableBody, TableCell, TableRow,
  TableContainer, Chip, Button, Dialog, DialogTitle, DialogContent, Alert,
  Snackbar, IconButton, Grid, CircularProgress
} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";

const API_BASE = "https://engg-automation.onrender.com";

function TrainerAssignmentDashboard({ user, token }) {
  const [unavailabilities, setUnavailabilities] = useState([]);
  const [loadingUA, setLoadingUA] = useState(true);
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

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    "x-user-email": user?.email || "",
    "x-user-role": user?.role || "",
  };

  // Load leaves
  useEffect(() => {
    if (!token) return;
    
    const fetchLeaves = async () => {
      console.log("🚀 Loading trainer leaves...");
      setLoadingUA(true);
      
      try {
        const res = await axios.get(`${API_BASE}/api/trainer-unavailability`, {
          headers: authHeaders,
          timeout: 20000,
        });
        
        console.log("📋 Leaves loaded:", res.data?.length || 0);
        setUnavailabilities(Array.isArray(res.data) ? res.data : []);
      } catch (error) {
        console.error("❌ Leaves fetch failed:", error.response?.status, error.message);
        setMessage("Failed to load leaves. Check backend logs.");
        setSnackbarOpen(true);
        setUnavailabilities([]);
      } finally {
        setLoadingUA(false);
      }
    };

    fetchLeaves();
  }, [token]);

  const handleAssignClick = async (ua) => {
    console.log("🎯 Assign clicked:", ua.id);
    setSelectedUA(ua);
    setLoading(true);

    try {
      const res = await axios.get(`${API_BASE}/api/unavailability-topics/${ua.id}`, {
        headers: authHeaders,
        timeout: 20000,
      });

      setTopics(res.data.topics || []);
      setBatchOwner(res.data.batch_owner);
      
      const isAuthorized = requesterRole === "admin" || 
        (batchOwner && batchOwner.toLowerCase() === user?.email.toLowerCase());
      setCanAssign(isAuthorized);
      
      // Load available trainers
      if (res.data.topics?.[0]) {
        const params = {
          domain: ua.domain,
          date: res.data.topics[0].date,
          start_time: res.data.topics[0].start_time,
          end_time: res.data.topics[0].end_time,
        };
        
        const trainersRes = await axios.get(`${API_BASE}/api/available-trainers`, {
          headers: authHeaders,
          params,
        });
        setAvailableTrainers(trainersRes.data || []);
      }

      setDialogOpen(true);
    } catch (error) {
      console.error("Assign load error:", error);
      setMessage("Failed to load topics");
      setSnackbarOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignConfirm = async () => {
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/api/assign-topics-to-trainer`, {
        unavailability_id: selectedUA.id,
        trainer_email: selectedTrainer.email,
        topic_ids: topics.map(t => t.id),
        batch_owner: batchOwner,
      }, { headers: authHeaders });

      setMessage("✅ Assigned successfully!");
      setSnackbarOpen(true);
      
      // Refresh list
      const res = await axios.get(`${API_BASE}/api/trainer-unavailability`, { headers: authHeaders });
      setUnavailabilities(res.data || []);
      
      setDialogOpen(false);
      setConfirmOpen(false);
    } catch (error) {
      setMessage("❌ Assignment failed: " + (error.response?.data?.error || error.message));
      setSnackbarOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const requesterRole = (user?.role || "").toLowerCase();

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" fontWeight="bold" mb={3}>
        Trainer Assignment Dashboard
      </Typography>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: "#1976d2" }}>
              <TableCell sx={{ color: "white", fontWeight: "bold" }}>Trainer</TableCell>
              <TableCell sx={{ color: "white", fontWeight: "bold" }}>Email</TableCell>
              <TableCell sx={{ color: "white", fontWeight: "bold" }}>Domain</TableCell>
              <TableCell sx={{ color: "white", fontWeight: "bold" }}>Dates</TableCell>
              <TableCell sx={{ color: "white", fontWeight: "bold" }}>Status</TableCell>
              <TableCell sx={{ color: "white", fontWeight: "bold" }}>Assigned</TableCell>
              <TableCell sx={{ color: "white", fontWeight: "bold" }}>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {unavailabilities.map((ua) => (
              <TableRow key={ua.id} hover>
                <TableCell>{ua.trainer_name}</TableCell>
                <TableCell>{ua.trainer_email}</TableCell>
                <TableCell><Chip label={ua.domain} color="primary" size="small" /></TableCell>
                <TableCell>{ua.start_date} → {ua.end_date}</TableCell>
                <TableCell>
                  <Chip 
                    label={ua.status?.toUpperCase() || "PENDING"} 
                    color={ua.status === "assigned" ? "success" : "warning"}
                    size="small" 
                  />
                </TableCell>
                <TableCell>{ua.assigned_to || "-"}</TableCell>
                <TableCell>
                  {ua.status !== "assigned" && (
                    <Button 
                      size="small" 
                      variant="contained"
                      onClick={() => handleAssignClick(ua)}
                      disabled={loading}
                    >
                      Assign
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {loadingUA ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            ) : unavailabilities.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography color="text.secondary">
                    No trainer leaves found
                    <br />
                    <small>Check browser console & backend logs</small>
                  </Typography>
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </TableContainer>

      {/* ASSIGN DIALOG */}
      <Dialog open={dialogOpen} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedUA?.trainer_name} ({selectedUA?.start_date} to {selectedUA?.end_date})
          <IconButton onClick={() => setDialogOpen(false)} sx={{ position: 'absolute', right: 16, top: 16 }}>
            <CheckIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Typography variant="h6" mb={2}>
            Topics ({topics.length}){batchOwner && ` | Owner: ${batchOwner}`}
          </Typography>
          
          <Box sx={{ mb: 3 }}>
            {topics.map(topic => (
              <Chip 
                key={topic.id}
                label={`${topic.date} ${topic.start_time}-${topic.end_time}: ${topic.topic_name}`}
                size="small" sx={{ mr: 1, mb: 1 }}
              />
            ))}
          </Box>

          <Typography variant="h6" mb={2}>Available Trainers</Typography>
          <Grid container spacing={2}>
            {availableTrainers.map(trainer => (
              <Grid item xs={12} sm={6} key={trainer.email}>
                <Paper 
                  sx={{ p: 2, cursor: canAssign ? 'pointer' : 'default' }}
                  onClick={() => canAssign && setSelectedTrainer(trainer)}
                >
                  <Typography fontWeight="bold">{trainer.name}</Typography>
                  <Typography variant="body2">{trainer.email}</Typography>
                  <Button 
                    fullWidth size="small" 
                    variant="contained" 
                    sx={{ mt: 1 }}
                    disabled={!canAssign}
                    onClick={() => setConfirmOpen(true)}
                  >
                    Assign
                  </Button>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </DialogContent>
      </Dialog>

      {/* CONFIRM */}
      <Dialog open={confirmOpen} maxWidth="sm">
        <DialogTitle>Confirm Assignment</DialogTitle>
        <DialogContent>
          <Typography>Assign {topics.length} topics to <strong>{selectedTrainer?.name}</strong>?</Typography>
          <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
            <Button 
              fullWidth variant="contained" 
              onClick={handleAssignConfirm}
              disabled={loading}
            >
              {loading ? <CircularProgress size={20} /> : "Yes, Assign"}
            </Button>
            <Button fullWidth onClick={() => setConfirmOpen(false)}>Cancel</Button>
          </Box>
        </DialogContent>
      </Dialog>

      <Snackbar open={snackbarOpen} autoHideDuration={5000} onClose={() => setSnackbarOpen(false)}>
        <Alert severity="info">{message}</Alert>
      </Snackbar>
    </Box>
  );
}

export default TrainerAssignmentDashboard;
