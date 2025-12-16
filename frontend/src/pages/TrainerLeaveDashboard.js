// src/pages/TrainerLeaveDashboard.js
import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient"; // DB only for reads
import {
  Paper,
  Typography,
  Button,
  Box,
  TextField,
  Alert,
  Fade,
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

export default function TrainerLeaveDashboard() {
  const [sessionUser, setSessionUser] = useState(null); // from localStorage
  const [internalUser, setInternalUser] = useState(null);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    from_date: "",
    to_date: "",
    reason: "",
  });
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

  // 2. Map to internal_users row (by email)
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

      if (data.role !== "trainer") {
        setError("You are not a trainer. Trainer dashboard only.");
      }

      setInternalUser(data);
    }

    if (sessionUser) {
      loadInternalUser();
    }
  }, [sessionUser]);

  // 3. Load this trainer's leaves
  useEffect(() => {
    if (!internalUser) return;
    loadLeaves();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [internalUser]);

  async function loadLeaves() {
    if (!internalUser) return;
    setLoading(true);
    setError("");
    setSuccess("");

    const { data, error: qError } = await supabase
      .from("trainer_leaves")
      .select("*")
      .eq("trainer_id", internalUser.id)
      .order("from_date", { ascending: true });

    if (qError) {
      console.error("loadLeaves error", qError);
      setError("Failed to load your leaves");
    } else {
      setLeaves(data || []);
    }
    setLoading(false);
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  // use backend API so emails are sent
  async function handleApply() {
    if (!internalUser) return;
    setError("");
    setSuccess("");

    if (!form.from_date || !form.to_date) {
      setError("⚠️ From and To dates are required");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/leave/apply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          trainer_id: internalUser.id,          // ✅ send trainer_id
          from_date: form.from_date,
          to_date: form.to_date,
          reason: form.reason || null,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "❌ Failed to apply for leave");
      } else {
        setSuccess("✅ Leave applied successfully");
        setForm({ from_date: "", to_date: "", reason: "" });
        await loadLeaves();
      }
    } catch (err) {
      console.error("handleApply error", err);
      setError("❌ Network error while applying leave");
    } finally {
      setLoading(false);
    }
  }

  // purely DB update, no email needed
  async function handleUpdate(leaveId, newFrom, newTo, newReason) {
    setError("");
    setSuccess("");
    setLoading(true);

    const payload = {};
    if (newFrom) payload.from_date = newFrom;
    if (newTo) payload.to_date = newTo;
    if (newReason !== undefined) payload.reason = newReason;

    const { data, error: upError } = await supabase
      .from("trainer_leaves")
      .update(payload)
      .eq("id", leaveId)
      .eq("trainer_id", internalUser.id)
      .eq("status", "pending")
      .select()
      .single();

    if (upError) {
      console.error("handleUpdate error", upError);
      setError("❌ Failed to update leave (only pending leaves can be updated)");
    } else {
      setSuccess("✅ Leave updated successfully");
      setLeaves((prev) =>
        prev.map((l) => (l.id === leaveId ? data : l))
      );
    }

    setLoading(false);
  }

  // no email needed on delete
  async function handleDelete(leaveId) {
    setError("");
    setSuccess("");
    setLoading(true);

    const { error: delError } = await supabase
      .from("trainer_leaves")
      .delete()
      .eq("id", leaveId)
      .eq("trainer_id", internalUser.id);

    if (delError) {
      console.error("handleDelete error", delError);
      setError("❌ Failed to delete leave");
    } else {
      setSuccess("✅ Leave deleted successfully");
      setLeaves((prev) => prev.filter((l) => l.id !== leaveId));
    }

    setLoading(false);
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
            Please login to access trainer leave dashboard.
          </Typography>
        </Paper>
      </Box>
    );
  }
  if (sessionUser.role !== "trainer") {
    return (
      <Box sx={{ maxWidth: 520, mx: "auto", my: 3 }}>
        <Paper elevation={5} sx={{ p: 4, borderRadius: 3 }}>
          <Typography variant="h5">
            Access denied. Only trainers can view this page.
          </Typography>
        </Paper>
      </Box>
    );
  }
  if (!internalUser) {
    return (
      <Box sx={{ maxWidth: 520, mx: "auto", my: 3 }}>
        <Paper elevation={5} sx={{ p: 4, borderRadius: 3 }}>
          <Typography variant="h5">Loading trainer profile...</Typography>
        </Paper>
      </Box>
    );
  }

  const message = error || success;

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", my: 3 }}>
      <Paper elevation={5} sx={{ p: 4, borderRadius: 3 }}>
        <Typography variant="h4" color="primary" gutterBottom>
          {roleTitle} Dashboard
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" mb={2}>
          Welcome, {welcomeName}!
        </Typography>

        <Typography variant="h6" color="primary" sx={{ mb: 3 }}>
          📝 Leave Management
        </Typography>

        {/* Apply Leave UI */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mb: 3 }}>
          <TextField
            label="From Date"
            type="date"
            InputLabelProps={{ shrink: true }}
            value={form.from_date}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, from_date: e.target.value }))
            }
            fullWidth
          />
          <TextField
            label="To Date"
            type="date"
            InputLabelProps={{ shrink: true }}
            value={form.to_date}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, to_date: e.target.value }))
            }
            fullWidth
          />
          <TextField
            label="Reason"
            value={form.reason}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, reason: e.target.value }))
            }
            fullWidth
          />
          <Button
            variant="contained"
            color="primary"
            fullWidth
            onClick={handleApply}
            sx={{ py: 1.5, fontWeight: "bold", fontSize: "1rem", boxShadow: 4 }}
            disabled={loading}
          >
            📤 Apply for Leave
          </Button>
        </Box>

        {/* Feedback message */}
        <Fade in={!!message}>
          <Box sx={{ mb: 3 }}>
            {message && (
              <Alert
                severity={
                  message.startsWith("✅")
                    ? "success"
                    : message.startsWith("⚠️")
                    ? "warning"
                    : "error"
                }
              >
                {message}
              </Alert>
            )}
          </Box>
        </Fade>

        {/* Existing leaves list */}
        <Typography variant="h6" sx={{ mb: 2 }}>
          📚 My Leaves
        </Typography>

        {loading && !leaves.length ? (
          <Typography>Loading leaves...</Typography>
        ) : !leaves.length ? (
          <Typography>No leaves found.</Typography>
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
                  <th style={thStyle}>From</th>
                  <th style={thStyle}>To</th>
                  <th style={thStyle}>Reason</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {leaves.map((leave) => (
                  <LeaveRow
                    key={leave.id}
                    leave={leave}
                    onUpdate={handleUpdate}
                    onDelete={handleDelete}
                  />
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

function LeaveRow({ leave, onUpdate, onDelete }) {
  const [editFrom, setEditFrom] = useState(leave.from_date || "");
  const [editTo, setEditTo] = useState(leave.to_date || "");
  const [editReason, setEditReason] = useState(leave.reason || "");
  const isPending = leave.status === "pending";

  return (
    <tr>
      <td style={tdStyle}>{leave.id}</td>
      <td style={tdStyle}>{formatDateDDMMYYYY(leave.from_date)}</td>
      <td style={tdStyle}>{formatDateDDMMYYYY(leave.to_date)}</td>
      <td style={tdStyle}>{leave.reason}</td>
      <td style={tdStyle}>{leave.status}</td>
      <td style={tdStyle}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {isPending && (
            <>
              <TextField
                type="date"
                label="From"
                InputLabelProps={{ shrink: true }}
                value={editFrom}
                onChange={(e) => setEditFrom(e.target.value)}
                size="small"
              />
              <TextField
                type="date"
                label="To"
                InputLabelProps={{ shrink: true }}
                value={editTo}
                onChange={(e) => setEditTo(e.target.value)}
                size="small"
              />
              <TextField
                label="Reason"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                size="small"
              />
              <Button
                variant="outlined"
                size="small"
                onClick={() =>
                  onUpdate(leave.id, editFrom, editTo, editReason)
                }
              >
                Save changes
              </Button>
            </>
          )}
          <Button
            variant="contained"
            color="error"
            size="small"
            onClick={() => onDelete(leave.id)}
          >
            Delete
          </Button>
        </Box>
      </td>
    </tr>
  );
}
