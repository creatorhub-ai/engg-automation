import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  CircularProgress,
} from "@mui/material";

const API = "https://engg-automation.onrender.com";

export default function ManagerLeaveDashboard() {
  const [user, setUser] = useState(null);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const s = localStorage.getItem("userSession");
    if (!s) {
      setError("Login required");
      setLoading(false);
      return;
    }
    setUser(JSON.parse(s));
  }, []);

  useEffect(() => {
    if (!user) return;

    async function loadLeaves() {
      try {
        const res = await fetch(`${API}/api/leave/list`);
        setLeaves(await res.json());
      } catch {
        setError("Failed to load leaves");
      }
      setLoading(false);
    }

    loadLeaves();
  }, [user]);

  async function decide(id, decision) {
    await fetch(`${API}/api/leave/${id}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });

    const reload = await fetch(`${API}/api/leave/list`);
    setLeaves(await reload.json());
  }

  if (loading) {
    return (
      <Box sx={{ textAlign: "center", mt: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) return <Alert severity="error">{error}</Alert>;

  return (
    <Box sx={{ maxWidth: 1000, mx: "auto", mt: 4 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4">Manager Leave Dashboard</Typography>

        {leaves.map((l) => (
          <Paper key={l.id} sx={{ p: 2, my: 1 }}>
            <Typography>
              {l.trainer_name} | {l.from_date} → {l.to_date} | {l.status}
            </Typography>

            {l.status === "pending" && (
              <>
                <Button onClick={() => decide(l.id, "approved")}>
                  Approve
                </Button>
                <Button
                  color="error"
                  onClick={() => decide(l.id, "rejected")}
                >
                  Reject
                </Button>
              </>
            )}
          </Paper>
        ))}
      </Paper>
    </Box>
  );
}
