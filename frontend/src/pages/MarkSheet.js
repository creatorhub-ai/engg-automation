import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
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
  CircularProgress,
  Tooltip,
  Fade,
  Chip,
} from "@mui/material";
import SaveIcon          from "@mui/icons-material/Save";
import LockIcon          from "@mui/icons-material/Lock";
import LockOpenIcon      from "@mui/icons-material/LockOpen";
import AssignmentIcon    from "@mui/icons-material/Assignment";
import GroupIcon         from "@mui/icons-material/Group";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import CheckCircleIcon   from "@mui/icons-material/CheckCircle";
import ErrorIcon         from "@mui/icons-material/Error";
import InfoOutlinedIcon  from "@mui/icons-material/InfoOutlined";
import axios from 'axios';

const API_BASE =
  process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

/* ─── Design tokens ─────────────────────────────────────────────────────── */
const TOKENS = {
  bg:          "#d4e0fd",
  surface:     "#ffffff",
  surfaceAlt:  "#f8f9fc",
  border:      "#e4e8f0",
  accent:      "#3d5afe",
  accentLight: "#e8ecff",
  text:        "#1a1f36",
  textSub:     "#6b7280",
  success:     { fill: "#10b981", light: "#d1fae5", text: "#065f46" },
  warning:     { fill: "#f59e0b", light: "#fef3c7", text: "#92400e" },
  error:       { fill: "#ef4444", light: "#fee2e2", text: "#991b1b" },
};

const cardSx = {
  background:   TOKENS.surface,
  border:       `1px solid ${TOKENS.border}`,
  borderRadius: "16px",
  boxShadow:    "0 2px 12px rgba(0,0,0,0.06)",
  overflow:     "hidden",
};

const labelSx = {
  fontFamily:    "'DM Sans', sans-serif",
  fontSize:      11,
  fontWeight:    700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color:         TOKENS.textSub,
};

const inputSx = {
  fontFamily: "'DM Sans', sans-serif",
  fontSize: 13,
  borderRadius: "10px",
  "& .MuiOutlinedInput-notchedOutline": { borderColor: TOKENS.border },
  "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: TOKENS.accent },
  "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: TOKENS.accent },
};

const tableHeadSx = {
  ...labelSx,
  background:   TOKENS.surfaceAlt,
  borderBottom: `2px solid ${TOKENS.border}`,
  py:           1.2,
  whiteSpace:   "nowrap",
};

const tableCellSx = {
  fontFamily:   "'DM Sans', sans-serif",
  fontSize:     13,
  color:        TOKENS.text,
  borderBottom: `1px solid ${TOKENS.border}`,
};

// Request handler - show only if window closed and no pending request
const handleRequestExtension = async () => {
  if (requesting || !reason.trim()) return; // Add a reason textarea/input
  setRequesting(true);
  try {
    await axios.post(`${APIBASE}/api/marks/extension-request`, {
      batchno: batchNo,
      assessmenttype: assessmentType,
      weekno: weekNo,
      traineremail: user.email, // Logged-in trainer
      reason: reason.trim()
    }, { headers: { Authorization: `Bearer ${token}` } });
    setHasPendingRequest(true);
    // Show success toast: "Request sent to manager"
  } catch (err) {
    // Show error toast
  } finally {
    setRequesting(false);
  }
};


/* ─── Assessment config ──────────────────────────────────────────────────── */
const ASSESSMENT_MAP = {
  weekly:       { api: "weekly-assessment",      label: "Weekly Assessment",      type: "weekly" },
  intermediate: { api: "intermediate-assessment", label: "Intermediate Assessment", type: "mid"    },
  module:       { api: "module-level-assessment", label: "Module Level Assessment", type: "mid"    },
  final:        { api: "final-assessment",        label: "Final Assessment",        type: "final"  },
  final_project:{ api: "final-project",           label: "Final Project",           autoDate: true },
  viva:         { api: "viva",                    label: "Viva",                    autoDate: true },
};

const AUTO_OUT_OF_TYPES = ["intermediate", "final", "final_project", "viva"];

/* ─── PDFT Out Of Rules ──────────────────────────────────────────────────── */
const PDFT_OUT_OF_RULES = [
  { keywords: ["intermediate"],    outOf: 25  },
  { keywords: ["digital design"],  outOf: 30  },
  { keywords: ["cmos"],            outOf: 20  },
  { keywords: ["tcl"],             outOf: 25  },
  { keywords: ["physical design"], outOf: 50  },
  { keywords: ["final project"],   outOf: 100 },
  { keywords: ["viva"],            outOf: 25  },
];

