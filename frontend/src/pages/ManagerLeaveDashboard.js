import React, { useState } from "react";
import axios from "axios";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  CircularProgress,
} from "@mui/material";

/* SAME PATTERN AS YOUR OTHER FILES */
const API_BASE =
  process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

export default function ManagerLeaveDashboard() {
  const [file, setFile] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const uploadHolidays = async () => {
    if (!file) return setMsg("Please select an Excel file");

    try {
      setLoading(true);
      setMsg("");

      const formData = new FormData();
      formData.append("file", file);

      await axios.post(`${API_BASE}/api/holidays/upload`, formData);

      setMsg("✅ Holidays uploaded successfully");
      loadCalendar();
    } catch (e) {
      console.error(e);
      setMsg("❌ Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const loadCalendar = async () => {
    const res = await axios.get(`${API_BASE}/api/holidays`);

    const ev = res.data.map((h) => ({
      title: h.name,
      date: h.holiday_date,
      allDay: true,
      backgroundColor:
        h.type === "Holiday" ? "#2e7d32" : "#d32f2f",
      borderColor:
        h.type === "Holiday" ? "#2e7d32" : "#d32f2f",
      textColor: "#fff",
    }));

    setEvents(ev);
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", mt: 3 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Holiday Calendar
        </Typography>

        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => setFile(e.target.files[0])}
        />

        <Button sx={{ ml: 2 }} variant="contained" onClick={uploadHolidays}>
          Upload
        </Button>

        {loading && <CircularProgress sx={{ ml: 2 }} />}
        {msg && <Alert sx={{ mt: 2 }}>{msg}</Alert>}

        {events.length > 0 && (
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            height="75vh"
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,timeGridWeek,timeGridDay",
            }}
            events={events}
          />
        )}
      </Paper>
    </Box>
  );
}
