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

// helper: 2025-12-22 -> 22/12/2025
function formatDateDDMMYYYY(dateStr) {
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

  const [form, setForm] = useState({
    from_date: "",
    to_date: "",
    reason: "",
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // -----------------------------------
  // 1. Load session user
  // -----------------------------------
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

  // -----------------------------------
  // 2. Load internal user SAFELY
  // -----------------------------------
  useEffect(() => {
    if (!sessionUser) return;

    let isMounted = true;

    async function loadInternalUser() {
      setLoadingProfile(true);
      setError("");

      try {
        const { data, error } = await supabase
          .from("internal_users")
          .select("*")
          .eq("email", sessionUser.email)
          .limit(1);

        if (error) throw error;

        if (!data || data.length === 0) {
          throw new Error(
            "Trainer profile not found. Contact admin to create internal_users entry."
          );
        }

        if (!isMounted) return;

        if (data[0].role !== "trainer") {
          throw new Error("Access denied. Trainer role required.");
        }

        setInternalUser(data[0]);
      } catch (err) {
        console.error("Internal user load failed:", err);
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setLoadingProfile(false);
      }
    }

    loadInternalUser();

    return () => {
      isMounted = false;
    };
  }, [sessionUser]);

  // -----------------------------------
  // 3. Load leaves
  // -----------------------------------
  useEffect(() => {
    if (!internalUser) return;
    loadLeaves();
  }, [internalUser]);

  async function loadLeaves() {
    setLoadingLeaves(true);
    setError("");

    const { data, error } = await supabase
      .from("trainer_leaves")
      .select("*")
      .eq("trainer_id", internalUser.id)
      .order("from_date", { ascending: true });

    if (error) {
      console.error(error);
      setError("Failed to load leaves");
    } else {
      setLeaves(data || []);
    }

    setLoadingLeaves(false);
  }

  // -----------------------------------
  // Apply Leave
  // -----------------------------------
  async function handleApply() {
    if (!form.from_date || !form.to_date) {
      setError("⚠️ From and To dates are required");
      return;
    }

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
          reason: form.reason || null,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Leave apply failed");
      }

      setSuccess("✅ Leave applied successfully");
      setForm({ from_date: "", to_date: "", reason: "" });
      loadLeaves();
    } catch (err) {
      console.error(err);
      setError(err.message);
    }
  }

  // -----------------------------------
  // UPDATE leave
  // -----------------------------------
  async function handleUpdate(id, from, to, reason) {
    setError("");
    setSuccess("");

    const { data, error } = await supabase
      .from("trainer_leaves")
      .update({ from_date: from, to_date: to, reason })
      .eq("id", id)
      .eq("trainer_id", internalUser.id)
      .eq("status", "pending")
      .select()
      .limit(1);

    if (error || !data?.length) {
      setError("❌ Update failed (only pending leaves allowed)");
      return;
    }

    setLeaves((prev) =>
      prev.map((l) => (l.id === id ? data[0] : l))
    );
    setSuccess("✅ Leave updated");
  }

  // -----------------------------------
  // DELETE leave
  // -----------------------------------
  async function handleDelete(id) {
    setError("");
    setSuccess("");

    const { error } = await supabase
      .from("trainer_leaves")
      .delete()
      .eq("id", id)
      .eq("trainer_id", internalUser.id);

    if (error) {
      setError("❌ Delete failed");
      return;
    }

    setLeaves((prev) => prev.filter((l) => l.id !== id));
    setSuccess("✅ Leave deleted");
  }

  // -----------------------------------
  // UI STATES
  // -----------------------------------
  if (loadingProfile) {
    return (
      <Box sx={{ textAlign: "center", mt: 10 }}>
        <CircularProgress />
        <Typography mt={2}>Loading trainer profile…</Typography>
      </Box>
    );
  }

  if (!sessionUser) {
    return <Alert severity="error">Please login</Alert>;
  }

  if (error && !internalUser) {
    return <Alert severity="error">{error}</Alert>;
  }

  // -----------------------------------
  // MAIN UI
  // -----------------------------------
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
