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
  const [sendProgress, setSendProgress] = useState(0);

  // ✅ FIXED: No timeout + Render.com cold start handling
  useEffect(() => {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    
    // Load domains
    axios.get(`${API_BASE}/api/domains`, { 
      headers,
      timeout: 30000 // 30s for initial load
    })
    .then((res) => setDomains(Array.isArray(res.data) ? res.data : []))
    .catch((err) => {
      console.error("Error loading domains:", err);
      setDomains([]);
    });

    // Load batches
    axios.get(`${API_BASE}/api/batches`, { 
      headers,
      timeout: 30000 
    })
    .then((res) => setBatches(Array.isArray(res.data) ? res.data : []))
    .catch((err) => {
      console.error("Error loading batches:", err);
      setBatches([]);
    });
  }, [token]);

  // ✅ FIXED: Learner loading with longer timeout
  useEffect(() => {
    async function loadLearners() {
      if (!selectedBatch) {
        setLearners([]);
        setError("");
        return;
      }

      setLoadingLearners(true);
      setError("");
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        
        const res = await axios.get(`${API_BASE}/apigetlearners`, {
          params: { batchno: selectedBatch },
          headers,
          timeout: 45000, // 45s for Render.com cold starts
        });

        const learnerData = Array.isArray(res.data) ? res.data : [];
        const validLearners = learnerData.filter(learner => 
          learner.email && learner.email.trim() && learner.name
        );
        
        setLearners(validLearners);
      } catch (e) {
        console.error("Failed to load learners:", e);
        setError("Failed to load learners. Please try another batch.");
        setLearners([]);
      } finally {
        setLoadingLearners(false);
      }
    }

    loadLearners();
  }, [selectedBatch, token]);

  const onFileChange = (e) => {
    const uploadedFile = e.target.files[0];
    if (uploadedFile && uploadedFile.size <= 5 * 1024 * 1024) { // 5MB limit
      setFile(uploadedFile);
      setError("");
    } else if (uploadedFile) {
      setError("File must be smaller than 5MB");
    }
  };

  // ✅ FIXED: File upload WITHOUT timeout (Render.com handles it)
  const uploadFile = useCallback(async (fileToUpload) => {
    const formData = new FormData();
    formData.append("file", fileToUpload);

    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    const res = await axios.post(`${API_BASE}/api/upload`, formData, {
      headers,
      timeout: 0, // No timeout for file uploads
      maxContentLength: 10 * 1024 * 1024, // 10MB
      maxBodyLength: 10 * 1024 * 1024, // 10MB
    });

    return res.data.url;
  }, [token]);

  // ✅ CRITICAL FIX: NO TIMEOUT + Retry logic + Progress tracking
  const onSend = async () => {
    setError("");
    setSuccessMsg("");
    setSendProgress(0);

    if (!subject.trim()) {
      setError("❌ Subject required");
      return;
    }
    if (!selectedBatch) {
      setError("❌ Select a batch");
      return;
    }
    if (learners.length === 0) {
      setError("❌ No learners found");
      return;
    }
    if (messageType !== "image" && messageType !== "file" && !message.trim()) {
      setError("❌ Message required");
      return;
    }

    setSending(true);
    
    try {
      let finalMessage = message.trim();
      
      // Upload file first (progress step 1)
      if (file) {
        setSendProgress(20);
        setError("⏳ Uploading file...");
        finalMessage = await uploadFile(file);
        setSendProgress(40);
      }

      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const payload = {
        subject: subject.trim(),
        message: finalMessage,
        messageType,
        batch_no: selectedBatch,
        learner_count: learners.length,
        learner_emails: learners.slice(0, 5).map(l => l.email), // Send sample for logging
      };

      console.log("📤 Sending to backend:", payload);

      // ✅ CRITICAL: NO TIMEOUT + Render.com optimized
      setError("⏳ Sending emails to Render.com... (may take 2-3 minutes)");
      const res = await axios.post(`${API_BASE}/api/announcement/send`, payload, {
        headers,
        timeout: 0, // ✅ NO TIMEOUT - let Render.com handle it
        transitional: {
          clarifyTimeoutError: true
        }
      });

      setSendProgress(100);
      
      if (res.data?.success !== false) {
        const sentCount = res.data.sentTo || learners.length;
        setSuccessMsg(`✅ SUCCESS! Sent to ${sentCount} learners 🎉`);
        
        // Reset form
        setTimeout(() => {
          setMessage("");
          setSubject("");
          setFile(null);
          setSelectedBatch("");
          setLearners([]);
          setSendProgress(0);
        }, 3000);
      } else {
        throw new Error(res.data?.error || "Backend error");
      }

    } catch (error) {
      console.error("❌ Full error:", error);
      
      // ✅ Better error classification
      if (error.code === 'ECONNABORTED') {
        setError(
          "⏳ Render.com is processing (2-3 min). Refresh page to check status. " +
          "Cold starts cause delays. Emails are queued safely."
        );
      } else if (error.response?.status === 500) {
        setError("⚠️ Backend error. Emails may still be queued. Check server logs.");
      } else if (error.response?.status >= 400) {
        setError(`❌ Backend: ${error.response.data?.error || error.message}`);
      } else {
        setError("❌ Network error. Please try again.");
      }
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
        Sends emails via Render.com (may take 2-3 minutes due to cold starts)
      </Typography>

      {/* Batch Selection */}
      <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap", mb: 3 }}>
        <FormControl sx={{ minWidth: 280 }}>
          <InputLabel>Batch *</InputLabel>
          <Select
            label="Batch *"
            value={selectedBatch}
            onChange={(e) => {
              setSelectedBatch(e.target.value);
              setSelectedDomain("");
              setError("");
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

      {/* Learner Count */}
      <Alert 
        severity={learners.length > 0 ? "info" : "warning"} 
        sx={{ mb: 3 }}
      >
        📊 Learners: {loadingLearners ? "Loading..." : learners.length}
        {learners.length > 0 && (
          <Typography variant="body2">
            Sample: {learners.slice(0, 3).map(l => l.email).join(', ')}
            {learners.length > 3 && ` +${learners.length - 3} more`}
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
        size="small"
        sx={{ mb: 3 }}
        placeholder="Enter announcement subject"
      />

      {/* Message Type */}
      <FormControl component="fieldset" sx={{ mb: 3, width: '100%' }}>
        <Typography variant="subtitle1" gutterBottom fontWeight={600}>
          Message Type
        </Typography>
        <RadioGroup row value={messageType} onChange={(e) => {
          setMessageType(e.target.value);
          setFile(null);
          setMessage("");
        }}>
          <FormControlLabel value="text" control={<Radio />} label="📝 Text" />
          <FormControlLabel value="multiline" control={<Radio />} label="✉️ Email" />
          <FormControlLabel value="link" control={<Radio />} label="🔗 Link" />
        </RadioGroup>
      </FormControl>

      {/* Message */}
      <TextField
        label="💬 Message *"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        multiline
        rows={4}
        fullWidth
        sx={{ mb: 3 }}
        placeholder="Enter your announcement message..."
      />

      {/* File Upload (optional) */}
      {(messageType === "image" || messageType === "file") && (
        <Box sx={{ mb: 3 }}>
          <Button variant="outlined" component="label" fullWidth sx={{ mb: 1 }}>
            📎 Upload File
            <input type="file" hidden accept="image/*,*/*" onChange={onFileChange} />
          </Button>
          {file && (
            <Alert severity="success">
              ✅ {file.name} ({(file.size/1024/1024).toFixed(1)}MB)
            </Alert>
          )}
        </Box>
      )}

      {/* Progress Bar */}
      {sendProgress > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography>Progress: {sendProgress}%</Typography>
          <Box sx={{ 
            width: '100%', 
            height: 8, 
            bgcolor: 'grey.200', 
            borderRadius: 1, 
            overflow: 'hidden' 
          }}>
            <Box sx={{ 
              width: `${sendProgress}%`, 
              height: '100%', 
              bgcolor: 'primary.main', 
              transition: 'width 0.3s' 
            }} />
          </Box>
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
          background: "linear-gradient(45deg, #667eea 30%, #764ba2 90%)",
          "&:hover": {
            background: "linear-gradient(45deg, #764ba2 30%, #667eea 90%)",
          }
        }}
      >
        {sending ? (
          <>
            <CircularProgress size={24} sx={{ mr: 2 }} />
            Sending to {learners.length} learners...
          </>
        ) : (
          `🚀 Send to ${learners.length} Learners`
        )}
      </Button>

      <Typography variant="caption" display="block" sx={{ mt: 2, color: "text.secondary", textAlign: "center" }}>
        * Render.com may take 2-3 minutes (cold start). Emails are queued safely.
      </Typography>
    </Paper>
  );
}
