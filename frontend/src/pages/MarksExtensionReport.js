/* eslint-disable react-hooks/exhaustive-deps */
// src/components/MarksExtensionReport.js
import React, { useEffect, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Chip,
  Alert,
  CircularProgress,
} from "@mui/material";
import axios from "axios";

const API_BASE =
  process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

const ASSESSMENT_LABELS = {
  "weekly-assessment": "Weekly Assessment",
  "intermediate-assessment": "Intermediate Assessment",
  "module-level-assessment": "Module Level Assessment",
  "weekly-quiz": "Weekly Quiz",
};

export default function MarksExtensionReport({ user, token }) {
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadBatches() {
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await axios.get(`${API_BASE}/api/batches`, { headers });
        if (Array.isArray(res.data)) setBatches(res.data);
      } catch (err) {
        console.error("Error loading batches:", err);
      }
    }
    loadBatches();
  }, [token]);

  useEffect(() => {
    if (selectedBatch) {
      loadRequests();
    } else {
      setRows([]);
    }
  }, [selectedBatch, statusFilter]);

  async function loadRequests() {
    setLoading(true);
    setError("");
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(
        `${API_BASE}/api/marks/extension-requests`,
        {
          params: {
            batch_no: selectedBatch,
            status: statusFilter === "all" ? undefined : statusFilter,
          },
          headers,
        }
      );
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error loading extension requests:", err);
      setError("Error loading extension request data");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Paper elevation={3} sx={{ p: 3, borderRadius: 3 }}>
      <Typography variant="h5" color="primary" gutterBottom>
        Marks Extension Requests Report
      </Typography>

      <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
        <FormControl sx={{ minWidth: 220 }}>
          <InputLabel>Batch No</InputLabel>
          <Select
            value={selectedBatch}
            label="Batch No"
            onChange={(e) => setSelectedBatch(e.target.value)}
          >
            <MenuItem value="">
              <em></em>
            </MenuItem>
            {batches.map((b) => (
              <MenuItem key={b.batch_no} value={b.batch_no}>
                {b.batch_no} {b.start_date ? `(${b.start_date})` : ""}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl sx={{ minWidth: 180 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={statusFilter}
            label="Status"
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="approved">Approved</MenuItem>
            <MenuItem value="rejected">Rejected</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading && (
        <Box display="flex" justifyContent="center" my={3}>
          <CircularProgress />
        </Box>
      )}

      {!loading && selectedBatch && (
        <TableContainer component={Paper} elevation={1}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: "#f5f5f5" }}>
                <TableCell>
                  <strong>Batch</strong>
                </TableCell>
                <TableCell>
                  <strong>Assessment</strong>
                </TableCell>
                <TableCell>
                  <strong>Week No</strong>
                </TableCell>
                <TableCell>
                  <strong>Trainer</strong>
                </TableCell>
                <TableCell>
                  <strong>Reason</strong>
                </TableCell>
                <TableCell align="center">
                  <strong>Status</strong>
                </TableCell>
                <TableCell align="center">
                  <strong>Requested At</strong>
                </TableCell>
                <TableCell align="center">
                  <strong>Decided At</strong>
                </TableCell>
                <TableCell>
                  <strong>Decided By</strong>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 3 }}>
                    <Typography variant="body2" color="text.secondary">
                      No extension requests for this batch and filter.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.batch_no}</TableCell>
                  <TableCell>
                    {ASSESSMENT_LABELS[r.assessment_type] || r.assessment_type}
                  </TableCell>
                  <TableCell>{r.week_no ?? "-"}</TableCell>
                  <TableCell>{r.trainer_email}</TableCell>
                  <TableCell>{r.reason || "-"}</TableCell>
                  <TableCell align="center">
                    <Chip
                      label={r.status}
                      size="small"
                      color={
                        r.status === "approved"
                          ? "success"
                          : r.status === "pending"
                          ? "warning"
                          : "error"
                      }
                    />
                  </TableCell>
                  <TableCell align="center">
                    {r.created_at
                      ? new Date(r.created_at).toLocaleString("en-IN", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })
                      : "-"}
                  </TableCell>
                  <TableCell align="center">
                    {r.decided_at
                      ? new Date(r.decided_at).toLocaleString("en-IN", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })
                      : "-"}
                  </TableCell>
                  <TableCell>{r.decided_by || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {!selectedBatch && !loading && (
        <Box textAlign="center" py={4}>
          <Typography variant="body1" color="text.secondary">
            Select a batch to view extension request history.
          </Typography>
        </Box>
      )}
    </Paper>
  );
}
