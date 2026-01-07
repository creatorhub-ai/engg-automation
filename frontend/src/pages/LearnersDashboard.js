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
  const batchno = raw?.batchno ?? raw?.batch_no ?? raw?.batchNo ?? "";
  return {
    ...raw,
    batchno: String(batchno).trim(),
    batch_no: String(batchno).trim(),
    email: (raw?.email || "").trim().toLowerCase(),
    name: (raw?.name || "").trim(),
    phone: raw?.phone || "",
    status: raw?.status || "Enabled",
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
      case "enabled": return "success";
      case "disabled": return "warning";
      case "dropout": return "default";
      default: return "default";
    }
  };

  const filteredLearners = useMemo(() => {
    if (statusFilter === "all") return allLearners;
    return allLearners.filter((l) => 
      (l.status || "Enabled").toLowerCase() === statusFilter.toLowerCase()
    );
  }, [allLearners, statusFilter]);

  useEffect(() => {
    loadLearnersData();
  }, []);

  async function loadLearnersData() {
    setLoading(true);
    setMessage("");

    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(`${API_BASE}/api/learners`, { headers });

      const rawLearners = Array.isArray(res.data) ? res.data : [];
      const normalized = rawLearners.map(normalizeLearner);

      // De-dupe by email + batchno
      const unique = normalized.filter((learner, index, self) =>
        index === self.findIndex((l) => 
          l.email === learner.email && l.batchno === learner.batchno
        )
      );

      setAllLearners(unique);

      const batches = [
        ...new Set(unique.map(l => l.batchno).filter(b => b))
      ].sort();

      setDistinctBatches(batches);

      setMessage(`✅ Loaded ${unique.length} unique learners from ${batches.length} batches`);
    } catch (err) {
      console.error("Load learners error:", err);
      setAllLearners([]);
      setDistinctBatches([]);
      setMessage("⚠️ No learners data available");
    } finally {
      setLoading(false);
    }
  }

  function handleSearch() {
    const value = (searchText || "").trim();
    if (!value) {
      setBatchLearners(filteredLearners);
      setMessage(
        `✅ Showing ${filteredLearners.length} learner${filteredLearners.length === 1 ? "" : "s"}`
      );
      return;
    }

    let results = [];
    if (searchType === "email") {
      results = filteredLearners.filter(l => 
        l.email.toLowerCase().includes(value.toLowerCase())
      );
    } else if (searchType === "name") {
      results = filteredLearners.filter(l => 
        l.name.toLowerCase().includes(value.toLowerCase())
      );
    } else if (searchType === "batch") {
      results = filteredLearners.filter(l => l.batchno === value);
    }

    setBatchLearners(results);
    setMessage(
      `✅ Found ${results.length} of ${filteredLearners.length} filtered learners`
    );
  }

  async function handleAddLearner() {
    if (!newLearner.name?.trim() || !newLearner.email?.trim() || !newLearner.batch_no?.trim()) {
      setMessage("❌ Please fill all fields");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const payload = {
        name: newLearner.name.trim(),
        email: newLearner.email.trim().toLowerCase(),
        phone: newLearner.phone?.trim() || "",
        batchno: newLearner.batch_no.trim(),
      };

      const res = await axios.post(`${API_BASE}/api/learners/add`, payload, { headers });

      if (res.data?.success) {
        const added = normalizeLearner(res.data.data);
        setAllLearners(prev => [added, ...prev]);
        
        if (!distinctBatches.includes(added.batchno)) {
          setDistinctBatches(prev => [...prev, added.batchno].sort());
        }

        setMessage("✅ New learner added successfully");
        setOpenAddDialog(false);
        setNewLearner({ name: "", email: "", phone: "", batch_no: "" });
      } else {
        setMessage(`❌ ${res.data?.error || "Failed to add learner"}`);
      }
    } catch (err) {
      console.error(err);
      setMessage("❌ Network error adding learner");
    } finally {
      setLoading(false);
    }
  }

  function handleStatusChange(learner) {
    const normalized = normalizeLearner(learner);
    setSelectedLearner(normalized);
    setNewStatus(normalized.status);
    setStatusDialogOpen(true);
  }

  async function handleStatusChangeConfirm() {
    if (!selectedLearner || !newStatus) return;

    setStatusUpdating(true);
    setMessage("");

    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const payload = {
        learneremail: selectedLearner.email,
        batchno: selectedLearner.batchno,
        status: newStatus,
      };

      const res = await axios.put(`${API_BASE}/api/learners/status`, payload, { headers });

      if (res.data?.success) {
        const match = (l) => l.email === selectedLearner.email && l.batchno === selectedLearner.batchno;
        
        setAllLearners(prev => prev.map(l => match(l) ? { ...l, status: newStatus } : l));
        setBatchLearners(prev => prev.map(l => match(l) ? { ...l, status: newStatus } : l));

        setMessage(`✅ Status changed to "${newStatus}"`);
        setStatusDialogOpen(false);
      } else {
        setMessage(`❌ ${res.data?.error || "Status update failed"}`);
      }
    } catch (err) {
      console.error(err);
      setMessage("❌ Network error updating status");
    } finally {
      setStatusUpdating(false);
    }
  }

  function handleReset() {
    setSearchText("");
    setBatchLearners([]);
    setMessage("");
  }

  const searchOptions = 
    searchType === "email" ? filteredLearners.map(l => l.email) :
    searchType === "name" ? filteredLearners.map(l => l.name) :
    distinctBatches;

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", my: 3, px: 2 }}>
      <Paper elevation={4} sx={{ p: 3, borderRadius: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box display="flex" alignItems="center" gap={2}>
            <MenuBookIcon sx={{ fontSize: 40, color: "#e8744f" }} />
            <Typography variant="h4" fontWeight="bold">
              Learners Dashboard
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<PersonAddIcon />}
            onClick={() => setOpenAddDialog(true)}
            sx={{ 
              background: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
              color: "#333", 
              fontWeight: "bold" 
            }}
          >
            Add Learner
          </Button>
        </Box>

        {/* Controls */}
        <Grid container spacing={2} mb={3}>
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
              }}
            >
              <MenuItem value="email">Email</MenuItem>
              <MenuItem value="name">Name</MenuItem>
              <MenuItem value="batch">Batch No</MenuItem>
            </TextField>
          </Grid>

          <Grid item xs={12} sm={3}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setBatchLearners([]);
                }}
              >
                <MenuItem value="all">All Status</MenuItem>
                <MenuItem value="Enabled">Enabled</MenuItem>
                <MenuItem value="Disabled">Disabled</MenuItem>
                <MenuItem value="Dropout">Dropout</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={4}>
            <Autocomplete
              freeSolo
              options={searchOptions}
              value={searchText}
              onChange={(e, val) => setSearchText(val || "")}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={searchType === "email" ? "Email" : 
                         searchType === "name" ? "Name" : "Batch No"}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              )}
            />
          </Grid>

          <Grid item xs={12} sm={1}>
            <Button
              variant="contained"
              fullWidth
              onClick={handleSearch}
              disabled={loading}
              sx={{ height: 56 }}
            >
              {loading ? <CircularProgress size={20} /> : <SearchIcon />}
            </Button>
          </Grid>

          <Grid item xs={12} sm={1}>
            <Button
              variant="outlined"
              fullWidth
              onClick={handleReset}
              sx={{ height: 56 }}
            >
              <RestartAltIcon />
            </Button>
          </Grid>
        </Grid>

        <Typography variant="caption" color="gray">
          Total: {allLearners.length} | Filtered: {filteredLearners.length} | Results: {batchLearners.length}
        </Typography>

        {message && (
          <Alert severity="info" sx={{ mt: 1, mb: 2 }}>
            {message}
          </Alert>
        )}

        {batchLearners.length > 0 ? (
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell>Batch</TableCell>
                  <TableCell>Status</TableCell>
                  {isManagerOrAdmin && <TableCell>Action</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {batchLearners.map((learner, idx) => {
                  const l = normalizeLearner(learner);
                  const isDropout = l.status.toLowerCase() === "dropout";

                  return (
                    <TableRow key={`${l.email}-${l.batchno}`} hover={!isDropout}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>{l.name}</TableCell>
                      <TableCell>{l.email}</TableCell>
                      <TableCell>{l.phone || "-"}</TableCell>
                      <TableCell>{l.batchno}</TableCell>
                      <TableCell>
                        <Chip
                          label={l.status}
                          color={getStatusColor(l.status)}
                          size="small"
                        />
                      </TableCell>
                      {isManagerOrAdmin && (
                        <TableCell>
                          <IconButton
                            size="small"
                            onClick={() => handleStatusChange(l)}
                            disabled={statusUpdating || isDropout}
                          >
                            <EditIcon fontSize="small" />
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
          <Paper sx={{ p: 3, textAlign: "center", mt: 2 }}>
            <Typography>No learners found. Try searching or add new learner.</Typography>
            <Button onClick={loadLearnersData} sx={{ mt: 2 }}>
              Reload Data
            </Button>
          </Paper>
        )}

        {/* Add Dialog */}
        <Dialog open={openAddDialog} onClose={() => setOpenAddDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Add New Learner</DialogTitle>
          <DialogContent>
            <TextField fullWidth label="Name" value={newLearner.name} 
              onChange={(e) => setNewLearner({...newLearner, name: e.target.value})}
              sx={{ mt: 2 }} />
            <TextField fullWidth label="Email" type="email" value={newLearner.email}
              onChange={(e) => setNewLearner({...newLearner, email: e.target.value})}
              sx={{ mt: 2 }} />
            <Autocomplete
              freeSolo options={distinctBatches}
              value={newLearner.batch_no}
              onChange={(e, val) => setNewLearner({...newLearner, batch_no: val || ""})}
              renderInput={(params) => 
                <TextField {...params} label="Batch No" sx={{ mt: 2 }} />}
            />
            <TextField fullWidth label="Phone" value={newLearner.phone}
              onChange={(e) => setNewLearner({...newLearner, phone: e.target.value})}
              sx={{ mt: 2 }} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenAddDialog(false)}>Cancel</Button>
            <Button onClick={handleAddLearner} variant="contained" disabled={loading}>
              Add Learner
            </Button>
          </DialogActions>
        </Dialog>

        {/* Status Dialog */}
        <Dialog open={statusDialogOpen} onClose={() => setStatusDialogOpen(false)} maxWidth="xs">
          <DialogTitle>Update Status</DialogTitle>
          <DialogContent>
            <Typography>Learner: {selectedLearner?.name}</Typography>
            <Typography>Batch: {selectedLearner?.batchno}</Typography>
            <TextField
              select fullWidth label="Status" value={newStatus}
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
            <Button onClick={handleStatusChangeConfirm} disabled={statusUpdating}>
              {statusUpdating ? "Updating..." : "Update"}
            </Button>
          </DialogActions>
        </Dialog>
      </Paper>
    </Box>
  );
}
