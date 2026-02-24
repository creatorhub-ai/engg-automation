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
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!Array.isArray(data)) {
          setPeriods([]);
          return;
        }

        // ✅ Remove only exact duplicate rows
        const uniqueMap = new Map();

        data.forEach((item) => {
          const key = `${item.week_no}-${item.date}-${item.topic_name}`;
          if (!uniqueMap.has(key)) {
            uniqueMap.set(key, item);
          }
        });

        setPeriods(Array.from(uniqueMap.values()));
      })
      .catch((err) => {
        console.error("Failed to load periods:", err);
        setPeriods([]);
      });

    setPeriodValue("");
    setSelectedDate("");
    setSelectedWeekNo("");
    setTopicName("");
    setMarks({});
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
    const val = e.target.value;
    // value format: "weekNo::date::topicName"
    const parts = val.split("::");
    const w = parts[0] || "";
    const d = parts[1] || "";
    const t = parts.slice(2).join("::"); // topic name may contain "::"
    setPeriodValue(val);
    setSelectedWeekNo(w);
    setSelectedDate(d);
    setTopicName(t);
    setMarks({});
  };

  const handleMarksInput = (id, val) => {
    if (!isWindowOpen) return;
    const points = val.replace(/\D/g, "");
    setMarks((p) => ({
      ...p,
      [id]: {
        points,
        percentage:
          outOff && Number(outOff) > 0
            ? Math.round((Number(points) / Number(outOff)) * 100)
            : "",
      },
    }));
  };

  /* SAVE */
  const handleSave = async () => {
    if (!batchNo || !selectedDate || !outOff) {
      setMessage("❌ Please select batch, assessment date and fill Out Of value.");
      setTimeout(() => setMessage(""), 4000);
      return;
    }

    if (!isWindowOpen) {
      setMessage("❌ The marks entry window is closed for this assessment.");
      setTimeout(() => setMessage(""), 4000);
      return;
    }

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
          percentage: marks[l.id].percentage !== "" ? marks[l.id].percentage : null,
        };

        // ✅ week_no for weekly / intermediate / final; module_no for module
        if (assessmentType === "module") {
          payload.module_no = Number(selectedWeekNo);
        } else {
          payload.week_no = Number(selectedWeekNo);
        }

        const response = await fetch(`${API_BASE}/api/marks/${cfg.api}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${response.status}`);
        }
      }

      setMessage("✅ Marks saved successfully");
      setMarks({});
    } catch (e) {
      console.error("Save error:", e);
      setMessage(`❌ Failed to save marks: ${e.message}`);
    }

    setTimeout(() => setMessage(""), 5000);
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
        <Typography variant="h4" sx={{ mb: 3 }}>
          Assessment Marks Entry
        </Typography>

        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 3, alignItems: "center" }}>
          {/* Assessment Type */}
          <FormControl sx={{ minWidth: 220 }}>
            <InputLabel>Assessment Type</InputLabel>
            <Select
              value={assessmentType}
              label="Assessment Type"
              onChange={(e) => {
                setAssessmentType(e.target.value);
                setPeriods([]);
                setPeriodValue("");
                setSelectedDate("");
                setSelectedWeekNo("");
                setTopicName("");
                setMarks({});
              }}
            >
              <MenuItem value="weekly">Weekly Assessment</MenuItem>
              <MenuItem value="intermediate">Intermediate Assessment</MenuItem>
              <MenuItem value="module">Module Level Assessment</MenuItem>
              <MenuItem value="final">Final Assessment</MenuItem>
            </Select>
          </FormControl>

          {/* Batch */}
          <FormControl sx={{ minWidth: 160 }}>
            <InputLabel>Batch</InputLabel>
            <Select
              value={batchNo}
              label="Batch"
              onChange={(e) => {
                setBatchNo(e.target.value);
                setPeriods([]);
                setPeriodValue("");
                setSelectedDate("");
                setSelectedWeekNo("");
                setTopicName("");
                setMarks({});
              }}
            >
              {availableBatches.map((b) => (
                <MenuItem key={b} value={b}>
                  {b}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Assessment Date / Period */}
          <FormControl sx={{ minWidth: 300 }}>
            <InputLabel>Assessment Date</InputLabel>
            <Select
              value={periodValue}
              label="Assessment Date"
              onChange={handlePeriodSelect}
              disabled={!batchNo || periods.length === 0}
            >
              {periods.length === 0 && (
                <MenuItem value="" disabled>
                  {batchNo ? "No assessments found" : "Select a batch first"}
                </MenuItem>
              )}
              {periods.map((p, idx) => (
                <MenuItem
                  key={`${p.week_no ?? idx}-${p.date}`}
                  value={`${p.week_no ?? ""}::${p.date}::${p.topic_name}`}
                >
                  {assessmentType === "module"
                    ? `Module ${p.week_no} (${p.date})`
                    : `Week ${p.week_no} (${p.date})`}
                  {p.topic_name ? ` — ${p.topic_name}` : ""}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Out Of */}
          <TextField
            label="Out Of"
            value={outOff}
            sx={{ width: 110 }}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "");
              setOutOff(v);
              // Recalculate percentages when outOff changes
              if (v) {
                setMarks((prev) => {
                  const updated = { ...prev };
                  Object.keys(updated).forEach((id) => {
                    if (updated[id]?.points) {
                      updated[id] = {
                        ...updated[id],
                        percentage: Math.round(
                          (Number(updated[id].points) / Number(v)) * 100
                        ),
                      };
                    }
                  });
                  return updated;
                });
              }
            }}
          />

          {/* Window status chip */}
          {selectedDate && (
            <Chip
              label={
                isWindowOpen
                  ? `Open till ${windowCloseDate}`
                  : `Closed (was ${windowCloseDate})`
              }
              color={isWindowOpen ? "success" : "error"}
              variant="outlined"
            />
          )}
        </Box>

        {/* Loading learners */}
        {loadingLearners && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
            <CircularProgress size={20} />
            <Typography variant="body2">Loading learners…</Typography>
          </Box>
        )}

        {/* Marks table */}
        {!loadingLearners && learners.length > 0 && (
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                <TableCell><strong>#</strong></TableCell>
                <TableCell><strong>Name</strong></TableCell>
                <TableCell><strong>Email</strong></TableCell>
                <TableCell><strong>Topic</strong></TableCell>
                <TableCell><strong>Marks</strong></TableCell>
                <TableCell><strong>%</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {learners.map((l, idx) => (
                <TableRow key={l.id} hover>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell>{l.name}</TableCell>
                  <TableCell>{l.email}</TableCell>
                  <TableCell>{topicName || "—"}</TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      sx={{ width: 90 }}
                      value={marks[l.id]?.points || ""}
                      disabled={!isWindowOpen || !selectedDate}
                      onChange={(e) => handleMarksInput(l.id, e.target.value)}
                      placeholder={outOff ? `/ ${outOff}` : ""}
                    />
                  </TableCell>
                  <TableCell>
                    {marks[l.id]?.percentage !== undefined && marks[l.id]?.percentage !== ""
                      ? `${marks[l.id].percentage}%`
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {!loadingLearners && batchNo && learners.length === 0 && (
          <Alert severity="info" sx={{ mt: 2 }}>
            No learners found for batch {batchNo}.
          </Alert>
        )}

        {/* Save button */}
        <Button
          sx={{ mt: 3 }}
          variant="contained"
          onClick={handleSave}
          disabled={!isWindowOpen || !selectedDate || learners.length === 0}
        >
          Save Marks
        </Button>

        {message && (
          <Alert
            severity={message.startsWith("✅") ? "success" : "error"}
            sx={{ mt: 2 }}
          >
            {message}
          </Alert>
        )}
      </Paper>
    </Box>
  );
}

export default MarkSheet;