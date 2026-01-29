import React, { useEffect, useState } from "react";
import axios from "axios";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

import { Box, Paper, Typography, CircularProgress, Alert } from "@mui/material";

// Change if needed
const API_BASE = "http://localhost:5000";

export default function ManagerLeaveDashboard() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch holidays from backend
  useEffect(() => {
    fetchHolidays();
  }, []);

  const fetchHolidays = async () => {
    try {
      setLoading(true);

      const res = await axios.get(`${API_BASE}/api/holidays`);

      /*
        Backend returns:
        [
          {
            id,
            holiday_date,
            name,
            type
          }
        ]
      */

      const calendarEvents = res.data.map((holiday) => ({
        id: holiday.id,
        title: holiday.name,
        date: holiday.holiday_date,

        // Color logic
        backgroundColor:
          holiday.type === "Holiday" ? "#2e7d32" : "#d32f2f",
        borderColor:
          holiday.type === "Holiday" ? "#2e7d32" : "#d32f2f",

        textColor: "#ffffff",
        allDay: true,
      }));

      setEvents(calendarEvents);
      setError("");
    } catch (err) {
      console.error(err);
      setError("Failed to load holidays");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
        Holiday Calendar
      </Typography>

      <Paper sx={{ p: 2 }}>
        {loading && (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {error && <Alert severity="error">{error}</Alert>}

        {!loading && !error && (
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
            dayMaxEvents={true}

            // Tooltip on hover
            eventMouseEnter={(info) => {
              info.el.style.cursor = "pointer";
            }}
          />
        )}
      </Paper>
    </Box>
  );
}
