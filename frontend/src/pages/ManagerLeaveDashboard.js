import React, { useEffect, useState } from "react";
import axios from "axios";
import { Box, Paper, Typography, CircularProgress } from "@mui/material";

const API_BASE =
  process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

export default function ManagerLeaveDashboard() {
  const [holidays, setHolidays] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);

  const year = new Date().getFullYear();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const [holidayRes, leaveRes] = await Promise.all([
        axios.get(`${API_BASE}/api/holidays?year=${year}`),
        axios.get(`${API_BASE}/api/unavailability-requests`),
      ]);

      setHolidays(holidayRes.data || []);
      setLeaves(leaveRes.data || []);
    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", mt: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          Holiday & Trainer Leave Calendar (Data View)
        </Typography>

        <Typography variant="h6" sx={{ mt: 2 }}>
          Holidays
        </Typography>
        {holidays.map(h => (
          <Typography key={h.id}>
            📅 {h.holiday_date} — {h.name} ({h.type})
          </Typography>
        ))}

        <Typography variant="h6" sx={{ mt: 3 }}>
          Trainer Unavailability
        </Typography>
        {leaves.map(l => (
          <Typography key={l.id}>
            🚫 {l.trainer_name || l.trainer_email} | {l.start_date} →{" "}
            {l.end_date} | {l.status}
          </Typography>
        ))}
      </Paper>
    </Box>
  );
}
