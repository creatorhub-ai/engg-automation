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

// ---------- helpers ----------
function formatDateDDMMYYYY(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

// ---------- timeout wrapper ----------
function withTimeout(promise, ms = 8000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timeout")), ms)
    ),
  ]);
}

export default function TrainerLeaveDashboard() {
  const [sessionUser, setSessionUser] = useState(null);
  const [internalUser, setInternalUser] = useState(null);
  const [leaves, setLeaves] = useState([]);

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingLeaves, setLoadingLeaves] = useState(false);

  const [form, setForm] = useState({
    from_date: "",
    to_date: "",
    reason: "",
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ---------- load session ----------
  useEffect(() => {
    const stored = localStorage.getItem("userSession");
    if (!stored) {
      setError("Please login again");
      setLoadingProfile(false);
      return;
    }

    try {
      setSessionUser(JSON.parse(stored));
    } catch {
      setError("Invalid session. Please login again.");
      setLoadingProfile(false);
    }
  }, []);

  // ---------- load internal user (FIXED) ----------
  useEffect(() => {
    if (!sessionUser) return;

    let cancelled = false;

    async function loadInternalUser() {
      setLoadingProfile(true);
      setError("");

      try {
        const { data, error } = await withTimeout(
          supabase
            .from("internal_users")
            .select("*")
            .eq("email", sessionUser.email)
            .limit(1),
          8000
        );

        if (cancelled) return;

        if (error) throw error;

        if (!data || data.length === 0) {
          throw new Error(
            "Trainer profile not found. Contact admin."
          );
        }

        if (data[0].role !== "Trainer") {
          throw new Error("Access denied. Trainer role required.");
        }

        setInternalUser(data[0]);
      } catch (err) {
        console.error(err);
        setError(
          err.message === "Request timeout"
            ? "Server taking too long. Please refresh."
            : err.message
        );
      } finally {
        if (!cancelled) setLoadingProfile(false);
      }
    }

    loadInternalUser();

    return () => {
      cancelled = true;
    };
  }, [sessionUser]);

  // ---------- load leaves ----------
  useEffect(() => {
    if (internalUser) {
      loadLeaves();
    }
    // eslint-disable-next-line
  }, [internalUser]);

  async function loadLeaves() {
    setLoadingLeaves(true);
    setError("");

    try {
      const { data, error } = await withTimeout(
        supabase
          .from("trainer_leaves")
          .select("*")
          .eq("trainer_id", internalUser.id)
          .order("from_date"),
        8000
      );

      if (error) throw error;

      setLeaves(data || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load leaves");
    } finally {
      setLoadingLeaves(false);
    }
  }

  // ---------- apply leave ----------
  async function handleApply() {
    if (!form.from_date || !form.to_date) {
      setError("From and To dates are required");
      return;
    }

    setError("");
    setSuccess("");

    try {
      const res = await withTimeout(
        fetch(`${API_BASE}/api/leave/apply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trainer_id: internalUser.id,
            from_date: form.from_date,
            to_date: form.to_date,
            reason: form.reason || null,
          }),
        }),
        8000
      );

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Leave apply failed");
      }

      setSuccess("✅ Leave applied successfully");
      setForm({ from_date: "", to_date: "", reason: "" });
      loadLeaves();
    } catch (err) {
      console.error(err);
      setError(
        err.message === "Request timeout"
          ? "Server taking too long. Try again."
          : err.message
      );
    }
  }

  // ---------- UI ----------
  if (loadingProfile) {
    return (
      <Box sx={{ textAlign: "center", mt: 10 }}>
        <CircularProgress />
        <Typography mt={2}>Loading profile…</Typography>
      </Box>
    );
  }

  if (error && !internalUser) {
    return <Alert severity="error">{error}</Alert>;
  }

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", my: 4 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom>
          Trainer Leave Dashboard
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

        <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
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
          <Button variant="contained" onClick={handleApply}>
            Apply
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
            </Paper>
          ))
        )}
      </Paper>
    </Box>
  );
}
