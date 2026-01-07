// src/pages/TrainerAssignmentDashboard.js - SMART AVAILABILITY CHECK
import React, { useEffect, useState, useCallback } from "react";
import {
  Box, Typography, Table, TableHead, TableBody, TableCell, TableRow,
  TableContainer, Chip, Button, Paper, Alert, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  MenuItem, Select, FormControl, InputLabel, Checkbox, FormControlLabel,
  Collapse, LinearProgress
} from "@mui/material";
import { useSnackbar } from 'notistack';

const API_BASE = "https://engg-automation.onrender.com";

function TrainerAssignmentDashboard() {
  const { enqueueSnackbar } = useSnackbar();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("Connecting to database...");
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [topics, setTopics] = useState([]);
  const [availableTrainers, setAvailableTrainers] = useState([]);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedTrainer, setSelectedTrainer] = useState("");
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);

  // 🔥 MAIN DATA FETCH
  const fetchUnavailability = useCallback(async () => {
    setStatus("Querying trainer_unavailability table...");
    setLoading(true);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${API_BASE}/api/trainer-unavailability`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (Array.isArray(data)) {
        setLeaves(data);
        setStatus(`✅ SUCCESS: Loaded ${data.length} records from trainer_unavailability table`);
        enqueueSnackbar(`Loaded ${data.length} trainer records`, { variant: "success" });
      } else {
        setLeaves([]);
        setStatus("⚠️ No data found in trainer_unavailability table");
      }
    } catch (error) {
      console.error("💥 API ERROR:", error.message);
      setStatus(`❌ Failed: ${error.name} - ${error.message}`);
      enqueueSnackbar(`Failed: ${error.message}`, { variant: "error" });
      setLeaves([]);
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  // 🔥 SMART AVAILABILITY CHECK - NEW API ENDPOINT NEEDED
  const fetchSmartAvailableTrainers = useCallback(async (leave) => {
    setAvailabilityLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/smart-available-trainers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          domain: leave.domain,
          start_date: leave.start_date,
          end_date: leave.end_date,
          exclude_trainer: leave.trainer_email
        })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      setAvailableTrainers(data.available || []);
      enqueueSnackbar(`${data.available?.length || 0} available trainers found`, { 
        variant: data.available?.length ? "success" : "warning" 
      });
    } catch (error) {
      console.error("Smart availability error:", error);
      // Fallback to basic trainer list
      await fetchBasicTrainers(leave.domain);
      enqueueSnackbar("Using basic trainer list (smart check unavailable)", { variant: "info" });
    } finally {
      setAvailabilityLoading(false);
    }
  }, [enqueueSnackbar]);

  // 🔥 FALLBACK - BASIC TRAINERS BY DOMAIN
  const fetchBasicTrainers = useCallback(async (domain) => {
    try {
      const url = domain 
        ? `${API_BASE}/api/available-trainers?domain=${domain}`
        : `${API_BASE}/api/available-trainers`;
      
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' }
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      setAvailableTrainers(data || []);
    } catch (error) {
      console.error("Basic trainers error:", error);
      setAvailableTrainers([]);
    }
  }, []);

  // 🔥 LOAD TOPICS FOR SELECTED LEAVE
  const fetchTopics = useCallback(async (leaveId) => {
    try {
      const response = await fetch(`${API_BASE}/api/unavailability-topics/${leaveId}`, {
        headers: { 'Accept': 'application/json' }
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      setTopics(data.topics || []);
      setSelectedTopics(data.topics || []);
    } catch (error) {
      console.error("Topics error:", error);
      setTopics([]);
      enqueueSnackbar("Failed to load topics", { variant: "warning" });
    }
  }, [enqueueSnackbar]);

  // 🔥 ASSIGN TOPICS TO TRAINER
  const assignTopics = useCallback(async () => {
    if (!selectedLeave || !selectedTrainer || selectedTopics.length === 0) {
      enqueueSnackbar("Please select trainer and at least one topic", { variant: "warning" });
      return;
    }

    try {
      setAvailabilityLoading(true);
      const response = await fetch(`${API_BASE}/api/assign-topics-to-trainer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          unavailability_id: selectedLeave.id,
          trainer_email: selectedTrainer,
          topic_ids: selectedTopics.map(t => t.id)
        })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const result = await response.json();
      if (result.success) {
        enqueueSnackbar(`✅ Assigned ${selectedTopics.length} topics to ${selectedTrainer.split('@')[0]}!`, { 
          variant: "success" 
        });
        setAssignDialogOpen(false);
        setSelectedTrainer("");
        setSelectedTopics([]);
        fetchUnavailability(); // Refresh main list
      } else {
        enqueueSnackbar("Failed to assign topics", { variant: "error" });
      }
    } catch (error) {
      console.error("Assign error:", error);
      enqueueSnackbar(`Assign failed: ${error.message}`, { variant: "error" });
    } finally {
      setAvailabilityLoading(false);
    }
  }, [selectedLeave, selectedTrainer, selectedTopics, fetchUnavailability, enqueueSnackbar]);

  // 🔥 HANDLE ROW CLICK - FULL WORKFLOW
  const handleRowClick = async (leave) => {
    if (leave.status === "assigned") {
      enqueueSnackbar("This trainer is already assigned", { variant: "info" });
      return;
    }

    setSelectedLeave(leave);
    
    // 1. Load topics
    await fetchTopics(leave.id);
    
    // 2. Load SMART available trainers (domain + date conflict check)
    await fetchSmartAvailableTrainers(leave);
    
    setAssignDialogOpen(true);
  };

  // 🔥 INITIAL LOAD
  useEffect(() => {
    fetchUnavailability();
  }, [fetchUnavailability]);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" fontWeight="bold" mb={4} color="primary.main">
        🧠 Smart Trainer Assignment Dashboard
      </Typography>

      {/* STATUS HEADER */}
      <Paper elevation={2} sx={{ p: 3, mb: 4 }}>
        <Alert 
          severity={status.includes("✅") ? "success" : status.includes("❌") ? "error" : "info"}
          sx={{ '& .MuiAlert-message': { fontSize: '1.1rem', fontWeight: 500 } }}
        >
          {status}
        </Alert>
        
        {leaves.length > 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Showing {leaves.length} trainer records • Last updated: {new Date().toLocaleTimeString()}
          </Typography>
        )}
        
        <Box sx={{ mt: 2 }}>
          <Button 
            variant="outlined" 
            onClick={fetchUnavailability}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : null}
          >
            🔄 Refresh Data
          </Button>
        </Box>
      </Paper>

      {/* TRAINER TABLE */}
      <Paper elevation={3} sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <TableContainer sx={{ maxHeight: 600 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: "primary.main" }}>
                <TableCell sx={{ color: "white", fontWeight: "bold", py: 2.5 }}>
                  Trainer Name
                </TableCell>
                <TableCell sx={{ color: "white", fontWeight: "bold", py: 2.5 }}>
                  Email
                </TableCell>
                <TableCell sx={{ color: "white", fontWeight: "bold", py: 2.5, minWidth: 80 }}>
                  Domain
                </TableCell>
                <TableCell sx={{ color: "white", fontWeight: "bold", py: 2.5 }}>
                  Date Range
                </TableCell>
                <TableCell sx={{ color: "white", fontWeight: "bold", py: 2.5, minWidth: 100 }}>
                  Status
                </TableCell>
                <TableCell sx={{ color: "white", fontWeight: "bold", py: 2.5, minWidth: 140 }}>
                  Action
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                    <CircularProgress size={32} sx={{ mb: 2 }} />
                    <Typography variant="h6" color="text.secondary">
                      Loading trainer unavailability data...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : leaves.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                    <Typography variant="h6" color="text.secondary">
                      No trainer unavailability records found
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Table "trainer_unavailability" is empty
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                leaves.map((leave) => (
                  <TableRow 
                    key={leave.id} 
                    hover 
                    onClick={() => handleRowClick(leave)}
                    sx={{ 
                      '&:hover': { 
                        bgcolor: leave.status === "assigned" ? '#f0f0f0' : '#f5f5f5',
                        cursor: leave.status === "assigned" ? "default" : "pointer"
                      },
                      transition: 'all 0.2s'
                    }}
                  >
                    <TableCell sx={{ py: 2.5 }}>
                      <Typography variant="subtitle1" fontWeight="bold">
                        {leave.trainer_name || "Unknown"}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 2.5 }}>
                      <Typography variant="body2" sx={{ maxWidth: 220 }}>
                        {leave.trainer_email || "No email"}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 2.5 }}>
                      <Chip 
                        label={leave.domain || "N/A"} 
                        color="primary" 
                        size="small" 
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell sx={{ py: 2.5 }}>
                      <Box>
                        <Typography variant="body2" fontWeight={500}>
                          {leave.start_date || "N/A"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          to {leave.end_date || "N/A"}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ py: 2.5 }}>
                      <Chip 
                        label={leave.status?.toUpperCase() || "PENDING"}
                        color={
                          leave.status === "assigned" ? "success" : 
                          leave.status === "rejected" ? "error" : 
                          "warning"
                        }
                        size="small"
                      />
                    </TableCell>
                    <TableCell sx={{ py: 2.5 }}>
                      <Button 
                        variant="contained" 
                        size="small"
                        disabled={leave.status === "assigned"}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRowClick(leave);
                        }}
                        sx={{ 
                          minWidth: 130,
                          px: 2,
                          fontSize: '0.75rem'
                        }}
                      >
                        {leave.status === "assigned" ? "ASSIGNED ✓" : "🤖 Assign Topics"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* 🔥 SMART ASSIGN DIALOG */}
      <Dialog 
        open={assignDialogOpen} 
        onClose={() => setAssignDialogOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: { height: '80vh' } }}
      >
        <DialogTitle>
          🤖 Smart Assignment: {selectedLeave?.trainer_name || "Trainer"}
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Domain: {selectedLeave?.domain} | {selectedLeave?.start_date} to {selectedLeave?.end_date}
          </Typography>
        </DialogTitle>
        
        <DialogContent sx={{ p: 3, overflow: 'hidden' }}>
          {availabilityLoading && (
            <Box sx={{ mb: 3 }}>
              <LinearProgress />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Checking trainer availability for {selectedLeave?.start_date} to {selectedLeave?.end_date}...
              </Typography>
            </Box>
          )}

          {/* TRAINER SELECTION */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Available Trainers ({availableTrainers.length})
            </Typography>
            <FormControl fullWidth>
              <InputLabel>Assign to Trainer</InputLabel>
              <Select
                value={selectedTrainer}
                onChange={(e) => setSelectedTrainer(e.target.value)}
                label="Assign to Trainer"
                disabled={availabilityLoading}
              >
                {availableTrainers.length === 0 ? (
                  <MenuItem disabled>No available trainers</MenuItem>
                ) : (
                  availableTrainers.map((trainer) => (
                    <MenuItem key={trainer.email} value={trainer.email}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Chip label="✅ FREE" size="small" color="success" />
                        <Box>
                          <Typography variant="body2" fontWeight={500}>
                            {trainer.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {trainer.email} • Domain: {trainer.domain || selectedLeave?.domain}
                          </Typography>
                        </Box>
                      </Box>
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>
          </Box>

          {/* TOPICS SELECTION */}
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Topics to Reassign ({topics.length} total)
            </Typography>
            <Paper sx={{ maxHeight: 250, overflow: 'auto', p: 2 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {topics.map((topic) => (
                  <FormControlLabel
                    key={topic.id}
                    control={
                      <Checkbox
                        checked={selectedTopics.some(t => t.id === topic.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTopics([...selectedTopics, topic]);
                          } else {
                            setSelectedTopics(selectedTopics.filter(t => t.id !== topic.id));
                          }
                        }}
                      />
                    }
                    label={
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={500} noWrap>
                          {topic.topic_name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {topic.date}
                        </Typography>
                      </Box>
                    }
                    sx={{ m: 0 }}
                  />
                ))}
                {topics.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    No topics available for this period
                  </Typography>
                )}
              </Box>
            </Paper>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Selected: {selectedTopics.length} / {topics.length} topics
            </Typography>
          </Box>
        </DialogContent>
        
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setAssignDialogOpen(false)} disabled={availabilityLoading}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={assignTopics}
            disabled={availabilityLoading || !selectedTrainer || selectedTopics.length === 0}
          >
            {availabilityLoading ? (
              <CircularProgress size={20} />
            ) : (
              `✅ Assign ${selectedTopics.length} Topics`
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* RAW DATA DEBUG */}
      <Collapse in={leaves.length > 0}>
        <Paper sx={{ mt: 4, p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Debug: Available Trainers ({availableTrainers.length})
          </Typography>
          <pre style={{
            fontSize: '11px', background: '#f8f9fa', padding: '12px',
            borderRadius: '6px', maxHeight: '200px', overflow: 'auto',
            fontFamily: 'Monaco, monospace', border: '1px solid #e0e0e0'
          }}>
            {JSON.stringify(availableTrainers.slice(0, 3), null, 2)}
          </pre>
        </Paper>
      </Collapse>
    </Box>
  );
}

export default TrainerAssignmentDashboard;
