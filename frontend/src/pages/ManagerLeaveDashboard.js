// ManagerLeaveDashboard.js
import React, {
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";
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

function formatDate(d) {
  const year = d.getFullYear();
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const TRAINER_COLORS = [
  { bg: deepPurple[100], border: deepPurple[200], text: deepPurple[900] },
  { bg: indigo[100], border: indigo[200], text: indigo[900] },
  { bg: teal[100], border: teal[200], text: teal[900] },
  { bg: amber[100], border: amber[200], text: amber[900] },
  { bg: pink[100], border: pink[200], text: pink[900] },
  { bg: blue[100], border: blue[200], text: blue[900] },
];

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

  const [viewType, setViewType] = useState("month"); // 'month' | 'week' | 'day'
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const trainerColorMapRef = useRef({});

  // NEW: upload state
  const [holidayFile, setHolidayFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null); // { type: 'success'|'error', msg: string }

  const authHeaders = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );

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
        axios.get(`${API_BASE}/api/internal-users/trainers`, {
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
  }, [authHeaders, cursor.getFullYear()]);

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

  // Merge leave + holidays into dayEventsMap, with name filter applied
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

        map[key].push({
          id: `leave-${req.id}-${key}`,
          trainer_name: req.trainer_name,
          domain: req.domain,
          reason: req.reason,
          category,
        });

        cursorDate.setDate(cursorDate.getDate() + 1);
      }
    });

    holidays.forEach((h) => {
      const key = h.holiday_date; // yyyy-mm-dd
      if (!map[key]) map[key] = [];
      const lower = (h.type || "").toLowerCase();
      const category = lower.includes("restricted")
        ? "optionalHoliday"
        : "holiday";

      map[key].push({
        id: `holiday-${key}`,
        trainer_name: "",
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

  // NEW: handle holiday file upload (PDF / Excel as per backend)
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

      // Reload holidays for current year so calendar updates
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

          if (ev.category === "holiday") {
            chipBg = green[200];
            chipColor = green[900];
          } else if (ev.category === "optionalHoliday") {
            chipBg = red[200];
            chipColor = red[900];
          } else {
            const name = (ev.trainer_name || "Trainer").trim();
            const idx = trainerColorMap[name] ?? 0;
            const palette = TRAINER_COLORS[idx];
            chipBg = palette.bg;
            chipColor = palette.text;
          }

          const label =
            ev.category === "trainer"
              ? ev.trainer_name || "Trainer Leave"
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

  const renderMonthView = () => {
    const firstDayOfMonth = new Date(year, monthIndex, 1);
    const lastDayOfMonth = new Date(year, monthIndex + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    const startWeekday = firstDayOfMonth.getDay();

    const weeks = [];
    let currentDay = 1 - startWeekday;

    while (currentDay <= daysInMonth) {
      const week = [];
      for (let i = 0; i < 7; i++) {
        const dateObj = new Date(year, monthIndex, currentDay);
        dateObj.setHours(0, 0, 0, 0);
        const isCurrentMonth = dateObj.getMonth() === monthIndex;
        const key = formatDate(dateObj);
        const events = dayEventsMap[key] || [];

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
          bgColor = deepPurple[50];
          borderColor = deepPurple[200];
        }

        week.push({
          dateObj,
          displayDay: dateObj.getDate(),
          isCurrentMonth,
          bgColor,
          borderColor,
        });
        currentDay++;
      }
      weeks.push(week);
    }

    return (
      <>
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
                {renderDayCellEvents(day.dateObj)}
              </Box>
            ))
          )}
        </Box>
      </>
    );
  };

  const renderWeekView = () => {
    const startOfWeek = new Date(cursor);
    const day = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - day);
    startOfWeek.setHours(0, 0, 0, 0);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      d.setHours(0, 0, 0, 0);
      days.push(d);
    }

    return (
      <>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            borderBottom: "1px solid #e0e0e0",
            pb: 1,
            mb: 1,
          }}
        >
          {days.map((d) => (
            <Box
              key={d.toISOString()}
              sx={{
                textAlign: "center",
                fontWeight: "bold",
                color: blue[800],
                fontSize: 13,
              }}
            >
              {d.toLocaleDateString("default", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
            </Box>
          ))}
        </Box>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: 0.5,
          }}
        >
          {days.map((d) => {
            const key = formatDate(d);
            const events = dayEventsMap[key] || [];

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
              bgColor = deepPurple[50];
              borderColor = deepPurple[200];
            }

            return (
              <Box
                key={key}
                sx={{
                  minHeight: 120,
                  borderRadius: 1,
                  border: `1px solid ${borderColor}`,
                  bgcolor: bgColor,
                  p: 0.75,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {renderDayCellEvents(d)}
              </Box>
            );
          })}
        </Box>
      </>
    );
  };

  const renderDayView = () => {
    const d = new Date(cursor);
    d.setHours(0, 0, 0, 0);

    return (
      <Box
        sx={{
          borderRadius: 1,
          border: "1px solid #e0e0e0",
          p: 1.5,
          minHeight: 150,
        }}
      >
        <Typography
          variant="subtitle1"
          sx={{ fontWeight: "bold", mb: 1 }}
        >
          {d.toLocaleDateString("default", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </Typography>
        {renderDayCellEvents(d)}
      </Box>
    );
  };

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          mb: 2,
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="h6" fontWeight="bold">
            Trainer Leave Calendar
          </Typography>
          <ToggleButtonGroup
            size="small"
            value={viewType}
            exclusive
            onChange={handleViewChange}
          >
            <ToggleButton value="day">Day</ToggleButton>
            <ToggleButton value="week">Week</ToggleButton>
            <ToggleButton value="month">Month</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <IconButton size="small" onClick={goPrev}>
            <ArrowBackIosNewIcon fontSize="small" />
          </IconButton>
          <Typography variant="subtitle1" fontWeight="medium">
            {viewType === "month"
              ? monthLabel
              : cursor.toLocaleDateString("default", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
          </Typography>
          <IconButton size="small" onClick={goNext}>
            <ArrowForwardIosIcon fontSize="small" />
          </IconButton>
        </Box>

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
            {trainers.map((t) => (
              <MenuItem key={t.id} value={t.id}>
                {t.name} ({t.email})
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Holiday file upload area */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          mb: 2,
          flexWrap: "wrap",
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: "bold" }}>
          Upload Holiday List (updates holidays table)
        </Typography>
        <input
          type="file"
          accept=".xlsx,.xls,.csv,.pdf"
          onChange={handleHolidayFileChange}
          style={{ maxWidth: 260 }}
        />
        <Button
          variant="contained"
          size="small"
          onClick={handleHolidayUpload}
          disabled={!holidayFile}
        >
          Upload
        </Button>
      </Box>

      {uploadStatus && (
        <Box sx={{ mb: 2 }}>
          <Alert severity={uploadStatus.type}>
            {uploadStatus.msg}
          </Alert>
        </Box>
      )}

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
          <Typography variant="body2">
            Restricted / Optional Holiday
          </Typography>
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
          <Typography variant="body2">
            Trainer Leave (per-trainer color)
          </Typography>
        </Box>
      </Box>

      {viewType === "month" && renderMonthView()}
      {viewType === "week" && renderWeekView()}
      {viewType === "day" && renderDayView()}
    </Paper>
  );
}

export default ManagerLeaveDashboard;
