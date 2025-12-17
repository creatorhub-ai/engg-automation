// src/pages/ManagerLeaveDashboard.js
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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
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

export default function ManagerLeaveDashboard() {
  const [sessionUser, setSessionUser] = useState(null);
  const [internalUser, setInternalUser] = useState(null);

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  const [view, setView] = useState("month");
  const [baseDate, setBaseDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [selectedMonth, setSelectedMonth] = useState("");

  const [leaves, setLeaves] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ---------- load session ----------
  useEffect(() => {
    const stored = localStorage.getItem("userSession");
    if (!stored) {
      setLoadingProfile(false);
      return;
    }

    try {
      setSessionUser(JSON.parse(stored));
    } catch {
      setError("Invalid session data");
      setLoadingProfile(false);
    }
  }, []);

  // ---------- load internal user (FIXED) ----------
  useEffect(() => {
    if (!sessionUser) return;

    let active = true;

    async function loadInternalUser() {
      setLoadingProfile(true);
      setError("");

      const { data, error } = await supabase
        .from("internal_users")
        .select("*")
        .eq("email", sessionUser.email)
        .limit(1);

      if (!active) return;

      if (error) {
        setError("Failed to load profile");
        setLoadingProfile(false);
        return;
      }

      if (!data || data.length === 0) {
        setError(
          "Manager profile not found. Ask admin to create internal_users entry."
        );
        setLoadingProfile(false);
        return;
      }

      if (!["manager", "admin"].includes(data[0].role)) {
        setError("Access denied");
        setLoadingProfile(false);
        return;
      }

      setInternalUser(data[0]);
      setLoadingProfile(false);
    }

    loadInternalUser();
    return () => (active = false);
  }, [sessionUser]);

  // ---------- load leaves ----------
  useEffect(() => {
    if (internalUser) loadLeaves();
    // eslint-disable-next-line
  }, [internalUser, view, baseDate, selectedMonth]);

  async function loadLeaves() {
    setPageLoading(true);
    setError("");

    const dateObj = new Date(baseDate);
    let from, to;

    if (view === "day") {
      from = baseDate;
      to = baseDate;
    } else if (view === "week") {
      const day = dateObj.getDay();
      const monday = new Date(dateObj);
      monday.setDate(dateObj.getDate() - ((day + 6) % 7));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      from = monday.toISOString().slice(0, 10);
      to = sunday.toISOString().slice(0, 10);
    } else {
      const year = dateObj.getFullYear();
      const m =
        selectedMonth !== ""
          ? parseInt(selectedMonth, 10) - 1
          : dateObj.getMonth();
      from = new Date(year, m, 1).toISOString().slice(0, 10);
      to = new Date(year, m + 1, 0).toISOString().slice(0, 10);
    }

    const { data, error } = await supabase
      .from("trainer_leaves")
      .select(
        `*,
         internal_users!trainer_leaves_trainer_id_fkey(name,email)`
      )
      .lte("from_date", to)
      .gte("to_date", from)
      .order("from_date");

    if (error) {
      setError("Failed to load leaves");
    } else {
      setLeaves(data || []);
    }

    setPageLoading(false);
  }

  // ---------- approve / reject ----------
  async function decide(leaveId, decision) {
    setActionLoading(leaveId);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(
        `${API_BASE}/api/leave/${leaveId}/decision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision,
            manager_id: internalUser.id,
            manager_name: internalUser.name,
            manager_email: internalUser.email,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error);
      }

      setSuccess(`✅ Leave ${decision}`);
      await loadLeaves();
    } catch {
      setError("Decision failed");
    } finally {
      setActionLoading(null);
    }
  }

  // ---------- UI guards ----------
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

  // ---------- UI ----------
  return (
    <Box sx={{ maxWidth: 1100, mx: "auto", my: 4 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom>
          Manager Leave Dashboard
        </Typography>

        {(error || success) && (
          <Alert severity={error ? "error" : "success"} sx={{ mb: 2 }}>
            {error || success}
          </Alert>
        )}

        {pageLoading ? (
          <CircularProgress />
        ) : !leaves.length ? (
          <Typography>No leaves found</Typography>
        ) : (
          leaves.map((l) => (
            <Box key={l.id} sx={{ mb: 1 }}>
              <Typography>
                {l.internal_users?.name} |{" "}
                {formatDateDDMMYYYY(l.from_date)} →{" "}
                {formatDateDDMMYYYY(l.to_date)} | {l.status}
              </Typography>
              {l.status === "pending" && (
                <>
                  <Button
                    size="small"
                    onClick={() => decide(l.id, "approved")}
                    disabled={actionLoading === l.id}
                  >
                    Approve
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    onClick={() => decide(l.id, "rejected")}
                    disabled={actionLoading === l.id}
                  >
                    Reject
                  </Button>
                </>
              )}
            </Box>
          ))
        )}
      </Paper>
    </Box>
  );
}
