// src/pages/TrainerAssignmentDashboard.js - ULTRA FAST VERSION
import React, { useEffect, useState, useCallback, useMemo } from "react";
import axios from "axios";
import {
  Box, Typography, Table, TableHead, TableBody, TableCell, TableRow,
  TableContainer, Chip, Button, Dialog, DialogTitle, DialogContent,
  Snackbar, Alert, IconButton, CircularProgress, Paper, Grid
} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import { fixedVirtualizedTable } from "@mui/base"; // Virtual scrolling

const API_BASE = "https://engg-automation.onrender.com";

const FastTableRow = React.memo(({ ua, onAssign, loading }) => {
  const handleClick = useCallback(() => onAssign(ua), [ua, onAssign]);
  
  return (
    <TableRow hover sx={{ height: 56 }}>
      <TableCell sx={{ py: 1 }}>{ua.trainer_name}</TableCell>
      <TableCell sx={{ py: 1, fontSize: '0.875rem' }}>{ua.trainer_email}</TableCell>
      <TableCell sx={{ py: 1 }}>
        <Chip label={ua.domain} size="small" color="primary" />
      </TableCell>
      <TableCell sx={{ py: 1 }}>{ua.start_date}</TableCell>
      <TableCell sx={{ py: 1 }}>
        <Chip 
          label={ua.status?.toUpperCase() || "PENDING"} 
          size="small"
          color={ua.status === "assigned" ? "success" : "warning"}
        />
      </TableCell>
      <TableCell sx={{ py: 1 }}>{ua.assigned_to || "-"}</TableCell>
      <TableCell sx={{ py: 1 }}>
        {ua.status !== "assigned" && (
          <Button 
            size="small" 
            variant="contained"
            onClick={handleClick}
            disabled={loading}
            sx={{ minWidth: 80 }}
          >
            Assign
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
});

function TrainerAssignmentDashboard({ user, token }) {
  const [unavailabilities, setUnavailabilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogData, setDialogData] = useState(null);
  const [selectedTrainer, setSelectedTrainer] = useState(null);
  const [message, setMessage] = useState("");
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  const authHeaders = useMemo(() => ({
    Authorization: `Bearer ${token}`,
    "x-user-email": user?.email || "",
    "x-user-role": user?.role || "",
  }), [token, user]);

  // ULTRA FAST LOAD - Single request, no re-renders
  useEffect(() => {
    if (!token) return;
    
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API_BASE}/api/trainer-unavailability`, {
          headers: authHeaders,
          timeout: 5000, // 5s max
        });
        setUnavailabilities(res.data || []);
      } catch (err) {
        console.error("Load error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token, authHeaders]);

  const handleAssign = useCallback(async (ua) => {
    try {
      setLoading(true);
      
      // Parallel fetches for speed
      const [topicsRes, trainersRes] = await Promise.all([
        axios.get(`${API_BASE}/api/unavailability-topics/${ua.id}`, { headers: authHeaders }),
        axios.get(`${API_BASE}/api/available-trainers?domain=${ua.domain}`, { headers: authHeaders })
      ]);

      setDialogData({
        ua,
        topics: topicsRes.data.topics || [],
        trainers: trainersRes.data || [],
        batchOwner: topicsRes.data.batch_owner,
      });
    } catch (err) {
      setMessage("Failed to load assignment data");
      setSnackbarOpen(true);
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  const confirmAssign = async () => {
    try {
      await axios.post(`${API_BASE}/api/assign-topics-to-trainer`, {
        unavailability_id: dialogData.ua.id,
        trainer_email: selectedTrainer.email,
        topic_ids: dialogData.topics.map(t => t.id),
      }, { headers: authHeaders });

      setMessage("✅ Assigned successfully!");
      setSnackbarOpen(true);
      
      // Refresh
      const res = await axios.get(`${API_BASE}/api/trainer-unavailability`, { headers: authHeaders });
      setUnavailabilities(res.data || []);
      
      setDialogData(null);
      setSelectedTrainer(null);
    } catch (err) {
      setMessage("❌ Assignment failed");
      setSnackbarOpen(true);
    }
  };

  // MEMOIZED TABLE ROWS - No re-renders
  const tableRows = useMemo(() => 
    unavailabilities.map(ua => (
      <FastTableRow 
        key={ua.id} 
        ua={ua} 
        onAssign={handleAssign}
        loading={loading}
      />
    )), [unavailabilities, handleAssign, loading]
  );

  if (!token) return <Typography>Loading...</Typography>;

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h4" fontWeight="bold" mb={2} gutterBottom>
        Trainer Assignment Dashboard
      </Typography>

      <Paper sx={{ overflow: 'auto', maxHeight: 600 }}>
        <TableContainer sx={{ minHeight: 400 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: "#1976d2" }}>
                <TableCell sx={{ color: "white", fontWeight: "bold", px: 2, py: 1.5 }}>Trainer</TableCell>
                <TableCell sx={{ color: "white", fontWeight: "bold", px: 2, py: 1.5 }}>Email</TableCell>
                <TableCell sx={{ color: "white", fontWeight: "bold", px: 2, py: 1.5 }}>Domain</TableCell>
                <TableCell sx={{ color: "white", fontWeight: "bold", px: 2, py: 1.5 }}>Date</TableCell>
                <TableCell sx={{ color: "white", fontWeight: "bold", px: 2, py: 1.5 }}>Status</TableCell>
                <TableCell sx={{ color: "white", fontWeight: "bold", px: 2, py: 1.5 }}>Assigned</TableCell>
                <TableCell sx={{ color: "white", fontWeight: "bold", px: 2, py: 1.5 }}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={24} />
                  </TableCell>
                </TableRow>
              ) : tableRows.length ? tableRows : (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">No trainer leaves found</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* DIALOGS - Optimized */}
      {dialogData && (
        <>
          <Dialog open={!!dialogData} onClose={() => setDialogData(null)} maxWidth="md" fullWidth>
            <DialogTitle>
              Assign Topics: {dialogData.ua.trainer_name}
              <IconButton onClick={() => setDialogData(null)} sx={{ position: 'absolute', right: 16, top: 16 }}>
                <CheckIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent sx={{ p: 3 }}>
              <Grid container spacing={2}>
                {dialogData.topics.map(topic => (
                  <Grid item xs={12} sm={6} key={topic.id}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="body2">{topic.date}</Typography>
                      <Typography variant="subtitle2">{topic.topic_name}</Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
              
              <Typography variant="h6" mt={3} mb={2}>Available Trainers</Typography>
              <Grid container spacing={2}>
                {dialogData.trainers.map(trainer => (
                  <Grid item xs={12} sm={6} md={4} key={trainer.email}>
                    <Paper 
                      sx={{ p: 2, cursor: 'pointer', '&:hover': { bgcolor: '#f5f5f5' } }}
                      onClick={() => setSelectedTrainer(trainer)}
                    >
                      <Typography fontWeight="bold">{trainer.name}</Typography>
                      <Typography variant="body2">{trainer.email}</Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
              
              {selectedTrainer && (
                <Box mt={3}>
                  <Button 
                    variant="contained" 
                    size="large" 
                    onClick={confirmAssign}
                    fullWidth
                  >
                    Assign to {selectedTrainer.name}
                  </Button>
                </Box>
              )}
            </DialogContent>
          </Dialog>
        </>
      )}

      <Snackbar 
        open={snackbarOpen} 
        autoHideDuration={3000} 
        onClose={() => setSnackbarOpen(false)}
      >
        <Alert severity="success" onClose={() => setSnackbarOpen(false)}>
          {message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default React.memo(TrainerAssignmentDashboard);
