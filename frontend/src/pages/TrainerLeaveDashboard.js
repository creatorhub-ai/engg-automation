// src/pages/TrainerLeaveDashboard.js
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
  CircularProgress,
} from "@mui/material";

const API_BASE =
  process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

// ---------------- UTILS ----------------
function formatDateDDMMYYYY(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

// fetch with timeout (CRITICAL)
async function fetchWithTimeout(url, options = {}, timeout = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// ---------------- COMPONENT ----------------
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

  // ---------------- LOAD SESSION ----------------
  useEffect(() => {
    const stored = localStorage.getItem("userSession");
    if (!stored) {
      setLoadingProfile(false);
      return;
    }

    try {
      setSessionUser(JSON.parse(stored));
    } catch {
      setLoadingProfile(false);
    }
  }, []);

  // ---------------- LOAD INTERNAL USER ----------------
  useEffect(() => {
    if (!sessionUser) return;

    let mounted = true;

    async function loadInternalUser() {
      setLoadingProfile(true);
      try {
        const { data, error } = await supabase
          .from("internal_users")
          .select("*")
          .eq("email", sessionUser.email)
          .limit(1);

        if (error || !data?.length) {
          throw new Error("Trainer profile not found");
        }

        if (mounted) setInternalUser(data[0]);
      } catch (err) {
        if (mounted) setError(err.message);
      } finally {
        if (mounted) setLoadingProfile(false);
      }
    }

    loadInternalUser();
    return () => (mounted = false);
  }, [sessionUser]);

  // ---------------- LOAD LEAVES ----------------
  useEffect(() => {
    if (!internalUser) return;
    loadLeaves();
  }, [internalUser]);

  async function loadLeaves() {
    setLoadingLeaves(true);
    const { data } = await supabase
      .from("trainer_leaves")
      .select("*")
      .eq("trainer_id", internalUser.id)
      .order("from_date");

    setLeaves(data || []);
    setLoadingLeaves(false);
  }

  // ---------------- APPLY LEAVE (FIXED) ----------------
  async function handleApply() {
    if (!form.from_date || !form.to_date) {
      setError("⚠️ From and To dates are required");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    const payload = {
      trainer_id: internalUser.id,
      from_date: form.from_date,
      to_date: form.to_date,
      reason: form.reason || null,
    };

    try {
      // 1️⃣ TRY BACKEND (EMAIL FLOW)
      const res = await fetchWithTimeout(
        `${API_BASE}/api/leave/apply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
        10000
      );

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error("Backend failed");
      }

      setSuccess("✅ Leave applied successfully");
    } catch (err) {
      console.warn("Backend unavailable. Saving directly…");

      // 2️⃣ FALLBACK — DIRECT DB INSERT (DEMO SAFE)
      const { error: dbError } = await supabase
        .from("trainer_leaves")
        .insert([
          {
            ...payload,
            status: "pending",
          },
        ]);

      if (dbError) {
        setError("❌ Failed to apply leave");
        setSubmitting(false);
        return;
      }

      setSuccess("✅ Leave applied successfully");
    }

    setForm({ from_date: "", to_date: "", reason: "" });
    await loadLeaves();
    setSubmitting(false);
  }

  // ---------------- DELETE LEAVE ----------------
  async function handleDelete(id) {
    await supabase
      .from("trainer_leaves")
      .delete()
      .eq("id", id)
      .eq("trainer_id", internalUser.id);

    loadLeaves();
  }

  // ---------------- UI STATES ----------------
  if (loadingProfile) {
    return (
      <Box sx={{ textAlign: "center", mt: 10 }}>
        <CircularProgress />
        <Typography mt={2}>Loading trainer profile…</Typography>
      </Box>
    );
  }

  if (!sessionUser) return <Alert severity="error">Please login</Alert>;
  if (error && !internalUser)
    return <Alert severity="error">{error}</Alert>;

  // ---------------- MAIN UI ----------------
  return (
    <Box sx={{ maxWidth: 900, mx: "auto", my: 4 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4">Trainer Leave Dashboard</Typography>

        <Fade in={!!(error || success)}>
          <Box sx={{ my: 2 }}>
            {error && <Alert severity="error">{error}</Alert>}
            {success && <Alert severity="success">{success}</Alert>}
          </Box>
        </Fade>

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
                {formatDateDDMMYYYY(l.from_date)} →{" "}
                {formatDateDDMMYYYY(l.to_date)} | {l.status}
              </Typography>
              <Button
                color="error"
                onClick={() => handleDelete(l.id)}
              >
                Delete
              </Button>
            </Paper>
          ))
        )}
      </Paper>
    </Box>
  );
}
