import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import {
  Paper,
  Typography,
  Button,
  Box,
  TextField,
  Alert,
  CircularProgress,
} from "@mui/material";

const API_BASE =
  process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

// ---------- UTILS ----------
function formatDate(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

export default function TrainerLeaveDashboard() {
  const [sessionUser, setSessionUser] = useState(null);
  const [internalUser, setInternalUser] = useState(null);
  const [leaves, setLeaves] = useState([]);

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingLeaves, setLoadingLeaves] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    from_date: "",
    to_date: "",
    reason: "",
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ---------- LOAD SESSION ----------
  useEffect(() => {
    const stored = localStorage.getItem("userSession");
    if (stored) {
      setSessionUser(JSON.parse(stored));
    }
    setLoadingProfile(false);
  }, []);

  // ---------- LOAD INTERNAL USER ----------
  useEffect(() => {
    if (!sessionUser) return;

    async function loadUser() {
      setLoadingProfile(true);
      const { data, error } = await supabase
        .from("internal_users")
        .select("*")
        .eq("email", sessionUser.email)
        .single();

      if (error || !data) {
        setError("Trainer profile not found");
      } else {
        setInternalUser(data);
      }
      setLoadingProfile(false);
    }

    loadUser();
  }, [sessionUser]);

  // ---------- LOAD LEAVES ----------
  useEffect(() => {
    if (internalUser) loadLeaves();
  }, [internalUser]);

  async function loadLeaves() {
    setLoadingLeaves(true);
    const res = await fetch(
      `${API_BASE}/api/leave/list?view=month&date=${new Date()
        .toISOString()
        .slice(0, 10)}`
    );
    const data = await res.json();
    setLeaves(
      data.filter((l) => l.trainer_id === internalUser.id) || []
    );
    setLoadingLeaves(false);
  }

  // ---------- APPLY LEAVE ----------
  async function handleApply() {
    if (!form.from_date || !form.to_date) {
      setError("From and To dates are required");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`${API_BASE}/api/leave/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trainer_id: internalUser.id,
          from_date: form.from_date,
          to_date: form.to_date,
          reason: form.reason,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSuccess("Leave applied successfully");
      setForm({ from_date: "", to_date: "", reason: "" });
      loadLeaves();
    } catch {
      setError("Failed to apply leave");
    }

    setSubmitting(false);
  }

  // ---------- UI ----------
  if (loadingProfile) {
    return (
      <Box sx={{ textAlign: "center", mt: 8 }}>
        <CircularProgress />
        <Typography mt={2}>Loading profile…</Typography>
      </Box>
    );
  }

  if (!sessionUser) return <Alert severity="error">Please login</Alert>;
  if (error && !internalUser) return <Alert severity="error">{error}</Alert>;

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", my: 4 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom>
          Trainer Leave Dashboard
        </Typography>

        {(error || success) && (
          <Alert severity={error ? "error" : "success"} sx={{ mb: 2 }}>
            {error || success}
          </Alert>
        )}

        <Box sx={{ display: "flex", gap: 2, mb: 3 }}>
          <TextField
            type="date"
            label="From"
            InputLabelProps={{ shrink: true }}
            value={form.from_date}
            onChange={(e) =>
              setForm({ ...form, from_date: e.target.value })
            }
          />
          <TextField
            type="date"
            label="To"
            InputLabelProps={{ shrink: true }}
            value={form.to_date}
            onChange={(e) =>
              setForm({ ...form, to_date: e.target.value })
            }
          />
          <TextField
            label="Reason"
            value={form.reason}
            onChange={(e) =>
              setForm({ ...form, reason: e.target.value })
            }
          />
          <Button
            variant="contained"
            onClick={handleApply}
            disabled={submitting}
          >
            {submitting ? "Applying…" : "Apply"}
          </Button>
        </Box>

        {loadingLeaves ? (
          <CircularProgress />
        ) : (
          leaves.map((l) => (
            <Paper key={l.id} sx={{ p: 2, mb: 1 }}>
              <Typography>
                {formatDate(l.from_date)} → {formatDate(l.to_date)} |{" "}
                {l.status}
              </Typography>
            </Paper>
          ))
        )}
      </Paper>
    </Box>
  );
}
