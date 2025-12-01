import React, { useState } from "react";
import Papa from "papaparse";
import axios from "axios";
import DashboardLayout from "../components/DashboardLayout";
import {
  Box,
  Paper,
  Typography,
  Button,
  Fade,
  Alert,
} from "@mui/material";

const API_BASE = process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

export default function UploadCoursePlanner() {
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
          classroom_name: r.classroom_name || r.classroom || "",
          batch_no: r.batch_no || r.Batch || r.batch || "",
          domain: r.domain || "",
          mode: r.mode || "",
          week_no: r.week_no || r.week || "",
          date: r.date || r.Date || "",
          start_time: r.start_time || r["start time"] || r.StartTime || "",
          end_time: r.end_time || "",
          module_name: r.module_name || "",
          topic_name: r.topic_name || "",
          trainer_name: r.trainer_name || "",
          trainer_email: r.trainer_email || "",
          topic_status: r.topic_status || "",
          remarks: r.remarks || "",
          batch_type: r.batch_type || "",
          actual_date: r.actual_date || "",
          date_difference: r.date_difference || "",
          date_changed_by: r.date_changed_by || "",
          date_changed_at: r.date_changed_at || "",
        }));

        try {
          const res = await axios.post(`${API_BASE}/upload-course-planner`, { courses: json });
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
            Upload Course Planner
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
