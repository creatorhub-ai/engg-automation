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
      .catch(() => setAvailableBatches([]))
      .finally(() => setLoadingBatches(false));
  }, []);

  /* LOAD LEARNERS */
  useEffect(() => {
    if (!batchNo) return setLearners([]);

    setLoadingLearners(true);
    fetch(`${API_BASE}/apigetlearners?batchno=${encodeURIComponent(batchNo)}`)
      .then((res) => res.json())
      .then((data) => setLearners(Array.isArray(data) ? data : []))
      .catch(() => setLearners([]))
      .finally(() => setLoadingLearners(false));
  }, [batchNo]);

  /* LOAD PERIODS — 🔥 FIXED */
  useEffect(() => {
    if (!batchNo || !assessmentType) return;

    const apiType = ASSESSMENT_MAP[assessmentType]?.api;

    if (!apiType) {
      console.error("Invalid assessment type:", assessmentType);
      return;
    }

    const url = `${API_BASE}/apiperiods/${encodeURIComponent(
      batchNo
    )}/${encodeURIComponent(apiType)}`;

    console.log("Fetching periods from:", url);

    fetch(url)
      .then(async (res) => {
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          console.error("Backend 400 Error:", errorData);
          throw new Error(errorData.error || `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        console.log("Periods received:", data);
        setPeriods(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error("Failed to load periods:", err.message);
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
    const parts = val.split("::");
    setPeriodValue(val);
    setSelectedWeekNo(parts[0] || "");
    setSelectedDate(parts[1] || "");
    setTopicName(parts.slice(2).join("::"));
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
      return;
    }

    if (!isWindowOpen) {
      setMessage("❌ The marks entry window is closed.");
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
          week_no:
            assessmentType === "module"
              ? undefined
              : Number(selectedWeekNo),
          module_no:
            assessmentType === "module"
              ? Number(selectedWeekNo)
              : undefined,
        };

        await fetch(`${API_BASE}/api/marks/${cfg.api}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      setMessage("✅ Marks saved successfully");
      setMarks({});
    } catch (e) {
      setMessage("❌ Failed to save marks");
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

        {/* REST OF YOUR UI REMAINS SAME */}
        {/* (No changes below needed) */}
        
      </Paper>
    </Box>
  );
}

export default MarkSheet;
