import React, { useEffect, useState } from "react";
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

// ---------- UTILS ----------
function formatDate(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
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
  const [pageLoading, setPageLoading] = useState(false);
  const [error, setError] = useState("");

  // ---------- LOAD SESSION ----------
  useEffect(() => {
    const stored = localStorage.getItem("userSession");
    if (stored) setSessionUser(JSON.parse(stored));
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

      if (error || !["manager", "admin"].includes(data.role)) {
        setError("Access denied");
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
  }, [internalUser, view, baseDate]);

  async function loadLeaves() {
    setPageLoading(true);
    const res = await fetch(
      `${API_BASE}/api/leave/list?view=${view}&date=${baseDate}`
    );
    const data = await res.json();
    setLeaves(data || []);
    setPageLoading(false);
  }

  // ---------- APPROVE / REJECT ----------
  async function decide(id, decision) {
    await fetch(`${API_BASE}/api/leave/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leave_id: id,
        decision,
        manager_name: internalUser.name,
        manager_email: internalUser.email,
      }),
    });
    loadLeaves();
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

  if (error) return <Alert severity="error">{error}</Alert>;

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto", my: 4 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom>
          Manager Leave Dashboard
        </Typography>

        <Box sx={{ display: "flex", gap: 2, mb: 3 }}>
          <Select value={view} onChange={(e) => setView(e.target.value)}>
            <MenuItem value="date">Date</MenuItem>
            <MenuItem value="week">Week</MenuItem>
            <MenuItem value="month">Month</MenuItem>
          </Select>

          <TextField
            type={view === "month" ? "month" : "date"}
            value={baseDate}
            onChange={(e) => setBaseDate(e.target.value)}
          />
        </Box>

        {pageLoading ? (
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
