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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Snackbar,
  IconButton,
  Grid,
} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";

const API_BASE = process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

function TrainerAssignmentDashboard({ user, token, batch_no }) {
  const [unavailabilities, setUnavailabilities] = useState([]);
  const [selectedUnavailability, setSelectedUnavailability] = useState(null);
  const [availableTrainers, setAvailableTrainers] = useState([]);
  const [topics, setTopics] = useState([]);
  const [selectedTrainer, setSelectedTrainer] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [alertOpen, setAlertOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load unavailabilities
  useEffect(() => {
    fetchUnavailabilities();
  }, []);

  const fetchUnavailabilities = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}`, 'x-user-email': user.email };
      const res = await axios.get(`${API_BASE}/api/trainer-unavailability`, { headers });
      setUnavailabilities(res.data);
    } catch (err) {
      setMessage("Error loading unavailabilities");
    }
  };

  const handleAssignClick = async (unavailability) => {
    setSelectedUnavailability(unavailability);
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(
        `${API_BASE}/api/unavailability-topics/${unavailability.id}`,
        { headers }
      );
      setTopics(res.data.topics);
      
      // Get available trainers
      const trainersRes = await axios.get(
        `${API_BASE}/api/available-trainers?domain=${unavailability.trainer.domain}&start_date=${unavailability.start_date}&end_date=${unavailability.end_date}`,
        { headers }
      );
      setAvailableTrainers(trainersRes.data);
      setDialogOpen(true);
    } catch (err) {
      setMessage("Error loading data");
    }
    setLoading(false);
  };

  const handleTrainerSelect = (trainerEmail) => {
    setSelectedTrainer(trainerEmail);
    setAssignDialogOpen(true);
  };

  const handleAssignTopics = async () => {
    if (!selectedTrainer || topics.length === 0) return;
    
    setLoading(true);
    try {
      const headers = { 
        Authorization: `Bearer ${token}`, 
        'x-user-email': user.email,
        'Content-Type': 'application/json'
      };
      
      const topicIds = topics.map(t => t.id);
      const res = await axios.post(
        `${API_BASE}/api/assign-topics-to-trainer`,
        {
          unavailability_id: selectedUnavailability.id,
          trainer_email: selectedTrainer,
          batch_no: batch_no,
          topic_ids: topicIds
        },
        { headers }
      );
      
      setMessage("✅ Topics assigned successfully!");
      setAlertOpen(true);
      setDialogOpen(false);
      setAssignDialogOpen(false);
      setSelectedTrainer("");
      fetchUnavailabilities();
    } catch (err) {
      setMessage("❌ Failed to assign topics");
      setAlertOpen(true);
    }
    setLoading(false);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" fontWeight="bold" mb={3} color="primary">
        Trainer Assignment Dashboard
      </Typography>

      <TableContainer component={Paper} sx={{ mb: 3 }}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: "#1976d2" }}>
              <TableCell sx={{ color: "white", fontWeight: "bold" }}>Trainer</TableCell>
              <TableCell sx={{ color: "white", fontWeight: "bold" }}>Domain</TableCell>
              <TableCell sx={{ color: "white", fontWeight: "bold" }}>From</TableCell>
              <TableCell sx={{ color: "white", fontWeight: "bold" }}>To</TableCell>
              <TableCell sx={{ color: "white", fontWeight: "bold" }}>Status</TableCell>
              <TableCell sx={{ color: "white", fontWeight: "bold" }}>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {unavailabilities.map((ua) => (
              <TableRow key={ua.id} hover>
                <TableCell>{ua.trainer_name}</TableCell>
                <TableCell>
                  <Chip label={ua.domain} size="small" color="primary" />
                </TableCell>
                <TableCell>{ua.start_date}</TableCell>
                <TableCell>{ua.end_date}</TableCell>
                <TableCell>
                  <Chip 
                    label={ua.status || 'Pending'} 
                    color={ua.status === 'assigned' ? 'success' : 'warning'}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  {ua.status !== 'assigned' && (
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => handleAssignClick(ua)}
                      disabled={loading}
                    >
                      Assign Topics
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Topics Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Assign Topics for {selectedUnavailability?.trainer_name}
          <IconButton onClick={() => setDialogOpen(false)} sx={{ position: 'absolute', right: 8, top: 8 }}>
            <CheckIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography mb={2}>Select trainer to assign {topics.length} topics</Typography>
          
          <Grid container spacing={2}>
            {availableTrainers.map((trainer) => (
              <Grid item xs={12} sm={6} md={4} key={trainer.email}>
                <Paper 
                  sx={{ p: 2, cursor: 'pointer', '&:hover': { bgcolor: '#e3f2fd' } }}
                  onClick={() => handleTrainerSelect(trainer.email)}
                >
                  <Typography fontWeight="bold">{trainer.name}</Typography>
                  <Typography variant="body2" color="text.secondary">{trainer.email}</Typography>
                  <Typography variant="caption">{trainer.domain}</Typography>
                  <Button
                    fullWidth
                    variant="contained"
                    size="small"
                    onClick={() => handleTrainerSelect(trainer.email)}
                    sx={{ mt: 1 }}
                  >
                    Assign
                  </Button>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </DialogContent>
      </Dialog>

      {/* Confirm Assignment Dialog */}
      <Dialog open={assignDialogOpen} onClose={() => setAssignDialogOpen(false)}>
        <DialogTitle>Confirm Assignment</DialogTitle>
        <DialogContent>
          <Typography>
            Assign {topics.length} topics to <strong>{selectedTrainer}</strong>?
          </Typography>
          <Box mt={2}>
            <Button 
              variant="contained" 
              onClick={handleAssignTopics}
              disabled={loading}
              startIcon={<CheckIcon />}
            >
              {loading ? 'Assigning...' : 'Assign Topics'}
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

      <Snackbar open={alertOpen} autoHideDuration={6000} onClose={() => setAlertOpen(false)}>
        <Alert severity={message.startsWith('✅') ? 'success' : 'error'}>
          {message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default TrainerAssignmentDashboard;
