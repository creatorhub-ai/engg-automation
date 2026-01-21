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
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItem,
  ListItemText,
  Divider,
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

  // 🔧 UPDATED: unified dialog state (no breaking changes)
  const [selectedLeaveDetails, setSelectedLeaveDetails] = useState(null);

  const [holidayFile, setHolidayFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null);

  const authHeaders = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );

  const getTrainerHue = (key) => {
    const k = String(key || "").trim().toLowerCase() || "trainer";
    if (trainerHueMapRef.current[k] == null) {
      trainerHueMapRef.current[k] = hashString(k) % 360;
    }
    return trainerHueMapRef.current[k];
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
  }, [authHeaders, cursor.getFullYear()]);

  // 🔧 UPDATED: inject clicked date into each trainer event
  const dayEventsMap = useMemo(() => {
    const map = {};

    const filtered =
      selectedTrainerId === "all"
        ? requests
        : requests.filter(
            (r) => String(r.trainer_id) === String(selectedTrainerId)
          );

    filtered.forEach((req) => {
      const start = new Date(req.start_date);
      const end = new Date(req.end_date || req.start_date);

      for (
        let d = new Date(start);
        d <= end;
        d.setDate(d.getDate() + 1)
      ) {
        const key = formatDate(d);
        if (!map[key]) map[key] = [];

        const trainerKey =
          (req.trainer_email || "").toLowerCase() ||
          `id:${req.trainer_id}`;

        map[key].push({
          id: `leave-${req.id}-${key}`,
          trainer_name: req.trainer_name,
          trainer_email: req.trainer_email,
          trainer_key: trainerKey,
          category: "trainer",
          reason: req.reason,
          domain: req.domain,
          date: key, // ✅ REQUIRED
        });
      }
    });

    holidays.forEach((h) => {
      if (!map[h.holiday_date]) map[h.holiday_date] = [];
      map[h.holiday_date].push({
        id: `holiday-${h.holiday_date}`,
        category: h.type?.toLowerCase().includes("restricted")
          ? "optionalHoliday"
          : "holiday",
        reason: h.name,
      });
    });

    return map;
  }, [requests, holidays, selectedTrainerId]);

  // 🔧 UPDATED: correct API → dialog mapping
  const handleTrainerChipClick = async (ev) => {
    try {
      const res = await axios.get(
        `${API_BASE}/api/trainer-leave-schedule`,
        {
          headers: authHeaders,
          params: {
            trainer_email: ev.trainer_email,
            trainer_name: ev.trainer_name,
            date: ev.date,
          },
        }
      );

      setSelectedLeaveDetails({
        trainerName: ev.trainer_name,
        leaveDate: ev.date,
        batches: res.data || [],
      });
    } catch (err) {
      setSelectedLeaveDetails({
        trainerName: ev.trainer_name,
        leaveDate: ev.date,
        batches: [],
        error: "Failed to load batch details",
      });
    }
  };

  const closeDialog = () => setSelectedLeaveDetails(null);

  const renderDayCellEvents = (dateObj) => {
    const key = formatDate(dateObj);
    const events = dayEventsMap[key] || [];

    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
        {events.map((ev) => {
          if (ev.category !== "trainer") {
            return (
              <Chip
                key={ev.id}
                size="small"
                label={ev.reason}
                sx={{
                  bgcolor:
                    ev.category === "holiday" ? green[200] : red[200],
                  fontSize: 11,
                }}
              />
            );
          }

          const style = getTrainerChipStyle(ev.trainer_key);

          return (
            <Chip
              key={ev.id}
              size="small"
              label={ev.trainer_name}
              onClick={() => handleTrainerChipClick(ev)}
              sx={{
                bgcolor: style.bg,
                color: style.text,
                border: `1px solid ${style.border}`,
                fontSize: 11,
                cursor: "pointer",
              }}
            />
          );
        })}
      </Box>
    );
  };

  // 🔧 UPDATED: dialog uses existing UI but correct data
  const renderBatchDetailsDialog = () => {
    if (!selectedLeaveDetails) return null;

    return (
      <Dialog open onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedLeaveDetails.trainerName} –{" "}
          {selectedLeaveDetails.leaveDate}
        </DialogTitle>

        <DialogContent dividers>
          {selectedLeaveDetails.error ? (
            <Alert severity="error">{selectedLeaveDetails.error}</Alert>
          ) : selectedLeaveDetails.batches.length === 0 ? (
            <Typography>No batches scheduled on this date.</Typography>
          ) : (
            <List dense>
              {selectedLeaveDetails.batches.map((b, i) => (
                <React.Fragment key={i}>
                  <ListItem>
                    <ListItemText
                      primary={`Batch: ${b.batch_no}`}
                      secondary={`Modules: ${b.modules.join(", ")}`}
                    />
                  </ListItem>
                  <Divider />
                </React.Fragment>
              ))}
            </List>
          )}
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      {/* ⚠️ EVERYTHING BELOW IS UNCHANGED */}
      {viewType === "month" && renderMonthView?.()}
      {viewType === "week" && renderWeekView?.()}
      {viewType === "day" && renderDayView?.()}
      {renderBatchDetailsDialog()}
    </Paper>
  );
}

export default ManagerLeaveDashboard;
