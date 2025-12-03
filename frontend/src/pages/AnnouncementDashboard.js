import React, { useEffect, useState } from "react";
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
} from "@mui/material";
import axios from "axios";

const API_BASE =
  process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

export default function AnnouncementDashboard({ token }) {
  const [domains, setDomains] = useState([]);
  const [batches, setBatches] = useState([]);

  const [selectedDomain, setSelectedDomain] = useState("");
  const [selectedBatch, setSelectedBatch] = useState("");
  const [learners, setLearners] = useState([]);

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState(""); // text content or URL
  const [messageType, setMessageType] = useState("text"); // text, multiline, paragraph, link, image, file

  const [file, setFile] = useState(null);

  const [loadingLearners, setLoadingLearners] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    // load domains and batches on mount
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    // FIX: use existing backend routes /api/domains and /api/batches
    axios
      .get(`${API_BASE}/api/domains`, { headers })
      .then((res) => setDomains(res.data || []))
      .catch((err) => {
        console.error("Error loading domains:", err);
        setDomains([]);
      });

    axios
      .get(`${API_BASE}/api/batches`, { headers })
      .then((res) => setBatches(res.data || []))
      .catch((err) => {
        console.error("Error loading batches:", err);
        setBatches([]);
      });
  }, [token]);

  useEffect(() => {
    // load learners based on selected domain or batch
    async function loadLearners() {
      if (!selectedDomain && !selectedBatch) {
        setLearners([]);
        return;
      }
      setLoadingLearners(true);
      setError("");
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const params = {};
        if (selectedDomain) params.domain = selectedDomain;
        if (selectedBatch) params.batch_no = selectedBatch;

        const res = await axios.get(
          `${API_BASE}/api/announcement/learners`,
          { params, headers }
        );
        setLearners(res.data || []);
      } catch (e) {
        console.error("Failed to load learners:", e);
        setError("Failed to load learners");
        setLearners([]);
      } finally {
        setLoadingLearners(false);
      }
    }
    loadLearners();
  }, [selectedDomain, selectedBatch, token]);

  const onFileChange = (e) => {
    const uploadedFile = e.target.files[0];
    if (uploadedFile) {
      setFile(uploadedFile);
    }
  };

  async function uploadFile(fileToUpload) {
    const formData = new FormData();
    formData.append("file", fileToUpload);

    try {
      const headers = token
        ? {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          }
        : { "Content-Type": "multipart/form-data" };
      const res = await axios.post(`${API_BASE}/api/upload`, formData, {
        headers,
      });
      if (res.data && res.data.url) {
        return res.data.url;
      }
      throw new Error("Upload failed: no URL returned");
    } catch (err) {
      console.error("File upload failed:", err);
      throw err;
    }
  }

  const onSend = async () => {
    setError("");
    setSuccessMsg("");

    if (!subject.trim()) {
      setError("Subject cannot be empty");
      return;
    }
    if (!selectedDomain && !selectedBatch) {
      setError("Select either a domain or batch");
      return;
    }
    if (
      (messageType === "image" || messageType === "file") &&
      !file &&
      !message.trim()
    ) {
      setError("Please upload a file/image or enter its URL");
      return;
    }
    if (
      messageType !== "image" &&
      messageType !== "file" &&
      !message.trim()
    ) {
      setError("Message cannot be empty");
      return;
    }

    setSending(true);
    try {
      let finalMessage = message;

      if (file) {
        finalMessage = await uploadFile(file);
      }

      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const payload = {
        subject,
        message: finalMessage,
        messageType,
        domain: selectedDomain || null,
        batch_no: selectedBatch || null,
      };

      const res = await axios.post(
        `${API_BASE}/api/announcement/send`,
        payload,
        { headers }
      );

      if (res.data.success) {
        setSuccessMsg(
          `Announcement sent successfully to ${res.data.sentTo} learners.`
        );
        setMessage("");
        setSubject("");
        setFile(null);
      } else {
        setError("Failed to send announcement");
      }
    } catch (e) {
      console.error("Failed to send announcement:", e);
      setError("Failed to send announcement");
    } finally {
      setSending(false);
    }
  };

  return (
    <Paper sx={{ p: 3, maxWidth: 800, mx: "auto" }}>
      <Typography variant="h4" gutterBottom>
        Announcement Dashboard
      </Typography>

      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 2 }}>
        <FormControl sx={{ minWidth: 240 }}>
          <InputLabel>Domain (optional)</InputLabel>
          <Select
            label="Domain (optional)"
            value={selectedDomain}
            onChange={(e) => {
              setSelectedDomain(e.target.value);
              if (e.target.value) setSelectedBatch("");
            }}
            displayEmpty
          >
            <MenuItem value="">
              <em>None</em>
            </MenuItem>
            {domains.map((domain) => (
              <MenuItem key={domain} value={domain}>
                {domain}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl sx={{ minWidth: 180 }}>
          <InputLabel>Batch No (optional)</InputLabel>
          <Select
            label="Batch No (optional)"
            value={selectedBatch}
            onChange={(e) => {
              setSelectedBatch(e.target.value);
              if (e.target.value) setSelectedDomain("");
            }}
            displayEmpty
          >
            <MenuItem value="">
              <em>None</em>
            </MenuItem>
            {batches.map((batch) => (
              <MenuItem key={batch.batch_no || batch} value={batch.batch_no || batch}>
                {batch.batch_no || batch}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Learners matching selection:{" "}
        {loadingLearners ? "Loading..." : learners.length}
      </Typography>

      <FormControl fullWidth sx={{ mb: 2 }}>
        <TextField
          label="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          size="small"
          required
        />
      </FormControl>

      <FormControl component="fieldset" sx={{ mb: 2 }}>
        <RadioGroup
          row
          value={messageType}
          onChange={(e) => {
            setMessageType(e.target.value);
            setFile(null);
            setMessage("");
          }}
        >
          <FormControlLabel
            value="text"
            control={<Radio />}
            label="Single Line Text"
          />
          <FormControlLabel
            value="multiline"
            control={<Radio />}
            label="Multiline Text"
          />
          <FormControlLabel
            value="paragraph"
            control={<Radio />}
            label="Paragraph"
          />
          <FormControlLabel
            value="link"
            control={<Radio />}
            label="Link (URL)"
          />
          <FormControlLabel
            value="image"
            control={<Radio />}
            label="Image Upload or URL"
          />
          <FormControlLabel
            value="file"
            control={<Radio />}
            label="File Upload or URL"
          />
        </RadioGroup>
      </FormControl>

      <FormControl fullWidth sx={{ mb: 2 }}>
        {messageType === "text" && (
          <TextField
            label="Message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            size="small"
            required
          />
        )}
        {(messageType === "multiline" || messageType === "paragraph") && (
          <TextField
            label="Message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            multiline
            rows={messageType === "paragraph" ? 6 : 3}
            required
          />
        )}
        {messageType === "link" && (
          <TextField
            label="Link URL"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
          />
        )}
        {(messageType === "image" || messageType === "file") && (
          <>
            <Button variant="outlined" component="label" sx={{ mb: 1 }}>
              Upload File
              <input
                type="file"
                accept={messageType === "image" ? "image/*" : "*"}
                hidden
                onChange={onFileChange}
              />
            </Button>
            {file && (
              <Typography variant="body2" sx={{ mb: 1 }}>
                {file.name}
              </Typography>
            )}
            <TextField
              label={`${
                messageType === "image" ? "Image" : "File"
              } URL (or leave blank to use uploaded file)`}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              size="small"
              fullWidth
            />
          </>
        )}
      </FormControl>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {successMsg && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {successMsg}
        </Alert>
      )}

      <Button
        variant="contained"
        onClick={onSend}
        disabled={sending || loadingLearners}
      >
        {sending ? "Sending..." : "Send Announcement"}
      </Button>
    </Paper>
  );
}
