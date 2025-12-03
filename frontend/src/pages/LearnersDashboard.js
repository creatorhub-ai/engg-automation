import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  MenuItem,
  Autocomplete,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
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

  const [allLearners, setAllLearners] = useState([]);
  const [distinctBatches, setDistinctBatches] = useState([]);
  const [batchLearners, setBatchLearners] = useState([]);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [statusUpdating, setStatusUpdating] = useState(false);

  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [newLearner, setNewLearner] = useState({
    name: "",
    email: "",
    phone: "",
    batch_no: "",
  });

  const isManagerOrAdmin = ["manager", "admin"].includes(
    (user?.role || "").toLowerCase()
  );
  
  const dropdownSlotProps = {
    paper: {
      sx: {
        maxHeight: 400,   // taller dropdown
      },
    },
    listbox: {
      sx: {
        maxHeight: 380,
      },
    },
  };

  useEffect(() => {
    async function loadLearnersData() {
      setLoading(true);
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        let learnersData = [];
        try {
          const res = await axios.get(`${API_BASE}/api/learners`, { headers });
          learnersData = Array.isArray(res.data) ? res.data : [];
        } catch {
          console.log("No /api/learners endpoint, using batch-based load");
        }

        if (learnersData.length === 0) {
          const batchesRes = await axios.get(`${API_BASE}/api/batches`, {
            headers,
          });
          const batches = batchesRes.data || [];
          for (let i = 0; i < batches.length; i++) {
            const batchNo = batches[i].batch_no || batches[i];
            try {
              const batchLearnersRes = await axios.get(
                `${API_BASE}/api/getlearners?batchno=${batchNo}`,
                { headers }
              );
              learnersData = [
                ...learnersData,
                ...(batchLearnersRes.data || []),
              ];
            } catch {
              // ignore
            }
          }
        }

        const uniqueLearners = learnersData.filter(
          (learner, index, self) =>
            index ===
            self.findIndex(
              (l) =>
                l.email === learner.email && l.batch_no === learner.batch_no
            )
        );
        setAllLearners(uniqueLearners);

        const batches = [
          ...new Set(
            uniqueLearners
              .map((l) => l.batch_no)
              .filter((b) => b && b.trim() !== "")
          ),
        ].sort();
        setDistinctBatches(batches);
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

  function handleSearch() {
    if (!searchEmail && !searchName && !searchBatch) {
      setMessage("Please enter email, name, or batch number");
      setBatchLearners([]);
      return;
    }

    let list = [];
    const searchEmailTrim = searchEmail.trim().toLowerCase();
    const searchNameTrim = searchName.trim().toLowerCase();
    const searchBatchTrim = searchBatch.trim();

    if (searchEmailTrim) {
      list = allLearners.filter(
        (l) => (l.email || "").toLowerCase() === searchEmailTrim
      );
    } else if (searchNameTrim) {
      list = allLearners.filter(
        (l) => (l.name || "").toLowerCase() === searchNameTrim
      );
    } else if (searchBatchTrim) {
      list = allLearners.filter(
        (l) => String(l.batch_no).trim() === searchBatchTrim
      );
    }

    if (list.length > 0) {
      setBatchLearners(list);
      if (searchBatchTrim) {
        setMessage(
          `✅ Found ${list.length} learner${list.length > 1 ? "s" : ""} in batch ${searchBatchTrim}`
        );
      } else {
        setMessage(`✅ Found ${list.length} learner${list.length > 1 ? "s" : ""}`);
      }
    } else {
      setBatchLearners([]);
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
        const learnerToAdd = { ...newLearner, id: Date.now() };
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
      setMessage("❌ Error adding learner");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(learner, newStatus) {
    setStatusUpdating(true);
    setMessage("");
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.put(
        `${API_BASE}/api/learners/status`,
        {
          learner_email: learner.email,
          batch_no: learner.batch_no,
          status: newStatus,
        },
        { headers }
      );
      if (res.data.success) {
        setMessage("✅ Learner status updated");

        // update in allLearners
        setAllLearners((prev) =>
          prev.map((l) =>
            l.email === learner.email && l.batch_no === learner.batch_no
              ? { ...l, status: newStatus }
              : l
          )
        );
        // update in batchLearners
        setBatchLearners((prev) =>
          prev.map((l) =>
            l.email === learner.email && l.batch_no === learner.batch_no
              ? { ...l, status: newStatus }
              : l
          )
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
    setBatchLearners([]);
    setMessage("");
  }

  const listBoxStyle = {
    style: { maxHeight: 320, overflowY: "auto" },
  };

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
              disablePortal
              slotProps={dropdownSlotProps}
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
              disablePortal
              slotProps={dropdownSlotProps}
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
              disablePortal
              ListboxProps={listBoxStyle}
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

        <Typography
          variant="caption"
          sx={{ mb: 2, display: "block", color: "gray" }}
        >
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

        {/* Batch learners table with inline status editing */}
        {batchLearners.length > 0 && (
          <Box mt={1}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              {searchBatch
                ? `Batch ${searchBatch}: ${batchLearners.length} learner${
                    batchLearners.length > 1 ? "s" : ""
                  }`
                : `Matched learners: ${batchLearners.length}`}
            </Typography>
            <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Phone</TableCell>
                    <TableCell>Batch No</TableCell>
                    {isManagerOrAdmin && <TableCell>Status</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {batchLearners.map((l, idx) => (
                    <TableRow key={`${l.email}-${l.batch_no}`}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>{l.name}</TableCell>
                      <TableCell>{l.email}</TableCell>
                      <TableCell>{l.phone || "-"}</TableCell>
                      <TableCell>{l.batch_no}</TableCell>
                      {isManagerOrAdmin && (
                        <TableCell>
                          <TextField
                            select
                            size="small"
                            value={l.status || "Enabled"}
                            disabled={statusUpdating}
                            onChange={(e) =>
                              handleStatusChange(l, e.target.value)
                            }
                            sx={{ minWidth: 120 }}
                          >
                            <MenuItem value="Enabled">Enable</MenuItem>
                            <MenuItem value="Disabled">Disable</MenuItem>
                            <MenuItem value="Dropout">Dropout</MenuItem>
                          </TextField>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

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
                disablePortal
                ListboxProps={listBoxStyle}
                onChange={(e, value) =>
                  setNewLearner({ ...newLearner, batch_no: value || "" })
                }
                onInputChange={(e, value) =>
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
                  background:
                    "linear-gradient(135deg, #fee140 0%, #fa709a 100%)",
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
