import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
} from "@mui/material";

const API = "https://engg-automation.onrender.com";

export default function TrainerLeaveDashboard() {
  const [user, setUser] = useState(null);
  const [trainer, setTrainer] = useState(null);
  const [leaves, setLeaves] = useState([]);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reason, setReason] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // 1️⃣ Load session
  useEffect(() => {
    const s = localStorage.getItem("userSession");
    if (!s) {
      setError("Please login again");
      setLoading(false);
      return;
    }
    setUser(JSON.parse(s));
  }, []);

  // 2️⃣ Load trainer profile
  useEffect(() => {
    if (!user) return;

    async function loadProfile() {
      const { data, error } = await supabase
        .from("internal_users")
        .select("id,name,email")
        .eq("email", user.email)
        .single();

      if (error || !data) {
        setError("Trainer profile not found");
        setLoading(false);
        return;
      }

      setTrainer(data);
      setLoading(false);
    }

    loadProfile();
  }, [user]);

  // 3️⃣ Load leaves (NO FILTERING)
  useEffect(() => {
    if (!trainer) return;

    async function loadLeaves() {
      try {
        const res = await fetch(`${API}/api/leave/list`);
        const data = await res.json();

        const myLeaves = data.filter(
          (l) => l.trainer_id === trainer.id
        );

        setLeaves(myLeaves);
      } catch {
        setError("Failed to load leaves");
      }
    }

    loadLeaves();
  }, [trainer]);

  // 4️⃣ Apply leave (FIXED PAYLOAD)
  async function applyLeave() {
    setError("");
    setSuccess("");

    if (!fromDate || !toDate || !reason) {
      setError("All fields are required");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch(`${API}/api/leave/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trainer_id: trainer.id,
          from_date: fromDate,
          to_date: toDate,
          reason: reason,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Apply failed");
      }

      setSuccess("Leave applied successfully");
      setFromDate("");
      setToDate("");
      setReason("");

      // Reload leaves
      const reload = await fetch(`${API}/api/leave/list`);
      const allLeaves = await reload.json();
      setLeaves(allLeaves.filter(l => l.trainer_id === trainer.id));
    } catch (e) {
      setError(e.message);
    }

    setSaving(false);
  }

  if (loading) {
    return (
      <Box sx={{ textAlign: "center", mt: 10 }}>
        <CircularProgress />
        <Typography>Loading profile…</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", mt: 4 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4">Trainer Leave Dashboard</Typography>

        {error && <Alert severity="error" sx={{ my: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ my: 2 }}>{success}</Alert>}

        <Box sx={{ display: "flex", gap: 2, my: 3 }}>
          <TextField
            type="date"
            label="From"
            InputLabelProps={{ shrink: true }}
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
          <TextField
            type="date"
            label="To"
            InputLabelProps={{ shrink: true }}
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
          <TextField
            label="Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <Button
            variant="contained"
            disabled={saving}
            onClick={applyLeave}
          >
            {saving ? "Applying…" : "Apply"}
          </Button>
        </Box>

        {leaves.map((l) => (
          <Paper key={l.id} sx={{ p: 2, mb: 1 }}>
            <Typography>
              {l.from_date} → {l.to_date} | {l.status}
            </Typography>
          </Paper>
        ))}
      </Paper>
    </Box>
  );
}
