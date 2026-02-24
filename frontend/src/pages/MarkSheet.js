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
  final_project: {
    api: "final-project",
    label: "Final Project",
    autoDate: true,
  },
  viva: {
    api: "viva",
    label: "Viva",
    autoDate: true,
  },
};

const todayDate = new Date().toISOString().split("T")[0];

const parseDate = (str) => {
  if (!str) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split("-").map(Number);
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

  const isAutoDateAssessment =
    assessmentType === "final_project" || assessmentType === "viva";

  /* CLOCK */
  useEffect(() => {
    const i = setInterval(() => setCurrentDate(new Date()), 1000);
    return () => clearInterval(i);
  }, []);

  /* LOAD BATCHES */
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
      .finally(() => setLoadingBatches(false));
  }, []);

  /* LOAD LEARNERS */
  useEffect(() => {
    if (!batchNo) return setLearners([]);

    setLoadingLearners(true);
    fetch(`${API_BASE}/apigetlearners?batchno=${batchNo}`)
      .then((res) => res.json())
      .then((data) => setLearners(Array.isArray(data) ? data : []))
      .finally(() => setLoadingLearners(false));
  }, [batchNo]);

  /* LOAD PERIODS (ONLY FOR PLANNER BASED) */
  useEffect(() => {
    if (!batchNo) return;

    if (isAutoDateAssessment) {
      setSelectedDate(todayDate);
      setSelectedWeekNo("");
      setTopicName(ASSESSMENT_MAP[assessmentType].label);
      setPeriods([]);
      return;
    }

    const apiType = ASSESSMENT_MAP[assessmentType].api;

    fetch(`${API_BASE}/apiperiods/${batchNo}/${apiType}`)
      .then((res) => res.json())
      .then((data) => {
        const uniqueMap = new Map();
        (data || []).forEach((item) => {
          const key = `${item.week_no}-${item.date}-${item.topic_name}`;
          if (!uniqueMap.has(key)) uniqueMap.set(key, item);
        });
        setPeriods(Array.from(uniqueMap.values()));
      })
      .catch(() => setPeriods([]));

    setPeriodValue("");
    setSelectedDate("");
    setSelectedWeekNo("");
    setTopicName("");
    setMarks({});
  }, [batchNo, assessmentType]);

  /* WINDOW CHECK */
  useEffect(() => {
    if (isAutoDateAssessment) {
      setIsWindowOpen(true);
      return;
    }

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

  const handlePeriodSelect = (e) => {
    const val = e.target.value;
    const parts = val.split("::");
    setPeriodValue(val);
    setSelectedWeekNo(parts[0] || "");
    setSelectedDate(parts[1] || "");
    setTopicName(parts.slice(2).join("::"));
    setMarks({});
  };

  const handleMarksInput = (id, val) => {
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
      setMessage("❌ Please complete required fields.");
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
          percentage: marks[l.id].percentage || null,
        };

        if (!isAutoDateAssessment) {
          if (assessmentType === "module") {
            payload.module_no = Number(selectedWeekNo);
          } else {
            payload.week_no = Number(selectedWeekNo);
          }
        }

        const response = await fetch(`${API_BASE}/api/marks/${cfg.api}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) throw new Error("Save failed");
      }

      setMessage("✅ Marks saved successfully");
      setMarks({});
    } catch (e) {
      setMessage("❌ Failed to save marks");
    }

    setTimeout(() => setMessage(""), 4000);
  };

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

        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 3 }}>

          <FormControl sx={{ minWidth: 220 }}>
            <InputLabel>Assessment Type</InputLabel>
            <Select
              value={assessmentType}
              label="Assessment Type"
              onChange={(e) => setAssessmentType(e.target.value)}
            >
              <MenuItem value="weekly">Weekly Assessment</MenuItem>
              <MenuItem value="intermediate">Intermediate Assessment</MenuItem>
              <MenuItem value="module">Module Level Assessment</MenuItem>
              <MenuItem value="final">Final Assessment</MenuItem>
              <MenuItem value="final_project">Final Project</MenuItem>
              <MenuItem value="viva">Viva</MenuItem>
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 160 }}>
            <InputLabel>Batch</InputLabel>
            <Select
              value={batchNo}
              label="Batch"
              onChange={(e) => setBatchNo(e.target.value)}
            >
              {availableBatches.map((b) => (
                <MenuItem key={b} value={b}>
                  {b}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {!isAutoDateAssessment && (
            <FormControl sx={{ minWidth: 300 }}>
              <InputLabel>Assessment Date</InputLabel>
              <Select
                value={periodValue}
                label="Assessment Date"
                onChange={handlePeriodSelect}
              >
                {periods.map((p, idx) => (
                  <MenuItem
                    key={`${p.week_no ?? idx}-${p.date}`}
                    value={`${p.week_no ?? ""}::${p.date}::${p.topic_name}`}
                  >
                    Week {p.week_no} ({p.date}) — {p.topic_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {isAutoDateAssessment && (
            <TextField
              label="Assessment Date"
              value={todayDate}
              disabled
            />
          )}

          <TextField
            label="Out Of"
            value={outOff}
            sx={{ width: 110 }}
            onChange={(e) =>
              setOutOff(e.target.value.replace(/\D/g, ""))
            }
          />
        </Box>

        {learners.length > 0 && (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Marks</TableCell>
                <TableCell>%</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {learners.map((l, idx) => (
                <TableRow key={l.id}>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell>{l.name}</TableCell>
                  <TableCell>{l.email}</TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      value={marks[l.id]?.points || ""}
                      onChange={(e) =>
                        handleMarksInput(l.id, e.target.value)
                      }
                    />
                  </TableCell>
                  <TableCell>
                    {marks[l.id]?.percentage || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Button
          sx={{ mt: 3 }}
          variant="contained"
          onClick={handleSave}
        >
          Save Marks
        </Button>

        {message && (
          <Alert sx={{ mt: 2 }}>
            {message}
          </Alert>
        )}
      </Paper>
    </Box>
  );
}

export default MarkSheet;
