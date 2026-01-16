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

  // ✅ FIXED: Load domains and batches with better error handling
  useEffect(() => {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    
    const loadDomains = axios.get(`${API_BASE}/api/domains`, { headers })
      .then((res) => setDomains(Array.isArray(res.data) ? res.data : []))
      .catch((err) => {
        console.error("Error loading domains:", err);
        setDomains([]);
      });

    const loadBatches = axios.get(`${API_BASE}/api/batches`, { headers })
      .then((res) => setBatches(Array.isArray(res.data) ? res.data : []))
      .catch((err) => {
        console.error("Error loading batches:", err);
        setBatches([]);
      });

    Promise.all([loadDomains, loadBatches]).catch(console.error);
  }, [token]);

  // ✅ FIXED: Load learners with correct endpoint and validation
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
        
        // ✅ FIXED: Correct learner endpoint with proper params
        const res = await axios.get(`${API_BASE}/apigetlearners`, {
          params: { batchno: selectedBatch },
          headers,
          timeout: 10000, // 10s timeout
        });

        const learnerData = Array.isArray(res.data) ? res.data : [];
        const validLearners = learnerData.filter(learner => 
          learner.email && learner.email.trim() && learner.name
        );
        
        setLearners(validLearners);
        if (validLearners.length === 0) {
          setError(`No valid learners found for batch ${selectedBatch}. Please check batch data.`);
        }
      } catch (e) {
        console.error("Failed to load learners:", e);
        const errorMsg = e.code === 'ECONNABORTED' 
          ? "Request timeout - please try again" 
          : e.response?.data?.error || "Failed to load learners";
        setError(errorMsg);
        setLearners([]);
      } finally {
        setLoadingLearners(false);
      }
    }

    loadLearners();
  }, [selectedBatch, token]);

  const onFileChange = (e) => {
    const uploadedFile = e.target.files[0];
    if (uploadedFile) {
      // ✅ Validate file size (10MB max)
      if (uploadedFile.size > 10 * 1024 * 1024) {
        setError("File size must be less than 10MB");
        return;
      }
      setFile(uploadedFile);
      setError("");
    }
  };

  // ✅ IMPROVED: File upload with better error handling
  const uploadFile = useCallback(async (fileToUpload) => {
    const formData = new FormData();
    formData.append("file", fileToUpload);

    try {
      const headers = token
        ? {
            Authorization: `Bearer ${token}`,
            // Don't set Content-Type for FormData - let browser set it with boundary
          }
        : {};

      const res = await axios.post(`${API_BASE}/api/upload`, formData, {
        headers,
        timeout: 30000, // 30s for file upload
      });

      if (res.data && res.data.url) {
        return res.data.url;
      }
      throw new Error("Upload failed: no URL returned");
    } catch (err) {
      console.error("File upload failed:", err);
      const errorMsg = err.response?.data?.error || "File upload failed";
      throw new Error(errorMsg);
    }
  }, [token]);

  // ✅ FIXED: Main send function with comprehensive validation
  const onSend = async () => {
    setError("");
    setSuccessMsg("");

    // Validation
    if (!subject.trim()) {
      setError("❌ Subject cannot be empty");
      return;
    }
    
    if (!selectedDomain && !selectedBatch) {
      setError("❌ Select either a domain OR batch");
      return;
    }
    
    if (learners.length === 0 && !selectedDomain) {
      setError("❌ No valid learners found for the selected batch");
      return;
    }
    
    if (messageType !== "image" && messageType !== "file" && !message.trim()) {
      setError("❌ Message content cannot be empty");
      return;
    }
    
    if ((messageType === "image" || messageType === "file") && !file && !message.trim()) {
      setError("❌ Please upload a file OR enter a URL");
      return;
    }

    setSending(true);
    try {
      let finalMessage = message.trim();

      // ✅ Handle file upload
      if (file) {
        setError("Uploading file...");
        finalMessage = await uploadFile(file);
        console.log("✅ File uploaded:", finalMessage);
      }

      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const payload = {
        subject: subject.trim(),
        message: finalMessage,
        messageType,
        domain: selectedDomain || null,
        batch_no: selectedBatch || null,
        learner_count: learners.length, // Send count for backend logging
      };

      console.log("📤 Sending payload:", payload);

      // ✅ FIXED: Email sending endpoint with timeout
      const res = await axios.post(`${API_BASE}/api/announcement/send`, payload, {
        headers,
        timeout: 60000, // 60s timeout for email sending
      });

      console.log("✅ Backend response:", res.data);

      if (res.status === 200 && res.data?.success !== false) {
        const sentCount = res.data.sentTo || learners.length || 0;
        setSuccessMsg(
          `✅ Announcement sent successfully to ${sentCount} learners! 🎉`
        );
        
        // Reset form
        setMessage("");
        setSubject("");
        setFile(null);
        setSelectedBatch("");
        setSelectedDomain("");
        setMessageType("text");
        setLearners([]);
      } else {
        const errorMsg = res.data?.error || "Backend returned non-success response";
        setError(`❌ Send failed: ${errorMsg}`);
      }
    } catch (e) {
      console.error("❌ Send failed:", e.response?.data || e);
      
      let errorMsg = "Failed to send announcement";
      if (e.response?.status === 429) {
        errorMsg = "⏳ Too many requests. Please wait and try again.";
      } else if (e.response?.status === 413) {
        errorMsg = "📁 File too large. Max 10MB allowed.";
      } else if (e.code === 'ECONNABORTED') {
        errorMsg = "⏱️ Request timeout. Please try again.";
      } else if (e.response?.data?.error) {
        errorMsg = e.response.data.error;
      } else if (e.message) {
        errorMsg = e.message;
      }
      
      setError(errorMsg);
    } finally {
      setSending(false);
    }
  };

  return (
    <Paper sx={{ p: 4, maxWidth: 900, mx: "auto", mb: 4 }}>
      <Typography variant="h4" gutterBottom color="primary">
        📢 Announcement Dashboard
      </Typography>
      <Typography variant="h6" sx={{ mb: 3, color: "text.secondary" }}>
        Send mass emails to batches or domains
      </Typography>

      {/* Selection */}
      <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap", mb: 3 }}>
        <FormControl sx={{ minWidth: 260 }}>
          <InputLabel>Domain (optional)</InputLabel>
          <Select
            label="Domain (optional)"
            value={selectedDomain}
            onChange={(e) => {
              setSelectedDomain(e.target.value);
              if (e.target.value) setSelectedBatch("");
            }}
          >
            <MenuItem value="">
              <em>All Domains</em>
            </MenuItem>
            {domains.map((domain) => (
              <MenuItem key={domain} value={domain}>
                {domain}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>Batch (optional)</InputLabel>
          <Select
            label="Batch (optional)"
            value={selectedBatch}
            onChange={(e) => {
              setSelectedBatch(e.target.value);
              if (e.target.value) setSelectedDomain("");
            }}
          >
            <MenuItem value="">
              <em>All Batches</em>
            </MenuItem>
            {batches.map((batch) => (
              <MenuItem key={batch.batch_no || batch} value={batch.batch_no || batch}>
                {batch.batch_no || batch}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Learner Count */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="body1" color="text.primary">
          📊 Learners: {loadingLearners ? (
            <CircularProgress size={20} />
          ) : (
            learners.length
          )}
        </Typography>
        {learners.length > 0 && (
          <Typography variant="caption" color="text.secondary">
            {learners[0]?.email} {learners.length > 1 ? `+${learners.length - 1} more` : ""}
          </Typography>
        )}
      </Box>

      <Divider sx={{ mb: 3 }} />

      {/* Subject */}
      <FormControl fullWidth sx={{ mb: 3 }}>
        <TextField
          label="📧 Subject *"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          size="small"
          placeholder="Enter announcement subject"
          error={!!error && !subject.trim()}
        />
      </FormControl>

      {/* Message Type */}
      <FormControl component="fieldset" sx={{ mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom fontWeight={600}>
          Message Type
        </Typography>
        <RadioGroup
          row
          value={messageType}
          onChange={(e) => {
            setMessageType(e.target.value);
            setFile(null);
            setMessage("");
            setError("");
          }}
        >
          <FormControlLabel value="text" control={<Radio />} label="📝 Text" />
          <FormControlLabel value="multiline" control={<Radio />} label="✍️ Multiline" />
          <FormControlLabel value="paragraph" control={<Radio />} label="📄 Paragraph" />
          <FormControlLabel value="link" control={<Radio />} label="🔗 Link" />
          <FormControlLabel value="image" control={<Radio />} label="🖼️ Image" />
          <FormControlLabel value="file" control={<Radio />} label="📎 File" />
        </RadioGroup>
      </FormControl>

      {/* Message Input */}
      <FormControl fullWidth sx={{ mb: 3 }}>
        {messageType === "text" && (
          <TextField
            label="📝 Message *"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            size="small"
            required
          />
        )}
        {(messageType === "multiline" || messageType === "paragraph") && (
          <TextField
            label="✍️ Message *"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            multiline
            rows={messageType === "paragraph" ? 6 : 3}
            required
          />
        )}
        {messageType === "link" && (
          <TextField
            label="🔗 Link URL *"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            placeholder="https://example.com"
          />
        )}
        {(messageType === "image" || messageType === "file") && (
          <Box>
            <Button variant="outlined" component="label" sx={{ mb: 2 }}>
              📎 Upload {messageType === "image" ? "Image" : "File"}
              <input
                type="file"
                accept={messageType === "image" ? "image/*" : "*/*"}
                hidden
                onChange={onFileChange}
              />
            </Button>
            {file && (
              <Typography variant="body2" color="success.main" sx={{ mb: 1 }}>
                ✅ {file.name} ({(file.size / 1024 / 1024).toFixed(1)}MB)
              </Typography>
            )}
            <TextField
              label={`${messageType === "image" ? "🖼️" : "📁"} URL (optional)`}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              size="small"
              fullWidth
              placeholder="https://example.com/image.jpg"
            />
          </Box>
        )}
      </FormControl>

      {/* Messages */}
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

      {/* Send Button */}
      <Button
        variant="contained"
        size="large"
        fullWidth
        onClick={onSend}
        disabled={sending || loadingLearners}
        sx={{ py: 1.5, fontSize: "1.1rem", fontWeight: 600 }}
      >
        {sending ? (
          <>
            <CircularProgress size={24} sx={{ mr: 1 }} />
            Sending...
          </>
        ) : (
          `📤 Send to ${learners.length} Learners`
        )}
      </Button>

      <Typography variant="caption" display="block" sx={{ mt: 1, color: "text.secondary" }}>
        * Required fields
      </Typography>
    </Paper>
  );
}
