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
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function ManagerLeaveDashboard({ user, token }) {
  const [requests, setRequests] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [selectedTrainerKey, setSelectedTrainerKey] = useState("all");

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
    const k = String(key || "").toLowerCase();
    if (!trainerHueMapRef.current[k]) {
      trainerHueMapRef.current[k] = hashString(k) % 360;
    }
    return trainerHueMapRef.current[k];
  };

  const getTrainerChipStyle = (key) => {
    const hue = getTrainerHue(key);
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

      setRequests(unavailRes.data || []);
      setHolidays(holRes.data || []);
      setTrainers(trainersRes.data || []);
    } catch {
      setRequests([]);
      setHolidays([]);
      setTrainers([]);
    }
  }

  useEffect(() => {
    loadAllData(cursor.getFullYear());
  }, [cursor.getFullYear()]);

  // ✅ FIXED FILTER LOGIC
  const dayEventsMap = useMemo(() => {
    const map = {};

    const filteredRequests =
      selectedTrainerKey === "all"
        ? requests
        : requests.filter((r) => {
            const reqKey =
              r.trainer_email?.toLowerCase() ||
              `id:${r.trainer_id}`;
            return reqKey === selectedTrainerKey;
          });

    filteredRequests.forEach((req) => {
      const start = new Date(req.start_date);
      const end = new Date(req.end_date || req.start_date);

      const cursorDate = new Date(start);
      while (cursorDate <= end) {
        const key = formatDate(cursorDate);
        if (!map[key]) map[key] = [];

        const trainerKey =
          req.trainer_email?.toLowerCase() ||
          `id:${req.trainer_id}`;

        map[key].push({
          id: `${req.id}-${key}`,
          trainer_name: req.trainer_name,
          trainer_key: trainerKey,
          reason: req.reason,
          category: "trainer",
        });

        cursorDate.setDate(cursorDate.getDate() + 1);
      }
    });

    holidays.forEach((h) => {
      const key = h.holiday_date;
      if (!map[key]) map[key] = [];
      map[key].push({
        id: `holiday-${key}`,
        category: h.type?.toLowerCase().includes("restricted")
          ? "optionalHoliday"
          : "holiday",
        reason: h.name,
      });
    });

    return map;
  }, [requests, holidays, selectedTrainerKey]);

  const renderDayCellEvents = (dateObj) => {
    const events = dayEventsMap[formatDate(dateObj)] || [];

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
            const s = getTrainerChipStyle(ev.trainer_key);
            bg = s.bg;
            color = s.text;
            border = s.border;
          }

          return (
            <Chip
              key={ev.id}
              size="small"
              label={ev.trainer_name || ev.reason}
              sx={{
                bgcolor: bg,
                color,
                border: `1px solid ${border}`,
                fontSize: 11,
              }}
            />
          );
        })}
      </Box>
    );
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap" }}>
        <Typography variant="h6">Trainer Leave Calendar</Typography>

        <FormControl size="small" sx={{ minWidth: 240 }}>
          <InputLabel>Trainer</InputLabel>
          <Select
            label="Trainer"
            value={selectedTrainerKey}
            onChange={(e) => setSelectedTrainerKey(e.target.value)}
          >
            <MenuItem value="all">
              <em>All Trainers</em>
            </MenuItem>

            {trainers.map((t) => {
              const key =
                t.email?.toLowerCase() || `id:${t.trainer_id || t.id}`;
              return (
                <MenuItem key={key} value={key}>
                  {t.name || t.trainer_name} ({t.email})
                </MenuItem>
              );
            })}
          </Select>
        </FormControl>
      </Box>

      {renderDayCellEvents(cursor)}
    </Paper>
  );
}

export default ManagerLeaveDashboard;
