import React, { useState, useEffect } from "react";
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
  process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

export default function ManagerLeaveDashboard() {
  const [file, setFile] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // Load calendar on component mount
  useEffect(() => {
    loadCalendar();
  }, []);

  const uploadHolidays = async () => {
    if (!file) {
      setMsg("⚠️ Please select an Excel file");
      return;
    }

    try {
      setLoading(true);
      setMsg("");
      
      const formData = new FormData();
      formData.append("file", file);

      console.log("Uploading file:", file.name);

      // ✅ FIX: Correct axios syntax (no template literals in method call)
      const response = await axios.post(
        `${API_BASE}/api/holidays/upload`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      console.log("Upload response:", response.data);
      setMsg(`✅ ${response.data.message || "Holidays uploaded successfully"}`);
      setFile(null); // Clear file input
      
      // Reload calendar after successful upload
      await loadCalendar();
    } catch (e) {
      console.error("Upload error:", e);
      const errorMsg = e.response?.data?.message || e.message || "Upload failed";
      setMsg(`❌ ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const loadCalendar = async () => {
    try {
      console.log("Loading calendar...");
      
      // ✅ FIX: Correct axios syntax
      const res = await axios.get(`${API_BASE}/api/holidays`);
      
      console.log("Holidays loaded:", res.data.length);

      const ev = res.data.map((h) => ({
        title: h.name,
        date: h.holiday_date,
        allDay: true,
        backgroundColor: h.type === "Holiday" ? "#2e7d32" : "#d32f2f",
        borderColor: h.type === "Holiday" ? "#2e7d32" : "#d32f2f",
        textColor: "#fff",
      }));
      
      setEvents(ev);
    } catch (error) {
      console.error("Error loading calendar:", error);
      setMsg("⚠️ Failed to load holidays");
    }
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", mt: 3, p: 2 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Holiday Calendar Manager
        </Typography>

        <Box sx={{ mb: 3, display: "flex", alignItems: "center", gap: 2 }}>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => setFile(e.target.files[0])}
            style={{ padding: "8px" }}
          />
          <Button
            variant="contained"
            onClick={uploadHolidays}
            disabled={loading || !file}
          >
            {loading ? "Uploading..." : "Upload Holidays"}
          </Button>
          {loading && <CircularProgress size={24} />}
        </Box>

        {msg && (
          <Alert 
            severity={msg.includes("✅") ? "success" : msg.includes("⚠️") ? "warning" : "error"} 
            sx={{ mb: 2 }}
            onClose={() => setMsg("")}
          >
            {msg}
          </Alert>
        )}

        {events.length > 0 ? (
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
            eventContent={(eventInfo) => (
              <Box sx={{ p: 0.5 }}>
                <Typography variant="caption" sx={{ fontWeight: "bold" }}>
                  {eventInfo.event.title}
                </Typography>
              </Box>
            )}
          />
        ) : (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <Typography variant="body1" color="text.secondary">
              No holidays loaded. Upload an Excel file to get started.
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
}