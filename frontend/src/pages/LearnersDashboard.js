import React, { useEffect, useMemo, useState } from "react";
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
  FormControl,
  InputLabel,
  Select,
} from "@mui/material";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import SearchIcon from "@mui/icons-material/Search";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import EditIcon from "@mui/icons-material/Edit";

const API_BASE = "https://engg-automation.onrender.com";

function normalizeLearner(raw) {
  return {
    ...raw,
    batchno: raw.batch_no || raw.batchno || "",
    batch_no: raw.batch_no || raw.batchno || "",
    email: (raw.email || raw.learner_email || "").trim().toLowerCase(),
    name: (raw.name || raw.learner_name || "").trim(),
    phone: raw.phone || "",
    status: raw.status || "Enabled",
  };
}

export default function LearnersDashboard({ user, token }) {
  const [searchType, setSearchType] = useState("email");
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

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

  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedLearner, setSelectedLearner] = useState(null);
  const [newStatus, setNewStatus] = useState("");

  const isManagerOrAdmin = ["manager", "admin"].includes(
    (user?.role || "").toLowerCase()
  );

  const getStatusColor = (status) => {
    switch ((status || "").toLowerCase()) {
      case "enabled":
        return "success";
      case "disabled":
        return "warning";
      case "dropout":
        return "default";
      default:
        return "default";
    }
  };

  const filteredLearners = useMemo(() => {
    if (statusFilter === "all") return allLearners;
    return allLearners.filter(
      (l) => (l.status || "Enabled").toLowerCase() === statusFilter.toLowerCase()
    );
  }, [allLearners, statusFilter]);

  // FIXED: Enhanced loadLearnersData with better error handling + logging
  async function loadLearnersData() {
    setLoading(true);
    setMessage("Loading learners from learners_data table...");

    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      console.log("🔄 Fetching learners from /api/learners...");
      const res = await axios.get(`${API_BASE}/api/learners`, { 
        headers,
        timeout: 10000 
      });

      console.log("📊 Raw API response:", res.data.slice(0, 3)); // Log first 3 records

      const raw = Array.isArray(res.data) ? res.data : [];
      const normalized = raw.map(normalizeLearner);

      // FIXED: Better duplicate removal (email + batch_no)
      const unique = normalized.filter((l, i, arr) =>
        arr.findIndex(l2 => 
          l2.email.toLowerCase() === l.email.toLowerCase() && 
          l2.batch_no === l.batch_no
        ) === i
      );

      console.log(`✅ Normalized ${raw.length} → ${unique.length} unique learners`);

      setAllLearners(unique);

      const batches = [
        ...new Set(unique.map((l) => l.batch_no).filter(Boolean)),
      ].sort();
      setDistinctBatches(batches);

      setMessage(
        `✅ Loaded ${unique.length} learners from ${batches.length} batches`
      );
      
      // Reset search results
      setBatchLearners(unique);
      
    } catch (err) {
      console.error("❌ Load error:", err.response?.status, err.message);
      console.error("Error details:", err.response?.data);
      
      setMessage(
        `⚠️ Failed to load learners (${err.response?.status || err.message})`
      );
      setAllLearners([]);
      setDistinctBatches([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLearnersData();
  }, []);

  function handleSearch() {
    const value = searchText.trim();
    if (!value) {
      setBatchLearners(filteredLearners);
      return;
    }

    let results = [];
    if (searchType === "email") {
      results = filteredLearners.filter((l) =>
        l.email.includes(value.toLowerCase())
      );
    } else if (searchType === "name") {
      results = filteredLearners.filter((l) =>
        l.name.toLowerCase().includes(value.toLowerCase())
      );
    } else {
      results = filteredLearners.filter((l) => l.batch_no === value);
    }

    setBatchLearners(results);
  }

  async function handleAddLearner() {
    const { name, email, phone, batch_no } = newLearner;
    if (!name?.trim() || !email?.trim() || !batch_no?.trim()) {
      setMessage("❌ Fill all required fields");
      return;
    }

    setLoading(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const payload = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        batchno: batch_no.trim(),
      };

      console.log("➕ Adding learner:", payload);
      const res = await axios.post(`${API_BASE}/api/learners/add`, payload, {
        headers,
      });

      if (res.data?.success) {
        const added = normalizeLearner(res.data.data);
        setAllLearners((prev) => [added, ...prev]);

        if (!distinctBatches.includes(added.batch_no)) {
          setDistinctBatches((prev) => [...prev, added.batch_no].sort());
        }

        setMessage("✅ Learner added successfully");
        setOpenAddDialog(false);
        setNewLearner({ name: "", email: "", phone: "", batch_no: "" });
      } else {
        setMessage(`❌ ${res.data?.error || "Failed to add learner"}`);
      }
    } catch (err) {
      console.error("Add error:", err.response?.data);
      setMessage(`❌ ${err.response?.data?.error || "Add failed"}`);
    } finally {
      setLoading(false);
    }
  }

  function handleStatusChange(learner) {
    const normalized = normalizeLearner(learner);
    setSelectedLearner(normalized);
    setNewStatus(normalized.status || "Enabled");
    setStatusDialogOpen(true);
  }

  async function handleStatusChangeConfirm() {
    if (!selectedLearner || !newStatus) return;

    setStatusUpdating(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const payload = {
        learneremail: selectedLearner.email,
        batchno: selectedLearner.batch_no,
        status: newStatus,
      };

      const res = await axios.put(
        `${API_BASE}/api/learners/status`,
        payload,
        { headers }
      );

      if (res.data?.success) {
        const match = (l) =>
          l.email === selectedLearner.email &&
          (l.batch_no || l.batchno) === selectedLearner.batch_no;

        setAllLearners((prev) =>
          prev.map((l) => (match(l) ? { ...l, status: newStatus } : l))
        );
        setBatchLearners((prev) =>
          prev.map((l) => (match(l) ? { ...l, status: newStatus } : l))
        );
        setMessage(`✅ Status updated to "${newStatus}"`);
        setStatusDialogOpen(false);
      } else {
        setMessage(`❌ ${res.data?.error || "Status update failed"}`);
      }
    } catch (err) {
      console.error("Status error:", err.response?.data);
      setMessage(`❌ ${err.response?.data?.error || "Status update failed"}`);
    } finally {
      setStatusUpdating(false);
    }
  }

  function handleReset() {
    setSearchText("");
    setBatchLearners(filteredLearners);
    setMessage("");
  }

  const searchOptions =
    searchType === "email"
      ? filteredLearners.map((l) => l.email)
      : searchType === "name"
      ? filteredLearners.map((l) => l.name)
      : distinctBatches;

  const currentResults = batchLearners.length > 0 ? batchLearners : filteredLearners;

  return (
    <Box sx={{ maxWidth: 1400, mx: "auto", p: 3 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box display="flex" alignItems="center" gap={2}>
            <MenuBookIcon sx={{ fontSize: 40, color: 'primary.main' }} />
            <Box>
              <Typography variant="h4" fontWeight="bold">
                Learners Dashboard
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Total: {allLearners.length} | Batches: {distinctBatches.length}
              </Typography>
            </Box>
          </Box>
          {isManagerOrAdmin && (
            <Button
              variant="contained"
              startIcon={<PersonAddIcon />}
              onClick={() => setOpenAddDialog(true)}
            >
              Add Learner
            </Button>
          )}
        </Box>

        {/* Search & Filter Row */}
        <Grid container spacing={2} mb={3}>
          <Grid item xs={12} md={2}>
            <TextField
              select
              fullWidth
              label="Search By"
              value={searchType}
              onChange={(e) => setSearchType(e.target.value)}
            >
              <MenuItem value="email">Email</MenuItem>
              <MenuItem value="name">Name</MenuItem>
              <MenuItem value="batch">Batch</MenuItem>
            </TextField>
          </Grid>

          <Grid item xs={12} md={2}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <MenuItem value="all">All Status</MenuItem>
                <MenuItem value="Enabled">Enabled</MenuItem>
                <MenuItem value="Disabled">Disabled</MenuItem>
                <MenuItem value="Dropout">Dropout</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={6}>
            <Autocomplete
              freeSolo
              options={searchOptions}
              value={searchText}
              onChange={(e, v) => setSearchText(v || "")}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={
                    searchType === "batch" ? "Batch No" :
                    searchType === "email" ? "Email" : "Name"
                  }
                  onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                  fullWidth
                />
              )}
            />
          </Grid>

          <Grid item xs={12} md={1}>
            <Button
              fullWidth
              variant="contained"
              onClick={handleSearch}
              startIcon={<SearchIcon />}
              sx={{ height: 56 }}
            >
              Search
            </Button>
          </Grid>

          <Grid item xs={12} md={1}>
            <Button
              fullWidth
              variant="outlined"
              onClick={handleReset}
              startIcon={<RestartAltIcon />}
              sx={{ height: 56 }}
            >
              Reset
            </Button>
          </Grid>
        </Grid>

        {/* Status Message */}
        {message && (
          <Alert severity={message.includes("✅") ? "success" : message.includes("❌") ? "error" : "info"} sx={{ mb: 2 }}>
            {message}
          </Alert>
        )}

        {/* Stats Row */}
        <Alert severity="info" sx={{ mb: 2 }}>
          Total: <strong>{allLearners.length}</strong> | 
          Filtered: <strong>{filteredLearners.length}</strong> | 
          Showing: <strong>{currentResults.length}</strong>
        </Alert>

        {/* Learners Table */}
        {currentResults.length ? (
          <TableContainer component={Paper} sx={{ maxHeight: 600 }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell>Batch</TableCell>
                  <TableCell>Status</TableCell>
                  {isManagerOrAdmin && <TableCell>Actions</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {currentResults.map((raw, i) => {
                  const l = normalizeLearner(raw);
                  const isDropout = (l.status || "").toLowerCase() === "dropout";
                  return (
                    <TableRow key={`${l.email}-${l.batch_no}`} hover>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell sx={{ fontWeight: 500 }}>{l.name}</TableCell>
                      <TableCell sx={{ wordBreak: 'break-all' }}>{l.email}</TableCell>
                      <TableCell>{l.phone || '-'}</TableCell>
                      <TableCell><strong>{l.batch_no}</strong></TableCell>
                      <TableCell>
                        <Chip
                          label={l.status || 'Enabled'}
                          color={getStatusColor(l.status)}
                          size="small"
                        />
                      </TableCell>
                      {isManagerOrAdmin && (
                        <TableCell>
                          <Tooltip title="Change Status">
                            <IconButton
                              size="small"
                              onClick={() => handleStatusChange(l)}
                              disabled={statusUpdating || isDropout}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Paper sx={{ p: 6, textAlign: "center" }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              {loading ? "Loading..." : "No learners found"}
            </Typography>
            <Button 
              onClick={loadLearnersData} 
              variant="contained" 
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} /> : <MenuBookIcon />}
            >
              {loading ? "Loading..." : "Reload Data"}
            </Button>
          </Paper>
        )}

        {/* Add Learner Dialog */}
        <Dialog open={openAddDialog} onClose={() => setOpenAddDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Add New Learner</DialogTitle>
          <DialogContent sx={{ pt: 2 }}>
            <TextField
              fullWidth label="Full Name *" 
              value={newLearner.name}
              onChange={(e) => setNewLearner({ ...newLearner, name: e.target.value })}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth label="Email *" type="email"
              value={newLearner.email}
              onChange={(e) => setNewLearner({ ...newLearner, email: e.target.value })}
              sx={{ mb: 2 }}
            />
            <Autocomplete
              freeSolo options={distinctBatches}
              value={newLearner.batch_no}
              onChange={(e, v) => setNewLearner({ ...newLearner, batch_no: v || "" })}
              renderInput={(params) => (
                <TextField {...params} label="Batch No *" sx={{ mb: 2 }} />
              )}
            />
            <TextField
              fullWidth label="Phone (Optional)"
              value={newLearner.phone}
              onChange={(e) => setNewLearner({ ...newLearner, phone: e.target.value })}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenAddDialog(false)}>Cancel</Button>
            <Button onClick={handleAddLearner} disabled={loading} variant="contained">
              {loading ? "Adding..." : "Add Learner"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Status Update Dialog */}
        <Dialog open={statusDialogOpen} onClose={() => setStatusDialogOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle>Update Status</DialogTitle>
          <DialogContent>
            <Typography variant="h6">{selectedLearner?.name}</Typography>
            <Typography variant="body2" color="text.secondary">
              {selectedLearner?.email} / {selectedLearner?.batch_no}
            </Typography>
            <TextField
              select fullWidth label="New Status"
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              sx={{ mt: 2 }}
            >
              <MenuItem value="Enabled">Enabled</MenuItem>
              <MenuItem value="Disabled">Disabled</MenuItem>
              <MenuItem value="Dropout">Dropout</MenuItem>
            </TextField>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setStatusDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleStatusChangeConfirm}
              disabled={statusUpdating}
              variant="contained"
            >
              {statusUpdating ? "Updating..." : "Update Status"}
            </Button>
          </DialogActions>
        </Dialog>
      </Paper>
    </Box>
  );
}
