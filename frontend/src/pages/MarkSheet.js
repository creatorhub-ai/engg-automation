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

function MarkSheet() {
  const [batchNo, setBatchNo] = useState("");
  const [availableBatches, setAvailableBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(true);

  const [assessmentType, setAssessmentType] = useState("weekly");

  const [learners, setLearners] = useState([]);
  const [loadingLearners, setLoadingLearners] = useState(false);

  const [marks, setMarks] = useState({});
  const [outOff, setOutOff] = useState("");

  const [periods, setPeriods] = useState([]);
  const [loadingPeriods, setLoadingPeriods] = useState(false);
  const [periodValue, setPeriodValue] = useState("");
  const [selectedWeekNo, setSelectedWeekNo] = useState("");
  const [selectedDate, setSelectedDate] = useState("");

  const [topicMap, setTopicMap] = useState({});

  const [message, setMessage] = useState("");

  const [isWindowOpen, setIsWindowOpen] = useState(true);
  const [windowCloseDate, setWindowCloseDate] = useState("");

  const [currentDate, setCurrentDate] = useState(new Date());

  /* ---------------- CLOCK ---------------- */
  useEffect(() => {
    const interval = setInterval(() => setCurrentDate(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  /* ---------------- FETCH BATCHES ---------------- */
  useEffect(() => {
    const fetchBatches = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/batches`);
        const data = await res.json();
        const distinct = [
          ...new Set(
            data.map((b) => (typeof b === "string" ? b : b.batch_no)).filter(Boolean)
          ),
        ];
        setAvailableBatches(distinct);
      } catch {
        setAvailableBatches([]);
      } finally {
        setLoadingBatches(false);
      }
    };
    fetchBatches();
  }, []);

  /* ---------------- FETCH LEARNERS ---------------- */
  useEffect(() => {
    if (!batchNo || !assessmentType) {
      setPeriods([]);
      setAssessmentDate("");
      return;
    }

    fetch(
      `${API_BASE}/api/assessment-dates?batch_no=${batchNo}&type=${assessmentType}`
    )
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setPeriods(data);
        } else {
          setPeriods([]); // 👈 SAFETY
        }
      })
      .catch(() => {
        setPeriods([]); // 👈 SAFETY
      });
  }, [batchNo, assessmentType]);

  /* ---------------- FETCH PERIODS (DISTINCT) ---------------- */
  useEffect(() => {
    if (!batchNo) return setPeriods([]);

    const fetchPeriods = async () => {
      setLoadingPeriods(true);
      try {
        const res = await fetch(
          `${API_BASE}/apiperiods/${batchNo}/weekly-assessment`
        );
        const data = await res.json();

        const unique = {};
        (data || []).forEach((p) => {
          unique[`${p.week_no}-${p.date}`] = p;
        });

        setPeriods(Object.values(unique));
      } catch {
        setPeriods([]);
      } finally {
        setLoadingPeriods(false);
      }
    };

    fetchPeriods();
    setPeriodValue("");
    setSelectedWeekNo("");
    setSelectedDate("");
    setTopicMap({});
  }, [batchNo]);

  /* ---------------- WINDOW CHECK ---------------- */
  useEffect(() => {
    if (!selectedDate) return;

    const d = new Date(selectedDate);
    const close = new Date(d);
    const days = assessmentType === "weekly" ? 3 : 4;
    close.setDate(d.getDate() + days);
    close.setHours(23, 59, 59, 999);

    setIsWindowOpen(currentDate <= close);
    setWindowCloseDate(close.toLocaleDateString("en-GB"));
  }, [selectedDate, assessmentType, currentDate]);

  /* ---------------- HANDLERS ---------------- */
  const handlePeriodSelect = async (date) => {
    setAssessmentDate(date);

    const res = await fetch(
      `${API_BASE}/api/topic?batch_no=${batchNo}&date=${date}`
    );

    if (res.ok) {
      const data = await res.json();
      setTopicMap(data);
    } else {
      setTopicMap(null);
    }
  };

  const handleMarksInput = (learnerId, value) => {
    if (!isWindowOpen) return;

    const points = value.replace(/[^0-9.]/g, "");
    const percentage = outOff
      ? Math.round((points / outOff) * 100)
      : "";

    setMarks((prev) => ({
      ...prev,
      [learnerId]: { points, percentage },
    }));
  };

  /* ---------------- SAVE ---------------- */
  const handleSave = async () => {
    if (!selectedDate || !outOff || !isWindowOpen) return;

    const endpointMap = {
      weekly: "/api/marks/weekly-assessment",
      intermediate: "/api/marks/intermediate-assessment",
      module: "/api/marks/module-level-assessment",
    };

    const endpoint = endpointMap[assessmentType];

    try {
      for (const learner of learners) {
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

        await fetch(`${API_BASE}${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      setMessage("✅ Marks saved successfully");
      setMarks({});
    } catch (err) {
      setMessage("❌ Failed to save marks");
    }

    setTimeout(() => setMessage(""), 4000);
  };

  /* ---------------- UI ---------------- */
  if (loadingBatches) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 5 }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading batches...</Typography>
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
              onChange={(e) => setAssessmentType(e.target.value)}
            >
              <MenuItem value="weekly">Weekly</MenuItem>
              <MenuItem value="intermediate">Intermediate</MenuItem>
              <MenuItem value="module">Module Level</MenuItem>
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 160 }}>
            <InputLabel>Batch</InputLabel>
            <Select value={batchNo} onChange={(e) => setBatchNo(e.target.value)}>
              {availableBatches.map((b) => (
                <MenuItem key={b} value={b}>
                  {b}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 220 }}>
            <InputLabel>Week / Date</InputLabel>
            <Select value={periodValue} onChange={handlePeriodSelect}>
              {Array.isArray(periods) && periods.map(p => (
                <MenuItem key={p.date} value={p.date}>
                  {p.date}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Out Of"
            value={outOff}
            onChange={(e) => setOutOff(e.target.value.replace(/\D/g, ""))}
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

        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Topic</TableCell>
              <TableCell>Marks</TableCell>
              <TableCell>%</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {learners.map((l) => (
              <TableRow key={l.id}>
                <TableCell>{l.name}</TableCell>
                <TableCell>{l.email}</TableCell>
                <TableCell>{topicMap?.topic_name || "-"}</TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    value={marks[l.id]?.points || ""}
                    disabled={!isWindowOpen}
                    onChange={(e) =>
                      handleMarksInput(l.id, e.target.value)
                    }
                  />
                </TableCell>
                <TableCell>{marks[l.id]?.percentage || ""}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Button
          variant="contained"
          sx={{ mt: 2 }}
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
