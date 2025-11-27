import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableHead,
  TableBody,
  TableCell,
  TableRow,
  TableContainer,
  Alert,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  InputAdornment,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import SchoolIcon from "@mui/icons-material/School";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

const API_BASE = process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

export default function TutorsDashboard({ user, token }) {
  const [tutors, setTutors] = useState([]);
  const [selectedTutor, setSelectedTutor] = useState("");
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState("");
  const [modules, setModules] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Add tutor dialog
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [newTutor, setNewTutor] = useState({
    name: "",
    email: "",
    password: "",
  });

  useEffect(() => {
    loadTutors();
  }, []);

  useEffect(() => {
    if (selectedTutor) {
      loadBatches(selectedTutor);
    } else {
      setBatches([]);
      setSelectedBatch("");
      setModules({});
    }
  }, [selectedTutor]);

  useEffect(() => {
    if (selectedTutor && selectedBatch) {
      loadModules(selectedTutor, selectedBatch);
    } else {
      setModules({});
    }
  }, [selectedBatch]);

  async function loadTutors() {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(`${API_BASE}/api/tutors`, { headers });
      setTutors(res.data || []);
    } catch (error) {
      console.error("Error loading tutors:", error);
      setMessage("Error loading tutors");
    }
  }

  async function loadBatches(trainerEmail) {
    setLoading(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(
        `${API_BASE}/api/tutors/batches/${trainerEmail}`,
        { headers }
      );
      setBatches(res.data || []);
    } catch (error) {
      console.error("Error loading batches:", error);
      setMessage("Error loading batches");
    } finally {
      setLoading(false);
    }
  }

  async function loadModules(trainerEmail, batchNo) {
    setLoading(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(
        `${API_BASE}/api/tutors/modules/${trainerEmail}/${batchNo}`,
        { headers }
      );
      setModules(res.data || {});
    } catch (error) {
      console.error("Error loading modules:", error);
      setMessage("Error loading modules");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddTutor() {
    if (!newTutor.name || !newTutor.email || !newTutor.password) {
      setMessage("Please fill all fields");
      return;
    }

    setLoading(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.post(`${API_BASE}/api/tutors/add`, newTutor, {
        headers,
      });

      if (res.data.success) {
        setMessage("✅ Tutor added successfully");
        setOpenAddDialog(false);
        setNewTutor({ name: "", email: "", password: "" });
        loadTutors();
      } else {
        setMessage("❌ Failed to add tutor: " + res.data.error);
      }
    } catch (error) {
      setMessage("❌ Error adding tutor");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setSelectedTutor("");
    setSelectedBatch("");
    setBatches([]);
    setModules({});
    setMessage("");
  }

  const selectedTutorData = tutors.find((t) => t.email === selectedTutor);

  return (
    <Box sx={{ maxWidth: 1400, mx: "auto", my: 3, px: 2 }}>
      <Paper
        elevation={4}
        sx={{
          p: 3,
          borderRadius: 3,
          background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
        }}
      >
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={3}
        >
          <Box display="flex" alignItems="center" gap={2}>
            <SchoolIcon sx={{ fontSize: 40, color: "#667eea" }} />
            <Typography variant="h4" fontWeight="bold" color="#333">
              Tutors Management
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<PersonAddIcon />}
            onClick={() => setOpenAddDialog(true)}
            sx={{
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              px: 3,
              py: 1.5,
              borderRadius: 2,
              textTransform: "none",
              fontSize: 16,
              fontWeight: "bold",
              boxShadow: "0 4px 15px rgba(102, 126, 234, 0.4)",
              "&:hover": {
                background: "linear-gradient(135deg, #764ba2 0%, #667eea 100%)",
                transform: "translateY(-2px)",
                boxShadow: "0 6px 20px rgba(102, 126, 234, 0.6)",
              },
              transition: "all 0.3s ease",
            }}
          >
            Add New Tutor
          </Button>
        </Box>

        {/* Filters */}
        <Grid container spacing={2} mb={3}>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Select Tutor</InputLabel>
              <Select
                value={selectedTutor}
                label="Select Tutor"
                onChange={(e) => setSelectedTutor(e.target.value)}
                sx={{
                  bgcolor: "white",
                  borderRadius: 2,
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: "#667eea",
                  },
                  "&:hover .MuiOutlinedInput-notchedOutline": {
                    borderColor: "#764ba2",
                  },
                }}
              >
                <MenuItem value="">
                  <em>Choose a tutor...</em>
                </MenuItem>
                {tutors.map((tutor) => (
                  <MenuItem key={tutor.email} value={tutor.email}>
                    {tutor.name} ({tutor.email})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={4}>
            {batches.length > 0 && (
              <FormControl fullWidth>
                <InputLabel>Select Batch</InputLabel>
                <Select
                  value={selectedBatch}
                  label="Select Batch"
                  onChange={(e) => setSelectedBatch(e.target.value)}
                  sx={{
                    bgcolor: "white",
                    borderRadius: 2,
                    "& .MuiOutlinedInput-notchedOutline": {
                      borderColor: "#667eea",
                    },
                    "&:hover .MuiOutlinedInput-notchedOutline": {
                      borderColor: "#764ba2",
                    },
                  }}
                >
                  <MenuItem value="">
                    <em>Choose a batch...</em>
                  </MenuItem>
                  {batches.map((batch) => (
                    <MenuItem key={batch} value={batch}>
                      {batch}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Grid>

          <Grid item xs={12} sm={2}>
            <Button
              variant="outlined"
              fullWidth
              startIcon={<RestartAltIcon />}
              onClick={handleReset}
              sx={{
                height: "56px",
                borderRadius: 2,
                borderColor: "#f57c00",
                color: "#f57c00",
                fontWeight: "bold",
                "&:hover": {
                  borderColor: "#e65100",
                  bgcolor: "rgba(245, 124, 0, 0.1)",
                },
              }}
            >
              Reset
            </Button>
          </Grid>
        </Grid>

        {message && (
          <Alert
            severity={message.startsWith("✅") ? "success" : "warning"}
            sx={{ mb: 2, borderRadius: 2 }}
          >
            {message}
          </Alert>
        )}

        {/* Tutor Details Card */}
        {selectedTutorData && (
          <Card
            sx={{
              mb: 3,
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "white",
              borderRadius: 3,
              boxShadow: "0 8px 20px rgba(102, 126, 234, 0.3)",
            }}
          >
            <CardContent>
              <Typography variant="h6" gutterBottom fontWeight="bold">
                📋 Tutor Details
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Name
                  </Typography>
                  <Typography variant="h6" fontWeight="bold">
                    {selectedTutorData.name}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Email
                  </Typography>
                  <Typography variant="h6" fontWeight="bold">
                    {selectedTutorData.email}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Total Batches
                  </Typography>
                  <Typography variant="h6" fontWeight="bold">
                    {batches.length}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        )}

        {/* Modules Display */}
        {Object.keys(modules).length > 0 && (
          <Box>
            <Typography variant="h6" gutterBottom fontWeight="bold" color="#333">
              📚 Modules Handled
            </Typography>
            {Object.entries(modules).map(([moduleName, topics]) => (
              <Accordion
                key={moduleName}
                sx={{
                  mb: 2,
                  borderRadius: 2,
                  "&:before": { display: "none" },
                  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  sx={{
                    bgcolor: "#f5f5f5",
                    borderRadius: 2,
                    "&:hover": { bgcolor: "#eeeeee" },
                  }}
                >
                  <Typography fontWeight="bold" color="#333">
                    {moduleName}{" "}
                    <Chip
                      label={`${topics.length} topics`}
                      size="small"
                      sx={{
                        ml: 2,
                        bgcolor: "#667eea",
                        color: "white",
                        fontWeight: "bold",
                      }}
                    />
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: "#fafafa" }}>
                          <TableCell>
                            <strong>Topic Name</strong>
                          </TableCell>
                          <TableCell>
                            <strong>Date</strong>
                          </TableCell>
                          <TableCell>
                            <strong>Status</strong>
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {topics.map((topic, idx) => (
                          <TableRow
                            key={idx}
                            sx={{
                              "&:hover": { bgcolor: "#f5f5f5" },
                            }}
                          >
                            <TableCell>{topic.topic_name}</TableCell>
                            <TableCell>{topic.date}</TableCell>
                            <TableCell>
                              <Chip
                                label={topic.topic_status}
                                size="small"
                                color={
                                  topic.topic_status === "Completed"
                                    ? "success"
                                    : topic.topic_status === "In Progress"
                                    ? "primary"
                                    : "default"
                                }
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        )}

        {selectedTutor && batches.length === 0 && !loading && (
          <Alert severity="info" sx={{ borderRadius: 2 }}>
            This tutor has no batches assigned yet.
          </Alert>
        )}
      </Paper>

      {/* Add Tutor Dialog */}
      <Dialog
        open={openAddDialog}
        onClose={() => setOpenAddDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
          },
        }}
      >
        <DialogTitle
          sx={{
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "white",
            fontWeight: "bold",
          }}
        >
          <Box display="flex" alignItems="center" gap={1}>
            <PersonAddIcon />
            Add New Tutor
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Name"
              value={newTutor.name}
              onChange={(e) =>
                setNewTutor({ ...newTutor, name: e.target.value })
              }
              sx={{
                mb: 2,
                "& .MuiOutlinedInput-root": {
                  "&:hover fieldset": {
                    borderColor: "#667eea",
                  },
                  "&.Mui-focused fieldset": {
                    borderColor: "#667eea",
                  },
                },
              }}
            />
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={newTutor.email}
              onChange={(e) =>
                setNewTutor({ ...newTutor, email: e.target.value })
              }
              sx={{
                mb: 2,
                "& .MuiOutlinedInput-root": {
                  "&:hover fieldset": {
                    borderColor: "#667eea",
                  },
                  "&.Mui-focused fieldset": {
                    borderColor: "#667eea",
                  },
                },
              }}
            />
            <TextField
              fullWidth
              label="Password"
              type={showPassword ? "text" : "password"}
              value={newTutor.password}
              onChange={(e) =>
                setNewTutor({ ...newTutor, password: e.target.value })
              }
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  "&:hover fieldset": {
                    borderColor: "#667eea",
                  },
                  "&.Mui-focused fieldset": {
                    borderColor: "#667eea",
                  },
                },
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button
            onClick={() => setOpenAddDialog(false)}
            sx={{
              color: "#666",
              "&:hover": { bgcolor: "#f5f5f5" },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAddTutor}
            variant="contained"
            disabled={loading}
            sx={{
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              px: 3,
              "&:hover": {
                background: "linear-gradient(135deg, #764ba2 0%, #667eea 100%)",
              },
            }}
          >
            {loading ? "Adding..." : "Add Tutor"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
