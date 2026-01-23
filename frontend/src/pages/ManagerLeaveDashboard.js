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
  Button,
  Alert,
} from "@mui/material";
import { blue, deepPurple, green, red } from "@mui/material/colors";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";

const API_BASE =
  process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

function formatDate(d) {
  const year = d.getFullYear();
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

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
  const [holidays, setHolidays] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [selectedTrainerEmail, setSelectedTrainerEmail] = useState("all");

  const [viewType, setViewType] = useState("month");
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const trainerHueMapRef = useRef({});

  const [holidayFile, setHolidayFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null);

  const authHeaders = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );

  const getTrainerHue = (key) => {
    const k = String(key || "").trim().toLowerCase() || "trainer";
    const map = trainerHueMapRef.current;
    if (map[k] == null) {
      map[k] = hashString(k) % 360;
    }
    return map[k];
  };

  const getTrainerChipStyle = (trainerKey) => {
    const hue = getTrainerHue(trainerKey);
    return {
      bg: `hsl(${hue}, 75%, 88%)`,
      border: `hsl(${hue}, 70%, 75%)`,
      text: `hsl(${hue}, 55%, 25%)`,
    };
  };

  async function loadAllData(year) {
    try {
      const [unavailRes, holRes, trainersRes] = await Promise.all([
        axios.get(`${API_BASE}/api/unavailability-requests`, {
          headers: authHeaders,
        }),
        axios.get(`${API_BASE}/api/holidays`, {
          headers: authHeaders,
          params: { year },
        }),
        axios.get(`${API_BASE}/api/trainers`, {
          headers: authHeaders,
        }),
      ]);

      setRequests(Array.isArray(unavailRes.data) ? unavailRes.data : []);
      setHolidays(Array.isArray(holRes.data) ? holRes.data : []);
      setTrainers(Array.isArray(trainersRes.data) ? trainersRes.data : []);
    } catch {
      setRequests([]);
      setHolidays([]);
      setTrainers([]);
    }
  }

  useEffect(() => {
    loadAllData(cursor.getFullYear());
  }, [authHeaders, cursor]);

  // ✅ FINAL dayEventsMap (email + module_name based)
  const dayEventsMap = useMemo(() => {
    const map = {};

    const filteredRequests =
      selectedTrainerEmail === "all"
        ? requests
        : requests.filter(
            (r) =>
              String(r.trainer_email || "").toLowerCase() ===
              String(selectedTrainerEmail).toLowerCase()
          );

    filteredRequests.forEach((req) => {
      const start = new Date(req.start_date);
      const end = new Date(req.end_date || req.start_date);

      const modules =
        (req.module_name || "")
          .split(",")
          .map((m) => m.trim())
          .filter(Boolean);

      const cursorDate = new Date(start);
      while (cursorDate <= end) {
        const key = formatDate(cursorDate);
        if (!map[key]) map[key] = [];

        map[key].push({
          id: `leave-${req.id}-${key}`,
          trainer_name: req.trainer_name,
          trainer_key: req.trainer_email?.toLowerCase(),
          domain: req.domain,
          modules,
          category: "trainer",
        });

        cursorDate.setDate(cursorDate.getDate() + 1);
      }
    });

    holidays.forEach((h) => {
      const key = h.holiday_date;
      if (!map[key]) map[key] = [];

      const lower = (h.type || "").toLowerCase();
      const category = lower.includes("restricted")
        ? "optionalHoliday"
        : "holiday";

      map[key].push({
        id: `holiday-${key}`,
        trainer_name: "",
        trainer_key: "",
        domain: "",
        modules: [],
        reason: h.name,
        category,
      });
    });

    return map;
  }, [requests, holidays, selectedTrainerEmail]);

  const goPrev = () => {
    setCursor((prev) => {
      const d = new Date(prev);
      if (viewType === "month") d.setMonth(d.getMonth() - 1);
      else if (viewType === "week") d.setDate(d.getDate() - 7);
      else d.setDate(d.getDate() - 1);
      return d;
    });
  };

  const goNext = () => {
    setCursor((prev) => {
      const d = new Date(prev);
      if (viewType === "month") d.setMonth(d.getMonth() + 1);
      else if (viewType === "week") d.setDate(d.getDate() + 7);
      else d.setDate(d.getDate() + 1);
      return d;
    });
  };

  const handleViewChange = (_, next) => next && setViewType(next);

  const renderDayCellEvents = (dateObj) => {
    const key = formatDate(dateObj);
    const events = dayEventsMap[key] || [];

    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
        {events.map((ev) => {
          let bg, color, border = "transparent";

          if (ev.category === "holiday") {
            bg = green[200];
            color = green[900];
          } else if (ev.category === "optionalHoliday") {
            bg = red[200];
            color = red[900];
          } else {
            const style = getTrainerChipStyle(ev.trainer_key);
            bg = style.bg;
            color = style.text;
            border = style.border;
          }

          const tooltip =
            ev.category === "trainer"
              ? `${ev.trainer_name} (${ev.domain || ""})${
                  ev.modules.length
                    ? `\n📚 Modules: ${ev.modules.join(", ")}`
                    : ""
                }`
              : ev.reason || "Holiday";

          return (
            <Tooltip key={ev.id} title={tooltip} arrow>
              <Chip
                size="small"
                label={ev.trainer_name || ev.reason || "Holiday"}
                sx={{
                  bgcolor: bg,
                  color,
                  border: `1px solid ${border}`,
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

  /* -------- RENDERERS (UNCHANGED STRUCTURE) -------- */

  const year = cursor.getFullYear();
  const monthIndex = cursor.getMonth();
  const monthLabel = cursor.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  const renderMonthView = () => {
    const first = new Date(year, monthIndex, 1);
    const last = new Date(year, monthIndex + 1, 0);
    const startWeekday = first.getDay();

    const weeks = [];
    let day = 1 - startWeekday;

    while (day <= last.getDate()) {
      const week = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(year, monthIndex, day);
        d.setHours(0, 0, 0, 0);
        week.push(d);
        day++;
      }
      weeks.push(week);
    }

    return (
      <>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", mb: 1 }}>
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
            <Box key={d} sx={{ textAlign: "center", fontWeight: "bold" }}>{d}</Box>
          ))}
        </Box>

        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 0.5 }}>
          {weeks.flat().map((d, i) => (
            <Box key={i} sx={{ minHeight: 90, border: "1px solid #ddd", p: 0.5 }}>
              <Typography variant="caption" sx={{ fontWeight: "bold", textAlign: "right" }}>
                {d.getDate()}
              </Typography>
              {renderDayCellEvents(d)}
            </Box>
          ))}
        </Box>
      </>
    );
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" fontWeight="bold" mb={2}>
        Trainer Leave Calendar
      </Typography>

      <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
        <ToggleButtonGroup size="small" value={viewType} exclusive onChange={handleViewChange}>
          <ToggleButton value="day">Day</ToggleButton>
          <ToggleButton value="week">Week</ToggleButton>
          <ToggleButton value="month">Month</ToggleButton>
        </ToggleButtonGroup>

        <IconButton onClick={goPrev}><ArrowBackIosNewIcon fontSize="small" /></IconButton>
        <Typography>{monthLabel}</Typography>
        <IconButton onClick={goNext}><ArrowForwardIosIcon fontSize="small" /></IconButton>

        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel>Trainer</InputLabel>
          <Select
            label="Trainer"
            value={selectedTrainerEmail}
            onChange={(e) => setSelectedTrainerEmail(e.target.value)}
          >
            <MenuItem value="all"><em>All Trainers</em></MenuItem>
            {trainers.map((t) => (
              <MenuItem key={t.email} value={t.email}>
                {t.name || t.trainer_name} ({t.email})
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {viewType === "month" && renderMonthView()}
    </Paper>
  );
}

export default ManagerLeaveDashboard;
