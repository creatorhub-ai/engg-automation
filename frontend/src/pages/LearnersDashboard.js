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

const API_BASE =
  process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

// Normalize learner object from any API shape
function normalizeLearner(raw) {
  const batchno = raw?.batchno ?? raw?.batch_no ?? raw?.batchNo ?? "";
  const batchNoStr = batchno != null ? String(batchno).trim() : "";
  const email = (raw?.email || "").trim();
  const name = (raw?.name || "").trim();

  return {
    ...raw,
    // keep both to avoid mismatch bugs
    batchno: batchNoStr,
    batch_no: batchNoStr,
    email,
    name,
    phone: raw?.phone || "",
    status: raw?.status || "Enabled",
  };
}

export default function LearnersDashboard({ user, token }) {
  // Search mode + value
  const [searchType, setSearchType] = useState("email"); // 'email' | 'name' | 'batch'
  const [searchText, setSearchText] = useState("");

  // ✅ NEW: Status filter
  const [statusFilter, setStatusFilter] = useState("all"); // all | Enabled | Disabled | Dropout

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

  const listBoxStyle = {
    style: { maxHeight: 320, maxWidth: 1000, overflowY: "auto" },
  };

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

  // ✅ Filtered list (after load) based on status
  const filteredLearners = useMemo(() => {
    if (statusFilter === "all") return allLearners;
    return allLearners.filter(
      (l) => (l.status || "Enabled").toLowerCase() === statusFilter.toLowerCase()
    );
  }, [allLearners, statusFilter]);

  useEffect(() => {
    async function loadLearnersData() {
      setLoading(true);
      setMessage("");
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        // Prefer /api/getlearners per batch because it already includes status in your backend [file:129]
        let learnersData = [];
        const batchesRes = await axios.get(`${API_BASE}/api/batches`, {
          headers,
        });
        const batches = Array.isArray(batchesRes.data) ? batchesRes.data : [];

        for (let i = 0; i < batches.length; i++) {
          const batchNo = batches[i].batch_no || batches[i].batchno || batches[i];
          if (!batchNo) continue;

          try {
            const res = await axios.get(
              `${API_BASE}/api/getlearners?batchno=${encodeURIComponent(batchNo)}`,
              { headers }
            );
            const rows = Array.isArray(res.data) ? res.data : [];
            learnersData = learnersData.concat(rows);
          } catch {
            // ignore a single batch failure
          }
        }

        const normalized = learnersData.map(normalizeLearner);

        // Dedupe by email + batchno
        const uniqueLearners = normalized.filter(
          (learner, index, self) =>
            index ===
            self.findIndex(
              (l) => l.email === learner.email && l.batchno === learner.batchno
            )
        );

        setAllLearners(uniqueLearners);

        const batchesList = [
          ...new Set(
            uniqueLearners
              .map((l) => l.batchno)
              .filter((b) => b && String(b).trim() !== "")
          ),
        ].sort();

        setDistinctBatches(batchesList);
      } catch (err) {
        console.error("Error loading learners data:", err);
        setAllLearners([]);
        setDistinctBatches([]);
        setBatchLearners([]);
        setMessage("Failed to load learners list");
      } finally {
        setLoading(false);
      }
    }

    loadLearnersData();
  }, [token]);

  function handleSearch() {
    const value = (searchText || "").trim();

    // If empty search text => show all filtered learners
    if (!value) {
      setBatchLearners(filteredLearners);
      setMessage(
        `✅ Showing ${filteredLearners.length} learner${
          filteredLearners.length === 1 ? "" : "s"
        }${statusFilter !== "all" ? ` (Status: ${statusFilter})` : ""}`
      );
      return;
    }

    let list = [];
    if (searchType === "email") {
      const v = value.toLowerCase();
      list = filteredLearners.filter((l) =>
        (l.email || "").toLowerCase().includes(v)
      );
    } else if (searchType === "name") {
      const v = value.toLowerCase();
      list = filteredLearners.filter((l) =>
        (l.name || "").toLowerCase().includes(v)
      );
    } else if (searchType === "batch") {
      list = filteredLearners.filter((l) => String(l.batchno).trim() === value);
    }

    setBatchLearners(list);

    if (list.length > 0) {
      if (searchType === "batch") {
        setMessage(
          `✅ Found ${list.length} learner${list.length > 1 ? "s" : ""} in batch ${value}${
            statusFilter !== "all" ? ` (Status: ${statusFilter})` : ""
          }`
        );
      } else {
        setMessage(
          `✅ Found ${list.length} learner${list.length > 1 ? "s" : ""}${
            statusFilter !== "all" ? ` (Status: ${statusFilter})` : ""
          }`
        );
      }
    } else {
      setMessage("❌ Learner not found - check value or Status Filter");
    }
  }

  async function handleAddLearner() {
    if (!newLearner.name || !newLearner.email || !newLearner.phone || !newLearner.batch_no) {
      setMessage("Please fill all fields");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      // backend uses batchno column in many places [file:129]
      const payload = {
        name: newLearner.name.trim(),
        email: newLearner.email.trim().toLowerCase(),
        phone: newLearner.phone.trim(),
        batchno: String(newLearner.batch_no).trim(),
      };

      const res = await axios.post(`${API_BASE}/api/learners/add`, payload, { headers });

      if (res.data?.success) {
        const added = normalizeLearner({ ...payload, status: "Enabled" });
        setAllLearners((prev) => [...prev, added]);

        if (!distinctBatches.includes(added.batchno)) {
          setDistinctBatches((prev) => [...prev, added.batchno].sort());
        }

        setMessage("✅ Learner added successfully");
        setOpenAddDialog(false);
        setNewLearner({ name: "", email: "", phone: "", batch_no: "" });
      } else {
        setMessage("❌ Failed to add learner: " + (res.data?.error || ""));
      }
    } catch (error) {
      console.error(error);
      setMessage("❌ Error adding learner");
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

      // ✅ MUST match backend expected keys: learneremail + batchno + status [file:129]
      const payload = {
        learneremail: selectedLearner.email,
        batchno: selectedLearner.batchno,
        status: newStatus,
      };

      const res = await axios.put(`${API_BASE}/api/learners/status`, payload, { headers });

      if (res.data?.success) {
        setMessage(
          `✅ Status changed for ${selectedLearner.name} (${selectedLearner.email}) to "${newStatus}"`
        );

        const match = (l) => l.email === selectedLearner.email && l.batchno === selectedLearner.batchno;

        // Update local state immediately
        setAllLearners((prev) =>
          prev.map((l) => (match(l) ? { ...l, status: newStatus } : l))
        );
        setBatchLearners((prev) =>
          prev.map((l) => (match(l) ? { ...l, status: newStatus } : l))
        );
      } else {
        setMessage("❌ Failed to update learner status");
      }
    } catch (err) {
      console.error(err);
      setMessage("❌ Error updating learner status (check backend logs)");
    } finally {
      setStatusUpdating(false);
    }
  }

  function handleStatusChange(learner) {
    const normalized = normalizeLearner(learner);
    setSelectedLearner(normalized);
    setNewStatus(normalized.status || "Enabled");
    setStatusDialogOpen(true);
  }

  function handleReset() {
    setSearchType("email");
    setSearchText("");
    setStatusFilter("all");
    setBatchLearners([]);
    setMessage("");
  }

  const searchOptions =
    searchType === "email"
      ? filteredLearners.map((l) => l.email || "")
      : searchType === "name"
      ? filteredLearners.map((l) => l.name || "")
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

        {/* Search Section + Status Filter */}
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
                setMessage("");
              }}
              sx={{ bgcolor: "white", borderRadius: 2 }}
            >
              <MenuItem value="email">Email</MenuItem>
              <MenuItem value="name">Name</MenuItem>
              <MenuItem value="batch">Batch No</MenuItem>
            </TextField>
          </Grid>

          {/* ✅ Status Filter */}
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth sx={{ bgcolor: "white", borderRadius: 2 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setBatchLearners([]);
                  setMessage("");
                }}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="Enabled">Enabled</MenuItem>
                <MenuItem value="Disabled">Disabled</MenuItem>
                <MenuItem value="Dropout">Dropout</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
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
                  maxWidth: 600,
                  width: 600,
                },
              }}
              sx={{
                "& .MuiAutocomplete-inputRoot": { width: 400 },
                "& .MuiInputBase-input": { minWidth: 300 },
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={searchLabel}
                  placeholder={searchPlaceholder}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  sx={{ bgcolor: "white", borderRadius: 2 }}
                />
              )}
            />
          </Grid>

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
              }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : "Search"}
            </Button>
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
              }}
            >
              Reset
            </Button>
          </Grid>
        </Grid>

        <Typography variant="caption" sx={{ mb: 2, display: "block", color: "gray" }}>
          Loaded: {allLearners.length} learners, {distinctBatches.length} batches | Filtered: {filteredLearners.length}
        </Typography>

        {message && (
          <Alert
            severity={
              message.startsWith("✅") ? "success" : message.includes("not") ? "info" : "warning"
            }
            sx={{ mb: 2, borderRadius: 2 }}
          >
            {message}
          </Alert>
        )}

        {/* Learners table */}
        {batchLearners.length > 0 && (
          <Box mt={1}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Results: {batchLearners.length} learners
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
                  {batchLearners.map((row, idx) => {
                    const l = normalizeLearner(row);
                    const isDropout = (l.status || "Enabled").toLowerCase() === "dropout";

                    return (
                      <TableRow
                        key={`${l.email}-${l.batchno}`}
                        hover={!isDropout}
                        sx={{
                          opacity: isDropout ? 0.55 : 1,
                          backgroundColor: isDropout ? "rgba(0,0,0,0.05)" : "inherit",
                          "& td": { color: isDropout ? "rgba(0,0,0,0.55)" : "inherit" },
                        }}
                      >
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell>{l.name}</TableCell>
                        <TableCell>{l.email}</TableCell>
                        <TableCell>{l.phone || "-"}</TableCell>
                        <TableCell>{l.batchno}</TableCell>
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
                            <Tooltip title={isDropout ? "Dropout learner (read-only)" : "Change Status"}>
                              <span>
                                <IconButton
                                  size="small"
                                  onClick={() => handleStatusChange(l)}
                                  disabled={statusUpdating || isDropout}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
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
                onChange={(e) => setNewLearner({ ...newLearner, name: e.target.value })}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={newLearner.email}
                onChange={(e) => setNewLearner({ ...newLearner, email: e.target.value })}
                sx={{ mb: 2 }}
              />
              <Autocomplete
                freeSolo
                options={distinctBatches}
                value={newLearner.batch_no}
                disablePortal
                ListboxProps={listBoxStyle}
                onChange={(e, value) => setNewLearner({ ...newLearner, batch_no: value || "" })}
                onInputChange={(e, value) => setNewLearner({ ...newLearner, batch_no: value || "" })}
                renderInput={(params) => (
                  <TextField {...params} fullWidth label="Batch Number" sx={{ mb: 2 }} />
                )}
              />
              <TextField
                fullWidth
                label="Phone"
                value={newLearner.phone}
                onChange={(e) => setNewLearner({ ...newLearner, phone: e.target.value })}
              />
            </Box>
          </DialogContent>

          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setOpenAddDialog(false)} sx={{ color: "#666" }}>
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
            <Button onClick={() => setStatusDialogOpen(false)} disabled={statusUpdating} sx={{ color: "#666" }}>
              Cancel
            </Button>

            <Button
              onClick={handleStatusChangeConfirm}
              variant="contained"
              disabled={statusUpdating || !newStatus}
              sx={{
                background: "linear-gradient(135deg, #4caf50 0%, #45a049 100%)",
                color: "white",
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
