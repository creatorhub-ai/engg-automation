import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  Box,
  Paper,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Table,
  TableHead,
  TableBody,
  TableCell,
  TableRow,
  TableContainer,
  Button,
  Tooltip
} from "@mui/material";
import { PieChart, Pie, Cell, Legend, Tooltip as ReTooltip } from "recharts";
import RestartAltIcon from "@mui/icons-material/RestartAlt";

const COLORS = ["#ffbb28", "#0088fe", "#00c49f"];
const API_BASE = process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

export default function CourseProgress() {

  const [domains, setDomains] = useState([]);
  const [allBatches, setAllBatches] = useState([]);
  const [batches, setBatches] = useState([]);
  const [selectedDomain, setSelectedDomain] = useState("");
  const [selectedBatch, setSelectedBatch] = useState("");
  const [loading, setLoading] = useState(false);
  const [progressData, setProgressData] = useState(null);
  const [error, setError] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [filteredTopics, setFilteredTopics] = useState([]);
  const [currentBatchNo, setCurrentBatchNo] = useState("");

  // ✅ NEW: Trainer details storage
  const [trainerDetails, setTrainerDetails] = useState({});

  // ================= INITIAL LOAD =================
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);

        const [domainsRes, batchesRes, trainersRes] = await Promise.all([
          axios.get(`${API_BASE}/api/domains`),
          axios.get(`${API_BASE}/api/batches`),
          axios.get(`${API_BASE}/api/internal-users`) // ✅ NEW
        ]);

        setDomains(domainsRes.data);
        setAllBatches(batchesRes.data);
        setBatches(batchesRes.data);

        // ✅ Map trainer details by name
        const trainerMap = {};
        (trainersRes.data || []).forEach(t => {
          trainerMap[t.name] = {
            email: t.email,
            phone: t.phone || "-" // phone optional
          };
        });

        setTrainerDetails(trainerMap);

      } catch {
        setError("Failed to load initial data.");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // ================= DOMAIN SELECT =================
  useEffect(() => {
    if (!selectedDomain) return;

    async function fetchDomainBatchesAndProgress() {
      setLoading(true);
      try {
        const batchRes = await axios.get(`${API_BASE}/api/batches`, {
          params: { domain: selectedDomain },
        });

        setBatches(batchRes.data);

        const progressRes = await axios.get(`${API_BASE}/api/course-progress`, {
          params: { domain: selectedDomain },
        });

        setProgressData(progressRes.data);
        setSelectedBatch("");

      } catch {
        setError("Failed to load domain data.");
        setBatches([]);
        setProgressData(null);
      } finally {
        setLoading(false);
      }
    }

    fetchDomainBatchesAndProgress();
  }, [selectedDomain]);

  // ================= BATCH SELECT =================
  useEffect(() => {
    if (!selectedBatch) return;

    async function fetchBatchProgress() {
      setLoading(true);
      try {
        const res = await axios.get(`${API_BASE}/api/course-progress`, {
          params: { batch_no: selectedBatch },
        });

        setProgressData(res.data);

      } catch {
        setError("Failed to load batch progress.");
        setProgressData(null);
      } finally {
        setLoading(false);
      }
    }

    fetchBatchProgress();
  }, [selectedBatch]);

  // ================= PIE CLICK =================
  const handlePieClick = (data, index, batchNo, topicsArr) => {
    const status = data.name;
    setSelectedStatus(status);
    setCurrentBatchNo(batchNo);
    const topicsArray = (topicsArr || []).filter(
      (t) => t.topic_status === status
    );
    setFilteredTopics(topicsArray);
  };

  const handleReset = () => {
    setSelectedDomain("");
    setSelectedBatch("");
    setProgressData(null);
    setError("");
    setSelectedStatus("");
    setFilteredTopics([]);
    setCurrentBatchNo("");
    setBatches(allBatches);
  };

  const isMultiBatchProgress = progressData && progressData.batches;

  // ================= TRAINER RENDER FUNCTION =================
  const renderTrainerNames = (trainerNames) => {
    return trainerNames.map((name, index) => {
      const details = trainerDetails[name];

      return (
        <span key={index}>
          <Tooltip
            arrow
            placement="right"
            componentsProps={{
              tooltip: {
                sx: {
                  backgroundColor: "#1e1e1e",   // Dark background
                  color: "#ffffff",             // White text
                  fontSize: "0.85rem",
                  padding: "12px",
                  borderRadius: "10px",
                  boxShadow: "0px 4px 12px rgba(0,0,0,0.3)"
                }
              },
              arrow: {
                sx: {
                  color: "#1e1e1e"
                }
              }
            }}
            title={
              details ? (
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Email:
                  </Typography>

                  <Typography
                    variant="body2"
                    sx={{
                      color: "#4fc3f7", // Light blue for visibility
                      cursor: "pointer",
                      textDecoration: "underline",
                      "&:hover": { color: "#81d4fa" }
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      window.location.href = `mailto:${details.email}`;
                    }}
                  >
                    {details.email}
                  </Typography>

                  <Typography
                    variant="body2"
                    sx={{ mt: 1, fontWeight: 600 }}
                  >
                    Phone:
                  </Typography>

                  <Typography variant="body2">
                    {details.phone}
                  </Typography>
                </Box>
              ) : "No details found"
            }
          >
            <span
              style={{
                textDecoration: "underline",
                cursor: "pointer",
                fontWeight: 500
              }}
            >
              {name}
            </span>
          </Tooltip>

          {index !== trainerNames.length - 1 && ", "}
        </span>
      );
    });
  };

  // ================= UI =================
  return (
    <Box p={3}>
      <Paper elevation={3} sx={{ p: 3, maxWidth: 900, mx: "auto" }}>
        <Typography variant="h5" gutterBottom>
          Course Progress Dashboard
        </Typography>

        {/* Domain Selector */}
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Domain</InputLabel>
          <Select
            value={selectedDomain}
            label="Domain"
            onChange={(e) => setSelectedDomain(e.target.value)}
            disabled={Boolean(selectedBatch) || loading}
          >
            <MenuItem value="">
              <em>Select Domain</em>
            </MenuItem>
            {domains.map((d) => (
              <MenuItem key={d} value={d}>{d}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Batch Selector */}
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Batch No</InputLabel>
          <Select
            value={selectedBatch}
            label="Batch No"
            onChange={(e) => setSelectedBatch(e.target.value)}
            disabled={Boolean(selectedDomain) || loading}
          >
            <MenuItem value="">
              <em>Select Batch</em>
            </MenuItem>
            {batches.map((b) => (
              <MenuItem key={b.batch_no} value={b.batch_no}>
                {b.batch_no}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Button
          variant="outlined"
          startIcon={<RestartAltIcon />}
          onClick={handleReset}
          sx={{ mb: 3 }}
          disabled={!selectedDomain && !selectedBatch}
        >
          Reset
        </Button>

        {loading && (
          <Box display="flex" justifyContent="center">
            <CircularProgress />
          </Box>
        )}

        {/* MULTI BATCH VIEW */}
        {isMultiBatchProgress && progressData.batches.map((batch) => (
          <Box key={batch.batch_no} mb={4} p={2} sx={{ border: "1px solid #ccc", borderRadius: 1 }}>
            <Typography><strong>Batch No:</strong> {batch.batch_no}</Typography>

            <Typography>
              <strong>Trainer(s):</strong> {renderTrainerNames(batch.trainer_names)}
            </Typography>

            <Typography><strong>Total Learners:</strong> {batch.total_learners}</Typography>
            <Typography><strong>Start Date:</strong> {batch.start_date}</Typography>
            <Typography><strong>End Date:</strong> {batch.end_date}</Typography>
          </Box>
        ))}

        {/* SINGLE BATCH VIEW */}
        {progressData && !isMultiBatchProgress && (
          <Box>
            <Typography><strong>Batch No:</strong> {progressData.batch_no}</Typography>

            <Typography>
              <strong>Trainer(s):</strong> {renderTrainerNames(progressData.trainer_names)}
            </Typography>

            <Typography><strong>Total Learners:</strong> {progressData.total_learners}</Typography>
            <Typography><strong>Start Date:</strong> {progressData.start_date}</Typography>
            <Typography><strong>End Date:</strong> {progressData.end_date}</Typography>
          </Box>
        )}

        {error && <Typography color="error">{error}</Typography>}
      </Paper>
    </Box>
  );
}
