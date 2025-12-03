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

  // Load all learners once for suggestions & search
  useEffect(() => {
    async function loadLearnersBasics() {
      setLoading(true);
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        // Backend: implement GET /api/learners/all-basics from learners_data
        const res = await axios.get(
          `${API_BASE}/api/learners/all-basics`,
          { headers }
        );
        const data = Array.isArray(res.data) ? res.data : [];
        setAllLearners(data);

        const batches = [
          ...new Set(
            data
              .map((l) => l.batch_no)
              .filter((b) => b && b.trim() !== "")
          ),
        ];
        setDistinctBatches(batches);
      } catch (err) {
        console.error("Error loading learners basics:", err);
        setAllLearners([]);
        setDistinctBatches([]);
        setMessage("Failed to load learners list for search");
      } finally {
        setLoading(false);
      }
    }

    loadLearnersBasics();
  }, [token]);

  // Exact match search using loaded learners (email > name > batch_no)
  function handleSearch() {
    if (!searchEmail && !searchName && !searchBatch) {
      setMessage("Please enter email, name, or batch number");
      setLearnerData(null);
      return;
    }

    let found = null;

    if (searchEmail) {
      const emailLower = searchEmail.trim().toLowerCase();
      found =
        allLearners.find(
          (l) => (l.email || "").toLowerCase() === emailLower
        ) || null;
    } else if (searchName) {
      const nameLower = searchName.trim().toLowerCase();
      found =
        allLearners.find(
          (l) => (l.name || "").toLowerCase() === nameLower
        ) || null;
    } else if (searchBatch) {
      const batchStr = searchBatch.trim();
      found =
        allLearners.find((l) => String(l.batch_no) === batchStr) || null;
    }

    if (found) {
      setLearnerData(found);
      setMessage("✅ Learner found");
    } else {
      setLearnerData(null);
      setMessage("Learner not found");
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
        // Update local arrays so search/suggestions include new learner
        setAllLearners((prev) => [...prev, newLearner]);
        setDistinctBatches((prev) =>
          prev.includes(newLearner.batch_no)
            ? prev
            : [...prev, newLearner.batch_no]
        );
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
      setMessage("❌ Error adding learner");
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
          background:
            "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)",
        }}
      >
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={3}
        >
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
              background:
                "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
              px: 3,
              py: 1.5,
              borderRadius: 2,
              textTransform: "none",
              fontSize: 16,
              fontWeight: "bold",
              color: "#333",
              boxShadow: "0 4px 15px rgba(250, 112, 154, 0.4)",
              "&:hover": {
                background:
                  "linear-gradient(135deg, #fee140 0%, #fa709a 100%)",
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
            <TextField
              fullWidth
              label="Search by Email"
              placeholder="Enter learner email"
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSearch()}
              inputProps={{ list: "email-options" }}
              sx={{
                bgcolor: "white",
                borderRadius: 2,
                "& .MuiOutlinedInput-root": {
                  "&:hover fieldset": {
                    borderColor: "#fa709a",
                  },
                  "&.Mui-focused fieldset": {
                    borderColor: "#fa709a",
                  },
                },
              }}
            />
            <datalist id="email-options">
              {allLearners.map((l) => (
                <option key={l.email} value={l.email} />
              ))}
            </datalist>
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="Search by Name"
              placeholder="Enter learner name"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSearch()}
              inputProps={{ list: "name-options" }}
              sx={{
                bgcolor: "white",
                borderRadius: 2,
                "& .MuiOutlinedInput-root": {
                  "&:hover fieldset": {
                    borderColor: "#fa709a",
                  },
                  "&.Mui-focused fieldset": {
                    borderColor: "#fa709a",
                  },
                },
              }}
            />
            <datalist id="name-options">
              {allLearners.map((l) => (
                <option key={`${l.email}-${l.batch_no}`} value={l.name} />
              ))}
            </datalist>
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="Search by Batch No"
              placeholder="Enter or select batch no"
              value={searchBatch}
              onChange={(e) => setSearchBatch(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSearch()}
              inputProps={{ list: "batch-options" }}
              sx={{
                bgcolor: "white",
                borderRadius: 2,
                "& .MuiOutlinedInput-root": {
                  "&:hover fieldset": {
                    borderColor: "#fa709a",
                  },
                  "&.Mui-focused fieldset": {
                    borderColor: "#fa709a",
                  },
                },
              }}
            />
            <datalist id="batch-options">
              {distinctBatches.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
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
                background:
                  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                fontWeight: "bold",
                borderRadius: 2,
                "&:hover": {
                  background:
                    "linear-gradient(135deg, #764ba2 0%, #667eea 100%)",
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

        {/* Learner Details Card */}
        {learnerData && (
          <Card
            sx={{
              background:
                "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
              color: "#333",
              borderRadius: 3,
              boxShadow: "0 8px 20px rgba(250, 112, 154, 0.3)",
            }}
          >
            <CardContent>
              <Typography
                variant="h6"
                gutterBottom
                fontWeight="bold"
              >
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
                    {learnerData.phone}
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

        {(searchEmail || searchName || searchBatch) &&
          !learnerData &&
          !loading &&
          message && (
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              No learner found with the given input.
            </Alert>
          )}
      </Paper>

      {/* Add Learner Dialog */}
      <Dialog
        open={openAddDialog}
        onClose={() => setOpenAddDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle
          sx={{
            background:
              "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
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
            <TextField
              fullWidth
              label="Phone"
              value={newLearner.phone}
              onChange={(e) =>
                setNewLearner({ ...newLearner, phone: e.target.value })
              }
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Batch Number"
              value={newLearner.batch_no}
              onChange={(e) =>
                setNewLearner({
                  ...newLearner,
                  batch_no: e.target.value,
                })
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
              background:
                "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
              color: "#333",
              px: 3,
              fontWeight: "bold",
              "&:hover": {
                background:
                  "linear-gradient(135deg, #fee140 0%, #fa709a 100%)",
              },
            }}
          >
            {loading ? "Adding..." : "Add Learner"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
