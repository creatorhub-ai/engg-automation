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
  { key: "weekly-assessment", label: "Weekly Assessment Score", topic: "Weekly Assessment", daysWindow: 3 },
  { key: "intermediate-assessment", label: "Intermediate Assessment Score", topic: "Intermediate Assessment", daysWindow: 5 },
  { key: "module-level-assessment", label: "Module Level Assessment", topic: "Module Level Assessment", daysWindow: 5 },
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
  const [windowStatus, setWindowStatus] = useState("valid");
  const [currentDate, setCurrentDate] = useState(new Date());

  const numberLabel = "Week No";

  // Update current date every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDate(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // ✅ FIXED: Correct date parsing for DD-MM-YYYY format
  const parseAssessmentDate = (dateStr) => {
    console.log("🔍 Parsing date:", dateStr);
    
    if (!dateStr || typeof dateStr !== 'string') return null;

    // Handle both DD-MM-YYYY and YYYY-MM-DD formats
    let day, month, year;
    
    // Try DD-MM-YYYY first (most common from your API)
    const ddmmyyyyMatch = dateStr.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
    if (ddmmyyyyMatch) {
      day = parseInt(ddmmyyyyMatch[1], 10);
      month = parseInt(ddmmyyyyMatch[2], 10);
      year = parseInt(ddmmyyyyMatch[3], 10);
    } 
    // Try YYYY-MM-DD format
    else {
      const yyyymmddMatch = dateStr.match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
      if (yyyymmddMatch) {
        year = parseInt(yyyymmddMatch[1], 10);
        month = parseInt(yyyymmddMatch[2], 10);
        day = parseInt(yyyymmddMatch[3], 10);
      } else {
        console.log("❌ No date pattern matched");
        return null;
      }
    }

    console.log("Parsed components:", { day, month, year });

    // Validate ranges
    if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > 2100) {
      console.log("❌ Invalid date components");
      return null;
    }

    // Create date object
    const date = new Date(year, month - 1, day);
    
    // Validate the date is valid (handles Feb 30th, etc.)
    if (isNaN(date.getTime()) || 
        date.getDate() !== day || 
        date.getMonth() !== month - 1 || 
        date.getFullYear() !== year) {
      console.log("❌ Invalid date");
      return null;
    }

    console.log("✅ Valid parsed date:", date.toISOString().split('T')[0]);
    return date;
  };

  // ✅ FIXED: Window validation with proper date calculation
  const checkMarkEntryWindow = (assessmentDateStr) => {
    console.log("🧮 Checking window for assessment date:", assessmentDateStr);
    
    const assessmentDate = parseAssessmentDate(assessmentDateStr);
    
    if (!assessmentDate) {
      console.log("❌ Cannot parse assessment date");
      setWindowStatus("invalid");
      setIsWindowOpen(false);
      setWindowCloseDate("Invalid date format");
      return { isOpen: false, closeDate: "Invalid date format" };
    }

    try {
      const now = currentDate;
      const typeConfig = ASSESSMENT_TYPES.find(t => t.key === assessmentType);
      const daysWindow = typeConfig?.daysWindow || 7;

      console.log("Assessment date:", assessmentDate.toLocaleDateString('en-GB'));
      console.log("Days window:", daysWindow);
      console.log("Current time:", now.toLocaleString('en-GB'));

      // Calculate closing date: assessment date + daysWindow days at 11:59 PM
      const closeDate = new Date(assessmentDate);
      closeDate.setDate(assessmentDate.getDate() + daysWindow);
      closeDate.setHours(23, 59, 59, 999);

      console.log("Calculated close date:", closeDate.toLocaleString('en-GB'));

      const isOpen = now <= closeDate;
      
      // Format close date properly as DD/MM/YYYY
      const closeDateFormatted = closeDate.toLocaleDateString('en-GB', {
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric'
      }) + `, ${closeDate.getHours().toString().padStart(2, '0')}:${closeDate.getMinutes().toString().padStart(2, '0')}`;

      console.log("Final window status:", { 
        now: now.toLocaleDateString('en-GB'), 
        closeDate: closeDate.toLocaleDateString('en-GB'), 
        isOpen 
      });

      setWindowStatus("valid");
      setIsWindowOpen(isOpen);
      setWindowCloseDate(closeDateFormatted);
      
      return { isOpen, closeDate: closeDateFormatted };
    } catch (error) {
      console.error("❌ Window check error:", error);
      setWindowStatus("error");
      return { isOpen: false, closeDate: "Error calculating window" };
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
      // Reset selections
      setPeriodValue(""); 
      setSelectedWeekNo(""); 
      setSelectedDate(""); 
      setSelectedTopic(""); 
      setIsWindowOpen(true); 
      setWindowCloseDate("");
      setWindowStatus("valid");
    } else {
      setPeriods([]);
    }
  }, [assessmentType, batchNo]);

  // Check window on date change
  useEffect(() => {
    if (selectedDate) {
      checkMarkEntryWindow(selectedDate);
    } else {
      setIsWindowOpen(true);
      setWindowCloseDate("");
      setWindowStatus("valid");
    }
  }, [selectedDate, assessmentType, currentDate]);

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

    const endpoint = `${API_BASE}/api/marks/${assessmentType}`;
    let anySaved = false;

    try {
      setMessage("⏳ Saving marks...");
      
      // Test API first
      console.log('🔍 Testing endpoint:', endpoint);
      
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

        console.log(`📤 Saving for ${learner.name}:`, payload);

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const errorText = await res.text();
          console.error('❌ Backend error:', res.status, errorText);
          throw new Error(`HTTP ${res.status}: ${errorText}`);
        }
        
        anySaved = true;
      }

      if (anySaved) {
        setMessage("✅ Marks saved successfully!");
        setMarks({});
      } else {
        setMessage("⚠️ Please enter points for at least one learner.");
      }
    } catch (err) {
      console.error("💥 Full error:", err);
      setMessage(`❌ Failed: ${err.message}`);
    }

    setTimeout(() => setMessage(""), 5000);
  };

  const currentType = ASSESSMENT_TYPES.find(at => at.key === assessmentType);

  // Format current date for display
  const formatCurrentDate = () => {
    const options = {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'Asia/Kolkata',
      timeZoneName: 'short'
    };
    return currentDate.toLocaleDateString('en-GB', options);
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", my: 3 }}>
      <Paper elevation={6} sx={{ p: 4, borderRadius: 3 }}>
        {/* Date display on top right */}
        <Box sx={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center", 
          mb: 3,
          flexWrap: "wrap",
          gap: 2
        }}>
          <Typography variant="h4" color="primary">
            Marks Entry Dashboard
          </Typography>
          <Box sx={{ 
            textAlign: "right", 
            p: 1.5, 
            bgcolor: "grey.50", 
            borderRadius: 2,
            border: "1px solid",
            borderColor: "grey.200"
          }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
              Current Date & Time
            </Typography>
            <Typography variant="h6" color="primary" fontWeight="bold">
              {formatCurrentDate()}
            </Typography>
          </Box>
        </Box>

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
                {windowStatus === "invalid" ? (
                  <Chip label="❌ Invalid date format" color="error" size="small" />
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
            <strong>❌ Invalid date format:</strong> {selectedDate}
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
          {isWindowOpen ? "💾 Save All Marks" : "🚫 Window Closed"}
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
