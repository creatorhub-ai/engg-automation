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
  Chip,
  CircularProgress,
} from "@mui/material";

const API_BASE =
  process.env.REACT_APP_API_URL ||
  "https://engg-automation.onrender.com";

function MarkSheet() {
  const [batchNo, setBatchNo] = useState("");
  const [availableBatches, setAvailableBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(true);

  const [assessmentType, setAssessmentType] = useState("weekly");

  const [learners, setLearners] = useState([]);
  const [loadingLearners, setLoadingLearners] = useState(false);

  const [periods, setPeriods] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedWeekNo, setSelectedWeekNo] = useState("");
  const [topicName, setTopicName] = useState("");

  const [marks, setMarks] = useState({});
  const [outOff, setOutOff] = useState("");

  const [isWindowOpen, setIsWindowOpen] = useState(true);
  const [windowCloseDate, setWindowCloseDate] = useState("");

  const [message, setMessage] = useState("");
  const [currentDate, setCurrentDate] = useState(new Date());

  /* ---------------- CLOCK ---------------- */
  useEffect(() => {
    const i = setInterval(() => setCurrentDate(new Date()), 1000);
    return () => clearInterval(i);
  }, []);

  /* ---------------- FETCH BATCHES ---------------- */
  useEffect(() => {
    fetch(`${API_BASE}/api/batches`)
      .then(res => res.json())
      .then(data => {
        const batches = Array.isArray(data)
          ? [...new Set(data.map(b => (typeof b === "string" ? b : b.batch_no)))]
          : [];
        setAvailableBatches(batches);
      })
      .catch(() => setAvailableBatches([]))
      .finally(() => setLoadingBatches(false));
  }, []);

  /* ---------------- FETCH LEARNERS ---------------- */
  useEffect(() => {
    if (!batchNo) {
      setLearners([]);
      return;
    }

    setLoadingLearners(true);
    fetch(`${API_BASE}/apigetlearners?batchno=${batchNo}`)
      .then(res => res.json())
      .then(data => setLearners(Array.isArray(data) ? data : []))
      .catch(() => setLearners([]))
      .finally(() => setLoadingLearners(false));
  }, [batchNo]);

  /* ---------------- FETCH ASSESSMENT DATES ---------------- */
  useEffect(() => {
    if (!batchNo || !assessmentType) {
      setPeriods([]);
      setSelectedDate("");
      setTopicName("");
      setSelectedWeekNo("");
      return;
    }

    fetch(
      `${API_BASE}/api/assessment-dates?batch_no=${batchNo}&type=${assessmentType}`
    )
      .then(res => res.json())
      .then(data => setPeriods(Array.isArray(data) ? data : []))
      .catch(() => setPeriods([]));
  }, [batchNo, assessmentType]);

  /* ---------------- WINDOW CHECK ---------------- */
  useEffect(() => {
    if (!selectedDate) return;

    const d = new Date(selectedDate);
    const close = new Date(d);
    const extraDays = assessmentType === "weekly" ? 3 : 4;
    close.setDate(d.getDate() + extraDays);
    close.setHours(23, 59, 59, 999);

    setIsWindowOpen(currentDate <= close);
    setWindowCloseDate(close.toLocaleDateString("en-GB"));
  }, [selectedDate, assessmentType, currentDate]);

  /* ---------------- MARK INPUT ---------------- */
  const handleMarksInput = (learnerId, value) => {
    if (!isWindowOpen) return;

    const points = value.replace(/\D/g, "");
    const percentage =
      outOff && points ? Math.round((points / outOff) * 100) : "";

    setMarks(prev => ({
      ...prev,
      [learnerId]: { points, percentage },
    }));
  };

  /* ---------------- SAVE ---------------- */
  const handleSave = async () => {
    if (!selectedDate || !outOff || !isWindowOpen) {
      setMessage("⚠️ Missing required fields");
      return;
    }

    const endpointMap = {
      weekly: "/api/marks/weekly-assessment",
      intermediate: "/api/marks/intermediate-assessment",
      module: "/api/marks/module-level-assessment",
    };

    try {
      for (const l of learners) {
        if (!marks[l.id]?.points) continue;

        await fetch(`${API_BASE}${endpointMap[assessmentType]}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            learner_id: l.id,
            batch_no: batchNo,
            assessment_date: selectedDate,
            assessment_type: assessmentType,
            topic_name: topicName,
            out_off: outOff,
            points: marks[l.id].points,
            percentage: marks[l.id].percentage,
            week_no: selectedWeekNo || null,
          }),
        });
      }

      setMessage("✅ Marks saved successfully");
      setMarks({});
    } catch {
      setMessage("❌ Failed to save marks");
    }

    setTimeout(() => setMessage(""), 4000);
  };

  /* ---------------- UI ---------------- */
  if (loadingBatches) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 5 }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading batches…</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", my: 3 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom>
          Assessment Marks Entry
        </Typography>

        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 2 }}>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Assessment Type</InputLabel>
            <Select
              value={assessmentType}
              onChange={e => setAssessmentType(e.target.value)}
            >
              <MenuItem value="weekly">Weekly</MenuItem>
              <MenuItem value="intermediate">Intermediate</MenuItem>
              <MenuItem value="module">Module Level</MenuItem>
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 160 }}>
            <InputLabel>Batch</InputLabel>
            <Select value={batchNo} onChange={e => setBatchNo(e.target.value)}>
              {availableBatches.map(b => (
                <MenuItem key={b} value={b}>{b}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 220 }}>
            <InputLabel>Assessment Date</InputLabel>
            <Select
              value={selectedDate}
              onChange={e => {
                const val = e.target.value;
                setSelectedDate(val);
                const row = periods.find(p => p.date === val);
                setTopicName(row?.topic_name || "");
                setSelectedWeekNo(row?.week_no || "");
              }}
            >
              {Array.isArray(periods) &&
                periods.map(p => (
                  <MenuItem key={p.date} value={p.date}>
                    {p.date}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>

          <TextField
            label="Out Of"
            value={outOff}
            onChange={e => setOutOff(e.target.value.replace(/\D/g, ""))}
          />

          {selectedDate && (
            <Chip
              label={
                isWindowOpen
                  ? `Open till ${windowCloseDate}`
                  : `Closed (${windowCloseDate})`
              }
              color={isWindowOpen ? "success" : "error"}
            />
          )}
        </Box>

        {loadingLearners ? (
          <CircularProgress />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Topic</TableCell>
                <TableCell>Marks</TableCell>
                <TableCell>%</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {learners.map(l => (
                <TableRow key={l.id}>
                  <TableCell>{l.name}</TableCell>
                  <TableCell>{topicName || "-"}</TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      value={marks[l.id]?.points || ""}
                      disabled={!isWindowOpen}
                      onChange={e =>
                        handleMarksInput(l.id, e.target.value)
                      }
                    />
                  </TableCell>
                  <TableCell>{marks[l.id]?.percentage || ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Button
          sx={{ mt: 2 }}
          variant="contained"
          disabled={!isWindowOpen}
          onClick={handleSave}
        >
          Save Marks
        </Button>

        {message && <Alert sx={{ mt: 2 }}>{message}</Alert>}
      </Paper>
    </Box>
  );
}

export default MarkSheet;
