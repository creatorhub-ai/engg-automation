import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Box, Paper, Typography, Button, TextField, Grid, Dialog,
  DialogTitle, DialogContent, DialogActions, Alert, CircularProgress,
  MenuItem, Autocomplete, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, IconButton, FormControl, InputLabel, Select,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import EditIcon from "@mui/icons-material/Edit";
import RestartAltIcon from "@mui/icons-material/RestartAlt";

const API_BASE = "https://engg-automation.onrender.com";

function normalizeLearner(raw) {
  return {
    id: raw.id,
    name: (raw.name || "").trim() || "Unknown",
    email: (raw.email || "").trim().toLowerCase(),
    phone: raw.phone || "",
    batch_no: raw.batch_no || "",
    status: raw.status || "Enabled",
  };
}

export default function LearnersDashboard({ user, token }) {
  const [allLearners, setAllLearners] = useState([]);
  const [distinctBatches, setDistinctBatches] = useState([]);
  const [batchLearners, setBatchLearners] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const headers = { Authorization: `Bearer ${token}` };

  // 🔥 FIXED: Direct learners_data query
  async function loadLearnersData() {
    setLoading(true);
    setMessage("Loading learners_data table...");
    
    try {
      console.log("🔄 Fetching /api/learners-data...");
      
      // Primary endpoint - learners_data table
      const { data: learnersRes } = await axios.get(`${API_BASE}/api/learners`, {
        headers,
        timeout: 10000
      });

      console.log("✅ learners_data response:", learnersRes?.slice(0, 2));

      const normalized = (learnersRes || []).map(normalizeLearner);
      const unique = normalized.filter((l, i, arr) =>
        arr.findIndex(l2 => l2.email === l.email && l2.batch_no === l.batch_no) === i
      );

      const batches = [...new Set(unique.map(l => l.batch_no).filter(Boolean))].sort();
      
      setAllLearners(unique);
      setDistinctBatches(batches);
      setBatchLearners(unique);
      
      setMessage(`✅ Loaded ${unique.length} learners from ${batches.length} batches`);
      
    } catch (err) {
      console.error("❌ API Error:", err.response?.status, err.message);
      setMessage(`❌ Failed to load: ${err.response?.data?.error || err.message}`);
      setAllLearners([]);
      setDistinctBatches([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) loadLearnersData();
  }, [token]);

  const filteredLearners = useMemo(() => {
    if (statusFilter === "all") return allLearners;
    return allLearners.filter(l => (l.status || "Enabled").toLowerCase() === statusFilter.toLowerCase());
  }, [allLearners, statusFilter]);

  function handleSearch() {
    const value = searchText.trim().toLowerCase();
    if (!value) {
      setBatchLearners(filteredLearners);
      return;
    }

    const results = filteredLearners.filter(l => 
      l.email.includes(value) || 
      l.name.toLowerCase().includes(value) || 
      l.batch_no.includes(value)
    );
    setBatchLearners(results);
  }

  async function handleAddLearner() {
    const newLearner = {
      name: newLearner.name?.trim(),
      email: newLearner.email?.trim().toLowerCase(),
      phone: newLearner.phone?.trim(),
      batchno: newLearner.batch_no?.trim(),
    };

    if (!newLearner.name || !newLearner.email || !newLearner.batchno) {
      setMessage("❌ Fill all required fields");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/api/learners/add`, newLearner, { headers });
      
      if (res.data?.success) {
        const added = normalizeLearner(res.data.data);
        setAllLearners(prev => [added, ...prev]);
        setMessage("✅ Learner added successfully");
        setOpenAddDialog(false);
        setNewLearner({ name: "", email: "", phone: "", batch_no: "" });
      }
    } catch (err) {
      setMessage(`❌ ${err.response?.data?.error || "Failed to add"}`);
    } finally {
      setLoading(false);
    }
  }

  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [newLearner, setNewLearner] = useState({ name: "", email: "", phone: "", batch_no: "" });
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedLearner, setSelectedLearner] = useState(null);
  const [newStatus, setNewStatus] = useState("");

  const isManagerOrAdmin = ["manager", "admin"].includes((user?.role || "").toLowerCase());

  return (
    <Box sx={{ maxWidth: 1400, mx: "auto", p: 3 }}>
      <Paper sx={{ p: 4 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              Learners Dashboard
            </Typography>
            <Typography color="text.secondary">
              Total: {allLearners.length} | Batches: {distinctBatches.length}
            </Typography>
          </Box>
          {isManagerOrAdmin && (
            <Button variant="contained" startIcon={<PersonAddIcon />}
              onClick={() => setOpenAddDialog(true)}>
              Add Learner
            </Button>
          )}
        </Box>

        {/* Controls */}
        <Grid container spacing={2} mb={3}>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label="Search Learners"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && handleSearch()}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select value={statusFilter} label="Status" onChange={e => setStatusFilter(e.target.value)}>
                <MenuItem value="all">All Status</MenuItem>
                <MenuItem value="Enabled">Enabled</MenuItem>
                <MenuItem value="Disabled">Disabled</MenuItem>
                <MenuItem value="Dropout">Dropout</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <Button fullWidth variant="contained" onClick={handleSearch} startIcon={<SearchIcon />}>
              Search
            </Button>
          </Grid>
          <Grid item xs={12} md={2}>
            <Button fullWidth variant="outlined" onClick={() => {
              setSearchText(""); setBatchLearners(filteredLearners);
            }} startIcon={<RestartAltIcon />}>
              Reset
            </Button>
          </Grid>
          <Grid item xs={12} md={3}>
            <Button fullWidth variant="contained" onClick={loadLearnersData} 
              disabled={loading} startIcon={<MenuBookIcon />}>
              {loading ? "Loading..." : "Reload Data"}
            </Button>
          </Grid>
        </Grid>

        {message && (
          <Alert severity={message.includes("✅") ? "success" : "error"} sx={{ mb: 2 }}>
            {message}
          </Alert>
        )}

        <Alert severity="info" sx={{ mb: 2 }}>
          Total: <strong>{allLearners.length}</strong> | 
          Filtered: <strong>{filteredLearners.length}</strong> | 
          Showing: <strong>{batchLearners.length}</strong>
        </Alert>

        {/* Table */}
        {batchLearners.length ? (
          <TableContainer component={Paper} sx={{ maxHeight: 600 }}>
            <Table stickyHeader>
              <TableHead sx={{ bgcolor: 'primary.main' }}>
                <TableRow>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>#</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Name</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Email</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Phone</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Batch</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {batchLearners.map((learner, i) => (
                  <TableRow key={`${learner.email}-${learner.batch_no}`} hover>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell sx={{ fontWeight: 500 }}>{learner.name}</TableCell>
                    <TableCell>{learner.email}</TableCell>
                    <TableCell>{learner.phone || '-'}</TableCell>
                    <TableCell><strong>{learner.batch_no}</strong></TableCell>
                    <TableCell>
                      <Chip label={learner.status} 
                        color={learner.status === "Enabled" ? "success" : "warning"}
                        size="small" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Paper sx={{ p: 6, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary">
              No learners data available
            </Typography>
            <Button onClick={loadLearnersData} variant="contained" sx={{ mt: 2 }}>
              Reload Data
            </Button>
          </Paper>
        )}

        {/* Add Dialog */}
        <Dialog open={openAddDialog} onClose={() => setOpenAddDialog(false)} maxWidth="sm">
          <DialogTitle>Add New Learner</DialogTitle>
          <DialogContent>
            <TextField fullWidth label="Name *" value={newLearner.name}
              onChange={e => setNewLearner({...newLearner, name: e.target.value})}
              sx={{ mb: 2 }} />
            <TextField fullWidth label="Email *" type="email" value={newLearner.email}
              onChange={e => setNewLearner({...newLearner, email: e.target.value})}
              sx={{ mb: 2 }} />
            <Autocomplete freeSolo options={distinctBatches} value={newLearner.batch_no}
              onChange={(e, v) => setNewLearner({...newLearner, batch_no: v || ""})}
              renderInput={params => <TextField {...params} label="Batch No *" sx={{ mb: 2 }} />} />
            <TextField fullWidth label="Phone" value={newLearner.phone}
              onChange={e => setNewLearner({...newLearner, phone: e.target.value})} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenAddDialog(false)}>Cancel</Button>
            <Button onClick={handleAddLearner} variant="contained">Add</Button>
          </DialogActions>
        </Dialog>
      </Paper>
    </Box>
  );
}