/* ─── DVFT Out Of Rules ──────────────────────────────────────────────────── */
// For DVFT batches:
//   Intermediate           → 25
//   Final Assessment Digital → 25
//   Final Assessment Verilog → 25
//   Final Assessment SV    → 30
//   Final Assessment UVM   → 30
//   Final Assessment Python → 15
//   Final Project          → 100
//   Viva                   → 25
const DVFT_OUT_OF_RULES = [
  { keywords: ["intermediate"],    outOf: 25  },
  { keywords: ["python"],          outOf: 15  },
  { keywords: ["uvm"],             outOf: 30  },
  { keywords: ["sv"],              outOf: 30  },
  { keywords: ["verilog"],         outOf: 25  },
  { keywords: ["digital"],         outOf: 25  },
  { keywords: ["final project"],   outOf: 100 },
  { keywords: ["viva"],            outOf: 25  },
];

/* ─── Batch type detectors ───────────────────────────────────────────────── */
function isPdftBatch(batchNo) { return (batchNo || "").toUpperCase().includes("PDFT"); }
function isDvftBatch(batchNo) {
  const up = (batchNo || "").toUpperCase();
  return up.includes("DVFT") || (up.startsWith("DV") && !up.includes("PDFT"));
}

function getFixedOutOf(topicName, assessmentType, batchNo) {
  if (!AUTO_OUT_OF_TYPES.includes(assessmentType)) return null;

  const combined = `${topicName || ""} ${ASSESSMENT_MAP[assessmentType]?.label || ""}`.toLowerCase();

  if (isPdftBatch(batchNo)) {
    for (const rule of PDFT_OUT_OF_RULES) {
      if (rule.keywords.every(kw => combined.includes(kw))) return rule.outOf;
    }
  }

  if (isDvftBatch(batchNo)) {
    // Final project and viva use date from user input but fixed out-of
    if (assessmentType === "final_project") return 100;
    if (assessmentType === "viva")          return 25;
    for (const rule of DVFT_OUT_OF_RULES) {
      if (rule.keywords.every(kw => combined.includes(kw))) return rule.outOf;
    }
  }

  return null;
}

const todayDate = new Date().toISOString().split("T")[0];
const parseDate = (str) => { if (!str) return null; const [y,m,d] = str.split("-").map(Number); return new Date(y, m-1, d); };
function getCurrentUser() { try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; } }
function isAdminOrManager(user) { return user?.role === "Admin" || user?.role === "Manager"; }

function deduplicatePeriods(data) {
  const seen = new Map();
  (data || []).forEach(item => {
    const key = `${item.date}::${(item.topic_name || "").trim().toLowerCase()}`;
    if (!seen.has(key)) seen.set(key, item);
  });
  return Array.from(seen.values());
}

