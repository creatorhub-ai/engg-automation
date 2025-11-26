import React, { useEffect, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";
import {
  Box,
  Paper,
  Typography,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Fade,
  Alert,
} from "@mui/material";

const ScheduleEmails = () => {
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState("");
  const [mode, setMode] = useState("Online");
  const [batchType, setBatchType] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("http://localhost:5000/api/batches")
      .then((res) => res.json())
      .then((data) => setBatches(data))
      .catch((err) => {
        setMessage("❌ Failed to fetch batches");
      });
  }, []);

  const handleSchedule = async () => {
    if (!selectedBatch || !mode) {
      setMessage("⚠️ Please select batch and mode");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("http://localhost:5000/api/schedule-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batch_no: selectedBatch,
          mode,
          batch_type: mode === "Offline" ? batchType : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(`❌ Failed: ${data.error || "Unknown error"}`);
      } else {
        setMessage(
          `✅ Scheduled ${data.scheduled} emails for ${data.batch_no} (Start: ${data.start_date})`
        );
      }
    } catch (err) {
      setMessage(`❌ Network error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <Box maxWidth={520} mx="auto" my={3}>
        <Paper elevation={4} sx={{ p: 4 }}>
          <Typography variant="h6" color="primary" gutterBottom>
            📧 Schedule Emails
          </Typography>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Select Batch</InputLabel>
            <Select
              value={selectedBatch}
              label="Select Batch"
              onChange={(e) => setSelectedBatch(e.target.value)}
            >
              <MenuItem value="">-- Choose Batch --</MenuItem>
              {batches.map((b, idx) => (
                <MenuItem key={idx} value={b.batch_no}>
                  {b.batch_no} ({b.start_date})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Mode</InputLabel>
            <Select
              value={mode}
              label="Mode"
              onChange={(e) => setMode(e.target.value)}
            >
              <MenuItem value="">-- Choose Batch Type --</MenuItem>
              <MenuItem value="Online">Online</MenuItem>
              <MenuItem value="Offline">Offline</MenuItem>
            </Select>
          </FormControl>
          {mode === "Offline" && (
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Batch Type</InputLabel>
              <Select
                value={batchType}
                label="Batch Type"
                onChange={(e) => setBatchType(e.target.value)}
              >
                <MenuItem value="">-- Choose Batch Type --</MenuItem>
                <MenuItem value="Morning Batch">Morning Batch</MenuItem>
                <MenuItem value="Afternoon Batch">Afternoon Batch</MenuItem>
              </Select>
            </FormControl>
          )}
          <Button
            onClick={handleSchedule}
            disabled={loading}
            variant="contained"
            color="primary"
            fullWidth
            sx={{ py: 1.3, fontWeight: "bold", fontSize: "1rem" }}
          >
            {loading ? "⏳ Scheduling..." : "Schedule Emails"}
          </Button>
          <Fade in={!!message}>
            <Box mt={2}>
              {message && (
                <Alert severity={message.startsWith("✅") ? "success" : "warning"}>
                  {message}
                </Alert>
              )}
            </Box>
          </Fade>
        </Paper>
      </Box>
    </DashboardLayout>
  );
};

export default ScheduleEmails;
