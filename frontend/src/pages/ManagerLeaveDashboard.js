import React, { useEffect, useState, useRef } from "react";
import { supabase } from "../supabaseClient";
import {
  Paper,
  Typography,
  Button,
  Box,
  Alert,
  Select,
  MenuItem,
  TextField,
  CircularProgress,
} from "@mui/material";

const API_BASE =
  process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

function formatDate(d) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

export default function ManagerLeaveDashboard() {
  const [sessionUser, setSessionUser] = useState(null);
  const [internalUser, setInternalUser] = useState(null);
  const [leaves, setLeaves] = useState([]);

  const [view, setView] = useState("month");
  const [baseDate, setBaseDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingLeaves, setLoadingLeaves] = useState(false);
  const [error, setError] = useState("");

  const loadedRef = useRef(false);

  // ---------- session ----------
  useEffect(() => {
    const s = localStorage.getItem("userSession");
    if (s) setSessionUser(JSON.parse(s));
    setLoadingProfile(false);
  }, []);

  // ---------- manager profile ----------
  useEffect(() => {
    if (!sessionUser) return;

    async function loadUser() {
      setLoadingProfile(true);
      const { data, error } = await supabase
        .from("internal_users")
        .select("id,name,email,role")
        .eq("email", sessionUser.email)
        .single();

      if (error || !["manager", "admin"].includes(data.role)) {
        setError("Access denied");
      } else {
        setInternalUser(data);
      }
      setLoadingProfile(false);
    }

    loadUser();
  }, [sessionUser]);

  // ---------- load leaves ----------
  useEffect(() => {
    if (!internalUser) return;
    loadedRef.current = false;
    loadLeaves();
  }, [internalUser, view, baseDate]);

  async function loadLeaves() {
    if (loadedRef.current) return;
    loadedRef.current = true;

    setLoadingLeaves(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/leave/list?view=${view}&date=${baseDate}`
      );
      setLeaves(await res.json());
    } catch {
      setError("Failed to load leaves");
    }
    setLoadingLeaves(false);
  }

  async function decide(id, decision) {
    await fetch(`${API_BASE}/api/leave/${id}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decision,
        manager_id: internalUser.id,
        manager_name: internalUser.name,
        manager_email: internalUser.email,
      }),
    });
    loadedRef.current = false;
    loadLeaves();
  }

  // ---------- UI ----------
  if (loadingProfile)
    return (
      <Box sx={{ textAlign: "center", mt: 10 }}>
        <CircularProgress />
        <Typography mt={2}>Loading profile…</Typography>
      </Box>
    );

  if (error) return <Alert severity="error">{error}</Alert>;

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto", my: 4 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4">Manager Leave Dashboard</Typography>

        <Box sx={{ display: "flex", gap: 2, my: 2 }}>
          <Select value={view} onChange={(e) => setView(e.target.value)}>
            <MenuItem value="day">Day</MenuItem>
            <MenuItem value="week">Week</MenuItem>
            <MenuItem value="month">Month</MenuItem>
          </Select>

          <TextField
            type="date"
            value={baseDate}
            onChange={(e) => setBaseDate(e.target.value)}
          />
        </Box>

        {loadingLeaves ? (
          <CircularProgress />
        ) : (
          leaves.map((l) => (
            <Paper key={l.id} sx={{ p: 2, mb: 1 }}>
              <Typography>
                {l.trainer_name} | {formatDate(l.from_date)} →{" "}
                {formatDate(l.to_date)} | {l.status}
              </Typography>

              {l.status === "pending" && (
                <>
                  <Button
                    size="small"
                    onClick={() => decide(l.id, "approved")}
                  >
                    Approve
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    onClick={() => decide(l.id, "rejected")}
                  >
                    Reject
                  </Button>
                </>
              )}
            </Paper>
          ))
        )}
      </Paper>
    </Box>
  );
}
