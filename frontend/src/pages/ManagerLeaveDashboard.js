// src/pages/ManagerLeaveDashboard.js
import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import {
  Paper,
  Typography,
  Button,
  Box,
  TextField,
  Alert,
  Fade,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from "@mui/material";

const API_BASE =
  process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

// helper: 2025-12-22 -> 22/12/2025
function formatDateDDMMYYYY(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  if (!y || !m || !d) return dateStr;
  return `${d}/${m}/${y}`;
}

export default function ManagerLeaveDashboard() {
  const [sessionUser, setSessionUser] = useState(null);
  const [internalUser, setInternalUser] = useState(null);
  const [view, setView] = useState("month");
  const [baseDate, setBaseDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [selectedMonth, setSelectedMonth] = useState(""); // 1-12 as string for month view
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // 1. Load userSession from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("userSession");
    if (!stored) {
      setSessionUser(null);
      return;
    }
    try {
      const parsed = JSON.parse(stored);
      setSessionUser(parsed);
    } catch {
      setSessionUser(null);
    }
  }, []);

  // 2. Load internal_users row
  useEffect(() => {
    async function loadInternalUser() {
      if (!sessionUser) return;

      setError("");

      const { data, error: qError } = await supabase
        .from("internal_users")
        .select("*")
        .eq("email", sessionUser.email)
        .single();

      if (qError) {
        console.error("loadInternalUser error", qError);
        setError("Failed to load internal user profile");
        return;
      }

      if (data.role !== "manager" && data.role !== "admin") {
        setError("Access denied. Only manager/admin can view this dashboard.");
      }

      setInternalUser(data);
    }

    if (sessionUser) {
      loadInternalUser();
    }
  }, [sessionUser]);

  // 3. Load leaves for view+baseDate / selectedMonth
  useEffect(() => {
    if (!internalUser) return;
    loadLeaves();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [internalUser, view, baseDate, selectedMonth]);

  async function loadLeaves() {
    setLoading(true);
    setError("");
    setSuccess("");

    const dateObj = new Date(baseDate);
    let from, to;

    if (view === "day") {
      from = baseDate;
      to = baseDate;
    } else if (view === "week") {
      const dayOfWeek = dateObj.getDay();
      const monday = new Date(dateObj);
      monday.setDate(dateObj.getDate() - ((dayOfWeek + 6) % 7));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      from = monday.toISOString().slice(0, 10);
      to = sunday.toISOString().slice(0, 10);
    } else {
      const year = dateObj.getFullYear();
      const monthIndex =
        selectedMonth !== ""
          ? parseInt(selectedMonth, 10) - 1
          : dateObj.getMonth();
      const first = new Date(year, monthIndex, 1);
      const last = new Date(year, monthIndex + 1, 0);
      from = first.toISOString().slice(0, 10);
      to = last.toISOString().slice(0, 10);
    }

    const { data, error: qError } = await supabase
      .from("trainer_leaves")
      .select(
        `
        *,
        internal_users!trainer_leaves_trainer_id_fkey (
          name,
          email
        )
      `
      )
      .lte("from_date", to)
      .gte("to_date", from)
      .order("from_date", { ascending: true });

    if (qError) {
      console.error("loadLeaves error", qError);
      setError("Failed to load leaves");
    } else {
      setLeaves(data || []);
    }

    setLoading(false);
  }

  // use backend API so emails are sent
  async function decide(leaveId, decision) {
    setError("");
    setSuccess("");

    if (!["approved", "rejected", "revoked"].includes(decision)) {
      setError("Invalid decision");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/leave/${leaveId}/decision`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionUser.token}`,
        },
        body: JSON.stringify({ decision }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Failed to update leave status");
      } else {
        const label =
          decision === "revoked" ? "approval revoked" : ` ${decision}`;
        setSuccess(`✅ Leave ${label}`);
        await loadLeaves();
      }
    } catch (err) {
      console.error("decide error", err);
      setError("Failed to update leave status (network error)");
    } finally {
      setLoading(false);
    }
  }

  const welcomeName = sessionUser?.name || "User";
  const roleTitle = sessionUser?.role
    ? sessionUser.role.charAt(0).toUpperCase() + sessionUser.role.slice(1)
    : "Dashboard";

  if (!sessionUser) {
    return (
      <Box sx={{ maxWidth: 520, mx: "auto", my: 3 }}>
        <Paper elevation={5} sx={{ p: 4, borderRadius: 3 }}>
          <Typography variant="h5">
            Please login to access manager leave dashboard.
          </Typography>
        </Paper>
      </Box>
    );
  }
  if (sessionUser.role !== "manager" && sessionUser.role !== "admin") {
    return (
      <Box sx={{ maxWidth: 520, mx: "auto", my: 3 }}>
        <Paper elevation={5} sx={{ p: 4, borderRadius: 3 }}>
          <Typography variant="h5">
            Access denied. Only manager/admin can view this page.
          </Typography>
        </Paper>
      </Box>
    );
  }
  if (!internalUser) {
    return (
      <Box sx={{ maxWidth: 520, mx: "auto", my: 3 }}>
        <Paper elevation={5} sx={{ p: 4, borderRadius: 3 }}>
          <Typography variant="h5">Loading manager profile...</Typography>
        </Paper>
      </Box>
    );
  }

  const message = error || success;

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto", my: 3 }}>
      <Paper elevation={5} sx={{ p: 4, borderRadius: 3 }}>
        <Typography variant="h4" color="primary" gutterBottom>
          {roleTitle} Dashboard
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" mb={2}>
          Welcome, {welcomeName}!
        </Typography>

        <Typography variant="h6" color="primary" sx={{ mb: 3 }}>
          📊 Leave Management (Manager View)
        </Typography>

        {/* Filters UI */}
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: 2,
            mb: 3,
            alignItems: "center",
          }}
        >
          <FormControl sx={{ minWidth: 160 }}>
            <InputLabel>View</InputLabel>
            <Select
              label="View"
              value={view}
              onChange={(e) => {
                setView(e.target.value);
                if (e.target.value !== "month") {
                  setSelectedMonth("");
                }
              }}
            >
              <MenuItem value="day">Day</MenuItem>
              <MenuItem value="week">Week</MenuItem>
              <MenuItem value="month">Month</MenuItem>
            </Select>
          </FormControl>

          <TextField
            label="Base Date"
            type="date"
            InputLabelProps={{ shrink: true }}
            value={baseDate}
            onChange={(e) => setBaseDate(e.target.value)}
          />

          {view === "month" && (
            <FormControl sx={{ minWidth: 160 }}>
              <InputLabel>Month</InputLabel>
              <Select
                label="Month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              >
                <MenuItem value="">Current month</MenuItem>
                <MenuItem value="1">January</MenuItem>
                <MenuItem value="2">February</MenuItem>
                <MenuItem value="3">March</MenuItem>
                <MenuItem value="4">April</MenuItem>
                <MenuItem value="5">May</MenuItem>
                <MenuItem value="6">June</MenuItem>
                <MenuItem value="7">July</MenuItem>
                <MenuItem value="8">August</MenuItem>
                <MenuItem value="9">September</MenuItem>
                <MenuItem value="10">October</MenuItem>
                <MenuItem value="11">November</MenuItem>
                <MenuItem value="12">December</MenuItem>
              </Select>
            </FormControl>
          )}

          <Button
            variant="contained"
            color="primary"
            onClick={loadLeaves}
            sx={{ py: 1.1, fontWeight: "bold", boxShadow: 3 }}
            disabled={loading}
          >
            🔄 Refresh
          </Button>
        </Box>

        {/* Feedback */}
        <Fade in={!!message}>
          <Box sx={{ mb: 3 }}>
            {message && (
              <Alert
                severity={
                  message.startsWith("✅")
                    ? "success"
                    : message.startsWith("Access denied")
                    ? "warning"
                    : "error"
                }
              >
                {message}
              </Alert>
            )}
          </Box>
        </Fade>

        {/* Leaves table */}
        <Typography variant="h6" sx={{ mb: 2 }}>
          📋 Trainer Leaves
        </Typography>

        {loading && !leaves.length ? (
          <Typography>Loading leaves...</Typography>
        ) : !leaves.length ? (
          <Typography>No leaves found for selected range.</Typography>
        ) : (
          <Box sx={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                marginTop: 8,
              }}
            >
              <thead>
                <tr>
                  <th style={thStyle}>ID</th>
                  <th style={thStyle}>Trainer</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>From</th>
                  <th style={thStyle}>To</th>
                  <th style={thStyle}>Reason</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Manager ID</th>
                  <th style={thStyle}>Decision</th>
                </tr>
              </thead>
              <tbody>
                {leaves.map((l) => (
                  <tr key={l.id}>
                    <td style={tdStyle}>{l.id}</td>
                    <td style={tdStyle}>{l.internal_users?.name || "-"}</td>
                    <td style={tdStyle}>{l.internal_users?.email || "-"}</td>
                    <td style={tdStyle}>{formatDateDDMMYYYY(l.from_date)}</td>
                    <td style={tdStyle}>{formatDateDDMMYYYY(l.to_date)}</td>
                    <td style={tdStyle}>{l.reason}</td>
                    <td style={tdStyle}>{l.status}</td>
                    <td style={tdStyle}>{l.manager_id || "-"}</td>
                    <td style={tdStyle}>
                      {l.status === "pending" ? (
                        <Box sx={{ display: "flex", gap: 1 }}>
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            onClick={() => decide(l.id, "approved")}
                          >
                            Approve
                          </Button>
                          <Button
                            size="small"
                            variant="contained"
                            color="error"
                            onClick={() => decide(l.id, "rejected")}
                          >
                            Reject
                          </Button>
                        </Box>
                      ) : (
                        <Box sx={{ display: "flex", gap: 1 }}>
                          <i style={{ marginRight: 8 }}>
                            Already {l.status}
                          </i>
                          <Button
                            size="small"
                            variant="outlined"
                            color="warning"
                            onClick={() => decide(l.id, "revoked")}
                          >
                            Revoke
                          </Button>
                        </Box>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
        )}
      </Paper>
    </Box>
  );
}

const thStyle = {
  borderBottom: "1px solid #ddd",
  padding: "8px",
  textAlign: "left",
  backgroundColor: "#f5f5f5",
};

const tdStyle = {
  borderBottom: "1px solid #eee",
  padding: "8px",
  verticalAlign: "top",
};
