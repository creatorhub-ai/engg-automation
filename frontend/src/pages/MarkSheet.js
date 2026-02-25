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
  CircularProgress,
} from "@mui/material";

const API_BASE =
  process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

/* ─── Assessment config ─────────────────────────────────────────────────── */
const ASSESSMENT_MAP = {
  weekly: { api: "weekly-assessment", label: "Weekly Assessment", days: 3 },
  intermediate: { api: "intermediate-assessment", label: "Intermediate Assessment", days: 5 },
  module: { api: "module-level-assessment", label: "Module Level Assessment", days: 5 },
  final: { api: "final-assessment", label: "Final Assessment", days: 7 },
  final_project: { api: "final-project", label: "Final Project", autoDate: true },
  viva: { api: "viva", label: "Viva", autoDate: true },
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

  const [selectedCoursePlannerId, setSelectedCoursePlannerId] = useState("");
  const [selectedWeekNo, setSelectedWeekNo] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [topicName, setTopicName] = useState("");

  const [marks, setMarks] = useState({});
  const [outOff, setOutOff] = useState("");

  const [isWindowOpen, setIsWindowOpen] = useState(true);
  const [windowCloseDate, setWindowCloseDate] = useState("");

  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());

  const isAutoDateAssessment =
    assessmentType === "final_project" || assessmentType === "viva";

  /* ── Clock ────────────────────────────────────────────────────────────── */
  useEffect(() => {
    const i = setInterval(() => setCurrentDate(new Date()), 1000);
    return () => clearInterval(i);
  }, []);

  /* ── Load batches ─────────────────────────────────────────────────────── */
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

  /* ── Load learners ────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!batchNo) return setLearners([]);
    setLoadingLearners(true);
    fetch(`${API_BASE}/apigetlearners?batchno=${batchNo}`)
      .then((res) => res.json())
      .then((data) => setLearners(Array.isArray(data) ? data : []))
      .finally(() => setLoadingLearners(false));
  }, [batchNo]);

  /* ── Load periods ─────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!batchNo) return;

    if (isAutoDateAssessment) {
      setSelectedDate(todayDate);
      setSelectedCoursePlannerId("");
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
          const key = item.id ?? `${item.week_no}-${item.date}-${item.topic_name}`;
          if (!uniqueMap.has(key)) uniqueMap.set(key, item);
        });
        setPeriods(Array.from(uniqueMap.values()));
      })
      .catch(() => setPeriods([]));

    setPeriodValue("");
    setSelectedDate("");
    setSelectedCoursePlannerId("");
    setSelectedWeekNo("");
    setTopicName("");
    setMarks({});
  }, [batchNo, assessmentType]);

  /* ── Window open/close check ──────────────────────────────────────────── */
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

  /* ── Period selection ─────────────────────────────────────────────────── */
  const handlePeriodSelect = (e) => {
    const val = e.target.value;
    setPeriodValue(val);

    const [plannerId, weekPart, datePart, ...topicParts] = val.split("::");
    setSelectedCoursePlannerId(plannerId || "");
    setSelectedWeekNo(weekPart || "");
    setSelectedDate(datePart || "");
    setTopicName(topicParts.join("::"));
    setMarks({});
  };

  /* ── Marks input ──────────────────────────────────────────────────────── */
  const handleMarksInput = (id, val) => {
    if (!isWindowOpen && !isAutoDateAssessment) return; // 🔒 HARD STOP

    const points = val.replace(/\D/g, "");
    setMarks((prev) => ({
      ...prev,
      [id]: {
        points,
        percentage:
          outOff && Number(outOff) > 0
            ? Math.round((Number(points) / Number(outOff)) * 100)
            : "",
      },
    }));
  };

  /* ── Save ─────────────────────────────────────────────────────────────── */
  const handleSave = async () => {
    // 🔒 SAFETY CHECK
    if (!isWindowOpen && !isAutoDateAssessment) {
      setMessage("❌ Marks entry window is closed. Saving not allowed.");
      return;
    }

    if (!batchNo || !selectedDate || !outOff) {
      setMessage("❌ Please complete all required fields.");
      return;
    }

    if (!isAutoDateAssessment && !selectedCoursePlannerId) {
      setMessage("❌ Please select an assessment date from the dropdown.");
      return;
    }

    const cfg = ASSESSMENT_MAP[assessmentType];
    const learnersWithMarks = learners.filter((l) => marks[l.id]?.points);

    if (learnersWithMarks.length === 0) {
      setMessage("❌ No marks entered.");
      return;
    }

    setSaving(true);
    setMessage("");

    let savedCount = 0;
    let failCount = 0;

    try {
      for (const l of learnersWithMarks) {
        const payload = {
          learner_id: l.id,
          batch_no: batchNo,
          assessment_date: selectedDate,
          assessment_name: topicName || cfg.label,
          out_off: Number(outOff),
          points: Number(marks[l.id].points),
          percentage: marks[l.id].percentage || null,
          course_planner_id: selectedCoursePlannerId
            ? Number(selectedCoursePlannerId)
            : undefined,
        };

        if (!isAutoDateAssessment) {
          if (assessmentType === "module") {
            payload.module_no = Number(selectedWeekNo);
          } else {
            payload.week_no = Number(selectedWeekNo);
          }
        }

        try {
          const response = await fetch(`${API_BASE}/api/marks/${cfg.api}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          if (!response.ok) failCount++;
          else savedCount++;
        } catch {
          failCount++;
        }
      }

      if (failCount === 0) {
        setMessage(`✅ Marks saved successfully for ${savedCount} learner(s).`);
        setMarks({});
      } else {
        setMessage(`⚠️ Saved ${savedCount} record(s). ${failCount} failed.`);
      }
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(""), 5000);
    }
  };

  /* ── Render ───────────────────────────────────────────────────────────── */

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

        {/* Rest of your UI remains SAME */}

        {/* Learners table */}
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
                      sx={{ width: 90 }}
                      disabled={!isWindowOpen && !isAutoDateAssessment} // 🔒 FIX
                      value={marks[l.id]?.points || ""}
                      onChange={(e) => handleMarksInput(l.id, e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    {marks[l.id]?.percentage
                      ? `${marks[l.id].percentage}%`
                      : "—"}
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
          disabled={
            saving ||
            !batchNo ||
            !selectedDate ||
            !outOff ||
            (!isAutoDateAssessment && !selectedCoursePlannerId) ||
            (!isWindowOpen && !isAutoDateAssessment) // 🔒 FIX
          }
        >
          {saving ? "Saving…" : "Save Marks"}
        </Button>

        {message && (
          <Alert sx={{ mt: 2 }}>{message}</Alert>
        )}
      </Paper>
    </Box>
  );
}

export default MarkSheet;