/* ─── Section Header ─────────────────────────────────────────────────────── */
function SectionHeader({ icon, title, subtitle, right }) {
  return (
    <Box sx={{ px: 3, py: 2.5, background: `linear-gradient(135deg, ${TOKENS.accent}0d 0%, ${TOKENS.accentLight} 100%)`, borderBottom: `1px solid ${TOKENS.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5, flexWrap: "wrap" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <Box sx={{ color: TOKENS.accent, display: "flex" }}>{icon}</Box>
        <Box>
          <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 800, color: TOKENS.text, letterSpacing: "-0.02em" }}>{title}</Typography>
          {subtitle && <Typography sx={{ ...labelSx, fontSize: 10, mt: 0.2 }}>{subtitle}</Typography>}
        </Box>
      </Box>
      {right && <Box>{right}</Box>}
    </Box>
  );
}

/* ─── StatPill ───────────────────────────────────────────────────────────── */
function StatPill({ icon, label, value, accent }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, py: 1, borderRadius: "10px", background: accent ? TOKENS.accentLight : TOKENS.surfaceAlt, border: `1px solid ${accent ? TOKENS.accent + "33" : TOKENS.border}` }}>
      <Box sx={{ color: accent ? TOKENS.accent : TOKENS.textSub, display: "flex" }}>{icon}</Box>
      <Box>
        <Typography sx={{ ...labelSx, fontSize: 10 }}>{label}</Typography>
        <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700, color: TOKENS.text }}>{value}</Typography>
      </Box>
    </Box>
  );
}

/* ─── StatusBanner ───────────────────────────────────────────────────────── */
function StatusBanner({ message }) {
  if (!message) return null;
  const isSuccess = message.startsWith("✅");
  const isWarning = message.startsWith("⚠️");
  const colors = isSuccess ? TOKENS.success : isWarning ? TOKENS.warning : TOKENS.error;
  const Icon = isSuccess ? CheckCircleIcon : isWarning ? InfoOutlinedIcon : ErrorIcon;
  return (
    <Fade in>
      <Box sx={{ mt: 2.5, px: 2.5, py: 1.5, borderRadius: "10px", background: colors.light, border: `1px solid ${colors.fill}44`, display: "flex", alignItems: "center", gap: 1.5 }}>
        <Icon sx={{ fontSize: 16, color: colors.fill, flexShrink: 0 }} />
        <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: colors.text }}>{message}</Typography>
      </Box>
    </Fade>
  );
}

/* ─── Batch badge ────────────────────────────────────────────────────────── */
function BatchBadge({ batchNo }) {
  if (!batchNo) return null;
  const isPdft = isPdftBatch(batchNo);
  const isDvft = isDvftBatch(batchNo);
  if (!isPdft && !isDvft) return null;
  const color = isPdft ? "#7c3aed" : "#0891b2";
  const label = isPdft ? "PDFT" : "DVFT";
  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.8, px: 1.8, py: 0.8, borderRadius: "10px", background: `${color}18`, border: `1px solid ${color}33` }}>
      <Box sx={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
      <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, color }}>{label} Fixed Out-Of</Typography>
    </Box>
  );
}

/* ─── Main Component ─────────────────────────────────────────────────────── */
function MarkSheet() {
  const [batchNo,                 setBatchNo]                 = useState("");
  const [assessmentType,          setAssessmentType]          = useState("weekly");
  const [availableBatches,        setAvailableBatches]        = useState([]);
  const [loadingBatches,          setLoadingBatches]          = useState(true);
  const [learners,                setLearners]                = useState([]);
  const [loadingLearners,         setLoadingLearners]         = useState(false);
  const [periods,                 setPeriods]                 = useState([]);
  const [periodValue,             setPeriodValue]             = useState("");
  const [selectedCoursePlannerId, setSelectedCoursePlannerId] = useState("");
  const [selectedWeekNo,          setSelectedWeekNo]          = useState("");
  const [selectedDate,            setSelectedDate]            = useState("");
  const [topicName,               setTopicName]               = useState("");
  const [marks,                   setMarks]                   = useState({});
  const [outOff,                  setOutOff]                  = useState("");
  const [windowOpen,              setWindowOpen]              = useState(true);
  const [windowCloseDate,         setWindowCloseDate]         = useState("");
  const [message,                 setMessage]                 = useState("");
  const [saving,                  setSaving]                  = useState(false);
  const [savingOutOf,             setSavingOutOf]             = useState(false);
  const [loadingMarks,            setLoadingMarks]            = useState(false);
  const [currentDate,             setCurrentDate]             = useState(new Date());
  const [requesting, setRequesting] = useState(false);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);

  const currentUser  = getCurrentUser();
  const canEditOutOf = isAdminOrManager(currentUser);
  const isPdft       = isPdftBatch(batchNo);
  const isDvft       = isDvftBatch(batchNo);
  const isFixedOutOfBatch = isPdft || isDvft;

  const isAutoDateAssessment = assessmentType === "final_project" || assessmentType === "viva";
  const isAutoOutOfType      = AUTO_OUT_OF_TYPES.includes(assessmentType);

  // For DVFT: final_project and viva accept user-entered date but fixed out-of
  const isDvftAutoDateType = isDvft && isAutoDateAssessment;

  // Lock out-of editing if it's a fixed batch type and admin hasn't overridden
  const outOfLocked = canEditOutOf
    ? false
    : isAutoOutOfType
      ? (!windowOpen || isFixedOutOfBatch)
      : !windowOpen;

  const marksEnteredCount = learners.filter(l => marks[l.id]?.points).length;

  /* ── Clock ── */
  useEffect(() => {
    const i = setInterval(() => setCurrentDate(new Date()), 1000);
    return () => clearInterval(i);
  }, []);

  /* ── Load batches ── */
  useEffect(() => {
    fetch(`${API_BASE}/api/batches`)
      .then(res => res.json())
      .then(data => setAvailableBatches(Array.isArray(data) ? [...new Set(data.map(b => typeof b === "string" ? b : b.batch_no))] : []))
      .finally(() => setLoadingBatches(false));
  }, []);

  /* ── Load learners ── */
  useEffect(() => {
    if (!batchNo) return setLearners([]);
    setLoadingLearners(true);
    fetch(`${API_BASE}/apigetlearners?batchno=${batchNo}`)
      .then(res => res.json())
      .then(data => setLearners(Array.isArray(data) ? data : []))
      .finally(() => setLoadingLearners(false));
  }, [batchNo]);

  /* ── Load periods ── */
  useEffect(() => {
    if (!batchNo) return;

    if (isAutoDateAssessment) {
      // DVFT: date is entered by user (not auto today), out-of is fixed
      if (isDvft) {
        // Don't set selectedDate here — user picks date in a date field
        setSelectedDate("");
      } else {
        setSelectedDate(todayDate);
      }
      setSelectedCoursePlannerId("");
      setSelectedWeekNo("");
      setTopicName(ASSESSMENT_MAP[assessmentType].label);
      setPeriods([]);

      // Apply fixed out-of
      const fixed = getFixedOutOf("", assessmentType, batchNo);
      if (fixed !== null) setOutOff(String(fixed));
      return;
    }

    const apiType = ASSESSMENT_MAP[assessmentType].api;
    fetch(`${API_BASE}/apiperiods/${batchNo}/${apiType}`)
      .then(res => res.json())
      .then(data => {
        const unique = deduplicatePeriods(data);
        unique.sort((a, b) => {
          const d = new Date(a.date) - new Date(b.date);
          return d !== 0 ? d : (a.topic_name || "").localeCompare(b.topic_name || "");
        });
        setPeriods(unique);
      })
      .catch(() => setPeriods([]));

    setPeriodValue(""); setSelectedDate(""); setSelectedCoursePlannerId("");
    setSelectedWeekNo(""); setTopicName(""); setMarks({}); setOutOff("");
  }, [batchNo, assessmentType]);

  /* ── Window Logic ── */
  useEffect(() => {
    if (isAutoDateAssessment) { setWindowOpen(true); return; }
    if (!selectedDate) return;
    const assessmentDate = parseDate(selectedDate);
    if (!assessmentDate) return;
    let close = new Date(assessmentDate);
    const type = ASSESSMENT_MAP[assessmentType]?.type;
    if (type === "weekly") close.setDate(close.getDate() + 3);
    else if (type === "mid") close.setDate(close.getDate() + 5);
    else if (type === "final") close.setDate(close.getDate() + 7);
    close.setHours(23, 59, 59, 999);
    setWindowOpen(currentDate <= close);
    setWindowCloseDate(close.toLocaleDateString("en-GB"));
  }, [selectedDate, assessmentType, currentDate, isAutoDateAssessment]);

  useEffect(()=>{

    async function checkExtension(){

      const user = JSON.parse(localStorage.getItem("user"));

      const res = await fetch(
        `${API_BASE}/api/marks/check-extension?batch_no=${batchNo}&assessment_type=${ASSESSMENT_MAP[assessmentType].api}&course_planner_id=${selectedCoursePlannerId}&trainer_email=${user.email}`
      );

      const data = await res.json();

      if(data.extension){

        setWindowOpen(true);

        setWindowCloseDate(
          new Date(data.until).toLocaleDateString("en-GB")
        );

      }

    }

    if(!windowOpen){
      checkExtension();
    }

  },[batchNo,assessmentType,selectedCoursePlannerId]);

  // Load window status with pending check (call on mount or batch change)
  useEffect(() => {
    if (batchNo && assessmentType) {
      axios.get(`${APIBASE}/api/marks/window-status`, {
        params: { batchno: batchNo, assessmenttype: assessmentType, weekno: weekNo },
        headers: { Authorization: `Bearer ${token}` }
      }).then(res => {
        setWindowOpen(res.data.isopen);
        setHasPendingRequest(res.data.haspendingrequest);
      });
    }
  }, [batchNo, assessmentType, weekNo]);


  /* ── Load existing marks ── */
  const loadExistingMarks = useCallback(async (plannerId, date) => {
    if (!batchNo || !plannerId || !date) return;
    setLoadingMarks(true);
    try {
      const cfg = ASSESSMENT_MAP[assessmentType];
      const res = await fetch(`${API_BASE}/api/marks/${cfg.api}?batch_no=${batchNo}&course_planner_id=${plannerId}&assessment_date=${date}`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const savedOutOf = data[0]?.out_off;
        // Only override fixed out-of if admin or non-fixed batch
        if (savedOutOf && (!isFixedOutOfBatch || canEditOutOf)) setOutOff(String(savedOutOf));
        const marksMap = {};
        data.forEach(row => {
          marksMap[row.learner_id] = {
            points:     String(row.points ?? ""),
            percentage: row.percentage !== null ? String(row.percentage) : "",
          };
        });
        setMarks(marksMap);
      }
    } catch (e) {
      console.error("Failed to load existing marks", e);
    } finally {
      setLoadingMarks(false);
    }
  }, [batchNo, assessmentType, isFixedOutOfBatch, canEditOutOf]);

  /* ── Period selection ── */
  const handlePeriodSelect = (e) => {
    const val = e.target.value;
    setPeriodValue(val);
    const [plannerId, weekPart, datePart, ...topicParts] = val.split("::");
    const topic = topicParts.join("::");
    setSelectedCoursePlannerId(plannerId || "");
    setSelectedWeekNo(weekPart || "");
    setSelectedDate(datePart || "");
    setTopicName(topic);
    setMarks({});
    setOutOff("");

    // Apply fixed out-of for PDFT or DVFT
    const fixed = getFixedOutOf(topic, assessmentType, batchNo);
    if (fixed !== null) setOutOff(String(fixed));

    if (plannerId && datePart) loadExistingMarks(plannerId, datePart);
  };

  /* ── Marks input ── */
  const handleMarksInput = (id, val) => {
    const points = val.replace(/\D/g, "");
    setMarks(prev => ({
      ...prev,
      [id]: {
        points,
        percentage: outOff && Number(outOff) > 0
          ? Math.round((Number(points) / Number(outOff)) * 100)
          : "",
      },
    }));
  };

  /* ── Out Of change ── */
  const handleOutOfChange = (v) => {
    const val = v.replace(/\D/g, "");
    setOutOff(val);
    setMarks(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(id => {
        if (updated[id]?.points) {
          updated[id] = {
            ...updated[id],
            percentage: Number(val) > 0
              ? Math.round((Number(updated[id].points) / Number(val)) * 100)
              : "",
          };
        }
      });
      return updated;
    });
  };

  /* ── Save Out Of ── */
  const handleSaveOutOf = async () => {
    if (!outOff || !batchNo) return;
    setSavingOutOf(true);
    try {
      const cfg = ASSESSMENT_MAP[assessmentType];
      const res = await fetch(`${API_BASE}/api/marks/update-out-of`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          batch_no:          batchNo,
          assessment_type:   cfg.api,
          course_planner_id: selectedCoursePlannerId ? Number(selectedCoursePlannerId) : undefined,
          assessment_date:   selectedDate,
          out_off:           Number(outOff),
        }),
      });
      setMessage(res.ok
        ? "✅ Out Of updated successfully."
        : `❌ Failed to update Out Of: ${(await res.json().catch(() => ({}))).error || "Unknown error"}`);
    } catch {
      setMessage("❌ Network error while updating Out Of.");
    } finally {
      setSavingOutOf(false);
      setTimeout(() => setMessage(""), 4000);
    }
  };

  /* ── Save Marks ── */
  const handleSave = async () => {
    if (!windowOpen) { setMessage("❌ Marks entry window closed. Cannot save."); return; }
    if (!batchNo || !selectedDate || !outOff) { setMessage("❌ Please complete all required fields."); return; }
    if (!isAutoDateAssessment && !selectedCoursePlannerId) {
      setMessage("❌ Please select an assessment date from the dropdown."); return;
    }
    // DVFT auto-date types still need a date from the user
    if (isDvftAutoDateType && !selectedDate) {
      setMessage("❌ Please enter the assessment date."); return;
    }

    const cfg = ASSESSMENT_MAP[assessmentType];
    const learnersWithMarks = learners.filter(l => marks[l.id]?.points);
    if (learnersWithMarks.length === 0) { setMessage("❌ No marks entered."); return; }

    setSaving(true); setMessage("");
    let savedCount = 0, failCount = 0;
    try {
      for (const l of learnersWithMarks) {
        const payload = {
          learner_id:        l.id,
          batch_no:          batchNo,
          assessment_date:   selectedDate,
          assessment_name:   topicName || cfg.label,
          out_off:           Number(outOff),
          points:            Number(marks[l.id].points),
          percentage:        marks[l.id].percentage || null,
          course_planner_id: selectedCoursePlannerId ? Number(selectedCoursePlannerId) : undefined,
        };
        if (!isAutoDateAssessment) {
          if (assessmentType === "module") payload.module_no = Number(selectedWeekNo);
          else payload.week_no = Number(selectedWeekNo);
        }
        try {
          const response = await fetch(`${API_BASE}/api/marks/${cfg.api}`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify(payload),
          });
          if (!response.ok) failCount++;
          else savedCount++;
        } catch {
          failCount++;
        }
      }
      setMessage(
        failCount === 0
          ? `✅ Marks saved successfully for ${savedCount} learner(s).`
          : `⚠️ Saved ${savedCount} record(s). ${failCount} failed — check console.`
      );
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(""), 5000);
    }
  };

  /* ── Reset on batch/type change ── */
  const resetSelections = () => {
    setPeriodValue(""); setSelectedDate(""); setSelectedCoursePlannerId("");
    setSelectedWeekNo(""); setTopicName(""); setMarks({}); setOutOff("");
  };

  /* ── Loading state ── */
  if (loadingBatches) return (
    <Box sx={{ minHeight: "100vh", background: TOKENS.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Box sx={{ textAlign: "center" }}>
        <CircularProgress sx={{ color: TOKENS.accent }} />
        <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: TOKENS.textSub, mt: 2 }}>Loading batches…</Typography>
      </Box>
    </Box>
  );

  /* ── Render ── */
  return (
    <Box sx={{ minHeight: "100vh", background: TOKENS.bg, p: { xs: 2, md: 4 }, fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');`}</style>

      <Box sx={{ maxWidth: 1200, mx: "auto" }}>
        {/* ── Page Header ── */}
        <Box sx={{ mb: 4 }}>
          <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: { xs: 24, md: 30 }, fontWeight: 800, color: TOKENS.text, letterSpacing: "-0.03em", mb: 0.5 }}>
            Assessment Marks Entry
          </Typography>
          <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: TOKENS.textSub }}>
            Record and manage learner assessment scores
          </Typography>
        </Box>

        {/* ── Filters Card ── */}
        <Box sx={{ ...cardSx, mb: 3 }}>
          <SectionHeader
            icon={<AssignmentIcon sx={{ fontSize: 20 }} />}
            title="Assessment Configuration"
            subtitle="Select batch, type and assessment period"
            right={
              selectedDate && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, py: 0.8, borderRadius: "10px", background: windowOpen ? TOKENS.success.light : TOKENS.error.light, border: `1px solid ${windowOpen ? TOKENS.success.fill : TOKENS.error.fill}44` }}>
                  {windowOpen
                    ? <LockOpenIcon sx={{ fontSize: 14, color: TOKENS.success.fill }} />
                    : <LockIcon     sx={{ fontSize: 14, color: TOKENS.error.fill   }} />
                  }
                  <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, color: windowOpen ? TOKENS.success.text : TOKENS.error.text }}>
                    {windowOpen ? `Window open · closes ${windowCloseDate}` : `Window closed ${windowCloseDate}`}
                  </Typography>
                </Box>
              )
            }
          />
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "flex-end" }}>

              {/* Assessment Type */}
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>Assessment Type</InputLabel>
                <Select
                  value={assessmentType}
                  label="Assessment Type"
                  onChange={e => { setAssessmentType(e.target.value); resetSelections(); }}
                  sx={inputSx}
                >
                  {Object.entries(ASSESSMENT_MAP).map(([key, val]) => (
                    <MenuItem key={key} value={key} sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>
                      {val.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Batch */}
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>Batch</InputLabel>
                <Select
                  value={batchNo}
                  label="Batch"
                  onChange={e => { setBatchNo(e.target.value); resetSelections(); }}
                  sx={inputSx}
                >
                  {availableBatches.map(b => (
                    <MenuItem key={b} value={b} sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>{b}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Period picker — non-auto types */}
              {!isAutoDateAssessment && (
                <FormControl size="small" sx={{ minWidth: 380 }}>
                  <InputLabel sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>Assessment Date / Topic</InputLabel>
                  <Select value={periodValue} label="Assessment Date / Topic" onChange={handlePeriodSelect} sx={inputSx}>
                    {periods.length === 0 ? (
                      <MenuItem disabled value="">
                        <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: TOKENS.textSub, fontStyle: "italic" }}>
                          {batchNo ? "No assessments found" : "Select a batch first"}
                        </Typography>
                      </MenuItem>
                    ) : (
                      periods.map(p => {
                        const plannerId = p.course_planner_id ?? p.id ?? `${p.date}-${p.topic_name}`;
                        const weekNo    = p.week_no ?? p.module_no ?? "";
                        const val       = `${plannerId}::${weekNo}::${p.date}::${p.topic_name}`;
                        const weekLabel = p.week_no ? `Week ${p.week_no}` : p.module_no ? `Module ${p.module_no}` : "";
                        return (
                          <MenuItem key={`${p.date}-${p.topic_name}`} value={val} sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>
                            {weekLabel ? <><strong>{weekLabel}</strong>&nbsp;—&nbsp;</> : ""}
                            {p.date} — {p.topic_name}
                          </MenuItem>
                        );
                      })
                    )}
                  </Select>
                </FormControl>
              )}

              {/* Date input for auto-date types */}
              {isAutoDateAssessment && (
                isDvft ? (
                  /* DVFT: user picks the actual date */
                  <TextField
                    label="Assessment Date"
                    type="date"
                    size="small"
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{
                      width: 180,
                      "& .MuiInputBase-root": { ...inputSx, fontFamily: "'DM Sans', sans-serif", fontSize: 13 },
                      "& .MuiInputLabel-root": { fontFamily: "'DM Sans', sans-serif", fontSize: 13 },
                    }}
                  />
                ) : (
                  /* PDFT / others: locked to today */
                  <TextField
                    label="Assessment Date"
                    value={todayDate}
                    disabled
                    size="small"
                    sx={{
                      width: 160,
                      "& .MuiInputBase-root": { ...inputSx, fontFamily: "'DM Sans', sans-serif", fontSize: 13 },
                      "& .MuiInputLabel-root": { fontFamily: "'DM Sans', sans-serif", fontSize: 13 },
                    }}
                  />
                )
              )}

              {/* Out Of */}
              <Box sx={{ display: "flex", alignItems: "flex-end", gap: 1.5 }}>
                <Tooltip title={
                  isFixedOutOfBatch && isAutoOutOfType && !canEditOutOf
                    ? `Out Of is fixed for ${isPdft ? "PDFT" : "DVFT"} batches`
                    : ""
                }>
                  <span>
                    <TextField
                      label="Out Of"
                      value={outOff}
                      disabled={outOfLocked}
                      size="small"
                      sx={{
                        width: 110,
                        "& .MuiInputBase-root": { ...inputSx, fontFamily: "'DM Sans', sans-serif", fontSize: 13 },
                        "& .MuiInputLabel-root": { fontFamily: "'DM Sans', sans-serif", fontSize: 13 },
                        "& .MuiFormHelperText-root": { fontFamily: "'DM Sans', sans-serif", fontSize: 10 },
                      }}
                      onChange={e => handleOutOfChange(e.target.value)}
                      inputProps={{ inputMode: "numeric" }}
                      helperText={isFixedOutOfBatch && outOff && isAutoOutOfType && !canEditOutOf ? "Fixed" : ""}
                    />
                  </span>
                </Tooltip>

                {canEditOutOf && selectedDate && (
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleSaveOutOf}
                    disabled={savingOutOf || !outOff}
                    startIcon={savingOutOf ? <CircularProgress size={12} color="inherit" /> : <SaveIcon sx={{ fontSize: 14 }} />}
                    sx={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 12, borderRadius: "10px", textTransform: "none", borderColor: TOKENS.border, color: TOKENS.textSub, whiteSpace: "nowrap", height: 40, "&:hover": { borderColor: TOKENS.accent, color: TOKENS.accent, background: TOKENS.accentLight } }}
                  >
                    {savingOutOf ? "Saving…" : "Save Out Of"}
                  </Button>
                )}
              </Box>
            </Box>

            {/* Assessment Info Pills */}
            {(topicName || isAutoDateAssessment) && (
              <Fade in>
                <Box sx={{ mt: 2.5, display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center" }}>
                  <StatPill icon={<AssignmentIcon sx={{ fontSize: 14 }} />} label="Assessment" value={topicName || ASSESSMENT_MAP[assessmentType]?.label} accent />
                  {selectedDate && <StatPill icon={<CalendarTodayIcon sx={{ fontSize: 14 }} />} label="Date" value={selectedDate} />}
                  <StatPill icon={<InfoOutlinedIcon sx={{ fontSize: 14 }} />} label="Out Of" value={outOff || "—"} />
                  {selectedCoursePlannerId && (
                    <StatPill icon={<InfoOutlinedIcon sx={{ fontSize: 14 }} />} label="Planner ID" value={selectedCoursePlannerId} />
                  )}
                  <BatchBadge batchNo={batchNo} />
                </Box>
              </Fade>
            )}
          </Box>
        </Box>

        {/* ── Learners / Marks Card ── */}
        <Box sx={{ ...cardSx }}>
          <SectionHeader
            icon={<GroupIcon sx={{ fontSize: 20 }} />}
            title="Marks Entry"
            subtitle={batchNo ? `Batch ${batchNo}` : "Select a batch to begin"}
            right={
              learners.length > 0 && (
                <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
                  <Chip
                    label={`${learners.length} learners`}
                    size="small"
                    sx={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 11, background: TOKENS.accentLight, color: TOKENS.accent, border: `1px solid ${TOKENS.accent}33` }}
                  />
                  {marksEnteredCount > 0 && (
                    <Chip
                      label={`${marksEnteredCount} entered`}
                      size="small"
                      sx={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 11, background: TOKENS.success.light, color: TOKENS.success.text, border: `1px solid ${TOKENS.success.fill}44` }}
                    />
                  )}
                </Box>
              )
            }
          />
          <Box sx={{ p: 3 }}>
            {loadingLearners || loadingMarks ? (
              <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 6, gap: 2 }}>
                <CircularProgress sx={{ color: TOKENS.accent }} size={32} />
                <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: TOKENS.textSub }}>
                  {loadingMarks ? "Loading saved marks…" : "Loading learners…"}
                </Typography>
              </Box>
            ) : learners.length > 0 ? (
              <>
                <Box sx={{ borderRadius: "12px", border: `1px solid ${TOKENS.border}`, overflow: "hidden" }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ ...tableHeadSx, width: 40 }}>#</TableCell>
                        <TableCell sx={tableHeadSx}>Name</TableCell>
                        <TableCell sx={tableHeadSx}>Email</TableCell>
                        <TableCell sx={{ ...tableHeadSx, width: 130 }}>
                          Marks{outOff ? ` / ${outOff}` : ""}
                        </TableCell>
                        <TableCell sx={{ ...tableHeadSx, width: 80 }}>%</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {learners.map((l, idx) => {
                        const hasMarks = !!marks[l.id]?.points;
                        const pct      = marks[l.id]?.percentage;
                        const pctNum   = Number(pct);
                        const pctColor =
                          pct === "" || pct === undefined ? TOKENS.textSub :
                          pctNum >= 75 ? TOKENS.success.fill :
                          pctNum >= 50 ? TOKENS.warning.fill :
                          TOKENS.error.fill;
                        return (
                          <TableRow
                            key={l.id}
                            sx={{ "&:nth-of-type(even)": { background: TOKENS.surfaceAlt }, "&:hover": { background: TOKENS.accentLight + "66", transition: "background 0.15s" } }}
                          >
                            <TableCell sx={{ ...tableCellSx, color: TOKENS.textSub, fontFamily: "'DM Mono', monospace", fontSize: 11 }}>{idx + 1}</TableCell>
                            <TableCell sx={{ ...tableCellSx, fontWeight: 600 }}>{l.name}</TableCell>
                            <TableCell sx={{ ...tableCellSx, color: TOKENS.textSub, fontSize: 12 }}>{l.email}</TableCell>
                            <TableCell sx={{ ...tableCellSx, py: 0.5 }}>
                              <TextField
                                size="small"
                                disabled={!windowOpen}
                                value={marks[l.id]?.points || ""}
                                onChange={e => handleMarksInput(l.id, e.target.value)}
                                inputProps={{ inputMode: "numeric" }}
                                sx={{
                                  width: 90,
                                  "& .MuiInputBase-root": {
                                    fontFamily: "'DM Mono', monospace",
                                    fontSize: 13,
                                    fontWeight: 700,
                                    borderRadius: "8px",
                                    background: hasMarks ? TOKENS.accentLight : "transparent",
                                    "& .MuiOutlinedInput-notchedOutline": { borderColor: hasMarks ? TOKENS.accent + "44" : TOKENS.border },
                                  },
                                }}
                              />
                            </TableCell>
                            <TableCell sx={{ ...tableCellSx }}>
                              {pct !== undefined && pct !== "" ? (
                                <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, px: 1.2, py: 0.3, borderRadius: "20px", background: `${pctColor}18`, border: `1px solid ${pctColor}44` }}>
                                  <Typography sx={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 800, color: pctColor }}>{pct}%</Typography>
                                </Box>
                              ) : (
                                <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: TOKENS.textSub }}>—</Typography>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Box>

                {/* Save Button */}
                <Box sx={{ mt: 3, display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
                  <Button
                    variant="contained"
                    onClick={handleSave}
                    disabled={
                      saving || !windowOpen || !batchNo || !selectedDate || !outOff ||
                      (!isAutoDateAssessment && !selectedCoursePlannerId)
                    }
                    startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon sx={{ fontSize: 18 }} />}
                    sx={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 13, borderRadius: "10px", textTransform: "none", px: 3, py: 1.2, background: TOKENS.accent, "&:hover": { background: "#2a3fd4" }, "&:disabled": { opacity: 0.5 } }}
                  >
                    {saving ? "Saving…" : `Save Marks${marksEnteredCount > 0 ? ` (${marksEnteredCount})` : ""}`}
                  </Button>

                  {!windowOpen && !hasPendingRequest && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                      <Button
                        variant="contained"
                        onClick={handleRequestExtension}
                        disabled={requesting}
                        sx={{ background: '#FF9800', '&:hover': { background: '#F57C00' } }}
                      >
                        {requesting ? 'Requesting...' : 'Request 24hr Extension'}
                      </Button>
                      <TextField
                        multiline
                        rows={2}
                        placeholder="Reason for extension (optional)"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        sx={{ width: '100%' }}
                      />
                    </Box>
                  )}
                  {!windowOpen && hasPendingRequest && (
                    <Alert severity="info">Extension request pending manager approval.</Alert>
                  )}

                  {!windowOpen && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, py: 0.8, borderRadius: "8px", background: TOKENS.error.light, border: `1px solid ${TOKENS.error.fill}44` }}>
                      <LockIcon sx={{ fontSize: 14, color: TOKENS.error.fill }} />
                      <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600, color: TOKENS.error.text }}>
                        Window closed - contact manager for extension
                      </Typography>
                    </Box>
                  )}
                </Box>

                <StatusBanner message={message} />
              </>
            ) : (
              batchNo ? (
                <Box sx={{ textAlign: "center", py: 6 }}>
                  <GroupIcon sx={{ fontSize: 40, color: TOKENS.border, mb: 1 }} />
                  <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: TOKENS.textSub }}>
                    No learners found for batch {batchNo}.
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ textAlign: "center", py: 6 }}>
                  <AssignmentIcon sx={{ fontSize: 40, color: TOKENS.border, mb: 1 }} />
                  <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: TOKENS.textSub }}>
                    Select a batch above to load learners.
                  </Typography>
                </Box>
              )
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default MarkSheet;