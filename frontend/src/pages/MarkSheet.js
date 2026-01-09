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

const ASSESSMENT_TYPES = [
  { key: "weekly-assessment", label: "Weekly Assessment Score", topic: "Weekly Assessment", daysWindow: 4 },
  { key: "intermediate-assessment", label: "Intermediate Assessment Score", topic: "Intermediate Assessment", daysWindow: 5 },
  { key: "module-level-assessment", label: "Module Level Assessment", topic: "Module Level Assessment", daysWindow: 6 },
  { key: "weekly-quiz", label: "Weekly Quiz", topic: "Weekly Quiz", daysWindow: 7 },
];

function MarkSheet() {
  const [batchNo, setBatchNo] = useState("");
  const [assessmentType, setAssessmentType] = useState(ASSESSMENT_TYPES[0].key);
  const [learners, setLearners] = useState([]);
  const [marks, setMarks] = useState({});
  const [outOff, setOutOff] = useState("");
  const [periods, setPeriods] = useState([]);
  const [periodValue, setPeriodValue] = useState("");
  const [selectedWeekNo, setSelectedWeekNo] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("");
  const [message, setMessage] = useState("");
  const [isWindowOpen, setIsWindowOpen] = useState(true);
  const [windowCloseDate, setWindowCloseDate] = useState("");
  const [windowStatus, setWindowStatus] = useState("checking");

  const numberLabel = "Week No";

  // ✅ FIXED: Robust date parsing for ALL formats
  const parseAssessmentDate = (dateStr) => {
    if (!dateStr) return null;

    // Handle DD-MM-YYYY, DD/MM/YYYY, DD-MM-YY, DD/MM/YY
    const dashPattern = /(\d{1,2})-(\d{1,2})-(\d{4}|\d{2})/;
    const slashPattern = /(\d{1,2})[\/](\d{1,2})[\/](\d{4}|\d{2})/;

    let day, month, year;

    // Try dash format first (API common format)
    let match = dateStr.match(dashPattern);
    if (match) {
      day = parseInt(match[1], 10);
      month = parseInt(match[2], 10);
      year = parseInt(match[3], 10);
    } else {
      // Try slash format
      match = dateStr.match(slashPattern);
      if (match) {
        day = parseInt(match[1], 10);
        month = parseInt(match[2], 10);
        year = parseInt(match[3], 10);
      }
    }

    if (!day || !month || !year || day > 31 || month > 12) return null;

    // Handle 2-digit years (00-29 = 2000-2029, 30-99 = 1930-1999)
    if (year < 100) {
      year = year >= 30 ? 1900 + year : 2000 + year;
    }

    const date = new Date(year, month - 1, day);
    
    // Validate parsed date
    if (date.getDate() !== day || date.getMonth() !== month - 1 || date.getFullYear() !== year) {
      return null;
    }

    return date;
  };

  // ✅ FIXED: Window validation logic
  const checkMarkEntryWindow = (assessmentDateStr) => {
    const assessmentDate = parseAssessmentDate(assessmentDateStr);
    
    if (!assessmentDate) {
      setWindowStatus("invalid");
      setIsWindowOpen(false);
      setWindowCloseDate("Invalid date format");
      return { isOpen: false, closeDate: "Invalid date format" };
    }

    try {
      const now = new Date(); // Current: 09/01/2026 09:42 AM IST
      const typeConfig = ASSESSMENT_TYPES.find(t => t.key === assessmentType);
      const daysWindow = typeConfig?.daysWindow || 7;

      // Check reasonable date range (past 90 days to future 60 days)
      const minDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      const maxDate = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

      if (assessmentDate < minDate || assessmentDate > maxDate) {
        setWindowStatus("out_of_range");
        setIsWindowOpen(false);
        setWindowCloseDate("Date out of valid range");
        return { isOpen: false, closeDate: "Date out of valid range" };
      }

      // Calculate closing date (end of day)
      const closeDate = new Date(assessmentDate);
      closeDate.setDate(assessmentDate.getDate() + daysWindow);
      closeDate.setHours(23, 59, 59, 999);

      const isOpen = now <= closeDate;
      
      const closeDateStr = closeDate.toLocaleDateString('en-GB', {
        day: '2-digit', month: '2-digit', year: 'numeric', 
        hour: '2-digit', minute: '2-digit', hour12: false
      });

      setWindowStatus("valid");
      setIsWindowOpen(isOpen);
      setWindowCloseDate(closeDateStr);
      
      return { isOpen, closeDate: closeDateStr };
    } catch (error) {
      console.error("Window check error:", error);
      setWindowStatus("error");
      return { isOpen: false, closeDate: "Error checking window" };
    }
  };

  // Load learners
  useEffect(() => {
    if (batchNo) {
      fetch(`${API_BASE}/apigetlearners?batchno=${encodeURIComponent(batchNo)}`)
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then(data => {
          const learnersClean = (data || [])
            .filter(l => l.id)
            .map(l => ({ ...l, id: l.id }));
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

  // Load periods
  useEffect(() => {
    if (batchNo) {
      fetch(`${API_BASE}/apiperiods/${encodeURIComponent(batchNo)}/${encodeURIComponent(assessmentType)}`)
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then(data => setPeriods(Array.isArray(data) ? data : []))
        .catch(err => {
          console.error("Failed to load periods:", err);
          setPeriods([]);
        });
      // Reset
      setPeriodValue(""); 
      setSelectedWeekNo(""); 
      setSelectedDate(""); 
      setSelectedTopic(""); 
      setIsWindowOpen(true); 
      setWindowCloseDate("");
      setWindowStatus("checking");
    } else {
      setPeriods([]);
    }
  }, [assessmentType, batchNo]);

  // ✅ FIXED: Check window immediately when date selected
  useEffect(() => {
    if (selectedDate) {
      checkMarkEntryWindow(selectedDate);
    } else {
      setIsWindowOpen(true);
      setWindowCloseDate("");
      setWindowStatus("checking");
    }
  }, [selectedDate, assessmentType]);

  const handlePeriodSelect = (e) => {
    setPeriodValue(e.target.value);
    const [w, d, t] = e.target.value.split("::");
    setSelectedWeekNo(w);
    setSelectedDate(d || "");
    setSelectedTopic(t || "");
  };

  const handleMarksInput = (learnerId, value) => {
    if (!isWindowOpen || windowStatus !== "valid") return;
    
    let val = value.replace(/[^0-9.]/g, "");
    let percentage = "";
    if (outOff && val !== "") {
      percentage = Math.round((parseFloat(val) / parseFloat(outOff)) * 100);
    }
    setMarks(prev => ({
      ...prev,
      [learnerId]: {
        ...prev[learnerId],
        points: val,
        percentage: percentage !== "" ? percentage : "",
      },
    }));
  };

  const handleSave = async () => {
    if (!selectedWeekNo || !outOff) {
      setMessage("⚠️ Select week and out-off before saving.");
      setTimeout(() => setMessage(""), 3000);
      return;
    }

    if (!isWindowOpen || windowStatus !== "valid") {
      setMessage("❌ Mark entry window CLOSED. Cannot save marks.");
      setTimeout(() => setMessage(""), 5000);
      return;
    }

    if (windowStatus === "checking") {
      setMessage("⏳ Please wait for window validation...");
      setTimeout(() => setMessage(""), 3000);
      return;
    }

    const endpoint = `${API_BASE}/api/marks/${assessmentType}`;
    let anySaved = false;

    try {
      for (let learner of learners) {
        if (!marks[learner.id]?.points) continue;
        
        const payload = {
          learner_id: learner.id,
          batch_no: batchNo,
          week_no: selectedWeekNo,
          assessment_date: selectedDate,
          out_off: outOff,
          points: marks[learner.id].points,
          percentage: marks[learner.id].percentage || null,
        };

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${res.status}`);
        }
        anySaved = true;
      }

      if (anySaved) {
        setMessage("✅ Marks saved successfully!");
        setMarks({}); // Clear after save
      } else {
        setMessage("⚠️ Please enter points for at least one learner.");
      }
    } catch (err) {
      console.error("Save error:", err);
      setMessage(`❌ Error: ${err.message}`);
    }

    setTimeout(() => setMessage(""), 4000);
  };

  const currentType = ASSESSMENT_TYPES.find(at => at.key === assessmentType);

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", my: 3 }}>
      <Paper elevation={6} sx={{ p: 4, borderRadius: 3 }}>
        <Typography variant="h4" color="primary" gutterBottom>
          Marks Entry Dashboard
        </Typography>

        <Box sx={{ display: "flex", gap: 3, mb: 2, flexWrap: "wrap", alignItems: "end" }}>
          <FormControl sx={{ minWidth: 180 }}>
            <TextField label="Batch No" value={batchNo} onChange={(e) => setBatchNo(e.target.value)} size="small" />
          </FormControl>
          
          <FormControl sx={{ minWidth: 260 }}>
            <InputLabel>Assessment Type</InputLabel>
            <Select label="Assessment Type" value={assessmentType} onChange={(e) => setAssessmentType(e.target.value)} size="small">
              {ASSESSMENT_TYPES.map(at => (
                <MenuItem key={at.key} value={at.key}>{at.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>{numberLabel}</InputLabel>
            <Select label={numberLabel} value={periodValue} onChange={handlePeriodSelect} size="small">
              <MenuItem value="">Select {numberLabel}</MenuItem>
              {periods.map(p => (
                <MenuItem key={`${p.week_no}::${p.date}::${p.topic_name}`} value={`${p.week_no}::${p.date}::${p.topic_name}`}>
                  {p.week_no} {p.date ? `(${p.date})` : ""}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <FormControl sx={{ minWidth: 160 }}>
            <TextField
              label="Out Off (Marks)"
              type="number"
              inputProps={{ min: 1 }}
              value={outOff}
              onChange={(e) => setOutOff(e.target.value.replace(/[^0-9]/g, ""))}
              size="small"
            />
          </FormControl>

          {selectedDate && (
            <>
              <Box sx={{ px: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  <b>Date:</b> {selectedDate}
                </Typography>
              </Box>
              <Box sx={{ px: 2 }}>
                {windowStatus === "checking" ? (
                  <Chip label="⏳ Checking window..." color="info" size="small" />
                ) : windowStatus === "invalid" ? (
                  <Chip label="❌ Invalid date format" color="error" size="small" />
                ) : windowStatus === "out_of_range" ? (
                  <Chip label="📅 Out of range" color="warning" size="small" />
                ) : isWindowOpen ? (
                  <Chip label={`✅ Open until ${windowCloseDate}`} color="success" size="small" />
                ) : (
                  <Chip label={`❌ CLOSED (${windowCloseDate})`} color="error" size="small" />
                )}
              </Box>
            </>
          )}
        </Box>

        {selectedDate && !isWindowOpen && windowStatus === "valid" && (
          <Alert severity="error" sx={{ mb: 3 }}>
            <strong>🚫 Mark entry window CLOSED</strong> for {selectedDate}. 
            Last date was <strong>{windowCloseDate}</strong>.
          </Alert>
        )}

        {windowStatus === "invalid" && selectedDate && (
          <Alert severity="error" sx={{ mb: 3 }}>
            <strong>❌ Invalid date format:</strong> {selectedDate}. Please check the date.
          </Alert>
        )}

        <Typography variant="h6" color="primary" sx={{ mb: 2, mt: 4 }}>
          {currentType?.label}
        </Typography>

        <Paper sx={{ mb: 3, overflowX: 'auto' }}>
          <Table sx={{ minWidth: 800 }}>
            <TableHead>
              <TableRow>
                <TableCell><b>Name</b></TableCell>
                <TableCell><b>Email</b></TableCell>
                <TableCell><b>Topic</b></TableCell>
                <TableCell><b>Marks</b></TableCell>
                <TableCell><b>%</b></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {learners.map(learner => (
                <TableRow key={learner.id}>
                  <TableCell>{learner.name}</TableCell>
                  <TableCell>{learner.email}</TableCell>
                  <TableCell>{selectedTopic}</TableCell>
                  <TableCell>
                    <TextField
                      type="number"
                      value={marks[learner.id]?.points || ""}
                      inputProps={{ min: 0, max: outOff || undefined }}
                      onChange={(e) => handleMarksInput(learner.id, e.target.value)}
                      size="small"
                      disabled={!isWindowOpen || windowStatus !== "valid" || !selectedWeekNo || !outOff}
                      sx={{ width: 100 }}
                    />
                  </TableCell>
                  <TableCell>
                    {marks[learner.id]?.percentage && outOff ? `${marks[learner.id].percentage}%` : ""}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>

        <Button
          variant="contained"
          color="primary"
          fullWidth
          onClick={handleSave}
          disabled={!isWindowOpen || windowStatus !== "valid" || !selectedWeekNo || !outOff}
          sx={{ py: 1.5, fontSize: "1.1rem", fontWeight: 600 }}
        >
          {windowStatus === "checking" ? "⏳ Checking..." : 
           isWindowOpen ? "💾 Save All Marks" : "🚫 Window Closed"}
        </Button>

        {message && (
          <Fade in={true} timeout={500}>
            <Alert severity={
              message.startsWith("✅") ? "success" :
              message.startsWith("⚠️") ? "warning" : "error"
            } sx={{ mt: 2 }} onClose={() => setMessage("")}>
              {message}
            </Alert>
          </Fade>
        )}
      </Paper>
    </Box>
  );
}

export default MarkSheet;
