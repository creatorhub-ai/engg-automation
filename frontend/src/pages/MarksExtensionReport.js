// src/components/MarksExtensionReport.js
import React, { useEffect, useState } from "react";
import {
  Box, Typography, FormControl, InputLabel, Select, MenuItem,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  CircularProgress, Alert, Button,
} from "@mui/material";
import { AssignmentLate as ExtIcon } from "@mui/icons-material";
import axios from "axios";

const API_BASE = process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

const ASSESSMENT_LABELS = {
  "weekly-assessment":        "Weekly Assessment",
  "intermediate-assessment":  "Intermediate Assessment",
  "module-level-assessment":  "Module Level Assessment",
  "weekly-quiz":              "Weekly Quiz",
};

/* ─── Design tokens (matches CourseProgress) ────────────────────────────── */
const TOKENS = {
  bg:          "#d4e0fd",
  surface:     "#ffffff",
  surfaceAlt:  "#f8f9fc",
  border:      "#e4e8f0",
  accent:      "#3d5afe",
  accentLight: "#e8ecff",
  text:        "#1a1f36",
  textSub:     "#6b7280",
  success:     { fill: "#10b981", light: "#d1fae5", text: "#065f46" },
  warning:     { fill: "#f59e0b", light: "#fef3c7", text: "#92400e" },
  error:       { fill: "#ef4444", light: "#fee2e2", text: "#991b1b" },
};

const cardSx = {
  background:   TOKENS.surface,
  border:       `1px solid ${TOKENS.border}`,
  borderRadius: "16px",
  boxShadow:    "0 2px 12px rgba(0,0,0,0.06)",
  overflow:     "hidden",
};

const labelSx = {
  fontFamily:    "'DM Sans', sans-serif",
  fontSize:      11,
  fontWeight:    700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color:         TOKENS.textSub,
};

const tableHeadSx = {
  fontFamily:    "'DM Sans', sans-serif",
  fontSize:      11,
  fontWeight:    700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color:         TOKENS.textSub,
  background:    TOKENS.surfaceAlt,
  borderBottom:  `2px solid ${TOKENS.border}`,
  py:            1.4,
  whiteSpace:    "nowrap",
};

const tableCellSx = {
  fontFamily:   "'DM Sans', sans-serif",
  fontSize:     13,
  color:        TOKENS.text,
  borderBottom: `1px solid ${TOKENS.border}`,
  py:           1.4,
};

const inputSx = {
  fontFamily: "'DM Sans', sans-serif",
  fontSize: 13,
  borderRadius: "10px",
  "& .MuiOutlinedInput-notchedOutline": { borderColor: TOKENS.border },
  "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: TOKENS.accent },
  "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: TOKENS.accent },
};

/* ─── Status badge ───────────────────────────────────────────────────────── */
function StatusBadge({ status }) {
  const map = {
    approved: { bg: TOKENS.success.light, color: TOKENS.success.text, border: TOKENS.success.fill },
    pending:  { bg: TOKENS.warning.light, color: TOKENS.warning.text, border: TOKENS.warning.fill },
    rejected: { bg: TOKENS.error.light,   color: TOKENS.error.text,   border: TOKENS.error.fill   },
  };
  const s = map[status] || { bg: TOKENS.surfaceAlt, color: TOKENS.textSub, border: TOKENS.border };
  return (
    <Box sx={{ display: "inline-flex", px: 1.2, py: 0.3, borderRadius: "20px", background: s.bg, border: `1px solid ${s.border}44` }}>
      <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 700, color: s.color, textTransform: "capitalize" }}>
        {status}
      </Typography>
    </Box>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  Main component
 * ═══════════════════════════════════════════════════════════════════════════ */
