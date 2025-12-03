import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Grid,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  MenuItem,
  Autocomplete,
} from "@mui/material";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import SearchIcon from "@mui/icons-material/Search";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import MenuBookIcon from "@mui/icons-material/MenuBook";

const API_BASE =
  process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

export default function LearnersDashboard({ user, token }) {
  const [searchEmail, setSearchEmail] = useState("");
  const [searchName, setSearchName] = useState("");
  const [searchBatch, setSearchBatch] = useState("");

  const [learnerData, setLearnerData] = useState(null);
  const [allLearners, setAllLearners] = useState([]);
  const [distinctBatches, setDistinctBatches] = useState([]);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [statusUpdating, setStatusUpdating] = useState(false);

  // Add learner dialog states
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [newLearner, setNewLearner] = useState({
    name: "",
    email: "",
    phone: "",
    batch_no: "",
  });

  // Load all learners using existing endpoints + get distinct batches
  useEffect(() => {
    async function loadLearnersData() {
      setLoading(true);
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        
        // Method 1: Try existing learners endpoint first
        let learnersData = [];
        try {
          // Use existing /api/learners/email endpoint pattern or general learners
          const res = await axios.get(`${API_BASE}/api/learners`, { headers });
          learnersData = Array.isArray(res.data) ? res.data : [];
        } catch (e) {
          console.log("No general learners endpoint, trying batch approach");
        }

        // Method 2: If empty, load via batches (fallback)
        if (learnersData.length === 0) {
          // Get batches first
          const batchesRes = await axios.get(`${API_BASE}/api/batches`, { headers });
          const batches = batchesRes.data || [];
          
          // Load learners for first few batches to populate suggestions
          for (let i = 0; i < Math.min(5, batches.length); i++) {
            try {
              const batchLearnersRes = await axios.get(
                `${API_BASE}/api/getlearners?batchno=${batches[i]}`,
                { headers }
              );
              learnersData = [...learnersData, ...(batchLearnersRes.data || [])];
            } catch (e) {
              console.log(`No learners for batch ${batches[i]}`);
            }
          }
        }

        // Deduplicate learners
        const uniqueLearners = learnersData.filter(
          (learner, index, self) =>
            index ===
            self.findIndex(
              (l) => l.email === learner.email && l.batch_no === learner.batch_no
            )
        );

        setAllLearners(uniqueLearners);

        // Extract distinct batches
        const batches = [
          ...new Set(
            uniqueLearners
              .map((l) => l.batch_no)
              .filter((b) => b && b.trim() !== "")
          ),
        ].sort();
        setDistinctBatches(batches);

        console.log(`Loaded ${uniqueLearners.length} learners, ${batches.length} batches`);
      } catch (err) {
        console.error("Error loading learners data:", err);
        setAllLearners([]);
        setDistinctBatches([]);
        setMessage("Failed to load learners list - using manual search");
      } finally {
        setLoading(false);
      }
    }

    loadLearnersData();
  }, [token]);

  // Improved search with better matching
  function handleSearch() {
    if (!searchEmail && !searchName && !searchBatch) {
      setMessage("Please enter email, name, or batch number");
      setLearnerData(null);
      return;
    }

    let found = null;
    const searchEmailTrim = searchEmail.trim().toLowerCase();
    const searchNameTrim = searchName.trim().toLowerCase();
    const searchBatchTrim = searchBatch.trim();

    // Priority 1: Exact email match
    if (searchEmailTrim) {
      found = allLearners.find(
        (l) => (l.email || "").toLowerCase() === searchEmailTrim
      );
    }
    // Priority 2: Exact name match
    else if (searchNameTrim) {
      found = allLearners.find(
        (l) => (l.name || "").toLowerCase() === searchNameTrim
      );
    }
    // Priority 3: Exact batch_no match (first learner in batch)
    else if (searchBatchTrim) {
      found = allLearners.find((l) => String(l.batch_no).trim() === searchBatchTrim);
    }

    if (found) {
      setLearnerData(found);
      setMessage(`✅ Learner found: ${found.name}`);
    } else {
      setLearnerData(null);
      setMessage("❌ Learner not found - check spelling or try another field");
    }
  }

  async function handleAddLearner() {
    if (
      !newLearner.name ||
      !newLearner.email ||
      !newLearner.phone ||
      !newLearner.batch_no
    ) {
      setMessage("Please fill all fields");
      return;
    }
    setLoading(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.post(
        `${API_BASE}/api/learners/add`,
        newLearner,
        { headers }
      );
      if (res.data.success) {
        setMessage("✅ Learner added successfully");
        setOpenAddDialog(false);
        // Add to local state
        const learnerToAdd = { ...newLearner, id: Date.now() }; // temp id
        setAllLearners((prev) => [...prev, learnerToAdd]);
        if (!distinctBatches.includes(newLearner.batch_no)) {
          setDistinctBatches((prev) => [...prev, newLearner.batch_no]);
        }
        setNewLearner({
          name: "",
          email: "",
          phone: "",
          batch_no: "",
        });
      } else {
        setMessage("❌ Failed to add learner: " + (res.data.error || ""));
      }
    } catch (error) {
      setMessage("❌ Error adding learner: " + error.response?.data?.error);
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  // Update learner status handler
  async function handleStatusChange(learnerEmail, batchNo, newStatus) {
    setStatusUpdating(true);
    setMessage("");
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.put(
        `${API_BASE}/api/learners/status`,
        {
          learner_email: learnerEmail,
          batch_no: batchNo,
          status: newStatus,
        },
        { headers }
      );
      if (res.data.success) {
        setMessage("✅ Learner status updated");
        setLearnerData((prev) =>
          prev ? { ...prev, status: newStatus } : prev
        );
      } else {
        setMessage("❌ Failed to update learner status");
      }
    } catch (err) {
      setMessage("❌ Error updating learner status");
      console.error(err);
    }
    setStatusUpdating(false);
  }

  function handleReset() {
    setSearchEmail("");
    setSearchName("");
    setSearchBatch("");
    setLearnerData(null);
    setMessage("");
  }

  const showStatusDropdown =
    learnerData &&
    ["manager", "admin"].includes((user?.role || "").toLowerCase());

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", my: 3, px: 2 }}>
      <Paper
        elevation={4}
        sx={{
          p: 3,
          borderRadius: 3,
          background: "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)",
        }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box display="flex" alignItems="center" gap={2}>
            <MenuBookIcon sx={{ fontSize: 40, color: "#e8744f" }} />
            <Typography variant="h4" fontWeight="bold" color="#333">
              Learners Management
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<PersonAddIcon />}
            onClick={() => setOpenAddDialog(true)}
            sx={{
              background: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
              px: 3,
              py: 1.5,
              borderRadius: 2,
              textTransform: "none",
              fontSize: 16,
              fontWeight: "bold",
              color: "#333",
              boxShadow: "0 4px 15px rgba(250, 112, 154, 0.4)",
              "&:hover": {
                background: "linear-gradient(135deg, #fee140 0%, #fa709a 100%)",
                transform: "translateY(-2px)",
                boxShadow: "0 6px 20px rgba(250, 112, 154, 0.6)",
              },
              transition: "all 0.3s ease",
            }}
          >
            Add New Learner
          </Button>
        </Box>

        {/* Search Section */}
        <Grid container spacing={2} mb={3}>
          <Grid item xs={12} sm={4}>
            <Autocomplete
              freeSolo
              options={allLearners.map((l) => l.email || "")}
              value={searchEmail}
              onChange={(e, value) => setSearchEmail(value || "")}
              onInputChange={(e, value) => setSearchEmail(value)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  fullWidth
                  label="Search by Email"
                  placeholder="Type email for suggestions"
                  onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                  sx={{
                    bgcolor: "white",
                    borderRadius: 2,
                    "& .MuiOutlinedInput-root": {
                      "&:hover fieldset": { borderColor: "#fa709a" },
                      "&.Mui-focused fieldset": { borderColor: "#fa709a" },
                    },
                  }}
                />
              )}
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <Autocomplete
              freeSolo
              options={allLearners.map((l) => l.name || "")}
              value={searchName}
              onChange={(e, value) => setSearchName(value || "")}
              onInputChange={(e, value) => setSearchName(value)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  fullWidth
                  label="Search by Name"
                  placeholder="Type name for suggestions"
                  onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                  sx={{
                    bgcolor: "white",
                    borderRadius: 2,
                    "& .MuiOutlinedInput-root": {
                      "&:hover fieldset": { borderColor: "#fa709a" },
                      "&.Mui-focused fieldset": { borderColor: "#fa709a" },
                    },
                  }}
                />
              )}
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <Autocomplete
              freeSolo
              options={distinctBatches}
              value={searchBatch}
              onChange={(e, value) => setSearchBatch(value || "")}
              onInputChange={(e, value) => setSearchBatch(value)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  fullWidth
                  label="Search by Batch No"
                  placeholder="Type or select batch"
                  onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                  sx={{
                    bgcolor: "white",
                    borderRadius: 2,
                    "& .MuiOutlinedInput-root": {
                      "&:hover fieldset": { borderColor: "#fa709a" },
                      "&.Mui-focused fieldset": { borderColor: "#fa709a" },
                    },
                  }}
                />
              )}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Button
              variant="contained"
              fullWidth
              startIcon={<SearchIcon />}
              onClick={handleSearch}
              disabled={loading}
              sx={{
                height: "56px",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                fontWeight: "bold",
                borderRadius: 2,
                "&:hover": {
                  background: "linear-gradient(135deg, #764ba2 0%, #667eea 100%)",
                },
              }}
            >
              {loading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                "Search"
              )}
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
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

        {/* Debug info */}
        <Typography variant="caption" sx={{ mb: 2, display: 'block', color: 'gray' }}>
          Loaded: {allLearners.length} learners, {distinctBatches.length} batches
        </Typography>

        {message && (
          <Alert
            severity={
              message.startsWith("✅")
                ? "success"
                : message.includes("not")
                ? "info"
                : "warning"
            }
            sx={{ mb: 2, borderRadius: 2 }}
          >
            {message}
          </Alert>
        )}

        {/* Rest of the component remains the same */}
        {learnerData && (
          <Card
            sx={{
              background: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
              color: "#333",
              borderRadius: 3,
              boxShadow: "0 8px 20px rgba(250, 112, 154, 0.3)",
            }}
          >
            <CardContent>
              <Typography variant="h6" gutterBottom fontWeight="bold">
                👨‍🎓 Learner Details
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>
                    Name
                  </Typography>
                  <Typography variant="h6" fontWeight="bold">
                    {learnerData.name}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>
                    Email
                  </Typography>
                  <Typography variant="h6" fontWeight="bold">
                    {learnerData.email}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>
                    Phone
                  </Typography>
                  <Typography variant="h6" fontWeight="bold">
                    {learnerData.phone || "N/A"}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>
                    Batch Number
                  </Typography>
                  <Typography variant="h6" fontWeight="bold">
                    {learnerData.batch_no}
                  </Typography>
                </Grid>
                {showStatusDropdown && (
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Status"
                      select
                      value={learnerData.status || "Enabled"}
                      onChange={(e) =>
                        handleStatusChange(
                          learnerData.email,
                          learnerData.batch_no,
                          e.target.value
                        )
                      }
                      size="small"
                      disabled={statusUpdating}
                      sx={{ minWidth: 150, mt: 2 }}
                    >
                      <MenuItem value="Enabled">Enable</MenuItem>
                      <MenuItem value="Disabled">Disable</MenuItem>
                      <MenuItem value="Dropout">Dropout</MenuItem>
                    </TextField>
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>
        )}

        {/* Add Learner Dialog - SAME AS BEFORE */}
        <Dialog
          open={openAddDialog}
          onClose={() => setOpenAddDialog(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{ sx: { borderRadius: 3 } }}
        >
          <DialogTitle
            sx={{
              background: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
              color: "#333",
              fontWeight: "bold",
            }}
          >
            <Box display="flex" alignItems="center" gap={1}>
              <PersonAddIcon />
              Add New Learner
            </Box>
          </DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2 }}>
              <TextField
                fullWidth
                label="Name"
                value={newLearner.name}
                onChange={(e) =>
                  setNewLearner({ ...newLearner, name: e.target.value })
                }
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={newLearner.email}
                onChange={(e) =>
                  setNewLearner({ ...newLearner, email: e.target.value })
                }
                sx={{ mb: 2 }}
              />
              <Autocomplete
                freeSolo
                options={distinctBatches}
                value={newLearner.batch_no}
                onChange={(e, value) =>
                  setNewLearner({ ...newLearner, batch_no: value || "" })
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    fullWidth
                    label="Batch Number"
                    sx={{ mb: 2 }}
                  />
                )}
              />
              <TextField
                fullWidth
                label="Phone"
                value={newLearner.phone}
                onChange={(e) =>
                  setNewLearner({ ...newLearner, phone: e.target.value })
                }
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button
              onClick={() => setOpenAddDialog(false)}
              sx={{ color: "#666", "&:hover": { bgcolor: "#f5f5f5" } }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddLearner}
              variant="contained"
              disabled={loading}
              sx={{
                background: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
                color: "#333",
                px: 3,
                fontWeight: "bold",
                "&:hover": {
                  background: "linear-gradient(135deg, #fee140 0%, #fa709a 100%)",
                },
              }}
            >
              {loading ? "Adding..." : "Add Learner"}
            </Button>
          </DialogActions>
        </Dialog>
      </Paper>
    </Box>
  );
}
