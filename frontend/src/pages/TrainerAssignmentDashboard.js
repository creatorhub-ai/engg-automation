// src/pages/TrainerAssignmentDashboard.js - BULLETPROOF VERSION
import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  Box, Typography, Table, TableHead, TableBody, TableCell, TableRow,
  TableContainer, Chip, Button, Dialog, DialogTitle, DialogContent,
  Snackbar, Alert, IconButton, CircularProgress, Paper, Grid
} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";

const API_BASE = "https://engg-automation.onrender.com";

function TrainerAssignmentDashboard({ user, token }) {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(null);
  const [selectedTrainer, setSelectedTrainer] = useState(null);
  const [message, setMessage] = useState("");
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // BULLETPROOF DATA FETCH
  useEffect(() => {
    const fetchLeaves = async () => {
      console.log("🚀 [DEBUG] Starting fetch - token:", !!token);
      
      if (!token) {
        setLoading(false);
        return;
      }

      setLoading(true);
      
      try {
        console.log("🌐 [DEBUG] Calling API:", `${API_BASE}/api/trainer-unavailability`);
        
        const response = await axios.get(`${API_BASE}/api/trainer-unavailability`, {
          headers,
          timeout: 10000,
        });

        console.log("📊 [DEBUG] API Response:", {
          status: response.status,
          dataLength: response.data?.length || 0,
          firstItem: response.data?.[0],
          fullData: response.data
        });

        const data = Array.isArray(response.data) ? response.data : [];
        setLeaves(data);
        
        if (data.length === 0) {
          console.log("⚠️ [DEBUG] No data returned - table might be empty");
          setMessage("No trainer leaves found in database");
          setSnackbarOpen(true);
        }

      } catch (error) {
        console.error("💥 [ERROR] Fetch failed:", {
          message: error.message,
          status: error.response?.status,
          data: error.response?.data,
          url: error.config?.url
        });
        
        setMessage(`Failed to fetch: ${error.message}`);
        setSnackbarOpen(true);
        setLeaves([]);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaves();
  }, [token]);

  const handleAssignClick = async (leave) => {
    console.log("🎯 [DEBUG] Assign clicked:", leave.id);
    
    try {
      setLoading(true);
      
      const [topicsRes, trainersRes] = await Promise.all([
        axios.get(`${API_BASE}/api/unavailability-topics/${leave.id}`, { headers, timeout: 8000 }),
        axios.get(`${API_BASE}/api/available-trainers?domain=${leave.domain}`, { headers, timeout: 8000 })
      ]);

      console.log("📋 [DEBUG] Topics:", topicsRes.data.topics?.length || 0);
      console.log("👥 [DEBUG] Trainers:", trainersRes.data?.length || 0);

      setDialog({
        leave,
        topics: topicsRes.data.topics || [],
        trainers: trainersRes.data || [],
        batchOwner: topicsRes.data.batch_owner
      });
    } catch (error) {
      console.error("💥 [ERROR] Dialog load failed:", error);
      setMessage("Failed to load assignment dialog");
      setSnackbarOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAssign = async () => {
    try {
      console.log("✅ [DEBUG] Confirming assignment:", selectedTrainer?.email);
      
      await axios.post(`${API_BASE}/api/assign-topics-to-trainer`, {
        unavailability_id: dialog.leave.id,
        trainer_email: selectedTrainer.email,
        topic_ids: dialog.topics.map(t => t.id),
      }, { headers, timeout: 10000 });

      setMessage("✅ Topics assigned successfully!");
      setSnackbarOpen(true);
      
      // Refresh data
      const response = await axios.get(`${API_BASE}/api/trainer-unavailability`, { headers });
      setLeaves(Array.isArray(response.data) ? response.data : []);
      
      setDialog(null);
      setSelectedTrainer(null);
    } catch (error) {
      console.error("💥 [ERROR] Assignment failed:", error);
      setMessage(`Assignment failed: ${error.response?.data?.error || error.message}`);
      setSnackbarOpen(true);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" fontWeight="bold" mb={3} color="primary">
        Trainer Assignment Dashboard
      </Typography>

      {/* DEBUG INFO */}
      <Paper sx={{ p: 2, mb: 2, bgcolor: "#f5f5f5" }}>
        <Typography variant="caption" color="text.secondary">
          Debug: {leaves.length} leaves | Loading: {loading.toString()} | Token: {token ? "OK" : "MISSING"}
        </Typography>
      </Paper>

      <Paper elevation={3}>
        <TableContainer sx={{ maxHeight: 600 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: "#1976d2" }}>
                <TableCell sx={{ color: "white", fontWeight: "bold", py: 2 }}>Trainer</TableCell>
                <TableCell sx={{ color: "white", fontWeight: "bold", py: 2 }}>Email</TableCell>
                <TableCell sx={{ color: "white", fontWeight: "bold", py: 2 }}>Domain</TableCell>
                <TableCell sx={{ color: "white", fontWeight: "bold", py: 2 }}>Start Date</TableCell>
                <TableCell sx={{ color: "white", fontWeight: "bold", py: 2 }}>Status</TableCell>
                <TableCell sx={{ color: "white", fontWeight: "bold", py: 2 }}>Assigned To</TableCell>
                <TableCell sx={{ color: "white", fontWeight: "bold", py: 2 }}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 8 }}>
                    <CircularProgress size={32} />
                    <Typography variant="h6" mt={2}>Loading trainer leaves...</Typography>
                  </TableCell>
                ) : leaves.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 8 }}>
                    <Typography variant="h6" color="text.secondary">
                      No trainer leaves found
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Check browser console (F12) for detailed logs
                    </Typography>
                  </TableCell>
                ) : (
                  leaves.map((leave) => (
                    <TableRow key={leave.id} hover>
                      <TableCell sx={{ py: 2 }}>{leave.trainer_name}</TableCell>
                      <TableCell sx={{ py: 2, fontSize: '0.875rem' }}>{leave.trainer_email}</TableCell>
                      <TableCell sx={{ py: 2 }}>
                        <Chip label={leave.domain} size="small" color="primary" />
                      </TableCell>
                      <TableCell sx={{ py: 2 }}>{leave.start_date}</TableCell>
                      <TableCell sx={{ py: 2 }}>
                        <Chip 
                          label={leave.status?.toUpperCase() || "PENDING"}
                          size="small"
                          color={leave.status === "assigned" ? "success" : "warning"}
                        />
                      </TableCell>
                      <TableCell sx={{ py: 2 }}>{leave.assigned_to || "-"}</TableCell>
                      <TableCell sx={{ py: 2 }}>
                        {leave.status !== "assigned" && (
                          <Button
                            variant="contained"
                            size="small"
                            onClick={() => handleAssignClick(leave)}
                            disabled={loading}
                          >
                            Assign Topics
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* ASSIGNMENT DIALOG */}
      {dialog && (
        <Dialog open={true} onClose={() => setDialog(null)} maxWidth="md" fullWidth>
          <DialogTitle>
            Assign Topics: {dialog.leave.trainer_name}
            <IconButton onClick={() => setDialog(null)} sx={{ position: 'absolute', right: 16, top: 16 }}>
              <CheckIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ p: 3 }}>
            <Typography variant="h6" mb={2}>
              Topics Found ({dialog.topics.length})
              {dialog.batchOwner && ` | Batch Owner: ${dialog.batchOwner}`}
            </Typography>
            
            <Grid container spacing={2} sx={{ mb: 4 }}>
              {dialog.topics.slice(0, 8).map((topic) => (
                <Grid item xs={12} sm={6} key={topic.id}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="body2">{topic.date}</Typography>
                    <Typography variant="subtitle2" fontWeight="bold">
                      {topic.topic_name || "Unnamed Topic"}
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>

            <Typography variant="h6" mb={2}>Available Trainers ({dialog.trainers.length})</Typography>
            <Grid container spacing={2}>
              {dialog.trainers.map((trainer) => (
                <Grid item xs={12} sm={6} md={4} key={trainer.email}>
                  <Paper
                    sx={{
                      p: 2,
                      cursor: 'pointer',
                      border: selectedTrainer?.email === trainer.email ? '2px solid #1976d2' : '1px solid #e0e0e0',
                      '&:hover': { bgcolor: selectedTrainer?.email === trainer.email ? '#e3f2fd' : '#f5f5f5' }
                    }}
                    onClick={() => setSelectedTrainer(trainer)}
                  >
                    <Typography fontWeight="bold">{trainer.name}</Typography>
                    <Typography variant="body2" color="text.secondary">{trainer.email}</Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>

            {selectedTrainer && (
              <Box sx={{ mt: 4 }}>
                <Button
                  variant="contained"
                  size="large"
                  onClick={handleConfirmAssign}
                  disabled={loading}
                  sx={{ px: 4, py: 1.5 }}
                >
                  ✅ Assign {dialog.topics.length} Topics to {selectedTrainer.name}
                </Button>
              </Box>
            )}
          </DialogContent>
        </Dialog>
      )}

      <Snackbar 
        open={snackbarOpen} 
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity={message.includes("✅") ? "success" : "error"} sx={{ width: '100%' }}>
          {message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default TrainerAssignmentDashboard;
