// ManagerLeaveDashboard.js
import React, { useEffect, useMemo, useState } from "react";
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
  Button,
  Alert,
} from "@mui/material";
import { blue, deepPurple, green, red } from "@mui/material/colors";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";

const API_BASE =
  process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

/* ---------- Helpers ---------- */
const formatDate = (d) => {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const da = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${da}`;
};

function ManagerLeaveDashboard({ token }) {
  const [requests, setRequests] = useState([]);
  const [holidays, setHolidays] = useState([]);

  const [viewType, setViewType] = useState("month");
  const [cursor, setCursor] = useState(new Date());

  const [holidayFile, setHolidayFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null);

  const authHeaders = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );

  /* ---------- Load Data ---------- */
  const loadAllData = async (year) => {
    try {
      const [leaveRes, holidayRes] = await Promise.all([
        axios.get(`${API_BASE}/api/unavailability-requests`, {
          headers: authHeaders,
        }),
        axios.get(`${API_BASE}/api/holidays`, {
          headers: authHeaders,
          params: { year },
        }),
      ]);

      setRequests(leaveRes.data || []);
      setHolidays(holidayRes.data || []);
    } catch (err) {
      console.error(err);
      setRequests([]);
      setHolidays([]);
    }
  };

  useEffect(() => {
    loadAllData(cursor.getFullYear());
  }, [cursor]);

  /* ---------- Upload Holiday File ---------- */
  const handleUpload = async () => {
    if (!holidayFile) return;

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
        msg: "Holiday calendar uploaded successfully",
      });

      await loadAllData(cursor.getFullYear());
    } catch (err) {
      setUploadStatus({
        type: "error",
        msg:
          err.response?.data?.error ||
          "Failed to upload holiday calendar",
      });
    }
  };

  /* ---------- Merge Events ---------- */
  const dayEventsMap = useMemo(() => {
    const map = {};

    requests.forEach((r) => {
      const start = new Date(r.start_date);
      const end = new Date(r.end_date || r.start_date);
      const d = new Date(start);

      while (d <= end) {
        const key = formatDate(d);
        if (!map[key]) map[key] = [];

        map[key].push({
          id: `leave-${r.id}`,
          label: r.trainer_name,
          category: "trainer",
        });

        d.setDate(d.getDate() + 1);
      }
    });

    holidays.forEach((h) => {
      const key = h.holiday_date;
      if (!map[key]) map[key] = [];

      map[key].push({
        id: `holiday-${h.id}`,
        label: h.name,
        category:
          h.type.toLowerCase() === "restricted holiday"
            ? "restricted"
            : "holiday",
      });
    });

    return map;
  }, [requests, holidays]);

  /* ---------- Calendar Rendering ---------- */
  const renderEvents = (date) => {
    const key = formatDate(date);
    const events = dayEventsMap[key] || [];

    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
        {events.map((e) => {
          const isHoliday = e.category === "holiday";
          const isRestricted = e.category === "restricted";

          return (
            <Tooltip key={e.id} title={e.label}>
              <Chip
                size="small"
                label={e.label}
                sx={{
                  bgcolor: isHoliday
                    ? green[200]
                    : isRestricted
                    ? red[200]
                    : deepPurple[200],
                  color: "#000",
                  fontSize: 11,
                }}
              />
            </Tooltip>
          );
        })}
      </Box>
    );
  };

  /* ---------- Views ---------- */
  const renderMonthView = () => {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);

    const weeks = [];
    let day = 1 - first.getDay();

    while (day <= last.getDate()) {
      const week = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(y, m, day);
        week.push(d);
        day++;
      }
      weeks.push(week);
    }

    return (
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0.5 }}>
        {weeks.flat().map((d, i) => (
          <Box key={i} sx={{ border: "1px solid #ddd", p: 0.5, minHeight: 90 }}>
            <Typography variant="caption">{d.getDate()}</Typography>
            {renderEvents(d)}
          </Box>
        ))}
      </Box>
    );
  };

  /* ---------- Navigation ---------- */
  const goPrev = () =>
    setCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const goNext = () =>
    setCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="h6">Leave Calendar</Typography>
        <Box>
          <IconButton onClick={goPrev}>
            <ArrowBackIosNewIcon fontSize="small" />
          </IconButton>
          <IconButton onClick={goNext}>
            <ArrowForwardIosIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      <Box sx={{ mb: 2 }}>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={(e) => setHolidayFile(e.target.files[0])}
        />
        <Button size="small" variant="contained" onClick={handleUpload}>
          Upload Holiday Calendar
        </Button>
      </Box>

      {uploadStatus && (
        <Alert severity={uploadStatus.type}>{uploadStatus.msg}</Alert>
      )}

      {renderMonthView()}
    </Paper>
  );
}

export default ManagerLeaveDashboard;
