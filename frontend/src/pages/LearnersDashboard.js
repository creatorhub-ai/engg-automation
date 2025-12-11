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
  Chip,
  IconButton,
  Tooltip,
} from "@mui/material";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import SearchIcon from "@mui/icons-material/Search";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import EditIcon from "@mui/icons-material/Edit";

const API_BASE =
  process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

export default function LearnersDashboard({ user, token }) {
  // Search mode + value
  const [searchType, setSearchType] = useState("email"); // 'email' | 'name' | 'batch'
  const [searchText, setSearchText] = useState("");

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

  // Status change dialog state
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedLearner, setSelectedLearner] = useState(null);
  const [newStatus, setNewStatus] = useState("");

  const isManagerOrAdmin = ["manager", "admin"].includes(
    (user?.role || "").toLowerCase()
  );

  const dropdownSlotProps = {
    paper: {
      sx: {
        maxHeight: 800,
        maxWidth: 800,
      },
    },
    listbox: {
      sx: {
        maxHeight: 400,
        maxWidth: 1000,
      },
    },
  };

  const listBoxStyle = {
    style: { maxHeight: 320, maxWidth: 1000, overflowY: "auto" },
  };

  // Status color mapping
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "enabled":
        return "success";
      case "disabled":
        return "warning";
      case "dropout":
        return "error";
      default:
        return "default";
    }
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
    const value = (searchText || "").trim();
    if (!value) {
      setMessage("Please select a search type and enter a value");
      setBatchLearners([]);
      return;
    }

    let list = [];
    if (searchType === "email") {
      const v = value.toLowerCase();
      list = allLearners.filter(
        (l) => (l.email || "").toLowerCase() === v
      );
    } else if (searchType === "name") {
      const v = value.toLowerCase();
      list = allLearners.filter(
        (l) => (l.name || "").toLowerCase() === v
      );
    } else if (searchType === "batch") {
      list = allLearners.filter(
        (l) => String(l.batch_no).trim() === value
      );
    }

    if (list.length > 0) {
      setBatchLearners(list);
      if (searchType === "batch") {
        setMessage(
          `✅ Found ${list.length} learner${list.length > 1 ? "s" : ""} in batch ${value}`
        );
      } else {
        setMessage(`✅ Found ${list.length} learner${list.length > 1 ? "s" : ""}`);
      }
    } else {
      setBatchLearners([]);
      setMessage("❌ Learner not found - check spelling or try another value");
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

  async function handleStatusChangeConfirm() {
    if (!selectedLearner || !newStatus) return;

    setStatusUpdating(true);
    setStatusDialogOpen(false);
    setMessage("");
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.put(
        `${API_BASE}/api/learners/status`,
        {
          learner_email: selectedLearner.email,
          batch_no: selectedLearner.batch_no,
          status: newStatus,
        },
        { headers }
      );
      if (res.data.success) {
        setMessage(
          `✅ Status changed for ${selectedLearner.name} (${selectedLearner.email}) from "${selectedLearner.status || "Enabled"}" to "${newStatus}"`
        );

        setAllLearners((prev) =>
          prev.map((l) =>
            l.email === selectedLearner.email &&
            l.batch_no === selectedLearner.batch_no
              ? { ...l, status: newStatus }
              : l
          )
        );
        setBatchLearners((prev) =>
          prev.map((l) =>
            l.email === selectedLearner.email &&
            l.batch_no === selectedLearner.batch_no
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

  function handleStatusChange(learner) {
    setSelectedLearner(learner);
    setNewStatus(learner.status || "Enabled");
    setStatusDialogOpen(true);
  }

  function handleReset() {
    setSearchType("email");
    setSearchText("");
    setBatchLearners([]);
    setMessage("");
  }

  // Options for main search input based on searchType
  const searchOptions =
    searchType === "email"
      ? allLearners.map((l) => l.email || "")
      : searchType === "name"
      ? allLearners.map((l) => l.name || "")
      : distinctBatches;

  const searchLabel =
    searchType === "email"
      ? "Enter Email"
      : searchType === "name"
      ? "Enter Name"
      : "Enter / Select Batch No";

  const searchPlaceholder =
    searchType === "email"
      ? "Type learner email"
      : searchType === "name"
      ? "Type learner name"
      : "Type or select batch number";

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
          {/* Search type dropdown */}
          <Grid item xs={12} sm={3}>
            <TextField
              select
              fullWidth
              label="Search By"
              value={searchType}
              onChange={(e) => {
                setSearchType(e.target.value);
                setSearchText("");
                setBatchLearners([]);
                setMessage("");
              }}
              sx={{
                bgcolor: "white",
                borderRadius: 2,
                "& .MuiOutlinedInput-root": {
                  "&:hover fieldset": { borderColor: "#fa709a" },
                  "&.Mui-focused fieldset": { borderColor: "#fa709a" },
                },
              }}
            >
              <MenuItem value="email">Email</MenuItem>
              <MenuItem value="name">Name</MenuItem>
              <MenuItem value="batch">Batch No</MenuItem>
            </TextField>
          </Grid>

          {/* Dynamic search input */}
          <Grid item xs={12} sm={6} md={6}>
            <Autocomplete
              freeSolo
              disablePortal
              options={searchOptions}
              value={searchText}
              onChange={(e, value) => setSearchText(value || "")}
              onInputChange={(e, value) => setSearchText(value || "")}
              ListboxProps={{
                style: {
                  maxHeight: 320,
                  maxWidth: 600,        // wider dropdown
                  width: 600,
                },
              }}
              sx={{
                "& .MuiAutocomplete-inputRoot": {
                  width: 400,           // wider input
                },
                "& .MuiInputBase-input": {
                  minWidth: 300,        // prevents text clipping
                },
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={searchLabel}
                  placeholder={searchPlaceholder}
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

          {/* Search button */}
          <Grid item xs={12} sm={2}>
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

          {/* Reset button */}
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

        {/* Batch learners table */}
        {batchLearners.length > 0 && (
          <Box mt={1}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              {searchType === "batch" && searchText
                ? `Batch ${searchText}: ${batchLearners.length} learner${
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
                    <TableCell>Status</TableCell>
                    {isManagerOrAdmin && <TableCell>Action</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {batchLearners.map((l, idx) => (
                    <TableRow key={`${l.email}-${l.batch_no}`} hover>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>{l.name}</TableCell>
                      <TableCell>{l.email}</TableCell>
                      <TableCell>{l.phone || "-"}</TableCell>
                      <TableCell>{l.batch_no}</TableCell>
                      <TableCell>
                        <Chip
                          label={l.status || "Enabled"}
                          color={getStatusColor(l.status)}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      {isManagerOrAdmin && (
                        <TableCell>
                          <Tooltip title="Change Status">
                            <IconButton
                              size="small"
                              onClick={() => handleStatusChange(l)}
                              disabled={statusUpdating}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
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
                  background: "linear-gradient(135deg, #fee140 0%, #fa709a 100%)",
                },
              }}
            >
              {loading ? "Adding..." : "Add Learner"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Status Change Dialog */}
        <Dialog
          open={statusDialogOpen}
          onClose={() => setStatusDialogOpen(false)}
          maxWidth="xs"
          fullWidth
          PaperProps={{ sx: { borderRadius: 3 } }}
        >
          <DialogTitle
            sx={{
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "white",
              fontWeight: "bold",
            }}
          >
            Change Status for {selectedLearner?.name}
          </DialogTitle>
          <DialogContent sx={{ pt: 2 }}>
            <Typography variant="body2" gutterBottom>
              Current status: <strong>{selectedLearner?.status || "Enabled"}</strong>
            </Typography>
            <TextField
              select
              fullWidth
              label="New Status"
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              disabled={statusUpdating}
              sx={{ mt: 1 }}
            >
              <MenuItem value="Enabled">Enable</MenuItem>
              <MenuItem value="Disabled">Disable</MenuItem>
              <MenuItem value="Dropout">Dropout</MenuItem>
            </TextField>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button
              onClick={() => setStatusDialogOpen(false)}
              disabled={statusUpdating}
              sx={{ color: "#666" }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleStatusChangeConfirm}
              variant="contained"
              disabled={statusUpdating || !newStatus}
              sx={{
                background: "linear-gradient(135deg, #4caf50 0%, #45a049 100%)",
                color: "white",
                "&:hover": {
                  background: "linear-gradient(135deg, #45a049 0%, #4caf50 100%)",
                },
              }}
            >
              {statusUpdating ? <CircularProgress size={20} /> : "Update Status"}
            </Button>
          </DialogActions>
        </Dialog>
      </Paper>
    </Box>
  );
}
