import React, { useState, useEffect } from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  TextField,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Alert,
  Fade,
  Chip,
} from "@mui/material";

const API_BASE = process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

function MarkSheet() {
  const [batchNo, setBatchNo] = useState("");
  const [availableBatches, setAvailableBatches] = useState([]);
  const [learners, setLearners] = useState([]);
  const [marks, setMarks] = useState({});
  const [outOff, setOutOff] = useState("");
  const [periods, setPeriods] = useState([]);
  const [periodValue, setPeriodValue] = useState("");
  const [selectedWeekNo, setSelectedWeekNo] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [message, setMessage] = useState("");
  const [isWindowOpen, setIsWindowOpen] = useState(true);
  const [windowCloseDate, setWindowCloseDate] = useState("");
  const [windowStatus, setWindowStatus] = useState("valid");
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDate(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch available batches on load
  useEffect(() => {
    fetch(`${API_BASE}/api/batches`)
      .then(res => res.json())
      .then(data => setAvailableBatches(data || []))
      .catch(err => console.error("Failed to load batches:", err));
  }, []);

  // Fetch learners when batchNo changes
  useEffect(() => {
    if (batchNo) {
      fetch(`${API_BASE}/apigetlearners?batchno=${encodeURIComponent(batchNo)}`)
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then(data => {
          const learnersClean = (data || []).filter(l => l.id).map(l => ({ ...l, id: l.id }));
          setLearners(learnersClean);
        })
        .catch(err => {
          console.error("Failed to load learners:", err);
          setLearners([]);
        });
    } else {
      setLearners([]);
    }
  }, [batchNo]);

  // Fetch periods for weekly-assessment
  useEffect(() => {
    if (batchNo) {
      fetch(`${API_BASE}/apiperiods/${encodeURIComponent(batchNo)}/weekly-assessment`)
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then(data => setPeriods(Array.isArray(data) ? data : []))
        .catch(err => {
          console.error("Failed to load periods:", err);
          setPeriods([]);
        });
      setPeriodValue("");
      setSelectedWeekNo("");
      setSelectedDate("");
      setIsWindowOpen(true);
      setWindowCloseDate("");
      setWindowStatus("valid");
    } else {
      setPeriods([]);
    }
  }, [batchNo]);

  // Check window when date changes
  useEffect(() => {
    if (selectedDate) {
      checkMarkEntryWindow(selectedDate);
    } else {
      setIsWindowOpen(true);
      setWindowCloseDate("");
      setWindowStatus("valid");
    }
  }, [selectedDate, currentDate]);

  const parseAssessmentDate = (dateStr) => {
    if (!dateStr) return null;
    const parts = dateStr.split(/[-\/]/);
    if (parts.length === 3) {
      const [d, m, y] = parts.map(Number);
      return new Date(y, m - 1, d);
    }
    return null;
  };

  const checkMarkEntryWindow = (assessmentDateStr) => {
    const assessmentDate = parseAssessmentDate(assessmentDateStr);
    if (!assessmentDate) {
      setWindowStatus("invalid");
      setIsWindowOpen(false);
      setWindowCloseDate("Invalid date");
      return;
    }
    const closeDate = new Date(assessmentDate);
    closeDate.setDate(assessmentDate.getDate() + 3); // 3 days for weekly-assessment
    const isOpen = currentDate <= closeDate;
    setIsWindowOpen(isOpen);
    setWindowCloseDate(closeDate.toLocaleDateString('en-GB'));
    setWindowStatus("valid");
  };

  const handlePeriodSelect = (e) => {
    setPeriodValue(e.target.value);
    const [w, d] = e.target.value.split("::");
    setSelectedWeekNo(w);
    setSelectedDate(d || "");
  };

  const handleMarksInput = (learnerId, value) => {
    if (!isWindowOpen) return;
    let val = value.replace(/[^0-9.]/g, "");
    let percentage = outOff ? Math.round((parseFloat(val) / parseFloat(outOff)) * 100) : "";
    setMarks(prev => ({
      ...prev,
      [learnerId]: { points: val, percentage },
    }));
  };

  const handleSave = async () => {
    if (!selectedDate || !outOff || !isWindowOpen) {
      setMessage("⚠️ Check inputs or window.");
      setTimeout(() => setMessage(""), 3000);
      return;
    }

    setMessage("⏳ Saving...");
    try {
      for (let learner of learners) {
        if (!marks[learner.id]?.points) continue;
        const payload = {
          learner_id: learner.id,
          batch_no: batchNo,
          assessment_date: selectedDate,
          out_off: outOff,
          points: marks[learner.id].points,
          percentage: marks[learner.id].percentage,
          week_no: selectedWeekNo,
        };

        const res = await fetch(`${API_BASE}/api/marks/weekly-assessment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Save failed");
        }
      }
      setMessage("✅ Marks saved!");
      setMarks({});
    } catch (err) {
      setMessage(`❌ Error: ${err.message}`);
    }
    setTimeout(() => setMessage(""), 5000);
  };

  const formatCurrentDate = () => {
    return currentDate.toLocaleDateString('en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", my: 3 }}>
      <Paper elevation={6} sx={{ p: 4, borderRadius: 3 }}>
        <Typography variant="h4" color="primary" gutterBottom>
          Weekly Assessment Marks Entry
        </Typography>
        <Box sx={{ textAlign: "right", mb: 3 }}>
          <Typography variant="h6">Current Date & Time: {formatCurrentDate()}</Typography>
        </Box>

        <Box sx={{ display: "flex", gap: 3, mb: 2, flexWrap: "wrap", alignItems: "end" }}>
          <FormControl sx={{ minWidth: 180 }}>
            <InputLabel>Batch No</InputLabel>
            <Select value={batchNo} onChange={(e) => setBatchNo(e.target.value)} size="small">
              <MenuItem value="">Select Batch</MenuItem>
              {availableBatches.map(batch => (
                <MenuItem key={batch} value={batch}>{batch}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Week No</InputLabel>
            <Select value={periodValue} onChange={handlePeriodSelect} size="small">
              <MenuItem value="">Select Week</MenuItem>
              {periods.map(p => (
                <MenuItem key={`${p.week_no}::${p.date}`} value={`${p.week_no}::${p.date}`}>
                  Week {p.week_no} ({p.date})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 160 }}>
            <TextField label="Out Off (Marks)" value={outOff} onChange={(e) => setOutOff(e.target.value.replace(/[^0-9]/g, ""))} size="small" />
          </FormControl>

          {selectedDate && (
            <Chip label={isWindowOpen ? `Open until ${windowCloseDate}` : `Closed (${windowCloseDate})`} color={isWindowOpen ? "success" : "error"} />
          )}
        </Box>

        <Table sx={{ minWidth: 800, mb: 3 }}>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Marks</TableCell>
              <TableCell>%</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {learners.map(learner => (
              <TableRow key={learner.id}>
                <TableCell>{learner.name}</TableCell>
                <TableCell>{learner.email}</TableCell>
                <TableCell>
                  <TextField value={marks[learner.id]?.points || ""} onChange={(e) => handleMarksInput(learner.id, e.target.value)} size="small" disabled={!isWindowOpen} />
                </TableCell>
                <TableCell>{marks[learner.id]?.percentage || ""}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Button variant="contained" onClick={handleSave} disabled={!isWindowOpen || !selectedWeekNo || !outOff}>
          Save Marks
        </Button>

        {message && (
          <Alert severity={message.startsWith("✅") ? "success" : "error"} sx={{ mt: 2 }}>
            {message}
          </Alert>
        )}
      </Paper>
    </Box>
  );
}

export default MarkSheet;