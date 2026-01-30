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
  const [selectedTrainerId, setSelectedTrainerId] = useState("all");
  const [viewType, setViewType] = useState("month");
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const trainerHueMapRef = useRef({});
  const [holidayFile, setHolidayFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [error, setError] = useState(null); // New: For general API errors

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
    const bg = `hsl(${hue}, 75%, 88%)`;
    const border = `hsl(${hue}, 70%, 75%)`;
    const text = `hsl(${hue}, 55%, 25%)`;
    return { bg, border, text };
  };

  async function loadAllData(year) {
    try {
      setError(null); // Clear previous errors
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
    } catch (err) {
      setError("Failed to load data. Please try again.");
      console.error(err);
      setRequests([]);
      setHolidays([]);
      setTrainers([]);
    }
  }

  useEffect(() => {
    loadAllData(cursor.getFullYear());
  }, [authHeaders, cursor.getFullYear()]);

  const dayEventsMap = useMemo(() => {
    const map = {};
    const filteredRequests =
      selectedTrainerId === "all"
        ? requests
        : requests.filter(
            (r) => String(r.trainer_id) === String(selectedTrainerId)
          );
    filteredRequests.forEach((req) => {
      const start = new Date(req.start_date);
      const end = new Date(req.end_date || req.start_date);
      const leaveType =
        (req.leave_type || "").toLowerCase() ||
        (req.reason || "").toLowerCase();
      const cursorDate = new Date(start);
      while (cursorDate <= end) {
        const key = formatDate(cursorDate);
        if (!map[key]) map[key] = [];
        let category = "trainer";
        if (leaveType.includes("optional holiday")) {
          category = "optionalHoliday";
        } else if (leaveType.includes("holiday")) {
          category = "holiday";
        }
        const trainerKey =
          (req.trainer_email || "").trim().toLowerCase() ||
          (req.trainer_id != null ? `id:${req.trainer_id}` : "") ||
          (req.trainer_name || "").trim().toLowerCase();
        map[key].push({
          id: `leave-${req.id}-${key}`,
          trainer_name: req.trainer_name,
          trainer_key: trainerKey,
          domain: req.domain,
          reason: req.reason,
          category,
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
        reason: h.name,
        category,
      });
    });
    return map;
  }, [requests, holidays, selectedTrainerId]);

  const year = cursor.getFullYear();
  const monthIndex = cursor.getMonth();
  const monthLabel = cursor.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  const goPrev = () => {
    setCursor((prev) => {
      const d = new Date(prev);
      if (viewType === "month") {
        d.setMonth(d.getMonth() - 1);
        d.setDate(1);
      } else if (viewType === "week") {
        d.setDate(d.getDate() - 7);
      } else {
        d.setDate(d.getDate() - 1);
      }
      return d;
    });
  };

  const goNext = () => {
    setCursor((prev) => {
      const d = new Date(prev);
      if (viewType === "month") {
        d.setMonth(d.getMonth() + 1);
        d.setDate(1);
      } else if (viewType === "week") {
        d.setDate(d.getDate() + 7);
      } else {
        d.setDate(d.getDate() + 1);
      }
      return d;
    });
  };

  const handleViewChange = (_, next) => {
    if (!next) return;
    setViewType(next);
  };

  const handleHolidayFileChange = (e) => {
    const file = e.target.files?.[0];
    setHolidayFile(file || null);
    setUploadStatus(null);
  };

  const handleHolidayUpload = async () => {
    if (!holidayFile) {
      setUploadStatus({
        type: "error",
        msg: "Please select a holiday file to upload.",
      });
      return;
    }
    try {
      const formData = new FormData();
      formData.append("file", holidayFile);
      await axios.post(`${API_BASE}/api/holidays/upload`, formData, {
        headers: {
          ...authHeaders,
          "Content-Type": "multipart/form-data",
        },
      });
      setUploadStatus({
        type: "success",
        msg: "Holiday list uploaded and saved successfully.",
      });
      await loadAllData(cursor.getFullYear());
    } catch (err) {
      setUploadStatus({
        type: "error",
        msg:
          err.response?.data?.error ||
          "Failed to upload holiday list. Please check file format.",
      });
    }
  };

  const renderDayCellEvents = (dateObj) => {
    const key = formatDate(dateObj);
    const events = dayEventsMap[key] || [];
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
        {events.map((ev) => {
          let chipBg;
          let chipColor;
          let chipBorder = "transparent";
          if (ev.category === "holiday") {
            chipBg = green[200];
            chipColor = green[900];
          } else if (ev.category === "optionalHoliday") {
            chipBg = red[200];
            chipColor = red[900];
          } else {
            const style = getTrainerChipStyle(ev.trainer_key || ev.trainer_name);
            chipBg = style.bg;
            chipColor = style.text;
            chipBorder = style.border;
          }
          const label =
            ev.category === "trainer"
              ? (ev.trainer_name || "").trim() || "Trainer"
              : ev.category === "holiday"
              ? ev.reason || "Holiday"
              : ev.reason || "Optional Holiday";
          return (
            <Tooltip
              key={ev.id}
              title={`${ev.trainer_name || ""} ${
                ev.domain ? `(${ev.domain})` : ""
              }${ev.reason ? ` - ${ev.reason}` : ""}`}
              arrow
            >
              <Chip
                size="small"
                label={label}
                sx={{
                  bgcolor: chipBg,
                  color: chipColor,
                  border: `1px solid ${chipBorder}`,
                  fontSize: 11,
                  height: 22,
                  maxWidth: "100%",
                }}
              />
            </Tooltip>
          );
        })}
      </Box>
    );
  };

  // ... (rest of the render functions remain unchanged)

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      {error && (
        <Box sx={{ mb: 2 }}>
          <Alert severity="error">{error}</Alert>
        </Box>
      )}
      {/* Rest of the JSX remains unchanged, except in the trainer select: */}
      <FormControl size="small" sx={{ minWidth: 200 }}>
        <InputLabel>Trainer</InputLabel>
        <Select
          label="Trainer"
          value={selectedTrainerId}
          onChange={(e) => setSelectedTrainerId(e.target.value)}
        >
          <MenuItem value="all">
            <em>All Trainers</em>
          </MenuItem>
          {trainers.map((t) => {
            const key = t.email?.toLowerCase() || `id:${t.id}`; // Fixed: Use t.id instead of r.trainer_id
            return (
              <MenuItem key={key} value={key}>
                {t.name || t.trainer_name} ({t.email})
              </MenuItem>
            );
          })}
        </Select>
      </FormControl>
      {/* ... rest of the component */}
    </Paper>
  );
}

export default ManagerLeaveDashboard;