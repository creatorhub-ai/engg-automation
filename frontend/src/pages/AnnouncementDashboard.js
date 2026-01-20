import React, { useEffect, useState, useCallback } from "react";
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
  RadioGroup,
  FormControlLabel,
  Radio,
  Alert,
  CircularProgress,
  Divider,
} from "@mui/material";
import axios from "axios";

const API_BASE = process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

export default function AnnouncementDashboard({ token }) {
  const [domains, setDomains] = useState([]);
  const [batches, setBatches] = useState([]);
  const [selectedDomain, setSelectedDomain] = useState("");
  const [selectedBatch, setSelectedBatch] = useState("");
  const [learners, setLearners] = useState([]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("text");
  const [file, setFile] = useState(null);
  const [loadingLearners, setLoadingLearners] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Load domains and batches
  useEffect(() => {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    
    axios.get(`${API_BASE}/api/domains`, { headers })
      .then((res) => setDomains(Array.isArray(res.data) ? res.data : []))
      .catch(() => setDomains([]));

    axios.get(`${API_BASE}/api/batches`, { headers })
      .then((res) => setBatches(Array.isArray(res.data) ? res.data : []))
      .catch(() => setBatches([]));
  }, [token]);

  // Load learners for batch
  useEffect(() => {
    async function loadLearners() {
      if (!selectedBatch) {
        setLearners([]);
        return;
      }

      setLoadingLearners(true);
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await axios.get(`${API_BASE}/apigetlearners`, {
          params: { batchno: selectedBatch },
          headers,
        });

        const validLearners = (res.data || []).filter(learner => 
          learner.email && learner.email.trim()
        );
        setLearners(validLearners);
      } catch (e) {
        console.error("Load learners failed:", e);
        setError("Failed to load learners");
        setLearners([]);
      } finally {
        setLoadingLearners(false);
      }
    }

    loadLearners();
  }, [selectedBatch, token]);

  const onFileChange = (e) => {
    const uploadedFile = e.target.files[0];
    if (uploadedFile && uploadedFile.size <= 10 * 1024 * 1024) {
      setFile(uploadedFile);
      setError("");
    } else {
      setError("File must be < 10MB");
    }
  };

  const uploadFile = useCallback(async (fileToUpload) => {
    const formData = new FormData();
    formData.append("file", fileToUpload);

    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await axios.post(`${API_BASE}/api/upload`, formData, { headers });
    return res.data.url;
  }, [token]);

  // ✅ FIXED: Backend uses EMAIL_USER/EMAIL_PASS from .env
  const onSend = async () => {
    setError("");
    setSuccessMsg("");

    if (!subject.trim()) return setError("Subject required");
    if (!selectedBatch) return setError("Select batch");
    if (!message.trim()) return setError("Message required");

    setSending(true);

    try {
      const res = await axios.post(
        `${API_BASE}/api/announcement/send-direct`,
        {
          subject,
          message,
          messageType,
          batch_no: selectedBatch,
        }
      );

      if (res.data.success) {
        setSuccessMsg(
          `✅ Sent ${res.data.sent} emails (${res.data.failed} failed)`
        );
        setSubject("");
        setMessage("");
        setSelectedBatch("");
      } else {
        setError(res.data.error || "Send failed");
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Server error");
    } finally {
      setSending(false);
    }
  };

  return (
    <Paper sx={{ p: 4, maxWidth: 900, mx: "auto", mb: 4 }}>
      <Typography variant="h4" gutterBottom color="primary">
        📢 Announcement Dashboard
      </Typography>
      <Typography variant="body1" sx={{ mb: 3, color: "text.secondary" }}>
        ✅ Sends from your EMAIL_USER (Gmail/App Password)
      </Typography>

      {/* Batch Selection */}
      <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap", mb: 3 }}>
        <FormControl sx={{ minWidth: 300 }}>
          <InputLabel>Batch *</InputLabel>
          <Select
            label="Batch *"
            value={selectedBatch}
            onChange={(e) => {
              setSelectedBatch(e.target.value);
              if (e.target.value) setSelectedDomain("");
            }}
          >
            <MenuItem value=""><em>Select Batch</em></MenuItem>
            {batches.map((batch) => (
              <MenuItem key={batch.batch_no || batch} value={batch.batch_no || batch}>
                {batch.batch_no || batch}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Learners Info */}
      <Alert severity={learners.length ? "success" : "warning"} sx={{ mb: 3 }}>
        📊 Learners: {loadingLearners ? "Loading..." : learners.length}
        {learners.length > 0 && (
          <Typography variant="body2" sx={{ mt: 1 }}>
            Sample: {learners.slice(0, 3).map(l => l.email).join(', ')}
          </Typography>
        )}
      </Alert>

      <Divider sx={{ mb: 3 }} />

      {/* Subject */}
      <TextField
        label="📧 Subject *"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        fullWidth
        multiline
        maxRows={2}
        sx={{ mb: 3 }}
        placeholder="Announcement: Batch PDFT17 - Important Update"
      />

      {/* Message Type */}
      <FormControl component="fieldset" sx={{ mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom fontWeight={600}>
          Message Format
        </Typography>
        <RadioGroup 
          row 
          value={messageType} 
          onChange={(e) => {
            setMessageType(e.target.value);
            setFile(null);
          }}
        >
          <FormControlLabel value="text" control={<Radio />} label="📝 Plain Text" />
          <FormControlLabel value="html" control={<Radio />} label="📧 HTML Email" />
          <FormControlLabel value="link" control={<Radio />} label="🔗 Link Only" />
        </RadioGroup>
      </FormControl>

      {/* Message */}
      <TextField
        label="💬 Message *"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        multiline
        rows={6}
        fullWidth
        sx={{ mb: 3 }}
        placeholder="Dear learners,

This is an important announcement for batch PDFT17.

Please read carefully and take action.

Best regards,
Training Team"
      />

      {/* File Upload */}
      {(messageType === "image" || messageType === "file") && (
        <Box sx={{ mb: 3 }}>
          <Button variant="outlined" component="label" fullWidth sx={{ mb: 2 }}>
            📎 Upload Attachment
            <input
              type="file"
              hidden
              accept={messageType === "image" ? "image/*" : "*/*"}
              onChange={onFileChange}
            />
          </Button>
          {file && (
            <Alert severity="info" icon={false}>
              ✅ {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)
            </Alert>
          )}
        </Box>
      )}

      {/* Status Messages */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}
      {successMsg && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMsg("")}>
          {successMsg}
        </Alert>
      )}

      {/* SEND BUTTON */}
      <Button
        variant="contained"
        size="large"
        fullWidth
        onClick={onSend}
        disabled={sending || loadingLearners || learners.length === 0}
        sx={{
          py: 2,
          fontSize: "1.2rem",
          fontWeight: 700,
          background: "linear-gradient(45deg, #4CAF50 30%, #45a049 90%)",
          "&:hover": { background: "linear-gradient(45deg, #45a049 30%, #4CAF50 90%)" }
        }}
      >
        {sending ? (
          <>
            <CircularProgress size={24} sx={{ mr: 2 }} />
            Sending from EMAIL_USER...
          </>
        ) : (
          `🚀 Send to ${learners.length} Learners`
        )}
      </Button>

      <Typography variant="caption" display="block" sx={{ mt: 2, color: "text.secondary", textAlign: "center" }}>
        📧 Uses EMAIL_USER/EMAIL_PASS from your .env file
      </Typography>
    </Paper>
  );
}
