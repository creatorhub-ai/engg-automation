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
  process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

/* 🔑 SINGLE SOURCE OF TRUTH */
const ASSESSMENT_MAP = {
  weekly: {
    api: "weekly-assessment",
    label: "Weekly Assessment",
    days: 3,
  },
  intermediate: {
    api: "intermediate-assessment",
    label: "Intermediate Assessment",
    days: 5,
  },
  module: {
    api: "module-level-assessment",
    label: "Module Level Assessment",
    days: 5,
  },
  final: {
    api: "final-assessment",
    label: "Final Assessment",
    days: 7,
  },
};

/* SAFE DATE PARSER */
const parseDate = (str) => {
  if (!str) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(str)) {
    const [d, m, y] = str.split(/[-/]/).map(Number);
    return new Date(y, m - 1, d);
  }
  return null;
};

function MarkSheet() {
  const [batchNo, setBatchNo] = useState("");
  const [assessmentType, setAssessmentType] = useState("weekly");

  const [availableBatches, setAvailableBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(true);

  const [learners, setLearners] = useState([]);
  const [loadingLearners, setLoadingLearners] = useState(false);

  const [periods, setPeriods] = useState([]);
  const [periodValue, setPeriodValue] = useState("");
  const [selectedWeekNo, setSelectedWeekNo] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [topicName, setTopicName] = useState("");

  const [marks, setMarks] = useState({});
  const [outOff, setOutOff] = useState("");

  const [isWindowOpen, setIsWindowOpen] = useState(true);
  const [windowCloseDate, setWindowCloseDate] = useState("");

  const [message, setMessage] = useState("");
  const [currentDate, setCurrentDate] = useState(new Date());

  /* CLOCK */
  useEffect(() => {
    const i = setInterval(() => setCurrentDate(new Date()), 1000);
    return () => clearInterval(i);
  }, []);

  /* BATCHES */
  useEffect(() => {
    fetch(`${API_BASE}/api/batches`)
      .then((res) => res.json())
      .then((data) =>
        setAvailableBatches(
          Array.isArray(data)
            ? [...new Set(data.map((b) => (typeof b === "string" ? b : b.batch_no)))]
            : []
        )
      )
      .catch(() => setAvailableBatches([]))
      .finally(() => setLoadingBatches(false));
  }, []);

  /* LEARNERS */
  useEffect(() => {
    if (!batchNo) return setLearners([]);

    setLoadingLearners(true);
    fetch(`${API_BASE}/apigetlearners?batchno=${batchNo}`)
      .then((res) => res.json())
      .then((data) => setLearners(Array.isArray(data) ? data : []))
      .catch(() => setLearners([]))
      .finally(() => setLoadingLearners(false));
  }, [batchNo]);

  /* LOAD ASSESSMENT DATES */
  useEffect(() => {
    if (!batchNo) return;

    const apiType = ASSESSMENT_MAP[assessmentType].api;

    fetch(`${API_BASE}/apiperiods/${batchNo}/${apiType}`)
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => setPeriods(Array.isArray(data) ? data : []))
      .catch(() => setPeriods([]));

    setPeriodValue("");
    setSelectedDate("");
    setSelectedWeekNo("");
    setTopicName("");
  }, [batchNo, assessmentType]);

  /* WINDOW CHECK */
  useEffect(() => {
    if (!selectedDate) return;

    const cfg = ASSESSMENT_MAP[assessmentType];
    const date = parseDate(selectedDate);
    if (!date) return setIsWindowOpen(false);

    const close = new Date(date);
    close.setDate(close.getDate() + cfg.days);
    close.setHours(23, 59, 59, 999);

    setIsWindowOpen(currentDate <= close);
    setWindowCloseDate(close.toLocaleDateString("en-GB"));
  }, [selectedDate, assessmentType, currentDate]);

  /* HANDLERS */
  const handlePeriodSelect = (e) => {
    const [w, d, t] = e.target.value.split("::");
    setPeriodValue(e.target.value);
    setSelectedWeekNo(w);
    setSelectedDate(d);
    setTopicName(t);
  };

  const handleMarksInput = (id, val) => {
    if (!isWindowOpen) return;
    const points = val.replace(/\D/g, "");
    setMarks((p) => ({
      ...p,
      [id]: {
        points,
        percentage: outOff ? Math.round((points / outOff) * 100) : "",
      },
    }));
  };

  /* SAVE */
  const handleSave = async () => {
    const cfg = ASSESSMENT_MAP[assessmentType];

    try {
      for (const l of learners) {
        if (!marks[l.id]?.points) continue;

        const payload = {
          learner_id: l.id,
          batch_no: batchNo,
          assessment_date: selectedDate,
          assessment_name: cfg.label,
          out_off: Number(outOff),
          points: Number(marks[l.id].points),
          percentage: marks[l.id].percentage || null,
        };

        // ✅ DO NOT CHANGE EXISTING WORKING LOGIC
        if (assessmentType !== "module") {
          payload.week_no = Number(selectedWeekNo);
        }

        if (assessmentType === "module") {
          payload.module_no = Number(selectedWeekNo);
        }

        const response = await fetch(`${API_BASE}/api/marks/${cfg.api}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error("Save failed");
        }
      }

      setMessage("✅ Marks saved successfully");
      setMarks({});
    } catch (e) {
      console.error("Save error:", e);
      setMessage("❌ Failed to save marks");
    }

    setTimeout(() => setMessage(""), 4000);
  };

  /* UI */
  if (loadingBatches)
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 5 }}>
        <CircularProgress />
      </Box>
    );

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", my: 3 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4">Assessment Marks Entry</Typography>

        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 2 }}>
          <FormControl sx={{ minWidth: 220 }}>
            <InputLabel>Assessment Type</InputLabel>
            <Select value={assessmentType} onChange={(e) => setAssessmentType(e.target.value)}>
              <MenuItem value="weekly">Weekly</MenuItem>
              <MenuItem value="intermediate">Intermediate</MenuItem>
              <MenuItem value="module">Module Level</MenuItem>
              <MenuItem value="final">Final Assessment</MenuItem>
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 160 }}>
            <InputLabel>Batch</InputLabel>
            <Select value={batchNo} onChange={(e) => setBatchNo(e.target.value)}>
              {availableBatches.map((b) => (
                <MenuItem key={b} value={b}>{b}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 300 }}>
            <InputLabel>Assessment Date</InputLabel>
            <Select value={periodValue} onChange={handlePeriodSelect}>
              {periods.map((p) => (
                <MenuItem
                  key={`${p.week_no}-${p.date}`}
                  value={`${p.week_no}::${p.date}::${p.topic_name}`}
                >
                  Week {p.week_no} ({p.date})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField label="Out Of" value={outOff} onChange={(e) => setOutOff(e.target.value.replace(/\D/g, ""))} />
          {selectedDate && <Chip label={isWindowOpen ? `Open till ${windowCloseDate}` : "Closed"} />}
        </Box>

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
            {learners.map((l) => (
              <TableRow key={l.id}>
                <TableCell>{l.name}</TableCell>
                <TableCell>{topicName}</TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    value={marks[l.id]?.points || ""}
                    onChange={(e) => handleMarksInput(l.id, e.target.value)}
                  />
                </TableCell>
                <TableCell>{marks[l.id]?.percentage || ""}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Button sx={{ mt: 2 }} variant="contained" onClick={handleSave}>
          Save Marks
        </Button>

        {message && <Alert sx={{ mt: 2 }}>{message}</Alert>}
      </Paper>
    </Box>
  );
}

export default MarkSheet;
