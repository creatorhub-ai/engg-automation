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
    id: raw.id,
    name: (raw.name || "").trim(),
    email: (raw.email || "").trim().toLowerCase(),
    phone: raw.phone || "",
    batch_no: raw.batch_no || "",
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
        return "success";
    }
  };

  const filteredLearners = useMemo(() => {
    if (statusFilter === "all") return allLearners;
    return allLearners.filter(
      (l) => (l.status || "Enabled").toLowerCase() === statusFilter.toLowerCase()
    );
  }, [allLearners, statusFilter]);

  // 🔥 FIXED: Direct learners_data table query with better error handling
  async function loadLearnersData() {
    setLoading(true);
    setMessage("🔄 Loading learners_data table...");
    
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      console.log("🔍 Fetching from /api/learners...");
      
      const res = await axios.get(`${API_BASE}/api/learners`, { 
        headers,
        timeout: 15000 
      });

      console.log("📊 Raw response:", res.data?.slice(0, 2));
      
      const raw = Array.isArray(res.data) ? res.data : [];
      if (raw.length === 0) {
        setMessage("⚠️ learners_data table is empty");
        return;
      }

      const normalized = raw.map(normalizeLearner);
      
      // Remove duplicates based on email + batch_no (matches backend unique constraint)
      const unique = normalized.filter((l, i, arr) =>
        arr.findIndex(l2 => 
          l2.email.toLowerCase() === l.email.toLowerCase() && 
          l2.batch_no === l.batch_no
        ) === i
      );

      const batches = [...new Set(unique.map(l => l.batch_no).filter(Boolean))].sort();
      
      setAllLearners(unique);
      setDistinctBatches(batches);
      setBatchLearners(unique); // Show all by default
      
      setMessage(`✅ Loaded ${unique.length} learners from ${batches.length} batches`);
      
    } catch (err) {
      console.error("❌ Load error:", err.response?.status, err.response?.data);
      setMessage(`❌ Failed: ${err.response?.data?.error || err.message}`);
      setAllLearners([]);
      setDistinctBatches([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) {
      loadLearnersData();
    }
  }, [token]);

  function handleSearch() {
    const value = searchText.trim().toLowerCase();
    if (!value) {
      setBatchLearners(filteredLearners);
      setMessage("");
      return;
    }

    let results = [];
    if (searchType === "email") {
      results = filteredLearners.filter(l => l.email.includes(value));
    } else if (searchType === "name") {
      results = filteredLearners.filter(l => l.name.toLowerCase().includes(value));
    } else {
      results = filteredLearners.filter(l => l.batch_no.includes(value));
    }

    setBatchLearners(results);
    setMessage(`🔍 Found ${results.length} matches`);
  }

  async function handleAddLearner() {
    const { name, email, phone, batch_no } = newLearner;
    if (!name?.trim() || !email?.trim() || !batch_no?.trim()) {
      setMessage("❌ Fill all required fields");
      return;
    }

    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const payload = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone?.trim() || null,
        batchno: batch_no.trim(),
      };

      console.log("➕ Adding:", payload);
      const res = await axios.post(`${API_BASE}/api/learners/add`, payload, { headers });

      if (res.data?.success) {
        const added = normalizeLearner(res.data.data);
        setAllLearners(prev => [added, ...prev]);
        
        if (!distinctBatches.includes(added.batch_no)) {
          setDistinctBatches(prev => [...prev, added.batch_no].sort());
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
    setSelectedLearner(learner);
    setNewStatus(learner.status || "Enabled");
    setStatusDialogOpen(true);
  }

  async function handleStatusChangeConfirm() {
    if (!selectedLearner || !newStatus) return;

    setStatusUpdating(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const payload = {
        learneremail: selectedLearner.email,
        batchno: selectedLearner.batch_no,
        status: newStatus,
      };

      const res = await axios.put(`${API_BASE}/api/learners/status`, payload, { headers });

      if (res.data?.success) {
        const match = (l) => l.email === selectedLearner.email && l.batch_no === selectedLearner.batch_no;
        
        setAllLearners(prev => prev.map(l => match(l) ? { ...l, status: newStatus } : l));
        setBatchLearners(prev => prev.map(l => match(l) ? { ...l, status: newStatus } : l));
        
        setMessage(`✅ Status updated to "${newStatus}"`);
        setStatusDialogOpen(false);
      } else {
        setMessage(`❌ ${res.data?.error || "Status update failed"}`);
      }
    } catch (err) {
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

  const searchOptions = searchType === "email"
    ? filteredLearners.map(l => l.email)
    : searchType === "name"
    ? filteredLearners.map(l => l.name)
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
            <Button variant="contained" startIcon={<PersonAddIcon />}
              onClick={() => setOpenAddDialog(true)}>
              Add Learner
            </Button>
          )}
        </Box>

        {/* Search Controls */}
        <Grid container spacing={2} mb={3}>
          <Grid item xs={12} md={2}>
            <TextField
              select fullWidth label="Search By"
              value={searchType}
              onChange={(e) => setSearchType(e.target.value)}
            >
              <MenuItem value="email">Email</MenuItem>
              <MenuItem value="name">Name</MenuItem>
              <MenuItem value="batch">Batch No</MenuItem>
            </TextField>
          </Grid>

          <Grid item xs={12} md={2}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select value={statusFilter} label="Status"
                onChange={(e) => setStatusFilter(e.target.value)}>
                <MenuItem value="all">All Status</MenuItem>
                <MenuItem value="Enabled">Enabled</MenuItem>
                <MenuItem value="Disabled">Disabled</MenuItem>
                <MenuItem value="Dropout">Dropout</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={5}>
            <Autocomplete
              freeSolo options={searchOptions} value={searchText}
              onChange={(e, v) => setSearchText(v || "")}
              renderInput={(params) => (
                <TextField {...params}
                  label={searchType === "batch" ? "Batch No" : 
                         searchType === "email" ? "Email" : "Name"}
                  onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                  fullWidth
                />
              )}
            />
          </Grid>

          <Grid item xs={12} md={1.5}>
            <Button fullWidth variant="contained" onClick={handleSearch}
              disabled={loading} startIcon={<SearchIcon />} sx={{ height: 56 }}>
              Search
            </Button>
          </Grid>

          <Grid item xs={12} md={1.5}>
            <Button fullWidth variant="outlined" onClick={handleReset}
              startIcon={<RestartAltIcon />} sx={{ height: 56 }}>
              Reset
            </Button>
          </Grid>
        </Grid>

        {/* Status Messages */}
        {message && (
          <Alert severity={
            message.includes("✅") ? "success" : 
            message.includes("❌") ? "error" : "info"
          } sx={{ mb: 2 }}>
            {message}
          </Alert>
        )}

        <Alert severity="info" sx={{ mb: 3 }}>
          Total: <strong>{allLearners.length}</strong> | 
          Filtered: <strong>{filteredLearners.length}</strong> | 
          Showing: <strong>{currentResults.length}</strong>
        </Alert>

        {/* Learners Table */}
        {currentResults.length ? (
          <TableContainer component={Paper} sx={{ maxHeight: 600, overflow: 'auto' }}>
            <Table stickyHeader>
              <TableHead sx={{ bgcolor: 'primary.main' }}>
                <TableRow>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>#</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Name</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Email</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Phone</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Batch No</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Status</TableCell>
                  {isManagerOrAdmin && <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Action</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {currentResults.map((raw, i) => {
                  const l = normalizeLearner(raw);
                  const isDropout = l.status?.toLowerCase() === "dropout";
                  return (
                    <TableRow key={`${l.email}-${l.batch_no}`} hover>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell sx={{ fontWeight: 500 }}>{l.name}</TableCell>
                      <TableCell sx={{ wordBreak: 'break-word' }}>{l.email}</TableCell>
                      <TableCell>{l.phone || "-"}</TableCell>
                      <TableCell><strong>{l.batch_no}</strong></TableCell>
                      <TableCell>
                        <Chip
                          label={l.status || "Enabled"}
                          color={getStatusColor(l.status)}
                          size="small"
                        />
                      </TableCell>
                      {isManagerOrAdmin && (
                        <TableCell>
                          <Tooltip title={isDropout ? "Dropouts cannot be edited" : "Change Status"}>
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
            <MenuBookIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              {loading ? "Loading learners_data..." : "No learners found"}
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>
              Table: public.learners_data
            </Typography>
            <Button 
              onClick={loadLearnersData} 
              variant="contained" 
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} /> : <MenuBookIcon />}
            >
              {loading ? "Loading..." : "🔄 Reload Data"}
            </Button>
          </Paper>
        )}

        {/* Add Learner Dialog */}
        <Dialog open={openAddDialog} onClose={() => setOpenAddDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Add New Learner</DialogTitle>
          <DialogContent sx={{ pt: 2 }}>
            <TextField
              fullWidth label="Name *" required
              value={newLearner.name}
              onChange={(e) => setNewLearner({ ...newLearner, name: e.target.value })}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth label="Email *" type="email" required
              value={newLearner.email}
              onChange={(e) => setNewLearner({ ...newLearner, email: e.target.value })}
              sx={{ mb: 2 }}
            />
            <Autocomplete
              freeSolo options={distinctBatches.sort()}
              value={newLearner.batch_no}
              onChange={(e, v) => setNewLearner({ ...newLearner, batch_no: v || "" })}
              renderInput={(params) => (
                <TextField {...params} label="Batch No *" required sx={{ mb: 2 }} />
              )}
            />
            <TextField
              fullWidth label="Phone (optional)"
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
              <MenuItem value="Enabled">✅ Enabled</MenuItem>
              <MenuItem value="Disabled">⏸️ Disabled</MenuItem>
              <MenuItem value="Dropout">🚪 Dropout</MenuItem>
            </TextField>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setStatusDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleStatusChangeConfirm} disabled={statusUpdating} variant="contained">
              {statusUpdating ? "Updating..." : "Update Status"}
            </Button>
          </DialogActions>
        </Dialog>
      </Paper>
    </Box>
  );
}
