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

/* ✅ SAME PATTERN AS OTHER FRONTEND FILES */
const API_BASE =
  process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

function ManagerLeaveDashboard() {
  const [file, setFile] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showCalendar, setShowCalendar] = useState(false);

  /* ===============================
     UPLOAD HOLIDAY FILE
     =============================== */
  const handleUpload = async () => {
    if (!file) {
      setMessage("Please select a holiday Excel file");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setLoading(true);
      setMessage("");

      await axios.post(
        `${API_BASE}/api/holidays/upload`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      setMessage("✅ Holidays uploaded successfully");
      fetchHolidays();
    } catch (err) {
      console.error(err);
      setMessage("❌ Failed to upload holidays");
    } finally {
      setLoading(false);
    }
  };

  /* ===============================
     FETCH HOLIDAYS FOR CALENDAR
     =============================== */
  const fetchHolidays = async () => {
    try {
      setLoading(true);

      const res = await axios.get(`${API_BASE}/api/holidays`);

      if (!Array.isArray(res.data) || res.data.length === 0) {
        setMessage("No holidays found. Please upload a file.");
        setShowCalendar(false);
        return;
      }

      const calendarEvents = res.data.map((h) => ({
        id: h.id,
        title: h.name,
        date: h.holiday_date,
        allDay: true,
        backgroundColor:
          h.type === "Holiday" ? "#2e7d32" : "#d32f2f",
        borderColor:
          h.type === "Holiday" ? "#2e7d32" : "#d32f2f",
        textColor: "#ffffff",
      }));

      setEvents(calendarEvents);
      setShowCalendar(true);
    } catch (err) {
      console.error(err);
      setMessage("❌ Failed to load holidays");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", my: 3 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h4" sx={{ mb: 2 }}>
          Holiday Calendar
        </Typography>

        {/* ===============================
           UPLOAD SECTION
           =============================== */}
        {!showCalendar && (
          <Box sx={{ mb: 2 }}>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setFile(e.target.files[0])}
            />

            <Button
              sx={{ ml: 2 }}
              variant="contained"
              onClick={handleUpload}
              disabled={loading}
            >
              Upload Holidays
            </Button>
          </Box>
        )}

        {message && <Alert sx={{ mb: 2 }}>{message}</Alert>}

        {loading && <CircularProgress />}

        {/* ===============================
           GOOGLE-CALENDAR STYLE VIEW
           =============================== */}
        {showCalendar && (
          <FullCalendar
            plugins={[
              dayGridPlugin,
              timeGridPlugin,
              interactionPlugin,
            ]}
            initialView="dayGridMonth"
            height="80vh"
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,timeGridWeek,timeGridDay",
            }}
            events={events}
            eventDisplay="block"
          />
        )}
      </Paper>
    </Box>
  );
}

export default ManagerLeaveDashboard;
