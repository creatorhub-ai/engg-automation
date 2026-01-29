import React, { useEffect, useState } from "react";
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

const API_BASE =
  process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function ManagerLeaveDashboard() {
  const [events, setEvents] = useState([]);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showCalendar, setShowCalendar] = useState(false);

  // Fetch holidays ONLY when calendar is allowed
  const fetchHolidays = async () => {
    try {
      setLoading(true);

      const res = await axios.get(`${API_BASE}/api/holidays`);

      if (res.data.length === 0) {
        setMessage("No holidays found. Please upload.");
        setShowCalendar(false);
        return;
      }

      const calendarEvents = res.data.map((h) => ({
        id: h.id,
        title: h.name,
        date: h.holiday_date,
        backgroundColor:
          h.type === "Holiday" ? "#2e7d32" : "#d32f2f",
        borderColor:
          h.type === "Holiday" ? "#2e7d32" : "#d32f2f",
        textColor: "#ffffff",
        allDay: true,
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

  // Upload holidays
  const uploadHolidays = async () => {
    if (!file) {
      setMessage("Please select a holiday file");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setLoading(true);

      await axios.post(
        `${API_BASE}/api/holidays/upload`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      setMessage("Holidays uploaded successfully");
      fetchHolidays();
    } catch (err) {
      console.error(err);
      setMessage("Holiday upload failed");
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
            Upload Holiday List
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

      {message && <Alert sx={{ mb: 2 }}>{message}</Alert>}

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
