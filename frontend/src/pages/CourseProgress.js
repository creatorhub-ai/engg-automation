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
} from "@mui/material";
import { PieChart, Pie, Cell, Legend, Tooltip } from "recharts";
import RestartAltIcon from "@mui/icons-material/RestartAlt";

const COLORS = ["#ffbb28", "#0088fe", "#00c49f"];
const API_BASE = process.env.API_BASE || "http://localhost:5000";

export default function CourseProgress() {
  const [domains, setDomains] = useState([]);
  const [allBatches, setAllBatches] = useState([]); // Store all batches
  const [batches, setBatches] = useState([]);
  const [selectedDomain, setSelectedDomain] = useState("");
  const [selectedBatch, setSelectedBatch] = useState("");
  const [loading, setLoading] = useState(false);
  const [progressData, setProgressData] = useState(null);
  const [error, setError] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [filteredTopics, setFilteredTopics] = useState([]);
  const [currentBatchNo, setCurrentBatchNo] = useState("");

  // Initial load: fetch domains and all batches
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const domainsPromise = axios.get(`${API_BASE}/api/domains`);
        const batchesPromise = axios.get(`${API_BASE}/api/batches`);
        const [domainsRes, batchesRes] = await Promise.all([
          domainsPromise,
          batchesPromise,
        ]);
        setDomains(domainsRes.data);
        setAllBatches(batchesRes.data); // Store all batches
        setBatches(batchesRes.data); // Initialize batches dropdown
      } catch {
        setError("Failed to load domain or batch information.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // When domain is selected
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
        setError("Failed to load batches or domain progress.");
        setBatches([]);
        setProgressData(null);
      } finally {
        setLoading(false);
      }
    }
    fetchDomainBatchesAndProgress();
  }, [selectedDomain]);

  // When batch is selected
  useEffect(() => {
    if (!selectedBatch) {
      return;
    }
    async function fetchBatchProgress() {
      setLoading(true);
      try {
        const res = await axios.get(`${API_BASE}/api/course-progress`, {
          params: { batch_no: selectedBatch },
        });
        setProgressData(res.data);
      } catch {
        setError("Failed to load progress for this batch.");
        setProgressData(null);
      } finally {
        setLoading(false);
      }
    }
    fetchBatchProgress();
  }, [selectedBatch]);

  // Pie click event: filter topics and set state for which batch/pie was clicked
  const handlePieClick = (data, index, batchNo, topicsArr) => {
    const status = data.name;
    setSelectedStatus(status);
    setCurrentBatchNo(batchNo);
    const topicsArray = (topicsArr || []).filter(
      (t) => t.topic_status === status
    );
    setFilteredTopics(topicsArray);
  };

  const handleDomainChange = (e) => {
    const domain = e.target.value;
    setSelectedDomain(domain);
    setSelectedBatch("");
    setProgressData(null);
    setError("");
    setSelectedStatus("");
    setFilteredTopics([]);
    setCurrentBatchNo("");

    // If domain is cleared, restore all batches
    if (!domain) {
      setBatches(allBatches);
    }
  };

  const handleBatchChange = (e) => {
    const batch = e.target.value;
    setSelectedBatch(batch);
    setSelectedDomain("");
    setProgressData(null);
    setError("");
    setSelectedStatus("");
    setFilteredTopics([]);
    setCurrentBatchNo("");

    // When batch is selected, keep all batches in dropdown
    setBatches(allBatches);
  };

  // Reset function
  const handleReset = () => {
    setSelectedDomain("");
    setSelectedBatch("");
    setProgressData(null);
    setError("");
    setSelectedStatus("");
    setFilteredTopics([]);
    setCurrentBatchNo("");
    setBatches(allBatches); // Restore all batches
  };

  const isMultiBatchProgress = progressData && progressData.batches;

  // Table rendering component
  function TopicTable({ batchNo, topics, selectedStatus }) {
    return (
      <TableContainer component={Paper} sx={{ minWidth: 300, mx: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>
                <strong>Batch No</strong>
              </TableCell>
              <TableCell>
                <strong>Topic Name</strong>
              </TableCell>
              <TableCell>
                <strong>Date</strong>
              </TableCell>
              <TableCell>
                <strong>Status</strong>
              </TableCell>
              <TableCell>
                <strong>Remarks</strong>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {topics.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  No topics found for {selectedStatus}.
                </TableCell>
              </TableRow>
            )}
            {topics.map((topic, idx) => (
              <TableRow key={idx}>
                <TableCell>{batchNo}</TableCell>
                <TableCell>{topic.topic_name}</TableCell>
                <TableCell>{topic.date}</TableCell>
                <TableCell>{topic.topic_status}</TableCell>
                <TableCell>{topic.remarks || "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  }

  // Render
  return (
    <Box p={3}>
      <Paper elevation={3} sx={{ p: 3, maxWidth: 900, mx: "auto" }}>
        <Typography variant="h5" gutterBottom>
          Course Progress Dashboard
        </Typography>

        {/* Domain selector */}
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Domain</InputLabel>
          <Select
            value={selectedDomain}
            label="Domain"
            onChange={handleDomainChange}
            disabled={Boolean(selectedBatch) || loading}
          >
            <MenuItem value="">
              <em>Select Domain</em>
            </MenuItem>
            {domains.map((d) => (
              <MenuItem key={d} value={d}>
                {d}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Batch selector */}
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Batch No</InputLabel>
          <Select
            value={selectedBatch}
            label="Batch No"
            onChange={handleBatchChange}
            disabled={Boolean(selectedDomain) || loading}
          >
            <MenuItem value="">
              <em>Select Batch</em>
            </MenuItem>
            {batches.map((b) => (
              <MenuItem key={b.batch_no} value={b.batch_no}>
                {b.batch_no} {b.start_date ? `(${b.start_date})` : ""}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Reset Button */}
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
          <Box display="flex" justifyContent="center" mt={2}>
            <CircularProgress />
          </Box>
        )}

        {/* Multiple batches (domain) progress */}
        {isMultiBatchProgress && !loading && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Progress for Domain: <strong>{progressData.domain}</strong>
            </Typography>
            {progressData.batches.length === 0 ? (
              <Typography>No batches found for this domain.</Typography>
            ) : (
              progressData.batches.map((batch) => {
                const pieData = [
                  {
                    name: "Planned",
                    value: batch.topic_status_counts?.Planned || 0,
                  },
                  {
                    name: "In Progress",
                    value: batch.topic_status_counts?.["In Progress"] || 0,
                  },
                  {
                    name: "Completed",
                    value: batch.topic_status_counts?.Completed || 0,
                  },
                ];
                const totalCount = pieData.reduce((a, b) => a + b.value, 0);
                return (
                  <Box
                    key={batch.batch_no}
                    mb={4}
                    p={2}
                    sx={{
                      border: "1px solid #ccc",
                      borderRadius: 1,
                      display: "flex",
                      alignItems: "flex-start",
                    }}
                  >
                    {/* Pie Chart on left */}
                    <Box>
                      <Typography>
                        <strong>Batch No:</strong> {batch.batch_no}
                      </Typography>
                      <Typography>
                        <strong>Trainer(s):</strong>{" "}
                        {batch.trainer_names.join(", ")}
                      </Typography>
                      <Typography>
                        <strong>Total Learners:</strong> {batch.total_learners}
                      </Typography>
                      <Typography>
                        <strong>Start Date:</strong> {batch.start_date}
                      </Typography>
                      <Typography>
                        <strong>End Date:</strong> {batch.end_date}
                      </Typography>
                      <Box mt={2}>
                        <PieChart width={400} height={220}>
                          <Pie
                            data={pieData}
                            dataKey="value"
                            nameKey="name"
                            cx={150}
                            cy={110}
                            outerRadius={80}
                            label={(entry) =>
                              `${entry.name}: ${
                                totalCount > 0
                                  ? Math.round((entry.value / totalCount) * 100)
                                  : 0
                              }%`
                            }
                            onClick={(data, index) =>
                              handlePieClick(
                                data,
                                index,
                                batch.batch_no,
                                batch.topics
                              )
                            }
                          >
                            {pieData.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={COLORS[index % COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </Box>
                    </Box>
                    {/* Table on right, per batch and clicked status */}
                    {selectedStatus && currentBatchNo === batch.batch_no && (
                      <TopicTable
                        batchNo={batch.batch_no}
                        topics={filteredTopics}
                        selectedStatus={selectedStatus}
                      />
                    )}
                  </Box>
                );
              })
            )}
          </Box>
        )}

        {/* Single batch progress */}
        {progressData && !isMultiBatchProgress && !loading && (
          <Box display="flex" alignItems="flex-start">
            {/* Pie Chart */}
            <Box>
              <Typography>
                <strong>Batch No:</strong> {progressData.batch_no}
              </Typography>
              <Typography>
                <strong>Trainer(s):</strong>{" "}
                {progressData.trainer_names.join(", ")}
              </Typography>
              <Typography>
                <strong>Total Learners:</strong> {progressData.total_learners}
              </Typography>
              <Typography>
                <strong>Start Date:</strong> {progressData.start_date}
              </Typography>
              <Typography>
                <strong>End Date:</strong> {progressData.end_date}
              </Typography>
              <Box mt={3}>
                <PieChart width={400} height={220}>
                  <Pie
                    data={[
                      {
                        name: "Planned",
                        value:
                          progressData.topic_status_counts?.Planned || 0,
                      },
                      {
                        name: "In Progress",
                        value:
                          progressData.topic_status_counts?.["In Progress"] ||
                          0,
                      },
                      {
                        name: "Completed",
                        value:
                          progressData.topic_status_counts?.Completed || 0,
                      },
                    ]}
                    dataKey="value"
                    nameKey="name"
                    cx={170}
                    cy={110}
                    outerRadius={80}
                    label={(entry) =>
                      `${entry.name}: ${Math.round(
                        (entry.value /
                          (Object.values(
                            progressData.topic_status_counts || {}
                          ).reduce((a, b) => a + b, 0) || 1)) *
                          100
                      )}%`
                    }
                    onClick={(data, index) =>
                      handlePieClick(
                        data,
                        index,
                        progressData.batch_no,
                        progressData.topics
                      )
                    }
                  >
                    {[0, 1, 2].map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </Box>
            </Box>
            {/* Table right of pie for single batch */}
            {selectedStatus && currentBatchNo === progressData.batch_no && (
              <TopicTable
                batchNo={progressData.batch_no}
                topics={filteredTopics}
                selectedStatus={selectedStatus}
              />
            )}
          </Box>
        )}

        {error && (
          <Typography mt={2} color="error">
            {error}
          </Typography>
        )}
      </Paper>
    </Box>
  );
}
