import React, { useState, useEffect } from "react";
import dayjs from "dayjs";
import * as XLSX from "xlsx";
import {
  Box,
  Paper,
  Typography,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormGroup,
  FormControlLabel,
  TextField,
  Alert,
  Fade
} from "@mui/material";

function InternalCommunication({ user }) {
  // Section 1: Internal Communication states
  const [roles, setRoles] = useState([]);
  const [domain, setDomain] = useState("");
  const [batchNo, setBatchNo] = useState("");
  const [batches, setBatches] = useState([]);
  const [batchStartDate, setBatchStartDate] = useState("");
  const [message, setMessage] = useState("");

  // Section 2: Course Closure states
  const [closureBatch, setClosureBatch] = useState("");
  const [closureDate, setClosureDate] = useState("");
  const [closureMessage, setClosureMessage] = useState("");
  const [batchMaxDate, setBatchMaxDate] = useState("");

  // Section 3: Feedback Sharing states
  const [feedbackBatchNo, setFeedbackBatchNo] = useState("");
  const [feedbackRoles, setFeedbackRoles] = useState([]);
  const [feedbackType, setFeedbackType] = useState("");
  const [feedbackFile, setFeedbackFile] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState("");

  useEffect(() => {
    fetch("http://localhost:5000/api/batches")
      .then((res) => res.json())
      .then((data) => {
        if (data) setBatches(data);
      })
      .catch((err) => console.error("Failed to load batches:", err));
  }, []);

  // Section 1 handlers
  const handleRoleChange = (e) => {
    const { value, checked } = e.target;
    setRoles((prev) =>
      checked ? [...prev, value.trim()] : prev.filter((r) => r !== value.trim())
    );
  };

  const handleBatchChange = (e) => {
    const selected = e.target.value;
    setBatchNo(selected.trim());
    const batchObj = batches.find((b) => b.batch_no === selected);
    if (batchObj && batchObj.start_date) {
      const isoDate = dayjs(batchObj.start_date, "DD-MMM-YYYY").format("YYYY-MM-DD");
      setBatchStartDate(isoDate);
    } else {
      setBatchStartDate("");
    }
  };

  const handleSchedule = async () => {
    if (roles.length === 0) {
      setMessage("⚠️ Please select at least one role");
      return;
    }
    if (!batchNo) {
      setMessage("⚠️ Please select a Batch No");
      return;
    }
    const body = {
      role: roles.length === 1 ? roles[0] : roles,
      batchNo: batchNo.trim(),
      startDate: batchStartDate,
    };
    if (roles.includes("Trainer")) body.domain = domain;

    try {
      const res = await fetch("http://localhost:5000/api/internal/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      setMessage(
        res.ok
          ? result.message || "✅ Scheduled successfully"
          : "❌ Failed to schedule: " + (result.error || "Unknown error")
      );
    } catch (err) {
      setMessage("❌ Failed to schedule: " + err.message);
    }
  };

  useEffect(() => {
    const fetchMaxDate = async () => {
      if (!closureBatch) {
        setBatchMaxDate("");
        setClosureDate("");
        return;
      }
      try {
        const res = await fetch(`http://localhost:5000/api/course_planner_data/max-date/${closureBatch}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.max_date) {
            setBatchMaxDate(data.max_date);
            if (!closureDate) setClosureDate(data.max_date);
          } else {
            setBatchMaxDate("");
          }
        } else {
          setBatchMaxDate("");
          console.error("Failed to fetch max date, status:", res.status);
        }
      } catch (error) {
        setBatchMaxDate("");
        console.error("Error fetching max date:", error.message);
      }
    };
    fetchMaxDate();
    // eslint-disable-next-line
  }, [closureBatch]);

  const handleClosureDateChange = (e) => {
    const newDate = e.target.value;
    if (batchMaxDate && dayjs(newDate).isBefore(dayjs(batchMaxDate), "day")) {
      alert(`End date must be on or after batch last date: ${dayjs(batchMaxDate).format("YYYY-MM-DD")}`);
      return;
    }
    setClosureDate(newDate);
  };

  const handleClosureAnnounce = async () => {
    if (!closureBatch || !closureDate) {
      setClosureMessage("⚠️ Please select batch and date");
      return;
    }
    if (batchMaxDate && dayjs(closureDate).isBefore(dayjs(batchMaxDate), "day")) {
      setClosureMessage(`❌ End date must be on or after batch last date: ${dayjs(batchMaxDate).format("YYYY-MM-DD")}`);
      return;
    }
    try {
      const res = await fetch("http://localhost:5000/api/course-closure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch_no: closureBatch, end_date: closureDate }),
      });
      const result = await res.json();
      setClosureMessage(
        res.ok
          ? result.message || "✅ Course closure emails sent successfully"
          : "❌ Failed to send emails: " + (result.error || "Unknown error")
      );
    } catch (err) {
      setClosureMessage("❌ Failed to send emails: " + err.message);
    }
  };

  // Feedback Sharing
  const feedbackRoleOptions = [
    "IT Admin",
    "Learning Coordinator",
    "Trainer",
    "Management"
  ];

  const handleFeedbackRoleChange = (e) => {
    const { value, checked } = e.target;
    setFeedbackRoles((prev) =>
      checked
        ? Array.from(new Set([...prev, value.trim()]))
        : prev.filter((r) => r !== value.trim())
    );
  };

  const handleFeedbackFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target.result;
      let workbook;
      if (file.name.endsWith(".csv")) {
        const arr = new Uint8Array(data);
        workbook = XLSX.read(arr, { type: "array", raw: true });
      } else {
        workbook = XLSX.read(data, { type: "binary" });
      }
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      let jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
      jsonData = jsonData.map(row => {
        const { Name, Email, Phone, ...rest } = row;
        return rest;
      });
      const newWorksheet = XLSX.utils.json_to_sheet(jsonData);
      workbook.Sheets[sheetName] = newWorksheet;
      const wbout = XLSX.write(workbook, {
        bookType: file.name.endsWith(".csv") ? "csv" : "xlsx",
        type: "array"
      });
      const newFileBlob = new Blob([wbout], { type: file.type });
      const newFile = new File([newFileBlob], file.name, { type: file.type });
      setFeedbackFile(newFile);
    };

    if (file.name.endsWith(".csv")) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsBinaryString(file);
    }
  };

  const handleFeedbackBatchNo = (e) => setFeedbackBatchNo(e.target.value.trim());

  const handleSendFeedbackEmail = async () => {
    if (!feedbackBatchNo || feedbackRoles.length === 0 || !feedbackType || !feedbackFile) {
      setFeedbackMessage("⚠️ Please fill all feedback sharing fields and upload a file.");
      return;
    }
    // For frontend, simply send whatever roles are selected here.
    const rolesList = feedbackRoles.map(r => r.trim()).filter((v, i, arr) => arr.indexOf(v) === i);

    const formData = new FormData();
    formData.append("batchNo", feedbackBatchNo);
    formData.append("roles", JSON.stringify(rolesList));
    formData.append("feedbackType", feedbackType);
    formData.append("file", feedbackFile);

    try {
      const res = await fetch("http://localhost:5000/api/internal/feedback-share", {
        method: "POST",
        body: formData,
      });
      const result = await res.json();
      setFeedbackMessage(res.ok ? "✅ Feedback mail sent!" : "❌ " + result.error);
    } catch (err) {
      setFeedbackMessage("❌ Error: " + err.message);
    }
  };

  // --- Role-based title ---
  const roleTitle = user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "Dashboard";
  const welcomeName = user?.name ? user.name : "User";

  return (
    <Box maxWidth={900} mx="auto" my={4}>
      <Paper elevation={4} sx={{ p: { xs: 2, sm: 4 }, mb: 5, borderRadius: 3 }}>
        <Typography variant="h4" color="primary" gutterBottom>
          {roleTitle} Dashboard
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" mb={2}>
          Welcome, {welcomeName}!
        </Typography>

        {/* Internal Communication */}
        <Box my={3}>
          <Typography variant="h6" color="secondary" gutterBottom>
            📩 Internal Communication
          </Typography>
          <FormGroup row>
            {["IT Admin", "Learning Coordinator", "Trainer", "Management"].map((role) => (
              <FormControlLabel
                key={role}
                control={
                  <Checkbox
                    checked={roles.includes(role)}
                    value={role}
                    onChange={handleRoleChange}
                  />
                }
                label={role}
              />
            ))}
          </FormGroup>
          {roles.includes("Trainer") && (
            <FormControl sx={{ mt: 2, minWidth: 180 }}>
              <InputLabel>Domain</InputLabel>
              <Select value={domain} onChange={(e) => setDomain(e.target.value)} label="Domain">
                <MenuItem value="">--select--</MenuItem>
                <MenuItem value="PD">PD</MenuItem>
                <MenuItem value="DV">DV</MenuItem>
                <MenuItem value="DFT">DFT</MenuItem>
              </Select>
            </FormControl>
          )}
          <FormControl sx={{ mt: 2, minWidth: 200 }}>
            <InputLabel>Batch No</InputLabel>
            <Select value={batchNo} onChange={handleBatchChange} label="Batch No">
              <MenuItem value="">--select--</MenuItem>
              {batches.map((b) => (
                <MenuItem key={b.batch_no} value={b.batch_no}>
                  {b.batch_no} (Start: {b.start_date})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {batchStartDate && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              📅 <strong>Start Date:</strong> {dayjs(batchStartDate).format("DD-MMM-YYYY")}
            </Typography>
          )}
          <Button variant="contained" sx={{ mt: 2 }} onClick={handleSchedule}>
            📤 Schedule Emails
          </Button>
          {message && (
            <Fade in={!!message}>
              <Box mt={2}><Alert severity={message.startsWith("✅") ? "success" : "warning"}>{message}</Alert></Box>
            </Fade>
          )}
        </Box>

        <hr style={{ margin: "30px 0" }} />

        {/* Course Closure Announcement Section */}
        <Box my={3}>
          <Typography variant="h6" color="secondary" gutterBottom>
            📢 Course Closure Announcement to IT Admin
          </Typography>
          <FormControl sx={{ mt: 2, minWidth: 200 }}>
            <InputLabel>Batch No</InputLabel>
            <Select
              value={closureBatch}
              onChange={(e) => setClosureBatch(e.target.value)}
              label="Batch No"
            >
              <MenuItem value="">--select--</MenuItem>
              {batches.map((b) => (
                <MenuItem key={b.batch_no} value={b.batch_no}>
                  {b.batch_no}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            sx={{ mt: 2 }}
            label="End Date"
            type="date"
            value={closureDate}
            InputLabelProps={{ shrink: true }}
            inputProps={{ min: batchMaxDate || undefined }}
            onChange={handleClosureDateChange}
            fullWidth
          />
          {batchMaxDate && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Last date of batch: {dayjs(batchMaxDate).format("DD-MMM-YYYY")}
            </Typography>
          )}
          <Button variant="contained" sx={{ mt: 2 }} onClick={handleClosureAnnounce}>
            📤 Send Emails
          </Button>
          {closureMessage && (
            <Fade in={!!closureMessage}>
              <Box mt={2}><Alert severity={closureMessage.startsWith("✅") ? "success" : "warning"}>{closureMessage}</Alert></Box>
            </Fade>
          )}
        </Box>

        <hr style={{ margin: "30px 0" }} />

        {/* Feedback Sharing */}
        <Box my={3}>
          <Typography variant="h6" color="secondary" gutterBottom>
            🗣️ Feedback Sharing
          </Typography>

          <FormControl sx={{ mt: 2, minWidth: 200 }}>
            <InputLabel>Batch No</InputLabel>
            <Select value={feedbackBatchNo} onChange={handleFeedbackBatchNo} label="Batch No">
              <MenuItem value="">--select--</MenuItem>
              {batches.map((b) => (
                <MenuItem key={b.batch_no} value={b.batch_no}>
                  {b.batch_no}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormGroup row sx={{ mt: 2 }}>
            {feedbackRoleOptions.map((role) => (
              <FormControlLabel
                key={role}
                control={
                  <Checkbox
                    checked={feedbackRoles.includes(role)}
                    value={role}
                    onChange={handleFeedbackRoleChange}
                  />
                }
                label={role}
              />
            ))}
          </FormGroup>

          <FormControl sx={{ mt: 2, minWidth: 180 }}>
            <InputLabel>Feedback Type</InputLabel>
            <Select
              value={feedbackType}
              label="Feedback Type"
              onChange={e => setFeedbackType(e.target.value)}
            >
              <MenuItem value="">--select--</MenuItem>
              <MenuItem value="Intermediate Feedback">Intermediate Feedback</MenuItem>
              <MenuItem value="Final Feedback">Final Feedback</MenuItem>
            </Select>
          </FormControl>

          <Box sx={{ mt: 2 }}>
            <Button variant="outlined" component="label">
              Upload CSV/XLSX
              <input type="file" accept=".csv,.xlsx" hidden onChange={handleFeedbackFile} />
            </Button>
            {feedbackFile && <Typography variant="body2" sx={{ ml: 2 }}>{feedbackFile.name}</Typography>}
          </Box>

          <Button variant="contained" sx={{ mt: 2 }} onClick={handleSendFeedbackEmail}>
            📤 Send Email
          </Button>

          {feedbackMessage && (
            <Fade in={!!feedbackMessage}>
              <Box mt={2}>
                <Alert severity={feedbackMessage.startsWith("✅") ? "success" : "warning"}>
                  {feedbackMessage}
                </Alert>
              </Box>
            </Fade>
          )}

        </Box>
      </Paper>
    </Box>
  );
}

export default InternalCommunication;
