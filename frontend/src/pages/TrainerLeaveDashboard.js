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
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    from_date: "",
    to_date: "",
    reason: "",
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  /* ---------------- Load Session ---------------- */
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

  /* ---------------- Load Internal User ---------------- */
  useEffect(() => {
    async function loadInternalUser() {
      if (!sessionUser) return;

      const { data, error } = await supabase
        .from("internal_users")
        .select("*")
        .eq("email", sessionUser.email)
        .single();

      if (error) {
        console.error(error);
        setError("Failed to load trainer profile");
        return;
      }

      if (data.role !== "trainer") {
        setError("Access denied: Trainer only");
        return;
      }

      setInternalUser(data);
    }

    loadInternalUser();
  }, [sessionUser]);

  /* ---------------- Load Leaves ---------------- */
  useEffect(() => {
    if (internalUser) loadLeaves();
  }, [internalUser]);

  async function loadLeaves() {
    setLoading(true);
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

    setLoading(false);
  }

  /* ---------------- Apply Leave (FIXED) ---------------- */
  async function handleApply() {
    if (!internalUser || submitting) return;

    setError("");
    setSuccess("");

    if (!form.from_date || !form.to_date) {
      setError("⚠️ From and To dates are required");
      return;
    }

    setSubmitting(true);

    const payload = {
      trainer_id: internalUser.id,
      from_date: form.from_date,
      to_date: form.to_date,
      reason: form.reason || null,
    };

    console.log("▶ APPLY LEAVE PAYLOAD:", payload);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s

    try {
      const res = await fetch(`${API_BASE}/api/leave/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const data = await res.json().catch(() => ({}));
      console.log("⬅ BACKEND RESPONSE:", data);

      if (!res.ok || !data.success) {
        setError(data.error || "❌ Failed to apply leave");
      } else {
        setSuccess("✅ Leave applied successfully");
        setForm({ from_date: "", to_date: "", reason: "" });
        await loadLeaves();
      }
    } catch (err) {
      console.error("APPLY ERROR:", err);

      if (err.name === "AbortError") {
        setError(
          "⏳ Server took too long to respond. Please try again."
        );
      } else {
        setError("❌ Network / server error");
      }
    } finally {
      clearTimeout(timeoutId);
      setSubmitting(false);
    }
  }

  /* ---------------- Update Leave ---------------- */
  async function handleUpdate(id, from, to, reason) {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("trainer_leaves")
      .update({ from_date: from, to_date: to, reason })
      .eq("id", id)
      .eq("trainer_id", internalUser.id)
      .eq("status", "pending")
      .select()
      .single();

    if (error) {
      setError("Failed to update leave");
    } else {
      setLeaves((prev) => prev.map((l) => (l.id === id ? data : l)));
      setSuccess("✅ Leave updated");
    }

    setLoading(false);
  }

  /* ---------------- Delete Leave ---------------- */
  async function handleDelete(id) {
    setLoading(true);
    setError("");

    const { error } = await supabase
      .from("trainer_leaves")
      .delete()
      .eq("id", id)
      .eq("trainer_id", internalUser.id);

    if (error) {
      setError("Failed to delete leave");
    } else {
      setLeaves((prev) => prev.filter((l) => l.id !== id));
      setSuccess("✅ Leave deleted");
    }

    setLoading(false);
  }

  /* ---------------- UI ---------------- */
  if (!sessionUser) return <Typography>Please login</Typography>;
  if (!internalUser) return <Typography>Loading profile...</Typography>;

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", my: 3 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom>
          Trainer Leave Dashboard
        </Typography>

        {/* APPLY FORM */}
        <Box sx={{ display: "flex", gap: 2, flexDirection: "column", mb: 3 }}>
          <TextField
            type="date"
            label="From Date"
            InputLabelProps={{ shrink: true }}
            value={form.from_date}
            onChange={(e) =>
              setForm((p) => ({ ...p, from_date: e.target.value }))
            }
          />
          <TextField
            type="date"
            label="To Date"
            InputLabelProps={{ shrink: true }}
            value={form.to_date}
            onChange={(e) =>
              setForm((p) => ({ ...p, to_date: e.target.value }))
            }
          />
          <TextField
            label="Reason"
            value={form.reason}
            onChange={(e) =>
              setForm((p) => ({ ...p, reason: e.target.value }))
            }
          />

          <Button
            variant="contained"
            onClick={handleApply}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <CircularProgress size={18} sx={{ mr: 1 }} />
                Applying...
              </>
            ) : (
              "Apply Leave"
            )}
          </Button>
        </Box>

        {/* MESSAGE */}
        <Fade in={!!(error || success)}>
          <Alert severity={error ? "error" : "success"}>
            {error || success}
          </Alert>
        </Fade>

        {/* LEAVES */}
        <Typography variant="h6" sx={{ mt: 3 }}>
          My Leaves
        </Typography>

        {loading ? (
          <Typography>Loading...</Typography>
        ) : (
          leaves.map((l) => (
            <Box key={l.id} sx={{ borderBottom: "1px solid #ddd", py: 1 }}>
              {formatDateDDMMYYYY(l.from_date)} →{" "}
              {formatDateDDMMYYYY(l.to_date)} | {l.status}
            </Box>
          ))
        )}
      </Paper>
    </Box>
  );
}
