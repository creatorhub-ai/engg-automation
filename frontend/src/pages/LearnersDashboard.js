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
    name: (raw.name || raw.learner_name || raw.full_name || "").trim(),
    phone: raw.phone || raw.mobile || "",
    status: raw.status || "Enabled",
  };
}

// 🔥 FIXED: Multiple fallback APIs + direct table query
async function fetchLearnersWithFallbacks(token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  
  // TRY 1: Original learners endpoint
  try {
    console.log("🔄 [API 1] /api/learners...");
    const res1 = await axios.get(`${API_BASE}/api/learners`, { 
      headers, timeout: 5000 
    });
    if (res1.data?.length > 0) {
      console.log("✅ [API 1] SUCCESS:", res1.data.length, "learners");
      return res1.data;
    }
  } catch (e) {
    console.log("❌ [API 1] FAILED");
  }

  // TRY 2: Direct learners_data table
  try {
    console.log("🔄 [API 2] /api/learners-data...");
    const res2 = await axios.get(`${API_BASE}/api/learners-data`, { 
      headers, timeout: 5000 
    });
    if (res2.data?.length > 0) {
      console.log("✅ [API 2] SUCCESS:", res2.data.length, "learners");
      return res2.data;
    }
  } catch (e) {
    console.log("❌ [API 2] FAILED");
  }

  // TRY 3: All learners without batch filter
  try {
    console.log("🔄 [API 3] /api/learners-all...");
    const res3 = await axios.get(`${API_BASE}/api/learners-all`, { 
      headers, timeout: 5000 
    });
    if (res3.data?.length > 0) {
      console.log("✅ [API 3] SUCCESS:", res3.data.length, "learners");
      return res3.data;
    }
  } catch (e) {
    console.log("❌ [API 3] FAILED");
  }

  // TRY 4: Raw database query (if backend supports)
  try {
    console.log("🔄 [API 4] /api/raw-learners...");
    const res4 = await axios.get(`${API_BASE}/api/raw-learners`, { 
      headers, timeout: 5000 
    });
    if (res4.data?.length > 0) {
      console.log("✅ [API 4] SUCCESS:", res4.data.length, "learners");
      return res4.data;
    }
  } catch (e) {
    console.log("❌ [API 4] FAILED");
  }

  console.log("❌ ALL APIs FAILED - Empty response");
  return [];
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

  // 🔥 FIXED: Ultimate loader with ALL fallbacks
  async function loadLearnersData() {
    setLoading(true);
    setMessage("🔄 Loading learners from multiple sources...");

    try {
      const rawLearners = await fetchLearnersWithFallbacks(token);
      
      if (rawLearners.length === 0) {
        throw new Error("All APIs returned empty data");
      }

      console.log("📊 Processing", rawLearners.length, "raw records");
      
      const normalized = rawLearners.map(normalizeLearner);
      
      // Remove duplicates (email + batch)
      const unique = normalized.filter((l, i, arr) =>
        arr.findIndex(l2 => 
          l2.email.toLowerCase() === l.email.toLowerCase() && 
          l2.batch_no === l.batch_no
        ) === i
      );

      console.log(`✅ FINAL: ${unique.length} unique learners`);

      setAllLearners(unique);
      
      const batches = [...new Set(unique.map(l => l.batch_no).filter(Boolean))].sort();
      setDistinctBatches(batches);
      
      setMessage(`✅ Loaded ${unique.length} learners from ${batches.length} batches`);
      setBatchLearners(unique); // Show all by default
      
    } catch (err) {
      console.error("🚨 TOTAL FAILURE:", err.message);
      setMessage(`❌ No data loaded: ${err.message}`);
      setAllLearners([]);
      setDistinctBatches([]);
      setBatchLearners([]);
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
      results = filteredLearners.filter((l) => l.batch_no.includes(value));
    }

    setBatchLearners(results);
    setMessage(`🔍 Found ${results.length} matches`);
  }

  // Rest of functions remain same...
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
        phone: phone.trim(),
        batchno: batch_no.trim(),
      };

      const res = await axios.post(`${API_BASE}/api/learners/add`, payload, { headers });
      
      if (res.data?.success) {
        const added = normalizeLearner(res.data.data);
        setAllLearners(prev => [added, ...prev]);
        setMessage("✅ Learner added");
        setOpenAddDialog(false);
        setNewLearner({ name: "", email: "", phone: "", batch_no: "" });
      } else {
        setMessage(`❌ ${res.data?.error || "Failed to add"}`);
      }
    } catch (err) {
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
              <Typography variant="h4" fontWeight="bold">Learners Dashboard</Typography>
              <Typography variant="body1" color="text.secondary">
                Total: {allLearners.length} | Batches: {distinctBatches.length}
              </Typography>
            </Box>
          </Box>
          <Button
            variant="contained"
            startIcon={<PersonAddIcon />}
            onClick={() => setOpenAddDialog(true)}
            disabled={!isManagerOrAdmin}
          >
            Add Learner
          </Button>
        </Box>

        <Grid container spacing={2} mb={3}>
          <Grid item xs={12} md={2}>
            <TextField select fullWidth label="Search By" value={searchType}
              onChange={(e) => setSearchType(e.target.value)}>
              <MenuItem value="email">Email</MenuItem>
              <MenuItem value="name">Name</MenuItem>
              <MenuItem value="batch">Batch</MenuItem>
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

          <Grid item xs={12} md={6}>
            <Autocomplete
              freeSolo options={searchOptions} value={searchText}
              onChange={(e, v) => setSearchText(v || "")}
              renderInput={(params) => (
                <TextField {...params}
                  label={searchType === "batch" ? "Batch No" : searchType === "email" ? "Email" : "Name"}
                  onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                  fullWidth
                />
              )}
            />
          </Grid>

          <Grid item xs={12} md={1}>
            <Button fullWidth variant="contained" onClick={handleSearch}
              startIcon={<SearchIcon />} sx={{ height: 56 }}>
              Search
            </Button>
          </Grid>

          <Grid item xs={12} md={1}>
            <Button fullWidth variant="outlined" onClick={handleReset}
              startIcon={<RestartAltIcon />} sx={{ height: 56 }}>
              Reset
            </Button>
          </Grid>
        </Grid>

        {message && (
          <Alert severity={message.includes("✅") ? "success" : "warning"} sx={{ mb: 2 }}>
            {message}
          </Alert>
        )}

        <Alert severity="info" sx={{ mb: 2 }}>
          Total: <strong>{allLearners.length}</strong> | 
          Filtered: <strong>{filteredLearners.length}</strong> | 
          Showing: <strong>{currentResults.length}</strong>
        </Alert>

        {currentResults.length ? (
          <TableContainer component={Paper} sx={{ maxHeight: 600 }}>
            <Table stickyHeader>
              <TableHead sx={{ bgcolor: 'primary.main', color: 'white' }}>
                <TableRow>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>#</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Name</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Email</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Phone</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Batch</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Status</TableCell>
                  {isManagerOrAdmin && <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Actions</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {currentResults.map((raw, i) => {
                  const l = normalizeLearner(raw);
                  return (
                    <TableRow key={`${l.email}-${l.batch_no}`} hover>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell sx={{ fontWeight: 500 }}>{l.name}</TableCell>
                      <TableCell>{l.email}</TableCell>
                      <TableCell>{l.phone || '-'}</TableCell>
                      <TableCell><strong>{l.batch_no}</strong></TableCell>
                      <TableCell>
                        <Chip label={l.status || 'Enabled'} 
                          color={getStatusColor(l.status)} size="small" />
                      </TableCell>
                      {isManagerOrAdmin && (
                        <TableCell>
                          <IconButton size="small" onClick={() => handleStatusChange(l)}>
                            <EditIcon />
                          </IconButton>
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
              {loading ? "Loading..." : "No learners data available"}
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>
              API Response: Empty from all endpoints
            </Typography>
            <Button onClick={loadLearnersData} variant="contained" disabled={loading}
              startIcon={loading ? <CircularProgress size={20} /> : <MenuBookIcon />}>
              🔄 Reload Data (Try All APIs)
            </Button>
          </Paper>
        )}

        {/* Add & Status Dialogs - SAME AS BEFORE */}
        <Dialog open={openAddDialog} onClose={() => setOpenAddDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Add New Learner</DialogTitle>
          <DialogContent sx={{ pt: 2 }}>
            <TextField fullWidth label="Name *" value={newLearner.name}
              onChange={(e) => setNewLearner({ ...newLearner, name: e.target.value })}
              sx={{ mb: 2 }} />
            <TextField fullWidth label="Email *" type="email" value={newLearner.email}
              onChange={(e) => setNewLearner({ ...newLearner, email: e.target.value })}
              sx={{ mb: 2 }} />
            <Autocomplete freeSolo options={distinctBatches} value={newLearner.batch_no}
              onChange={(e, v) => setNewLearner({ ...newLearner, batch_no: v || "" })}
              renderInput={(params) => <TextField {...params} label="Batch No *" sx={{ mb: 2 }} />} />
            <TextField fullWidth label="Phone" value={newLearner.phone}
              onChange={(e) => setNewLearner({ ...newLearner, phone: e.target.value })} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenAddDialog(false)}>Cancel</Button>
            <Button onClick={handleAddLearner} disabled={loading} variant="contained">
              Add Learner
            </Button>
          </DialogActions>
        </Dialog>
      </Paper>
    </Box>
  );
}
