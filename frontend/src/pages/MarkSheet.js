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
  weekly: {
    api: "weekly-assessment",
    label: "Weekly Assessment",
    type: "weekly",
  },
  intermediate: {
    api: "intermediate-assessment",
    label: "Intermediate Assessment",
    type: "mid",
  },
  module: {
    api: "module-level-assessment",
    label: "Module Level Assessment",
    type: "mid",
  },
  final: {
    api: "final-assessment",
    label: "Final Assessment",
    type: "final",
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
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
};

function isWindowOpen(assessmentType, assessmentDate) {
  const date = new Date(assessmentDate);
  const now = new Date();

  let close = new Date(date);

  if (assessmentType === "weekly-assessment") {
    close.setDate(close.getDate() + 3);
  } else if (
    assessmentType === "intermediate-assessment" ||
    assessmentType === "module-level-assessment"
  ) {
    close.setDate(close.getDate() + 5);
  } else if (assessmentType === "final-assessment") {
    close.setDate(close.getDate() + 7);
  }

  close.setHours(23, 59, 59, 999);

  return now <= close;
}

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

  const [isWindowOpenState, setIsWindowOpenState] = useState(true);
  const [windowCloseDate, setWindowCloseDate] = useState("");

  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());

  const isAutoDateAssessment =
    assessmentType === "final_project" || assessmentType === "viva";

  /* ── Clock ───────────────────────────────────────── */
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
            ? [
                ...new Set(
                  data.map((b) => (typeof b === "string" ? b : b.batch_no))
                ),
              ]
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

  /* ── LOAD EXISTING MARKS (NEW ADDITION) ─────────────────────────────── */
  useEffect(() => {
    if (!batchNo || !selectedDate) return;

    const cfg = ASSESSMENT_MAP[assessmentType];

    fetch(
      `${API_BASE}/api/marks/${cfg.api}?batch_no=${batchNo}&assessment_date=${selectedDate}&course_planner_id=${selectedCoursePlannerId || ""}`
    )
      .then((res) => res.json())
      .then((data) => {
        if (!Array.isArray(data) || data.length === 0) return;

        const loaded = {};
        data.forEach((row) => {
          loaded[row.learner_id] = {
            points: row.points,
            percentage:
              row.out_off > 0
                ? Math.round((row.points / row.out_off) * 100)
                : "",
          };
        });

        setMarks(loaded);

        if (data[0]?.out_off) {
          setOutOff(data[0].out_off);
        }
      })
      .catch(() => {});
  }, [batchNo, selectedDate, selectedCoursePlannerId, assessmentType]);

  /* ── Window Logic ─────────────────────────── */
  useEffect(() => {
    if (isAutoDateAssessment) {
      setIsWindowOpenState(true);
      return;
    }

    if (!selectedDate) return;

    const assessmentDate = parseDate(selectedDate);
    if (!assessmentDate) return;

    let close = new Date(assessmentDate);

    const type = ASSESSMENT_MAP[assessmentType]?.type;

    if (type === "weekly") close.setDate(close.getDate() + 3);
    else if (type === "mid") close.setDate(close.getDate() + 5);
    else if (type === "final") close.setDate(close.getDate() + 7);

    close.setHours(23, 59, 59, 999);

    const isOpen = currentDate <= close;

    setIsWindowOpenState(isOpen);
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
    if (!isWindowOpenState) {
      setMessage("❌ Marks entry window closed. Cannot save.");
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
      } else {
        setMessage(
          `⚠️ Saved ${savedCount} record(s). ${failCount} failed — check console.`
        );
      }
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(""), 5000);
    }
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

        {/* All your existing UI code remains unchanged */}

        {/* Save button */}
        <Button
          sx={{ mt: 3 }}
          variant="contained"
          onClick={handleSave}
          disabled={
            saving ||
            !isWindowOpenState ||
            !batchNo ||
            !selectedDate ||
            !outOff ||
            (!isAutoDateAssessment && !selectedCoursePlannerId)
          }
        >
          {saving ? "Saving…" : "Save Marks"}
        </Button>

        {message && (
          <Alert
            sx={{ mt: 2 }}
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
      </Paper>
    </Box>
  );
}

export default MarkSheet;
