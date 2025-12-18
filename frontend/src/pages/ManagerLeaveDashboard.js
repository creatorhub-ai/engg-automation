// ManagerLeaveDashboard.js
import React, { useEffect, useMemo, useState, useRef } from "react";
import axios from "axios";
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Chip,
  Tooltip,
} from "@mui/material";
import {
  blue,
  deepPurple,
  green,
  red,
  indigo,
  teal,
  amber,
  pink,
} from "@mui/material/colors";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";

const API_BASE =
  process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

// Helper to format date as YYYY-MM-DD
function formatDate(d) {
  const year = d.getFullYear();
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Palette for trainer-specific colors
const TRAINER_COLORS = [
  { bg: deepPurple[100], border: deepPurple[200], text: deepPurple[900] },
  { bg: indigo[100], border: indigo[200], text: indigo[900] },
  { bg: teal[100], border: teal[200], text: teal[900] },
  { bg: amber[100], border: amber[200], text: amber[900] },
  { bg: pink[100], border: pink[200], text: pink[900] },
  { bg: blue[100], border: blue[200], text: blue[900] },
];

// Simple hash to map trainer name to stable index
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function ManagerLeaveDashboard({ user, token }) {
  const [requests, setRequests] = useState([]);
  const [monthCursor, setMonthCursor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });

  // Optional: map of trainerName -> color index, persisted in ref
  const trainerColorMapRef = useRef({});

  useEffect(() => {
    async function loadUnavailability() {
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await axios.get(`${API_BASE}/api/unavailability-requests`, {
          headers,
        });
        setRequests(Array.isArray(res.data) ? res.data : []);
      } catch {
        setRequests([]);
      }
    }
    loadUnavailability();
  }, [token]);

  // Build trainer -> color index map based on trainer names present
  const trainerColorMap = useMemo(() => {
    const map = { ...trainerColorMapRef.current };

    requests.forEach((req) => {
      const name = (req.trainer_name || "").trim();
      if (!name) return;
      if (!map[name]) {
        const idx = hashString(name) % TRAINER_COLORS.length;
        map[name] = idx;
      }
    });

    trainerColorMapRef.current = map;
    return map;
  }, [requests]);

  // Build a map of day -> events
  const dayEventsMap = useMemo(() => {
    const map = {};

    requests.forEach((req) => {
      const start = new Date(req.start_date);
      const end = new Date(req.end_date || req.start_date);

      const leaveType =
        (req.leave_type || "").toLowerCase() ||
        (req.reason || "").toLowerCase();

      const cursor = new Date(start);
      while (cursor <= end) {
        const key = formatDate(cursor);
        if (!map[key]) map[key] = [];

        let category = "trainer";
        if (leaveType.includes("optional holiday")) {
          category = "optionalHoliday";
        } else if (leaveType.includes("holiday")) {
          category = "holiday";
        }

        map[key].push({
          id: req.id,
          trainer_name: req.trainer_name,
          domain: req.domain,
          reason: req.reason,
          category,
        });

        cursor.setDate(cursor.getDate() + 1);
      }
    });

    return map;
  }, [requests]);

  const year = monthCursor.getFullYear();
  const monthIndex = monthCursor.getMonth();

  const firstDayOfMonth = new Date(year, monthIndex, 1);
  const lastDayOfMonth = new Date(year, monthIndex + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();

  // 0=Sunday, 1=Monday ...
  const startWeekday = firstDayOfMonth.getDay();

  const weeks = [];
  let currentDay = 1 - startWeekday; // to include prev month spill

  while (currentDay <= daysInMonth) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      const dateObj = new Date(year, monthIndex, currentDay);
      const isCurrentMonth = dateObj.getMonth() === monthIndex;
      const dateKey = formatDate(dateObj);
      const events = dayEventsMap[dateKey] || [];

      let bgColor = "white";
      let borderColor = "#e0e0e0";

      const hasHoliday = events.some((e) => e.category === "holiday");
      const hasOptional = events.some(
        (e) => e.category === "optionalHoliday"
      );
      const hasTrainerLeave = events.some(
        (e) => e.category === "trainer"
      );

      if (hasHoliday) {
        bgColor = green[50];
        borderColor = green[200];
      } else if (hasOptional) {
        bgColor = red[50];
        borderColor = red[200];
      } else if (hasTrainerLeave) {
        bgColor = deepPurple[50]; // base for cells containing trainer leaves
        borderColor = deepPurple[200];
      }

      week.push({
        dateObj,
        displayDay: dateObj.getDate(),
        isCurrentMonth,
        dateKey,
        events,
        bgColor,
        borderColor,
      });
      currentDay++;
    }
    weeks.push(week);
  }

  const monthLabel = monthCursor.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  const goPrevMonth = () => {
    setMonthCursor((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() - 1);
      return d;
    });
  };

  const goNextMonth = () => {
    setMonthCursor((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + 1);
      return d;
    });
  };

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          mb: 2,
          justifyContent: "space-between",
        }}
      >
        <Typography variant="h6" fontWeight="bold">
          Trainer Leave Calendar
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <IconButton size="small" onClick={goPrevMonth}>
            <ArrowBackIosNewIcon fontSize="small" />
          </IconButton>
          <Typography variant="subtitle1" fontWeight="medium">
            {monthLabel}
          </Typography>
          <IconButton size="small" onClick={goNextMonth}>
            <ArrowForwardIosIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {/* Legend */}
      <Box
        sx={{
          display: "flex",
          gap: 2,
          mb: 2,
          flexWrap: "wrap",
          fontSize: 14,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box
            sx={{
              width: 16,
              height: 16,
              bgcolor: red[50],
              border: `1px solid ${red[200]}`,
            }}
          />
          <Typography variant="body2">Optional Holiday</Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box
            sx={{
              width: 16,
              height: 16,
              bgcolor: green[50],
              border: `1px solid ${green[200]}`,
            }}
          />
          <Typography variant="body2">Holiday</Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box
            sx={{
              width: 16,
              height: 16,
              bgcolor: deepPurple[50],
              border: `1px solid ${deepPurple[200]}`,
            }}
          />
          <Typography variant="body2">Trainer Leave (per-trainer color)</Typography>
        </Box>
      </Box>

      {/* Weekday headers */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          borderBottom: "1px solid #e0e0e0",
          pb: 1,
          mb: 1,
        }}
      >
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <Box
            key={d}
            sx={{
              textAlign: "center",
              fontWeight: "bold",
              color: blue[800],
              fontSize: 13,
            }}
          >
            {d}
          </Box>
        ))}
      </Box>

      {/* Calendar grid */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 0.5,
        }}
      >
        {weeks.map((week, wi) =>
          week.map((day, di) => (
            <Box
              key={`${wi}-${di}`}
              sx={{
                minHeight: 90,
                borderRadius: 1,
                border: `1px solid ${day.borderColor}`,
                bgcolor: day.isCurrentMonth ? day.bgColor : "#fafafa",
                opacity: day.isCurrentMonth ? 1 : 0.5,
                p: 0.5,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontWeight: "bold",
                  mb: 0.5,
                  textAlign: "right",
                }}
              >
                {day.displayDay}
              </Typography>

              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                {day.events.map((ev, idx) => {
                  let chipBg;
                  let chipColor;

                  if (ev.category === "holiday") {
                    chipBg = green[200];
                    chipColor = green[900];
                  } else if (ev.category === "optionalHoliday") {
                    chipBg = red[200];
                    chipColor = red[900];
                  } else {
                    // Trainer leave: use trainer-specific color
                    const name = (ev.trainer_name || "Trainer").trim();
                    const colorIdx =
                      trainerColorMap[name] ?? 0;
                    const palette = TRAINER_COLORS[colorIdx];
                    chipBg = palette.bg;
                    chipColor = palette.text;
                  }

                  const label =
                    ev.category === "trainer"
                      ? ev.trainer_name || "Trainer Leave"
                      : ev.category === "holiday"
                      ? "Holiday"
                      : "Optional Holiday";

                  return (
                    <Tooltip
                      key={`${ev.id}-${idx}`}
                      title={`${ev.trainer_name || ""} ${
                        ev.domain ? `(${ev.domain})` : ""
                      } - ${ev.reason || ""}`}
                      arrow
                    >
                      <Chip
                        size="small"
                        label={label}
                        sx={{
                          bgcolor: chipBg,
                          color: chipColor,
                          fontSize: 11,
                          height: 22,
                          maxWidth: "100%",
                        }}
                      />
                    </Tooltip>
                  );
                })}
              </Box>
            </Box>
          ))
        )}
      </Box>
    </Paper>
  );
}

export default ManagerLeaveDashboard;
