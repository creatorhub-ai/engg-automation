import React, { useState } from "react";
import axios from "axios";
import { Button, Box, Alert, Typography, Paper } from "@mui/material";

const API_BASE = "http://localhost:5000";  // Your Flask backend base URL

export default function AttendanceMailerUI() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("");

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setStatus("");
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!file) {
      setStatus("⚠️ Please select a file.");
      return;
    }
    setStatus("Processing...");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post(`${API_BASE}/api/send-attendance-mails`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setStatus(response.data.message);
    } catch (error) {
      setStatus("❌ Error: " + (error.response?.data?.error || error.message));
    }
  };

  return (
    <Paper elevation={6} sx={{ p: 4, maxWidth: 520, mx: "auto", mt: 4 }}>
      <Typography variant="h5" color="primary" sx={{ mb: 3 }}>
        📧 Attendance Email Sender
      </Typography>
      <Box component="form" onSubmit={handleSend}>
        <Button variant="outlined" component="label" sx={{ mb: 2 }} fullWidth>
          {file ? `Selected: ${file.name}` : "Upload CSV / XLSX"}
          <input type="file" accept=".csv,.xlsx" hidden onChange={handleFileChange} />
        </Button>
        <Button type="submit" variant="contained" color="primary" fullWidth disabled={!file}>
          Send Emails
        </Button>
      </Box>
      {status && <Alert severity={status.startsWith("✅") ? "success" : "info"} sx={{ mt: 2 }}>{status}</Alert>}
    </Paper>
  );
}
