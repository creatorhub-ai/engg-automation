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

// 🔴 NEVER hardcode localhost in deployed apps
const API_BASE = process.env.REACT_APP_API_URL;

export default function ManagerLeaveDashboard() {
  const [events, setEvents] = useState([]);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showCalendar, setShowCalendar] = useState(false);

  // 🔹 Upload holidays
  const uploadHolidays = async () => {
    if (!file) {
      setMessage("Please select a holiday file");
      return;
    }

    if (!API_BASE) {
      setMessage("Backend URL not configured");
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

      setMessage("Holidays uploaded successfully");
      fetchHolidays();
    } catch (err) {
      console.error(err);
      setMessage("Upload failed. Please check backend connectivity.");
    } finally {
      setLoading(false);
    }
  };

  // 🔹 Fetch holidays AFTER upload
  const fetchHolidays = async () => {
    try {
      setLoading(true);

      const res = await axios.get(`${API_BASE}/api/holidays`);

      if (!res.data || res.data.length === 0) {
        setMessage("No holidays found.");
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
      setMessage("Failed to load holidays");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Holiday Calendar
      </Typography>

      {/* Upload Section */}
      {!showCalendar && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography sx={{ mb: 1 }}>
            Upload Holiday Excel File
          </Typography>

          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => setFile(e.target.files[0])}
          />

          <Button
            variant="contained"
            sx={{ ml: 2 }}
            onClick={uploadHolidays}
            disabled={loading}
          >
            Upload
          </Button>
        </Paper>
      )}

      {message && (
        <Alert sx={{ mb: 2 }} severity="info">
          {message}
        </Alert>
      )}

      {loading && <CircularProgress />}

      {/* Calendar */}
      {showCalendar && (
        <Paper sx={{ p: 2 }}>
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
        </Paper>
      )}
    </Box>
  );
}
