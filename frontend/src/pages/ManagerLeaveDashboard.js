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
  CircularProgress,
} from "@mui/material";

const API_BASE =
  process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

// ---------- helpers ----------
function formatDateDDMMYYYY(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

export default function ManagerLeaveDashboard() {
  const [sessionUser, setSessionUser] = useState(null);
  const [internalUser, setInternalUser] = useState(null);

  const [view, setView] = useState("month");
  const [baseDate, setBaseDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [selectedMonth, setSelectedMonth] = useState("");

  const [leaves, setLeaves] = useState([]);

  const [pageLoading, setPageLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ---------- load session ----------
  useEffect(() => {
    const stored = localStorage.getItem("userSession");
    if (stored) {
      try {
        setSessionUser(JSON.parse(stored));
      } catch {
        setSessionUser(null);
      }
    }
  }, []);

  // ---------- load internal user ----------
  useEffect(() => {
    if (!sessionUser) return;

    async function loadInternalUser() {
      const { data, error } = await supabase
        .from("internal_users")
        .select("*")
        .eq("email", sessionUser.email)
        .single();

      if (error) {
        setError("Failed to load user profile");
        return;
      }

      if (!["manager", "admin"].includes(data.role)) {
        setError("Access denied");
        return;
      }

      setInternalUser(data);
    }

    loadInternalUser();
  }, [sessionUser]);

  // ---------- load leaves ----------
  useEffect(() => {
    if (internalUser) {
      loadLeaves();
    }
    // eslint-disable-next-line
  }, [internalUser, view, baseDate, selectedMonth]);

  async function loadLeaves() {
    setPageLoading(true);
    setError("");
    setSuccess("");

    const dateObj = new Date(baseDate);
    let from, to;

    if (view === "day") {
      from = baseDate;
      to = baseDate;
    } else if (view === "week") {
      const day = dateObj.getDay();
      const monday = new Date(dateObj);
      monday.setDate(dateObj.getDate() - ((day + 6) % 7));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      from = monday.toISOString().slice(0, 10);
      to = sunday.toISOString().slice(0, 10);
    } else {
      const year = dateObj.getFullYear();
      const m =
        selectedMonth !== ""
          ? parseInt(selectedMonth, 10) - 1
          : dateObj.getMonth();
      from = new Date(year, m, 1).toISOString().slice(0, 10);
      to = new Date(year, m + 1, 0).toISOString().slice(0, 10);
    }

    const { data, error } = await supabase
      .from("trainer_leaves")
      .select(
        `*,
         internal_users!trainer_leaves_trainer_id_fkey(name,email)`
      )
      .lte("from_date", to)
      .gte("to_date", from)
      .order("from_date");

    if (error) {
      setError("Failed to load leaves");
    } else {
      setLeaves(data || []);
    }

    setPageLoading(false);
  }

  // ---------- approve / reject / revoke ----------
  async function decide(leaveId, decision) {
    if (!internalUser) return;

    setActionLoading(leaveId);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(
        `${API_BASE}/api/leave/${leaveId}/decision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision,
            manager_id: internalUser.id,
            manager_name: internalUser.name,
            manager_email: internalUser.email,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed");
      }

      setSuccess(`✅ Leave ${decision}`);
      await loadLeaves();
    } catch (err) {
      console.error(err);
      setError("Action failed. Try again.");
    } finally {
      setActionLoading(null);
    }
  }

  // ---------- guards ----------
  if (!sessionUser) {
    return (
      <Box sx={{ maxWidth: 500, mx: "auto", my: 4 }}>
        <Paper sx={{ p: 4 }}>
          <Typography>Please login</Typography>
        </Paper>
      </Box>
    );
  }

  if (!internalUser) {
    return (
      <Box sx={{ maxWidth: 500, mx: "auto", my: 4 }}>
        <Paper sx={{ p: 4 }}>
          <CircularProgress />
          <Typography sx={{ mt: 2 }}>Loading profile…</Typography>
        </Paper>
      </Box>
    );
  }

  // ---------- UI ----------
  return (
    <Box sx={{ maxWidth: 1100, mx: "auto", my: 4 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom>
          Manager Leave Dashboard
        </Typography>

        <Fade in={!!(error || success)}>
          <Box sx={{ mb: 2 }}>
            {(error || success) && (
              <Alert severity={error ? "error" : "success"}>
                {error || success}
              </Alert>
            )}
          </Box>
        </Fade>

        {/* Filters */}
        <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
          <FormControl sx={{ minWidth: 140 }}>
            <InputLabel>View</InputLabel>
            <Select
              label="View"
              value={view}
              onChange={(e) => {
                setView(e.target.value);
                if (e.target.value !== "month") setSelectedMonth("");
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
                <MenuItem value="">Current</MenuItem>
                {[...Array(12)].map((_, i) => (
                  <MenuItem key={i + 1} value={String(i + 1)}>
                    {new Date(0, i).toLocaleString("default", {
                      month: "long",
                    })}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <Button onClick={loadLeaves} disabled={pageLoading}>
            Refresh
          </Button>
        </Box>

        {/* Table */}
        {pageLoading ? (
          <CircularProgress />
        ) : !leaves.length ? (
          <Typography>No leaves found</Typography>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Trainer</th>
                <th style={th}>From</th>
                <th style={th}>To</th>
                <th style={th}>Reason</th>
                <th style={th}>Status</th>
                <th style={th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {leaves.map((l) => (
                <tr key={l.id}>
                  <td style={td}>{l.internal_users?.name}</td>
                  <td style={td}>{formatDateDDMMYYYY(l.from_date)}</td>
                  <td style={td}>{formatDateDDMMYYYY(l.to_date)}</td>
                  <td style={td}>{l.reason}</td>
                  <td style={td}>{l.status}</td>
                  <td style={td}>
                    {l.status === "pending" ? (
                      <>
                        <Button
                          size="small"
                          color="success"
                          disabled={actionLoading === l.id}
                          onClick={() => decide(l.id, "approved")}
                        >
                          Approve
                        </Button>{" "}
                        <Button
                          size="small"
                          color="error"
                          disabled={actionLoading === l.id}
                          onClick={() => decide(l.id, "rejected")}
                        >
                          Reject
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="small"
                        color="warning"
                        disabled={actionLoading === l.id}
                        onClick={() => decide(l.id, "revoked")}
                      >
                        Revoke
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Paper>
    </Box>
  );
}

const th = { borderBottom: "1px solid #ddd", padding: 8 };
const td = { borderBottom: "1px solid #eee", padding: 8 };