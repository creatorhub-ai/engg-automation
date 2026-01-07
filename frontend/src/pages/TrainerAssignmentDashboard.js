// src/pages/TrainerAssignmentDashboard.js - PERFECT SYNTAX
import React, { useEffect, useState, useCallback, useMemo } from "react";
import axios from "axios";
import {
  Box, Typography, Table, TableHead, TableBody, TableCell, TableRow,
  TableContainer, Chip, Button, Dialog, DialogTitle, DialogContent,
  Snackbar, Alert, IconButton, CircularProgress, Paper, Grid
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

const API_BASE = "https://engg-automation.onrender.com";

function TrainerAssignmentDashboard({ user, token }) {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(null);
  const [selectedTrainer, setSelectedTrainer] = useState(null);
  const [message, setMessage] = useState("");
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  const headers = useMemo(() => ({
    Authorization: `Bearer ${token || ''}`,
    "Content-Type": "application/json",
  }), [token]);

  const fetchLeaves = useCallback(async () => {
    console.log("🚀 Starting fetch - token exists:", !!token);
    
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    
    try {
      console.log("🌐 Fetching from:", `${API_BASE}/api/trainer-unavailability`);
      
      const response = await axios.get(`${API_BASE}/api/trainer-unavailability`, {
        headers,
        timeout: 10000,
      });

      console.log("📊 Response:", {
        status: response.status,
        length: response.data?.length || 0,
        sample: response.data?.[0] || "none"
      });

      const data = Array.isArray(response.data) ? response.data : [];
      setLeaves(data);

      if (data.length === 0) {
        console.log("⚠️ No leaves found");
        setMessage("No trainer leaves found");
        setSnackbarOpen(true);
      }

    } catch (error) {
      console.error("💥 Fetch error:", error.response?.status || error.message);
      setMessage(`Fetch failed: ${error.message}`);
      setSnackbarOpen(true);
      setLeaves([]);
    } finally {
      setLoading(false);
    }
  }, [token, headers]);

  useEffect(() => {
    fetchLeaves();
  }, [fetchLeaves]);

  const handleAssignClick = useCallback(async (leave) => {
    console.log("🎯 Assign clicked:", leave.id);
    
    try {
      setLoading(true);
      
      const [topicsRes, trainersRes] = await Promise.all([
        axios.get(`${API_BASE}/api/unavailability-topics/${leave.id}`, { 
          headers, 
          timeout: 8000 
        }),
        axios.get(`${API_BASE}/api/available-trainers?domain=${leave.domain}`, { 
          headers, 
          timeout: 8000 
        })
      ]);

      setDialog({
        leave,
        topics: topicsRes.data.topics || [],
        trainers: trainersRes.data || [],
        batchOwner: topicsRes.data.batch_owner
      });
    } catch (error) {
      console.error("Dialog error:", error);
      setMessage("Failed to load dialog data");
      setSnackbarOpen(true);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  const handleConfirmAssign = useCallback(async () => {
    if (!dialog?.leave || !selectedTrainer) return;
    
    try {
      console.log("✅ Assigning to:", selectedTrainer.email);
      
      await axios.post(`${API_BASE}/api/assign-topics-to-trainer`, {
        unavailability_id: dialog.leave.id,
        trainer_email: selectedTrainer.email,
        topic_ids: (dialog.topics || []).map(t => t.id).filter(Boolean),
      }, { 
        headers, 
        timeout: 10000 
      });

      setMessage("✅ Topics assigned successfully!");
      setSnackbarOpen(true);
      
      await fetchLeaves();
      setDialog(null);
      setSelectedTrainer(null);
    } catch (error) {
      console.error("Assign error:", error);
      setMessage(`Assignment failed: ${error.response?.data?.error || error.message}`);
      setSnackbarOpen(true);
    }
  }, [dialog, selectedTrainer, headers, fetchLeaves]);

  const tableRows = useMemo(() => 
    leaves.map((leave) => (
      <TableRow 
        key={leave.id || `leave-${Math.random()}`}
        hover 
        sx={{ "&:hover": { bgcolor: "#f5f5f5" } }}
      >
        <TableCell sx={{ py: 3, fontWeight: 500 }}>
          {leave.trainer_name || "N/A"}
        </TableCell>
        <TableCell sx={{ py: 3, fontSize: '0.875rem' }}>
          {leave.trainer_email || "N/A"}
        </TableCell>
        <TableCell sx={{ py: 3 }}>
          <Chip label={leave.domain || "N/A"} size="small" color="primary" />
        </TableCell>
        <TableCell sx={{ py: 3 }}>
          {leave.start_date || "N/A"}
        </TableCell>
        <TableCell sx={{ py: 3 }}>
          <Chip 
            label={(leave.status || "PENDING").toUpperCase()}
            size="small"
            color={leave.status === "assigned" ? "success" : 
                   leave.status === "rejected" ? "error" : "warning"}
          />
        </TableCell>
        <TableCell sx={{ py: 3 }}>
          {leave.assigned_to || "-"}
        </TableCell>
        <TableCell sx={{ py: 3 }}>
          {leave.status !== "assigned" && (
            <Button
              variant="contained"
              size="small"
              onClick={() => handleAssignClick(leave)}
              disabled={loading}
              sx={{ minWidth: 110 }}
            >
              Assign Topics
            </Button>
          )}
        </TableCell>
      </TableRow>
    )),
    [leaves, handleAssignClick, loading]
  );

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" fontWeight="bold" mb={3} color="primary">
        Trainer Assignment Dashboard
      </Typography>

      <Paper sx={{ p: 2, mb: 3, bgcolor: "#e3f2fd" }}>
        <Typography variant="body2" color="text.primary">
          🔍 Debug: {leaves.length} leaves | Loading: {loading ? "YES" : "NO"} | 
          Token: {token ? "VALID" : "MISSING"}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Check browser console (F12) for detailed logs
        </Typography>
      </Paper>

      <Paper elevation={4} sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <TableContainer sx={{ maxHeight: 600 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: "#1976d2" }}>
                <TableCell sx={{ color: "white", fontWeight: "bold", py: 2.5, px: 3 }}>
                  Trainer
                </TableCell>
                <TableCell sx={{ color: "white", fontWeight: "bold", py: 2.5, px: 2 }}>
                  Email
                </TableCell>
                <TableCell sx={{ color: "white", fontWeight: "bold", py: 2.5 }}>
                  Domain
                </TableCell>
                <TableCell sx={{ color: "white", fontWeight: "bold", py: 2.5 }}>
                  Start Date
                </TableCell>
                <TableCell sx={{ color: "white", fontWeight: "bold", py: 2.5 }}>
                  Status
                </TableCell>
                <TableCell sx={{ color: "white", fontWeight: "bold", py: 2.5 }}>
                  Assigned To
                </TableCell>
                <TableCell sx={{ color: "white", fontWeight: "bold", py: 2.5 }}>
                  Action
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 12 }}>
                    <CircularProgress size={40} sx={{ mb: 2 }} />
                    <Typography variant="h5">Loading trainer leaves...</Typography>
                  </TableCell>
                </TableRow>
              ) : leaves.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 12 }}>
                    <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                      📭 No trainer leaves found
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Check backend logs and browser console (F12)
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                tableRows
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {dialog && (
        <Dialog open={true} onClose={() => setDialog(null)} maxWidth="lg" fullWidth>
          <DialogTitle sx={{ pb: 2 }}>
            <Typography variant="h5">
              Assign Topics: <strong>{dialog.leave.trainer_name || "N/A"}</strong>
            </Typography>
            <IconButton 
              onClick={() => setDialog(null)} 
              sx={{ position: 'absolute', right: 16, top: 16 }}
              size="small"
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          
          <DialogContent sx={{ p: 4 }}>
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" mb={2}>
                Topics ({(dialog.topics || []).length})
                {dialog.batchOwner && (
                  <Chip label={`Owner: ${dialog.batchOwner}`} color="info" size="small" sx={{ ml: 2 }} />
                )}
              </Typography>
              
              <Grid container spacing={2}>
                {(dialog.topics || []).slice(0, 8).map((topic, index) => (
                  <Grid item xs={12} sm={6} md={4} lg={3} key={topic.id || `topic-${index}`}>
                    <Paper sx={{ p: 2.5, height: 100, display: 'flex', flexDirection: 'column' }}>
                      <Typography variant="caption" color="text.secondary">
                        {topic.date || "N/A"}
                      </Typography>
                      <Typography variant="subtitle2" fontWeight="bold" sx={{ mt: 0.5 }}>
                        {topic.topic_name || "Unnamed Topic"}
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Box>

            <Typography variant="h6" mb={3}>
              Available Trainers ({(dialog.trainers || []).length})
            </Typography>
            
            <Grid container spacing={3}>
              {(dialog.trainers || []).map((trainer) => (
                <Grid item xs={12} sm={6} md={4} key={trainer.email || Math.random()}>
                  <Paper
                    elevation={selectedTrainer?.email === trainer.email ? 8 : 1}
                    sx={{ 
                      p: 3, 
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      borderRadius: 2,
                      '&:hover': { 
                        transform: 'translateY(-2px)',
                        boxShadow: 6 
                      },
                      border: selectedTrainer?.email === trainer.email ? '3px solid #1976d2' : '1px solid #e0e0e0',
                      bgcolor: selectedTrainer?.email === trainer.email ? '#e3f2fd' : 'white'
                    }}
                    onClick={() => setSelectedTrainer(trainer)}
                  >
                    <Typography variant="h6" fontWeight="bold" gutterBottom>
                      {trainer.name || "N/A"}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {trainer.email || "N/A"}
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>

            {selectedTrainer && (
              <Box sx={{ mt: 5, textAlign: 'center' }}>
                <Button
                  variant="contained"
                  size="large"
                  onClick={handleConfirmAssign}
                  disabled={loading}
                  sx={{ 
                    px: 6, 
                    py: 2, 
                    fontSize: '1.1rem',
                    borderRadius: 3,
                    boxShadow: 3
                  }}
                >
                  {loading ? (
                    <>
                      <CircularProgress size={24} sx={{ mr: 2 }} />
                      Assigning...
                    </>
                  ) : (
                    <>
                      ✅ Assign {(dialog.topics || []).length} Topics to {selectedTrainer.name}
                    </>
                  )}
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
        <Alert 
          severity={message.includes("✅") || message.includes("success") ? "success" : "error"} 
          sx={{ width: '100%' }}
          onClose={() => setSnackbarOpen(false)}
        >
          {message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default TrainerAssignmentDashboard;
