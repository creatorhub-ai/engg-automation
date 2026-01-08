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

const API_BASE =
  process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

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

  const numberLabel = "Week No";

  // Calculate days window based on assessment type
  const getDaysWindow = () => {
    const type = ASSESSMENT_TYPES.find(t => t.key === assessmentType);
    return type?.daysWindow || 7;
  };

  // Check if mark entry window is open
  const checkMarkEntryWindow = (assessmentDate) => {
    if (!assessmentDate) return true;
    
    try {
      // Parse assessment date (format: DD/MM/YYYY)
      const [day, month, year] = assessmentDate.split('/');
      const assessment = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
      
      // Calculate close date (end of day)
      const daysWindow = getDaysWindow();
      const closeDate = new Date(assessment);
      closeDate.setDate(assessment.getDate() + daysWindow);
      closeDate.setHours(23, 59, 59, 999);
      
      const now = new Date();
      const isOpen = now <= closeDate;
      
      // Format close date for display
      const closeDateStr = closeDate.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      
      setWindowCloseDate(closeDateStr);
      setIsWindowOpen(isOpen);
      return isOpen;
    } catch (error) {
      console.error("Date parsing error:", error);
      return true;
    }
  };

  // Load learners for batch
  useEffect(() => {
    if (batchNo) {
      fetch(`${API_BASE}/apigetlearners?batchno=${encodeURIComponent(batchNo)}`)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((data) => {
          const learnersClean = (data || [])
            .filter((l) => l.id)
            .map((l) => ({ ...l, id: l.id }));
          setLearners(learnersClean);
        })
        .catch((err) => {
          console.error("Failed to load learners:", err);
          setLearners([]);
        });
    } else {
      setLearners([]);
    }
  }, [batchNo]);

  // Load periods (week/date/topic) for batch + assessment type
  useEffect(() => {
    if (batchNo) {
      fetch(
        `${API_BASE}/apiperiods/${encodeURIComponent(
          batchNo
        )}/${encodeURIComponent(assessmentType)}`
      )
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((data) => setPeriods(Array.isArray(data) ? data : []))
        .catch((err) => {
          console.error("Failed to load periods:", err);
          setPeriods([]);
        });
      setPeriodValue("");
      setSelectedWeekNo("");
      setSelectedDate("");
      setSelectedTopic("");
      setIsWindowOpen(true);
      setWindowCloseDate("");
    } else {
      setPeriods([]);
    }
  }, [assessmentType, batchNo]);

  // Check window when period is selected
  useEffect(() => {
    if (selectedDate) {
      checkMarkEntryWindow(selectedDate);
    }
  }, [selectedDate, assessmentType]);

  const handlePeriodSelect = (e) => {
    setPeriodValue(e.target.value);
    const [w, d, t] = e.target.value.split("::");
    setSelectedWeekNo(w);
    setSelectedDate(d);
    setSelectedTopic(t);
  };

  const handleMarksInput = (learnerId, value) => {
    let val = value.replace(/[^0-9.]/g, "");
    let percentage = "";
    if (outOff && val !== "") {
      percentage = Math.round((parseFloat(val) / parseFloat(outOff)) * 100);
    }
    setMarks((prev) => ({
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

    if (!isWindowOpen) {
      setMessage("❌ Mark entry window is closed. Cannot save marks.");
      setTimeout(() => setMessage(""), 5000);
      return;
    }

    const endpoint = `${API_BASE}/api/marks/${assessmentType}`;
    let anySaved = false;

    try {
      for (let learner of learners) {
        if (!marks[learner.id] || !marks[learner.id].points) continue;
        const baseData = {
          learner_id: learner.id,
          batch_no: batchNo,
          week_no: selectedWeekNo,
          assessment_date: selectedDate,
          out_off: outOff,
        };
        const payload = { ...baseData, ...marks[learner.id] };

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to save marks");
        }
        anySaved = true;
      }
      if (anySaved) {
        setMessage("✅ Marks saved successfully!");
      } else {
        setMessage("⚠️ Please enter points for at least one learner.");
      }
    } catch (err) {
      console.error("Error saving marks:", err);
      setMessage("❌ Error saving marks: " + err.message);
    }

    setTimeout(() => setMessage(""), 3000);
  };

  const currentType = ASSESSMENT_TYPES.find((at) => at.key === assessmentType);

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", my: 3 }}>
      <Paper elevation={6} sx={{ p: 4, borderRadius: 3 }}>
        <Typography variant="h4" color="primary" gutterBottom>
          Marks Entry Dashboard
        </Typography>

        <Box sx={{ display: "flex", gap: 3, mb: 2, flexWrap: "wrap" }}>
          <FormControl sx={{ minWidth: 180 }}>
            <TextField
              label="Batch No"
              value={batchNo}
              onChange={(e) => setBatchNo(e.target.value)}
              size="small"
            />
          </FormControl>
          <FormControl sx={{ minWidth: 260 }}>
            <InputLabel>Assessment Type</InputLabel>
            <Select
              label="Assessment Type"
              value={assessmentType}
              onChange={(e) => setAssessmentType(e.target.value)}
              size="small"
            >
              {ASSESSMENT_TYPES.map((at) => (
                <MenuItem key={at.key} value={at.key}>
                  {at.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>{numberLabel}</InputLabel>
            <Select
              label={numberLabel}
              value={periodValue}
              onChange={handlePeriodSelect}
              size="small"
            >
              <MenuItem value="">Select {numberLabel}</MenuItem>
              {Array.isArray(periods) &&
                periods.map((p) => (
                  <MenuItem
                    key={`${p.week_no}::${p.date}::${p.topic_name}`}
                    value={`${p.week_no}::${p.date}::${p.topic_name}`}
                  >
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
              onChange={(e) =>
                setOutOff(e.target.value.replace(/[^0-9]/g, ""))
              }
              size="small"
            />
          </FormControl>
          {selectedDate && (
            <>
              <Box sx={{ display: "flex", alignItems: "center", px: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  <b>Date:</b> {selectedDate}
                </Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", px: 2 }}>
                {isWindowOpen ? (
                  <Chip 
                    label={`Window Open until ${windowCloseDate}`} 
                    color="success" 
                    size="small"
                  />
                ) : (
                  <Chip 
                    label={`Window Closed (${windowCloseDate})`} 
                    color="error" 
                    size="small"
                  />
                )}
              </Box>
            </>
          )}
        </Box>

        <Typography variant="h6" color="primary" sx={{ mb: 2, mt: 4 }}>
          {currentType?.label}
        </Typography>

        {!isWindowOpen && selectedDate && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="body2">
              Mark entry window is closed for {selectedDate}. 
              Last date was <strong>{windowCloseDate}</strong>.
            </Typography>
          </Alert>
        )}

        <Paper sx={{ mb: 3 }}>
          <Table sx={{ minWidth: 800 }}>
            <TableHead>
              <TableRow>
                <TableCell><b>Name</b></TableCell>
                <TableCell><b>Email</b></TableCell>
                <TableCell><b>Topic Name</b></TableCell>
                <TableCell><b>Marks Scored</b></TableCell>
                <TableCell><b>Percentage</b></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {learners.map((learner) => (
                <TableRow key={String(learner.id)}>
                  <TableCell>{learner.name}</TableCell>
                  <TableCell>{learner.email}</TableCell>
                  <TableCell>{selectedTopic}</TableCell>
                  <TableCell>
                    <TextField
                      type="number"
                      value={marks[learner.id]?.points || ""}
                      inputProps={{
                        min: 0,
                        max: outOff || "",
                      }}
                      onChange={(e) =>
                        handleMarksInput(learner.id, e.target.value)
                      }
                      size="small"
                      disabled={!selectedWeekNo || !outOff || !isWindowOpen}
                    />
                  </TableCell>
                  <TableCell>
                    {marks[learner.id]?.percentage && outOff
                      ? `${marks[learner.id].percentage}%`
                      : ""}
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
          sx={{
            py: 1.5,
            fontWeight: "bold",
            mb: 2,
            fontSize: "1rem",
            boxShadow: 4,
          }}
          disabled={!selectedWeekNo || !outOff || !isWindowOpen}
        >
          {isWindowOpen ? "Save All" : "Window Closed"}
        </Button>
        <Fade in={!!message}>
          <Box>
            {message && (
              <Alert
                severity={
                  message.startsWith("✅")
                    ? "success"
                    : message.startsWith("⚠️")
                    ? "warning"
                    : "error"
                }
              >
                {message}
              </Alert>
            )}
          </Box>
        </Fade>
      </Paper>
    </Box>
  );
}

export default MarkSheet;
