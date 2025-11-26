import React, { useState } from 'react';
import { Button, Box, Typography, Paper } from '@mui/material';

export default function AttendanceMailer() {
  const [file, setFile] = useState(null);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => setFile(e.target.files[0]);

  async function handleSend() {
    if (!file) {
      setMsg("Please select a file.");
      return;
    }
    setLoading(true);
    setMsg("Sending emails, please wait...");
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/send-attendance-emails", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    setLoading(false);
    setMsg(data.success
      ? "Emails sent to students with absent days!"
      : `Error: ${data.error || "Unknown error"}`);
  }

  return (
    <Box minHeight="70vh" display="flex" justifyContent="center" alignItems="center">
      <Paper elevation={6} sx={{ p: 4, minWidth: 350, borderRadius: 3 }}>
        <Typography variant="h5" mb={2} textAlign="center">
          Attendance Mailer
        </Typography>
        <Box mb={2}>
          <input type="file" accept=".xlsx" onChange={handleFileChange} />
        </Box>
        <Button
          variant="contained"
          color="primary"
          fullWidth
          onClick={handleSend}
          disabled={loading}
        >
          {loading ? "Sending..." : "Send Emails"}
        </Button>
        <Typography sx={{ mt: 2, textAlign: "center" }}>
          {msg}
        </Typography>
      </Paper>
    </Box>
  );
}