export default function MarksExtensionReport({ user, token }) {
  const [batches,         setBatches]        = useState([]);
  const [selectedBatch,   setSelectedBatch]  = useState("");
  const [statusFilter,    setStatusFilter]   = useState("all");
  const [rows,            setRows]           = useState([]);
  const [loading,         setLoading]        = useState(false);
  const [error,           setError]          = useState("");
  const [actionLoading,   setActionLoading]  = useState({}); // Track approve/reject loading per row

  /* ── Load batches ── */
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

  /* ── Load requests when batch / filter changes ── */
  useEffect(() => {
    if (selectedBatch) loadRequests();
    else setRows([]);
  }, [selectedBatch, statusFilter]);

  async function loadRequests() {
    setLoading(true);
    setError("");
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(`${API_BASE}/api/marks/extension-requests`, {
        params: {
          batchno: selectedBatch,  // Fixed: was batch_no
          status:  statusFilter === "all" ? undefined : statusFilter,
        },
        headers,
      });
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error loading extension requests:", err);
      setError("Error loading extension request data");
    } finally {
      setLoading(false);
    }
  }

  // APPROVE REQUEST - Fixed API endpoint and proper error handling
  async function approveRequest(id) {
    if (!token || !user?.email) {
      setError("Please login as manager to approve requests");
      return;
    }

    setActionLoading(prev => ({ ...prev, [id]: 'approve' }));

    try {
      await axios.post(`${API_BASE}/api/marks/extension-request/${id}/approve`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Refresh table data
      await loadRequests();
      
      // Show success message
      setError("✅ Extension approved successfully!");
      setTimeout(() => setError(""), 3000);
      
    } catch (err) {
      console.error("Approve error:", err);
      setError(`❌ Failed to approve: ${err.response?.data?.error || err.message}`);
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: false }));
    }
  }

  // REJECT REQUEST - Fixed API endpoint and proper error handling
  async function rejectRequest(id) {
    if (!token || !user?.email) {
      setError("Please login as manager to reject requests");
      return;
    }

    setActionLoading(prev => ({ ...prev, [id]: 'reject' }));

    try {
      await axios.post(`${API_BASE}/api/marks/extension-request/${id}/reject`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Refresh table data
      await loadRequests();
      
      // Show success message
      setError("✅ Request rejected successfully!");
      setTimeout(() => setError(""), 3000);
      
    } catch (err) {
      console.error("Reject error:", err);
      setError(`❌ Failed to reject: ${err.response?.data?.error || err.message}`);
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: false }));
    }
  }

  /* ════════════════════════════════════════════════════════════════════════ */
  return (
    <Box sx={{ minHeight: "100vh", background: TOKENS.bg, p: { xs: 2, md: 4 }, fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');`}</style>
      <Box sx={{ maxWidth: 1400, mx: "auto" }}>

        {/* ── Page header ── */}
        <Box sx={{ mb: 4 }}>
          <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: { xs: 24, md: 30 }, fontWeight: 800, color: TOKENS.text, letterSpacing: "-0.03em", mb: 0.5 }}>
            Marks Extension Requests
          </Typography>
          <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: TOKENS.textSub }}>
            View and track extension requests by batch
          </Typography>
        </Box>

        {/* ── Filters ── */}
        <Box sx={{ ...cardSx, p: 3, mb: 3 }}>
          <Typography sx={{ ...labelSx, mb: 2 }}>Filter</Typography>
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            <FormControl size="small" sx={{ minWidth: 240 }}>
              <InputLabel sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>Batch No</InputLabel>
              <Select
                value={selectedBatch}
                label="Batch No"
                onChange={e => setSelectedBatch(e.target.value)}
                sx={inputSx}
              >
                <MenuItem value=""><em></em></MenuItem>
                {batches.map(b => (
                  <MenuItem key={b.batch_no} value={b.batch_no} sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>
                    {b.batch_no}{b.start_date ? ` (${b.start_date})` : ""}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={e => setStatusFilter(e.target.value)}
                sx={inputSx}
              >
                {["all", "pending", "approved", "rejected"].map(s => (
                  <MenuItem key={s} value={s} sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, textTransform: "capitalize" }}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {error && (
            <Box sx={{ 
              mt: 2, px: 2.5, py: 1.5, borderRadius: "10px", 
              background: error.includes('✅') ? TOKENS.success.light : TOKENS.error.light,
              border: `1px solid ${error.includes('✅') ? TOKENS.success.fill : TOKENS.error.fill}44`
            }}>
              <Typography sx={{ 
                fontFamily: "'DM Sans', sans-serif", 
                fontSize: 12, 
                fontWeight: 600, 
                color: error.includes('✅') ? TOKENS.success.text : TOKENS.error.text
              }}>
                {error}
              </Typography>
            </Box>
          )}
        </Box>

        {/* ── Loading ── */}
        {loading && (
          <Box sx={{ ...cardSx, py: 8, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <CircularProgress size={32} sx={{ color: TOKENS.accent }} />
            <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: TOKENS.textSub }}>
              Loading extension requests…
            </Typography>
          </Box>
        )}

        {/* ── Table ── */}
        {!loading && selectedBatch && (
          <Box sx={cardSx}>
            {/* Card header */}
            <Box sx={{
              px: 3, py: 2.5,
              background: `linear-gradient(135deg, ${TOKENS.accent}0d 0%, ${TOKENS.accentLight} 100%)`,
              borderBottom: `1px solid ${TOKENS.border}`,
              display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap",
            }}>
              <ExtIcon sx={{ fontSize: 20, color: TOKENS.accent }} />
              <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 800, color: TOKENS.text }}>
                Extension Requests
              </Typography>
              <Box sx={{ px: 1.5, py: 0.4, borderRadius: "20px", background: TOKENS.accentLight, border: `1px solid ${TOKENS.accent}33` }}>
                <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, color: TOKENS.accent }}>
                  {selectedBatch}
                </Typography>
              </Box>
              {rows.length > 0 && (
                <Box sx={{ ml: "auto", px: 1.5, py: 0.4, borderRadius: "20px", background: TOKENS.surfaceAlt, border: `1px solid ${TOKENS.border}` }}>
                  <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, color: TOKENS.textSub }}>
                    {rows.length} records
                  </Typography>
                </Box>
              )}
            </Box>

            <TableContainer sx={{ maxHeight: 520 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    {[
                      "Batch", "Assessment", "Week No", "Trainer",
                      "Reason", "Status", "Requested At", "Decided At", "Decided By", "Actions"
                    ].map(h => (
                      <TableCell key={h} sx={tableHeadSx}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} align="center" sx={{ py: 7 }}>
                        <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: TOKENS.textSub }}>
                          No extension requests for this batch and filter.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map(r => (
                      <TableRow
                        key={r.id}
                        sx={{
                          "&:nth-of-type(even)": { background: TOKENS.surfaceAlt },
                          "&:hover": { background: `${TOKENS.accent}06` },
                        }}
                      >
                        <TableCell sx={{ ...tableCellSx, fontFamily: "'DM Mono', monospace", fontSize: 12, color: TOKENS.textSub }}>
                          {r.batchno || r.batch_no || "—"}
                        </TableCell>
                        <TableCell sx={tableCellSx}>
                          {ASSESSMENT_LABELS[r.assessmenttype || r.assessment_type] || (r.assessmenttype || r.assessment_type)}
                        </TableCell>
                        <TableCell align="center" sx={{ ...tableCellSx, fontFamily: "'DM Mono', monospace", fontSize: 12 }}>
                          {r.weekno ?? r.week_no ?? "—"}
                        </TableCell>
                        <TableCell sx={{ ...tableCellSx, fontSize: 12, color: TOKENS.textSub }}>
                          {r.traineremail || r.trainer_email || "—"}
                        </TableCell>
                        <TableCell sx={{ ...tableCellSx, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {r.reason || "—"}
                        </TableCell>
                        <TableCell sx={tableCellSx}>
                          <StatusBadge status={r.status} />
                        </TableCell>
                        <TableCell sx={{ ...tableCellSx, fontFamily: "'DM Mono', monospace", fontSize: 11, color: TOKENS.textSub }}>
                          {r.createdat || r.created_at
                            ? new Date(r.createdat || r.created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })
                            : "—"}
                        </TableCell>
                        <TableCell sx={{ ...tableCellSx, fontFamily: "'DM Mono', monospace", fontSize: 11, color: TOKENS.textSub }}>
                          {r.decidedat || r.decided_at
                            ? new Date(r.decidedat || r.decided_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })
                            : "—"}
                        </TableCell>
                        <TableCell sx={{ ...tableCellSx, fontSize: 12, color: TOKENS.textSub }}>
                          {r.decidedby || r.decided_by || "—"}
                        </TableCell>
                        <TableCell sx={{ ...tableCellSx, whiteSpace: "nowrap" }}>
                          {/* Show buttons ONLY for pending requests */}
                          {r.status === 'pending' ? (
                            <>
                              <Button
                                size="small"
                                variant="contained"
                                color="success"
                                onClick={() => approveRequest(r.id)}
                                disabled={actionLoading[r.id] === 'approve'}
                                sx={{ 
                                  minWidth: 80, mr: 0.5,
                                  background: TOKENS.success.fill,
                                  '&:hover': { background: `${TOKENS.success.fill}E0` }
                                }}
                              >
                                {actionLoading[r.id] === 'approve' ? 'Approving...' : 'Approve'}
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                color="error"
                                onClick={() => rejectRequest(r.id)}
                                disabled={actionLoading[r.id] === 'reject'}
                                sx={{ 
                                  minWidth: 70,
                                  borderColor: TOKENS.error.fill,
                                  color: TOKENS.error.fill,
                                  '&:hover': { 
                                    borderColor: `${TOKENS.error.fill}E0`,
                                    backgroundColor: `${TOKENS.error.fill}08`
                                  }
                                }}
                              >
                                {actionLoading[r.id] === 'reject' ? 'Rejecting...' : 'Reject'}
                              </Button>
                            </>
                          ) : (
                            <Typography variant="caption" color="textSecondary">
                              {r.status === 'approved' ? '✅ Approved' : '❌ Rejected'}
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* ── Empty state ── */}
        {!selectedBatch && !loading && (
          <Box sx={{ ...cardSx, py: 10, textAlign: "center" }}>
            <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600, color: TOKENS.textSub }}>
              Select a batch to view extension request history
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
