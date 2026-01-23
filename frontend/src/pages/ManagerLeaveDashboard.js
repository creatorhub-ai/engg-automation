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
  ToggleButton,
  ToggleButtonGroup,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import { blue, deepPurple, green, red } from "@mui/material/colors";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";

const API_BASE =
  process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

/* ---------- HELPERS ---------- */
function formatDate(d) {
  return d.toISOString().split("T")[0];
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/* ---------- COMPONENT ---------- */
function ManagerLeaveDashboard({ token }) {
  const [requests, setRequests] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [selectedTrainer, setSelectedTrainer] = useState("all");

  const [viewType, setViewType] = useState("month");
  const [cursor, setCursor] = useState(new Date());

  const trainerHueMap = useRef({});

  const authHeaders = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  /* ---------- COLORS ---------- */
  const getTrainerColor = (email) => {
    const key = email?.toLowerCase() || "trainer";
    if (!trainerHueMap.current[key]) {
      trainerHueMap.current[key] = hashString(key) % 360;
    }
    const hue = trainerHueMap.current[key];
    return {
      bg: `hsl(${hue}, 75%, 88%)`,
      border: `hsl(${hue}, 70%, 70%)`,
      text: `hsl(${hue}, 55%, 25%)`,
    };
  };

  /* ---------- LOAD DATA ---------- */
  useEffect(() => {
    (async () => {
      try {
        const [l, h, t] = await Promise.all([
          axios.get(`${API_BASE}/api/unavailability-requests`, {
            headers: authHeaders,
          }),
          axios.get(`${API_BASE}/api/holidays`, {
            headers: authHeaders,
            params: { year: cursor.getFullYear() },
          }),
          axios.get(`${API_BASE}/api/trainers`, {
            headers: authHeaders,
          }),
        ]);
        setRequests(l.data || []);
        setHolidays(h.data || []);
        setTrainers(t.data || []);
      } catch {
        setRequests([]);
        setHolidays([]);
        setTrainers([]);
      }
    })();
  }, [cursor, token]);

  /* ---------- BUILD EVENTS MAP ---------- */
  const dayEventsMap = useMemo(() => {
    const map = {};

    const filtered =
      selectedTrainer === "all"
        ? requests
        : requests.filter(
            (r) =>
              r.trainer_email?.toLowerCase() ===
              selectedTrainer.toLowerCase()
          );

    filtered.forEach((r) => {
      const start = new Date(r.start_date);
      const end = new Date(r.end_date || r.start_date);

      const modules =
        r.module_name?.split(",").map((m) => m.trim()) || [];

      const d = new Date(start);
      while (d <= end) {
        const key = formatDate(d);
        if (!map[key]) map[key] = [];

        map[key].push({
          id: `${r.id}-${key}`,
          trainer: r.trainer_name,
          email: r.trainer_email,
          domain: r.domain,
          modules,
          type: "leave",
        });

        d.setDate(d.getDate() + 1);
      }
    });

    holidays.forEach((h) => {
      const key = h.holiday_date;
      if (!map[key]) map[key] = [];
      map[key].push({
        id: `h-${key}`,
        name: h.name,
        type: h.type?.toLowerCase().includes("restricted")
          ? "optional"
          : "holiday",
      });
    });

    return map;
  }, [requests, holidays, selectedTrainer]);

  /* ---------- DAY CELL ---------- */
  const renderDayEvents = (date) => {
    const events = dayEventsMap[formatDate(date)] || [];

    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
        {events.map((e) => {
          let bg, color, border;

          if (e.type === "holiday") {
            bg = green[200];
            color = green[900];
          } else if (e.type === "optional") {
            bg = red[200];
            color = red[900];
          } else {
            const c = getTrainerColor(e.email);
            bg = c.bg;
            color = c.text;
            border = c.border;
          }

          const tooltip =
            e.type === "leave"
              ? `${e.trainer} (${e.domain || ""})${
                  e.modules.length
                    ? `\n📚 ${e.modules.join(", ")}`
                    : ""
                }`
              : e.name;

          return (
            <Tooltip key={e.id} title={tooltip} arrow>
              <Chip
                size="small"
                label={e.trainer || e.name}
                sx={{
                  bgcolor: bg,
                  color,
                  border: border ? `1px solid ${border}` : "none",
                  fontSize: 11,
                  height: 22,
                }}
              />
            </Tooltip>
          );
        })}
      </Box>
    );
  };

  /* ---------- MONTH VIEW ---------- */
  const renderMonthView = () => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const startDay = first.getDay();
    let day = 1 - startDay;

    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(year, month, day++);
      cells.push(d);
    }

    return (
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 0.5 }}>
        {cells.map((d, i) => {
          const key = formatDate(d);
          const hasEvent = dayEventsMap[key]?.length;

          return (
            <Box
              key={i}
              sx={{
                minHeight: 90,
                p: 0.5,
                border: "1px solid #ddd",
                bgcolor: hasEvent ? deepPurple[50] : "#fff",
                opacity: d.getMonth() === month ? 1 : 0.4,
              }}
            >
              <Typography
                variant="caption"
                sx={{ fontWeight: "bold", textAlign: "right" }}
              >
                {d.getDate()}
              </Typography>
              {renderDayEvents(d)}
            </Box>
          );
        })}
      </Box>
    );
  };

  /* ---------- NAV ---------- */
  const move = (dir) => {
    const d = new Date(cursor);
    if (viewType === "month") d.setMonth(d.getMonth() + dir);
    else d.setDate(d.getDate() + dir);
    setCursor(d);
  };

  /* ---------- RENDER ---------- */
  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="h6" fontWeight="bold">
          Trainer Leave Calendar
        </Typography>

        <ToggleButtonGroup
          size="small"
          value={viewType}
          exclusive
          onChange={(_, v) => v && setViewType(v)}
        >
          <ToggleButton value="day">Day</ToggleButton>
          <ToggleButton value="week">Week</ToggleButton>
          <ToggleButton value="month">Month</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
        <IconButton onClick={() => move(-1)}>
          <ArrowBackIosNewIcon fontSize="small" />
        </IconButton>

        <Typography>
          {cursor.toLocaleDateString("default", {
            month: "long",
            year: "numeric",
          })}
        </Typography>

        <IconButton onClick={() => move(1)}>
          <ArrowForwardIosIcon fontSize="small" />
        </IconButton>

        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel>Trainer</InputLabel>
          <Select
            label="Trainer"
            value={selectedTrainer}
            onChange={(e) => setSelectedTrainer(e.target.value)}
          >
            <MenuItem value="all">All Trainers</MenuItem>
            {trainers.map((t) => (
              <MenuItem key={t.email} value={t.email}>
                {t.name || t.trainer_name} ({t.email})
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {renderMonthView()}
    </Paper>
  );
}

export default ManagerLeaveDashboard;
