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

/* ───────────────── CONFIG ───────────────── */

const ASSESSMENT_MAP = {
  weekly: { api: "weekly-assessment", type: "weekly" },
  intermediate: { api: "intermediate-assessment", type: "mid" },
  module: { api: "module-level-assessment", type: "mid" },
  final: { api: "final-assessment", type: "final" },
  final_project: { api: "final-project", autoDate: true },
  viva: { api: "viva", autoDate: true },
};

const PDFT_OUTOFF_RULES = {
  intermediate: 25,
  final_project: 100,
  viva: 25,
  final: {
    "Digital Design": 30,
    CMOS: 20,
    TCL: 25,
    "Physical Design": 100,
  },
};

const todayDate = new Date().toISOString().split("T")[0];

const parseDate = (str) => {
  if (!str) return null;
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
};

function MarkSheet() {
  const [batchNo, setBatchNo] = useState("");
  const [assessmentType, setAssessmentType] = useState("weekly");
  const [periods, setPeriods] = useState([]);
  const [periodValue, setPeriodValue] = useState("");

  const [selectedCoursePlannerId, setSelectedCoursePlannerId] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [topicName, setTopicName] = useState("");

  const [learners, setLearners] = useState([]);
  const [marks, setMarks] = useState({});
  const [outOff, setOutOff] = useState("");

  const [isWindowOpen, setIsWindowOpen] = useState(true);
  const [windowCloseDate, setWindowCloseDate] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());

  const userRole = localStorage.getItem("role");
  const canEditOutOf =
    userRole === "Admin" || userRole === "Manager";

  const isPDFTBatch = batchNo?.toUpperCase().includes("PDFT");
  const isAutoDateAssessment =
    assessmentType === "final_project" ||
    assessmentType === "viva";

  /* ───────── CLOCK ───────── */
  useEffect(() => {
    const i = setInterval(() => setCurrentDate(new Date()), 1000);
    return () => clearInterval(i);
  }, []);

  /* ───────── LOAD PERIODS ───────── */
  useEffect(() => {
    if (!batchNo || isAutoDateAssessment) return;

    fetch(`${API_BASE}/apiperiods/${batchNo}/${ASSESSMENT_MAP[assessmentType].api}`)
      .then(res => res.json())
      .then(data => {
        const uniqueMap = new Map();
        (data || []).forEach(item => {
          const key = `${item.date}::${item.topic_name}`;
          if (!uniqueMap.has(key)) uniqueMap.set(key, item);
        });
        setPeriods(Array.from(uniqueMap.values()));
      });
  }, [batchNo, assessmentType]);

  /* ───────── LOAD LEARNERS ───────── */
  useEffect(() => {
    if (!batchNo) return;
    fetch(`${API_BASE}/apigetlearners?batchno=${batchNo}`)
      .then(res => res.json())
      .then(data => setLearners(Array.isArray(data) ? data : []));
  }, [batchNo]);

  /* ───────── WINDOW LOGIC ───────── */
  useEffect(() => {
    if (isAutoDateAssessment) return setIsWindowOpen(true);
    if (!selectedDate) return;

    let close = new Date(parseDate(selectedDate));
    const type = ASSESSMENT_MAP[assessmentType]?.type;

    if (type === "weekly") close.setDate(close.getDate() + 3);
    if (type === "mid") close.setDate(close.getDate() + 5);
    if (type === "final") close.setDate(close.getDate() + 7);

    close.setHours(23, 59, 59, 999);

    setIsWindowOpen(currentDate <= close);
    setWindowCloseDate(close.toLocaleDateString("en-GB"));
  }, [selectedDate, assessmentType, currentDate]);

  /* ───────── AUTO PDFT OUTOF ───────── */
  useEffect(() => {
    if (!isPDFTBatch) return;

    if (assessmentType === "intermediate")
      setOutOff(PDFT_OUTOFF_RULES.intermediate);

    if (assessmentType === "final_project")
      setOutOff(PDFT_OUTOFF_RULES.final_project);

    if (assessmentType === "viva")
      setOutOff(PDFT_OUTOFF_RULES.viva);

    if (assessmentType === "final" && topicName) {
      const val = PDFT_OUTOFF_RULES.final[topicName];
      if (val) setOutOff(val);
    }
  }, [assessmentType, topicName, batchNo]);

  /* ───────── LOAD EXISTING MARKS ───────── */
  useEffect(() => {
    if (!batchNo || !selectedDate || !selectedCoursePlannerId) return;

    fetch(
      `${API_BASE}/api/marks/${ASSESSMENT_MAP[assessmentType].api}?batch_no=${batchNo}&assessment_date=${selectedDate}&course_planner_id=${selectedCoursePlannerId}`
    )
      .then(res => res.json())
      .then(data => {
        const loaded = {};
        data.forEach(row => {
          loaded[row.learner_id] = {
            points: row.points,
            percentage:
              row.out_off > 0
                ? Math.round((row.points / row.out_off) * 100)
                : "",
          };
        });
        setMarks(loaded);
        if (data.length > 0) setOutOff(data[0].out_off);
      });
  }, [batchNo, selectedDate, selectedCoursePlannerId]);

  /* ───────── SAVE MARKS ───────── */
  const handleSave = async () => {
    if (!isWindowOpen) return setMessage("❌ Window closed");

    const cfg = ASSESSMENT_MAP[assessmentType];
    for (const l of learners) {
      if (!marks[l.id]?.points) continue;

      await fetch(`${API_BASE}/api/marks/${cfg.api}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          learner_id: l.id,
          batch_no: batchNo,
          assessment_date: selectedDate,
          assessment_name: topicName,
          out_off: Number(outOff),
          points: Number(marks[l.id].points),
          percentage: marks[l.id].percentage,
          course_planner_id: selectedCoursePlannerId,
        }),
      });
    }
    setMessage("✅ Saved");
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", my: 3 }}>
      <Paper sx={{ p: 4 }}>
        {!isAutoDateAssessment && selectedDate && (
          <Alert severity={isWindowOpen ? "success" : "error"}>
            {isWindowOpen
              ? `OPEN until ${windowCloseDate}`
              : `CLOSED on ${windowCloseDate}`}
          </Alert>
        )}

        <TextField
          label="Out Of"
          value={outOff}
          disabled={!isWindowOpen || (isPDFTBatch && !canEditOutOf)}
          onChange={(e) => setOutOff(e.target.value)}
        />

        {canEditOutOf && isPDFTBatch && (
          <Button
            onClick={async () => {
              await fetch(`${API_BASE}/api/outoff/save`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  batch_no: batchNo,
                  topic_name: topicName,
                  out_off: outOff,
                }),
              });
              setMessage("✅ Out Of updated");
            }}
          >
            Save Out Of
          </Button>
        )}

        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!isWindowOpen}
        >
          Save Marks
        </Button>

        {message && <Alert>{message}</Alert>}
      </Paper>
    </Box>
  );
}

export default MarkSheet;
