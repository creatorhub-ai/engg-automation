// src/pages/TrainerAssignmentDashboard.js - NO NOTISTACK REQUIRED
import React, { useEffect, useState, useCallback } from "react";
import {
  Box, Typography, Table, TableHead, TableBody, TableCell, TableRow,
  TableContainer, Chip, Button, Paper, Alert, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  MenuItem, Select, FormControl, InputLabel, Checkbox, FormControlLabel,
  Collapse, LinearProgress, Snackbar, Alert as MuiAlert, Fade
} from "@mui/material";

const API_BASE = "https://engg-automation.onrender.com";

function TrainerAssignmentDashboard() {
  // Custom Toast State (replaces notistack)
  const [toast, setToast] = useState({ open: false, message: "", severity: "info" });
  
  const showToast = (message, severity = "info") => {
    setToast({ open: true, message, severity });
  };

  const closeToast = () => setToast({ open: false, message: "", severity: "info" });

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
        showToast(`Loaded ${data.length} trainer records`, "success");
      } else {
        setLeaves([]);
        setStatus("⚠️ No data found in trainer_unavailability table");
        showToast("No data found in trainer_unavailability table", "warning");
      }
    } catch (error) {
      console.error("💥 API ERROR:", error.message);
      setStatus(`❌ Failed: ${error.name} - ${error.message}`);
      showToast(`Failed: ${error.message}`, "error");
      setLeaves([]);
    } finally {
      setLoading(false);
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
      showToast("Failed to load topics", "warning");
    }
  }, []);

  // 🔥 BASIC TRAINERS BY DOMAIN (FALLBACK)
  const fetchAvailableTrainers = useCallback(async (domain) => {
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
      showToast(`${data.length || 0} trainers loaded for domain: ${domain}`, "info");
    } catch (error) {
      console.error("Trainers error:", error);
      setAvailableTrainers([]);
      showToast("No trainers available", "warning");
    }
  }, []);

  // 🔥 ASSIGN TOPICS TO TRAINER
  const assignTopics = useCallback(async () => {
    if (!selectedLeave || !selectedTrainer || selectedTopics.length === 0) {
      showToast("Please select trainer and at least one topic", "warning");
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
        showToast(`✅ Assigned ${selectedTopics.length} topics successfully!`, "success");
        setAssignDialogOpen(false);
        setSelectedTrainer("");
        setSelectedTopics([]);
        fetchUnavailability(); // Refresh main list
      } else {
        showToast("Failed to assign topics", "error");
      }
    } catch (error) {
      console.error("Assign error:", error);
      showToast(`Assign failed: ${error.message}`, "error");
    } finally {
      setAvailabilityLoading(false);
    }
  }, [selectedLeave, selectedTrainer, selectedTopics, fetchUnavailability]);

  // 🔥 HANDLE ROW CLICK - FULL WORKFLOW
  const handleRowClick = async (leave) => {
    if (leave.status === "assigned") {
      showToast("This trainer is already assigned", "info");
      return;
    }

    setSelectedLeave(leave);
    
    // Load topics first
    await fetchTopics(leave.id);
    
    // Load available trainers for domain
    await fetchAvailableTrainers(leave.domain);
    
    setAssignDialogOpen(true);
  };

  // 🔥 INITIAL LOAD
  useEffect(() => {
    fetchUnavailability();
  }, [fetchUnavailability]);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" fontWeight="bold" mb={4} color="primary.main">
        🧠 Trainer Assignment Dashboard
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
                        {leave.status === "assigned" ? "ASSIGNED ✓" : "Assign Topics"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* ASSIGN TOPICS DIALOG */}
      <Dialog 
        open={assignDialogOpen} 
        onClose={() => setAssignDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { height: '70vh' } }}
      >
        <DialogTitle>Assign Topics for {selectedLeave?.trainer_name}</DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          {/* LEAVE DETAILS */}
          {selectedLeave && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Unavailability Details
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
                <Chip label={`Domain: ${selectedLeave.domain}`} color="primary" />
                <Chip label={`${selectedLeave.start_date} to ${selectedLeave.end_date}`} />
                <Chip label={`ID: ${selectedLeave.id}`} variant="outlined" />
              </Box>
            </Box>
          )}

          {/* SELECT TRAINER */}
          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel>Assign to Trainer</InputLabel>
            <Select
              value={selectedTrainer}
              onChange={(e) => setSelectedTrainer(e.target.value)}
              label="Assign to Trainer"
            >
              {availableTrainers.length === 0 ? (
                <MenuItem disabled>No trainers available</MenuItem>
              ) : (
                availableTrainers.map((trainer) => (
                  <MenuItem key={trainer.email} value={trainer.email}>
                    {trainer.name} ({trainer.email})
                  </MenuItem>
                ))
              )}
            </Select>
          </FormControl>

          {/* TOPICS CHECKLIST */}
          <Box>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Select Topics to Reassign ({topics.length} available)
            </Typography>
            <Box sx={{ maxHeight: 250, overflow: 'auto', border: '1px solid #e0e0e0', borderRadius: 1, p: 2 }}>
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
                    <Box>
                      <Typography variant="body2" fontWeight={500}>
                        {topic.topic_name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {topic.date}
                      </Typography>
                    </Box>
                  }
                  sx={{ m: 0, width: '100%' }}
                />
              ))}
              {topics.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No topics found for this trainer
                </Typography>
              )}
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Selected: {selectedTopics.length} / {topics.length} topics
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={assignTopics}
            disabled={availabilityLoading || !selectedTrainer || selectedTopics.length === 0}
          >
            {availabilityLoading ? <CircularProgress size={20} /> : `Assign ${selectedTopics.length} Topics`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* CUSTOM TOAST (replaces notistack) */}
      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={closeToast}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        TransitionComponent={Fade}
      >
        <MuiAlert 
          onClose={closeToast} 
          severity={toast.severity}
          sx={{ width: '100%' }}
          elevation={6}
          variant="filled"
        >
          {toast.message}
        </MuiAlert>
      </Snackbar>

      {/* RAW DATA DEBUG */}
      <Collapse in={leaves.length > 0}>
        <Paper sx={{ mt: 4, p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Debug Info:
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, fontSize: '0.875rem' }}>
            <Chip label={`Records: ${leaves.length}`} />
            <Chip label={`Trainers: ${availableTrainers.length}`} />
            <Chip label={`Topics: ${topics.length}`} />
          </Box>
        </Paper>
      </Collapse>
    </Box>
  );
}

export default TrainerAssignmentDashboard;
