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
  Button,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  Divider,
} from "@mui/material";
import { blue, deepPurple, green, red } from "@mui/material/colors";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";

const API_BASE =
  process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

// =======================
// Utils
// =======================
function formatDate(d) {
  return d.toISOString().split("T")[0];
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// =======================
// Component
// =======================
function ManagerLeaveDashboard({ user, token }) {
  const [requests, setRequests] = useState([]);
  const [holidays, setHolidays] = useState([]);

  // 🔹 Popup state
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogData, setDialogData] = useState([]);
  const [dialogTitle, setDialogTitle] = useState("");

  const [viewType, setViewType] = useState("month");
  const [cursor, setCursor] = useState(new Date());

  const trainerHueMapRef = useRef({});

  const authHeaders = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );

  // =======================
  // Stable Trainer Color
  // =======================
  const getTrainerColor = (email) => {
    const key = (email || "trainer").toLowerCase();
    if (!trainerHueMapRef.current[key]) {
      trainerHueMapRef.current[key] = hashString(key) % 360;
    }
    const hue = trainerHueMapRef.current[key];
    return {
      bg: `hsl(${hue}, 75%, 88%)`,
      text: `hsl(${hue}, 60%, 25%)`,
      border: `hsl(${hue}, 60%, 70%)`,
    };
  };

  // =======================
  // Load Data
  // =======================
  useEffect(() => {
    axios
      .get(`${API_BASE}/api/unavailability-requests`, {
        headers: authHeaders,
      })
      .then((res) => setRequests(res.data || []));
  }, [authHeaders]);

  // =======================
  // Click trainer → load schedule
  // =======================
  const handleTrainerClick = async (trainer, date) => {
    try {
      const res = await axios.get(
        `${API_BASE}/api/trainer-leave-schedule`,
        {
          headers: authHeaders,
          params: {
            trainer_email: trainer.trainer_email,
            trainer_name: trainer.trainer_name,
            date,
          },
        }
      );

      setDialogTitle(
        `${trainer.trainer_name} – ${date}`
      );
      setDialogData(res.data || []);
      setOpenDialog(true);
    } catch (err) {
      console.error(err);
    }
  };

  // =======================
  // Day Events Map
  // =======================
  const dayEventsMap = useMemo(() => {
    const map = {};

    requests.forEach((req) => {
      const start = new Date(req.start_date);
      const end = new Date(req.end_date || req.start_date);

      for (
        let d = new Date(start);
        d <= end;
        d.setDate(d.getDate() + 1)
      ) {
        const key = formatDate(d);
        if (!map[key]) map[key] = [];

        map[key].push({
          ...req,
          date: key,
        });
      }
    });

    return map;
  }, [requests]);

  // =======================
  // Render Day Cell
  // =======================
  const renderDayCellEvents = (dateObj) => {
    const key = formatDate(dateObj);
    const events = dayEventsMap[key] || [];

    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
        {events.map((ev) => {
          const color = getTrainerColor(ev.trainer_email);
          return (
            <Chip
              key={ev.id}
              size="small"
              label={ev.trainer_name}
              clickable
              onClick={() => handleTrainerClick(ev, key)}
              sx={{
                bgcolor: color.bg,
                color: color.text,
                border: `1px solid ${color.border}`,
                fontSize: 11,
              }}
            />
          );
        })}
      </Box>
    );
  };

  // =======================
  // UI
  // =======================
  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" mb={2}>
        Trainer Leave Calendar
      </Typography>

      {renderDayCellEvents(cursor)}

      {/* ================= Dialog ================= */}
      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{dialogTitle}</DialogTitle>
        <DialogContent>
          {dialogData.length === 0 ? (
            <Alert severity="info">
              No classes scheduled on this date
            </Alert>
          ) : (
            dialogData.map((b) => (
              <Box key={b.batch_no} sx={{ mb: 2 }}>
                <Typography fontWeight="bold">
                  Batch: {b.batch_no}
                </Typography>
                <Typography variant="body2">
                  Modules: {b.modules.join(", ")}
                </Typography>
                <Divider sx={{ mt: 1 }} />
              </Box>
            ))
          )}
        </DialogContent>
      </Dialog>
    </Paper>
  );
}

export default ManagerLeaveDashboard;
