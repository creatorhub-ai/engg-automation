import React, { useState } from "react";
import Papa from "papaparse";
import axios from "axios";
import DashboardLayout from "../components/DashboardLayout";
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Fade,
  Alert,
} from "@mui/material";

const API_BASE = process.env.API_BASE || "http://localhost:5000";

export default function UploadLearners() {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");

  const onChange = (e) => setFile(e.target.files[0]);

  const handleUpload = () => {
    setMessage("");
    if (!file) return setMessage("❌ Please choose CSV file");
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const json = results.data.map((r) => ({
          name: r.name || r.Name || r["Learner Name"] || "",
          email: r.email || r.Email || "",
          phone: r.phone || r.Phone || "",
          batch_no: r.batch_no || r.Batch || r.batch || "",
        }));
        try {
          const res = await axios.post(`${API_BASE}/upload-learners`, { learners: json });
          setMessage(res.data.message || "✅ Uploaded successfully");
        } catch (err) {
          setMessage("❌ Upload failed: " + (err.response?.data?.error || err.message));
        }
      },
      error: (err) => setMessage("CSV parse error: " + err.message),
    });
  };

  return (
    <DashboardLayout>
      <Box maxWidth={550} mx="auto" my={2}>
        <Paper elevation={4} sx={{ p: 4 }}>
          <Typography variant="h6" color="primary" gutterBottom>
            Upload Learners
          </Typography>
          <input type="file" accept=".csv" onChange={onChange} style={{ marginBottom: 12 }} />
          <Button variant="contained" onClick={handleUpload}>
            Upload
          </Button>
          <Fade in={!!message}>
            <Box mt={2}>
              {message && (
                <Alert severity={message.startsWith("✅") ? "success" : "error"}>
                  {message}
                </Alert>
              )}
            </Box>
          </Fade>
        </Paper>
      </Box>
    </DashboardLayout>
  );
}
