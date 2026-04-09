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
import SaveIcon           from "@mui/icons-material/Save";
import LockIcon           from "@mui/icons-material/Lock";
import LockOpenIcon       from "@mui/icons-material/LockOpen";
import AssignmentIcon     from "@mui/icons-material/Assignment";
import GroupIcon          from "@mui/icons-material/Group";
import CalendarTodayIcon  from "@mui/icons-material/CalendarToday";
import CheckCircleIcon    from "@mui/icons-material/CheckCircle";
import ErrorIcon          from "@mui/icons-material/Error";
import InfoOutlinedIcon   from "@mui/icons-material/InfoOutlined";

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

/* ─── Assessment config ──────────────────────────────────────────────────── */
const ASSESSMENT_MAP = {
  weekly:        { api: "weekly-assessment",      label: "Weekly Assessment",      type: "weekly" },
  intermediate:  { api: "intermediate-assessment", label: "Intermediate Assessment", type: "mid"   },
  module:        { api: "module-level-assessment", label: "Module Level Assessment", type: "mid"   },
  final:         { api: "final-assessment",        label: "Final Assessment",        type: "final" },
  final_project: { api: "final-project",           label: "Final Project",           autoDate: true },
  viva:          { api: "viva",                    label: "Viva",                    autoDate: true },
};

const AUTO_OUT_OF_TYPES = ["intermediate", "final", "final_project", "viva"];

/* ─── PDFT Out Of Rules ──────────────────────────────────────────────────── */
const PDFT_OUT_OF_RULES = [
  { keywords: ["intermediate"],    outOf: 30  },
  { keywords: ["digital design"],  outOf: 30  },
  { keywords: ["cmos"],            outOf: 20  },
  { keywords: ["tcl"],             outOf: 25  },
  { keywords: ["physical design"], outOf: 50  },
  { keywords: ["final project"],   outOf: 100 },
  { keywords: ["viva"],            outOf: 25  },
];

/* ─── DVFT Out Of Rules ──────────────────────────────────────────────────── */
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
    for (const rule of PDFT_OUT_OF_RULES)
      if (rule.keywords.every(kw => combined.includes(kw))) return rule.outOf;
  }
  if (isDvftBatch(batchNo)) {
    if (assessmentType === "final_project") return 100;
    if (assessmentType === "viva")          return 25;
    for (const rule of DVFT_OUT_OF_RULES)
      if (rule.keywords.every(kw => combined.includes(kw))) return rule.outOf;
  }
  return null;
}

const todayDate = new Date().toISOString().split("T")[0];

/* Normalize any date string to YYYY-MM-DD (handles M/D/YYYY, DD-MMM-YYYY, etc.) */
function normalizeDate(dateStr) {
  if (!dateStr) return "";
  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  // Parse and reformat — use Date with explicit parts to avoid timezone shift
  const parts = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (parts) {
    // Assume M/D/YYYY or D/M/YYYY — JS Date constructor treats M/D/YYYY as local
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }
  }
  // Fallback: try generic parse
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  return dateStr; // return as-is if unparseable
}

function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem("user") || "{}"); }
  catch { return {}; }
}

/* ─── Role hook (reads from localStorage — no server call needed) ────────── */
function useCurrentUserRole() {
  const localUser = getCurrentUser();
  // Role is stored lowercase by the login endpoint
  const role = (localUser?.role || "").toLowerCase();
  return {
    role,
    loading: false,
    isAdminOrManager: role === "Admin" || role === "Manager",
    isAdminOrCoordinator: role === "Admin" || role === "Coordinator",
    isTrainer: role === "trainer",
  };
}

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
  const Icon   = isSuccess ? CheckCircleIcon : isWarning ? InfoOutlinedIcon : ErrorIcon;
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
  const p = isPdftBatch(batchNo), d = isDvftBatch(batchNo);
  if (!p && !d) return null;
  const color = p ? "#7c3aed" : "#0891b2";
  const label = p ? "PDFT" : "DVFT";
  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.8, px: 1.8, py: 0.8, borderRadius: "10px", background: `${color}18`, border: `1px solid ${color}33` }}>
      <Box sx={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
      <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, color }}>{label} Fixed Out-Of</Typography>
    </Box>
  );
}

/* ─── OutOf Override Badge ───────────────────────────────────────────────── */
function OutOfOverrideBadge() {
  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.8, px: 1.8, py: 0.8, borderRadius: "10px", background: "#fef3c7", border: "1px solid #f59e0b55" }}>
      <LockOpenIcon sx={{ fontSize: 12, color: "#d97706" }} />
      <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, color: "#92400e" }}>Admin Override</Typography>
    </Box>
  );
}

/* ─── Main Component ─────────────────────────────────────────────────────── */
function MarkSheet() {
  const { isAdminOrManager, isAdminOrCoordinator, isTrainer, loading: roleLoading } = useCurrentUserRole();

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
  const [windowCloseDate,         setWindowCloseDate]         = useState("");
  const [message,                 setMessage]                 = useState("");
  const [saving,                  setSaving]                  = useState(false);
  const [savingOutOf,             setSavingOutOf]             = useState(false);
  const [loadingMarks,            setLoadingMarks]            = useState(false);
  const [marksAlreadySaved,       setMarksAlreadySaved]       = useState(false);

  const isPdft            = isPdftBatch(batchNo);
  const isDvft            = isDvftBatch(batchNo);
  const isFixedOutOfBatch = isPdft || isDvft;
  const isAutoDateAssessment = assessmentType === "final_project" || assessmentType === "viva";
  const isAutoOutOfType      = AUTO_OUT_OF_TYPES.includes(assessmentType);
  const isDvftAutoDateType   = isDvft && isAutoDateAssessment;

  const effectiveWindowOpen = true;

  const outOfLocked = isAdminOrManager
    ? false
    : isAutoOutOfType && isFixedOutOfBatch;

  // Admin and Coordinator can edit already-saved marks
  // Trainer can only enter marks for the first time; after save they become read-only
  const canEditSavedMarks = isAdminOrCoordinator;
  const marksEditDisabled = marksAlreadySaved && !canEditSavedMarks;

  const marksEnteredCount = learners.filter(l => marks[l.id]?.points && marks[l.id].points.trim() !== "").length;

  /* ── Load batches ── */
  useEffect(() => {
    fetch(`${API_BASE}/api/batches`)
      .then(r => r.json())
      .then(data => {
        // FIX: handle both array of strings and array of objects
        const batchList = Array.isArray(data)
          ? data.map(b => (typeof b === "string" ? b : b.batch_no)).filter(Boolean)
          : [];
        // Deduplicate
        setAvailableBatches([...new Set(batchList)]);
      })
      .catch(() => setAvailableBatches([]))
      .finally(() => setLoadingBatches(false));
  }, []);

  /* ── Load learners ── */
  useEffect(() => {
    if (!batchNo) return setLearners([]);
    setLoadingLearners(true);
    // Use the correct endpoint that returns learner id, name, email
    fetch(`${API_BASE}/apigetlearners?batchno=${batchNo}`)
      .then(r => r.json())
      .then(data => setLearners(Array.isArray(data) ? data : []))
      .catch(() => setLearners([]))
      .finally(() => setLoadingLearners(false));
  }, [batchNo]);

  /* ── Load periods ── */
  useEffect(() => {
    if (!batchNo) return;
    if (isAutoDateAssessment) {
      setSelectedDate(isDvft ? "" : todayDate);
      setSelectedCoursePlannerId(""); setSelectedWeekNo("");
      setTopicName(ASSESSMENT_MAP[assessmentType].label);
      setPeriods([]);
      const fixed = getFixedOutOf("", assessmentType, batchNo);
      if (fixed !== null) setOutOff(String(fixed));
      return;
    }
    const apiType = ASSESSMENT_MAP[assessmentType].api;
    fetch(`${API_BASE}/apiperiods/${batchNo}/${apiType}`)
      .then(r => r.json())
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

  /* ── Window close date — informational only ── */
  useEffect(() => {
    if (isAutoDateAssessment || !selectedDate) return;
    const assessmentDate = new Date(selectedDate + "T00:00:00");
    if (!assessmentDate) return;
    let close = new Date(assessmentDate);
    const type = ASSESSMENT_MAP[assessmentType]?.type;
    if (type === "weekly")     close.setDate(close.getDate() + 3);
    else if (type === "mid")   close.setDate(close.getDate() + 5);
    else if (type === "final") close.setDate(close.getDate() + 7);
    close.setHours(23, 59, 59, 999);
    setWindowCloseDate(close.toLocaleDateString("en-GB"));
  }, [selectedDate, assessmentType, isAutoDateAssessment]);

  /* ── Auto-load existing marks for auto-date assessments (final_project, viva) ── */
  useEffect(() => {
    if (!isAutoDateAssessment || !batchNo || !selectedDate) return;
    loadExistingMarks(null, selectedDate, outOff);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchNo, selectedDate, isAutoDateAssessment]);

  /* ── Load existing marks ── */
  const loadExistingMarks = useCallback(async (plannerId, date, currentOutOff) => {
    if (!batchNo || !date) return;
    setLoadingMarks(true);
    try {
      const cfg = ASSESSMENT_MAP[assessmentType];
      
      // Build query URL with or without course_planner_id
      let url = `${API_BASE}/api/marks/${cfg.api}?batch_no=${batchNo}&assessment_date=${date}`;
      if (plannerId) {
        url += `&course_planner_id=${plannerId}`;
      }
      
      const res = await fetch(url);
      if (!res.ok) {
        console.warn("Failed to load existing marks:", res.status);
        setMarksAlreadySaved(false);
        setLoadingMarks(false);
        return;
      }
      
      const data = await res.json();
      
      if (Array.isArray(data) && data.length > 0) {
        // Marks exist in DB — mark as already saved (read-only)
        setMarksAlreadySaved(true);

        // Load out_off from saved data if not already set from fixed rules
        const savedOutOf = data[0]?.out_off;
        if (savedOutOf != null && savedOutOf !== undefined) {
          // Only override if not locked (fixed batch rule) or if admin
          if (!outOfLocked || isAdminOrManager) {
            setOutOff(String(savedOutOf));
          }
        }

        // Build marks map from saved data
        const marksMap = {};
        data.forEach(row => {
          if (row.learner_id != null) {
            const pointsVal = row.points != null ? String(row.points) : "";
            const outOfVal  = row.out_off != null ? Number(row.out_off) : 0;
            const pctVal    = row.percentage != null
              ? String(row.percentage)
              : (pointsVal && outOfVal > 0 && pointsVal !== "AB"
                  ? String(Math.round((parseFloat(pointsVal) / outOfVal) * 100))
                  : "");
            
            marksMap[row.learner_id] = {
              points:     pointsVal,
              percentage: pctVal,
            };
          }
        });
        setMarks(marksMap);
        console.log(`Loaded ${Object.keys(marksMap).length} existing mark records`);
      } else {
        // No saved marks — clear the marks map, allow editing
        setMarks({});
        setMarksAlreadySaved(false);
        console.log("No existing marks found for this assessment");
      }
    } catch (e) {
      console.error("Failed to load existing marks:", e);
      setMarks({});
      setMarksAlreadySaved(false);
    } finally {
      setLoadingMarks(false);
    }
  }, [batchNo, assessmentType, outOfLocked, isAdminOrManager]);

  /* ── Period selection ── */
  const handlePeriodSelect = (e) => {
    const val = e.target.value;
    setPeriodValue(val);
    const [plannerId, weekPart, datePart, ...topicParts] = val.split("::");
    const topic = topicParts.join("::");
    const isoDate = normalizeDate(datePart);
    setSelectedCoursePlannerId(plannerId || "");
    setSelectedWeekNo(weekPart || "");
    setSelectedDate(isoDate);
    setTopicName(topic);
    setMarks({});
    setMarksAlreadySaved(false);

    // Set fixed out-of first
    const fixed = getFixedOutOf(topic, assessmentType, batchNo);
    const newOutOff = fixed !== null ? String(fixed) : "";
    setOutOff(newOutOff);

    // Load existing marks for this period
    if (isoDate) {
      loadExistingMarks(plannerId, isoDate, newOutOff);
    }
  };

  /* ── Marks input handler - allows decimals and absent codes ── */
  const handleMarksInput = (id, val) => {
    // Allow: digits, single decimal point, and "AB" for absent
    // Strip any character that is not a digit, dot, A, or B
    let cleaned = val.toUpperCase().replace(/[^0-9.AB]/g, "");
    
    // Prevent multiple dots
    const dotCount = (cleaned.match(/\./g) || []).length;
    if (dotCount > 1) {
      // Keep only up to first dot
      const firstDot = cleaned.indexOf(".");
      cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
    }
    
    setMarks(prev => ({
      ...prev,
      [id]: {
        points: cleaned,
        percentage: calculatePercentage(cleaned, outOff),
      },
    }));
  };

  /* ── Helper function to calculate percentage ── */
  const calculatePercentage = (points, outOf) => {
    if (!points || !outOf || points === "AB") return points === "AB" ? "" : "";
    const pointsNum = parseFloat(points);
    const outOfNum  = parseFloat(outOf);
    if (isNaN(pointsNum) || isNaN(outOfNum) || outOfNum === 0) return "";
    return Math.round((pointsNum / outOfNum) * 100).toString();
  };

  /* ── Out Of change ── */
  const handleOutOfChange = (v) => {
    // Allow only digits and single decimal point
    let val = v.replace(/[^0-9.]/g, "");
    const dotCount = (val.match(/\./g) || []).length;
    if (dotCount > 1) {
      const firstDot = val.indexOf(".");
      val = val.slice(0, firstDot + 1) + val.slice(firstDot + 1).replace(/\./g, "");
    }
    setOutOff(val);
    setMarks(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(id => {
        if (updated[id]?.points) {
          updated[id] = { ...updated[id], percentage: calculatePercentage(updated[id].points, val) };
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
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batch_no:          batchNo,
          assessment_type:   cfg.api,
          course_planner_id: selectedCoursePlannerId ? Number(selectedCoursePlannerId) : undefined,
          assessment_date:   selectedDate,
          out_off:           Number(outOff),
        }),
      });
      setMessage(res.status === 403
        ? "❌ Permission denied — only Admin or Manager can update Out Of."
        : res.ok
          ? "✅ Out Of updated successfully."
          : `❌ Failed to update Out Of: ${(await res.json().catch(() => ({}))).error || "Unknown error"}`);
    } catch { setMessage("❌ Network error while updating Out Of."); }
    finally   { setSavingOutOf(false); setTimeout(() => setMessage(""), 4000); }
  };

  /* ── Save Marks ── */
  const handleSave = async () => {
    if (!batchNo || !selectedDate || !outOff) { setMessage("❌ Please complete all required fields."); return; }
    if (!isAutoDateAssessment && !selectedCoursePlannerId) {
      setMessage("❌ Please select an assessment date from the dropdown."); return;
    }
    if (isDvftAutoDateType && !selectedDate) {
      setMessage("❌ Please enter the assessment date."); return;
    }
    const cfg = ASSESSMENT_MAP[assessmentType];
    const learnersWithMarks = learners.filter(l => marks[l.id]?.points && marks[l.id].points.trim() !== "");
    if (learnersWithMarks.length === 0) { setMessage("❌ No marks entered."); return; }
    setSaving(true); setMessage("");
    let savedCount = 0, failCount = 0;
    try {
      for (const l of learnersWithMarks) {
        const pointsStr = marks[l.id].points.trim();
        // Convert "AB" to a numeric 0 or keep as-is depending on your backend
        // Here we pass as-is; backend should handle "AB" or numeric strings
        const payload = {
          learner_id:        l.id,
          batch_no:          batchNo,
          assessment_date:   selectedDate,
          assessment_name:   topicName || cfg.label,
          out_off:           parseFloat(outOff),
          points:            pointsStr === "AB" ? 0 : parseFloat(pointsStr) || 0,
          percentage:        marks[l.id].percentage ? parseFloat(marks[l.id].percentage) : null,
          course_planner_id: selectedCoursePlannerId ? Number(selectedCoursePlannerId) : undefined,
        };
        if (!isAutoDateAssessment) {
          if (assessmentType === "module") payload.module_no = Number(selectedWeekNo);
          else                             payload.week_no   = Number(selectedWeekNo);
        }
        try {
          const response = await fetch(`${API_BASE}/api/marks/${cfg.api}`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!response.ok) failCount++; else savedCount++;
        } catch { failCount++; }
      }
      setMessage(failCount === 0
        ? `✅ Marks saved successfully for ${savedCount} learner(s).`
        : `⚠️ Saved ${savedCount} record(s). ${failCount} failed — check console.`);
    } finally { setSaving(false); setTimeout(() => setMessage(""), 5000); }
  };

  /* ── Reset ── */
  const resetSelections = () => {
    setPeriodValue(""); setSelectedDate(""); setSelectedCoursePlannerId("");
    setSelectedWeekNo(""); setTopicName(""); setMarks({}); setOutOff("");
    setMarksAlreadySaved(false);
  };

  /* ── Loading state ── */
  if (loadingBatches || roleLoading) return (
    <Box sx={{ minHeight: "100vh", background: TOKENS.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Box sx={{ textAlign: "center" }}>
        <CircularProgress sx={{ color: TOKENS.accent }} />
        <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: TOKENS.textSub, mt: 2 }}>
          {roleLoading ? "Verifying permissions…" : "Loading batches…"}
        </Typography>
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
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, py: 0.8, borderRadius: "10px", background: TOKENS.success.light, border: `1px solid ${TOKENS.success.fill}44` }}>
                    <LockOpenIcon sx={{ fontSize: 14, color: TOKENS.success.fill }} />
                    <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, color: TOKENS.success.text }}>
                      {!isAutoDateAssessment && windowCloseDate
                        ? `Window open · standard close ${windowCloseDate}`
                        : "Window open"}
                    </Typography>
                  </Box>
                </Box>
              )
            }
          />
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "flex-end" }}>
              {/* Assessment Type */}
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>Assessment Type</InputLabel>
                <Select value={assessmentType} label="Assessment Type"
                  onChange={e => { setAssessmentType(e.target.value); resetSelections(); }} sx={inputSx}>
                  {Object.entries(ASSESSMENT_MAP).map(([key, val]) => (
                    <MenuItem key={key} value={key} sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>{val.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Batch */}
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>Batch</InputLabel>
                <Select value={batchNo} label="Batch"
                  onChange={e => { setBatchNo(e.target.value); resetSelections(); }} sx={inputSx}>
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
                            {weekLabel ? <><strong>{weekLabel}</strong>&nbsp;—&nbsp;</> : ""}{p.date} — {p.topic_name}
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
                  <TextField label="Assessment Date" type="date" size="small" value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)} InputLabelProps={{ shrink: true }}
                    sx={{ width: 180, "& .MuiInputBase-root": { ...inputSx, fontFamily: "'DM Sans', sans-serif", fontSize: 13 }, "& .MuiInputLabel-root": { fontFamily: "'DM Sans', sans-serif", fontSize: 13 } }} />
                ) : (
                  <TextField label="Assessment Date" value={todayDate} disabled size="small"
                    sx={{ width: 160, "& .MuiInputBase-root": { ...inputSx, fontFamily: "'DM Sans', sans-serif", fontSize: 13 }, "& .MuiInputLabel-root": { fontFamily: "'DM Sans', sans-serif", fontSize: 13 } }} />
                )
              )}

              {/* Out Of + Save Out Of */}
              <Box sx={{ display: "flex", alignItems: "flex-end", gap: 1.5, flexWrap: "wrap" }}>
                <Tooltip title={
                  outOfLocked
                    ? `Out Of is fixed for ${isPdft ? "PDFT" : "DVFT"} batches. Contact Admin or Manager to override.`
                    : isAdminOrManager && isFixedOutOfBatch && isAutoOutOfType
                      ? "Admin/Manager override — fixed Out Of is editable for you."
                      : ""
                }>
                  <span>
                    <TextField
                      label="Out Of" value={outOff} disabled={outOfLocked} size="small"
                      onChange={e => handleOutOfChange(e.target.value)}
                      inputProps={{ inputMode: "decimal" }}
                      helperText={isFixedOutOfBatch && outOff && isAutoOutOfType ? (isAdminOrManager ? "Override" : "Fixed") : ""}
                      sx={{
                        width: 110,
                        "& .MuiInputBase-root": { ...inputSx, fontFamily: "'DM Sans', sans-serif", fontSize: 13, background: isAdminOrManager && isFixedOutOfBatch && isAutoOutOfType ? "#fef3c7" : "transparent" },
                        "& .MuiInputLabel-root": { fontFamily: "'DM Sans', sans-serif", fontSize: 13 },
                        "& .MuiFormHelperText-root": { fontFamily: "'DM Sans', sans-serif", fontSize: 10 },
                      }}
                    />
                  </span>
                </Tooltip>

                {/* Save Out Of — Admin/Manager only */}
                {isAdminOrManager && selectedDate && (
                  <Button variant="outlined" size="small" onClick={handleSaveOutOf}
                    disabled={savingOutOf || !outOff}
                    startIcon={savingOutOf ? <CircularProgress size={12} color="inherit" /> : <SaveIcon sx={{ fontSize: 14 }} />}
                    sx={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 12, borderRadius: "10px", textTransform: "none", borderColor: TOKENS.border, color: TOKENS.textSub, whiteSpace: "nowrap", height: 40, "&:hover": { borderColor: TOKENS.accent, color: TOKENS.accent, background: TOKENS.accentLight } }}>
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
                  {selectedCoursePlannerId && <StatPill icon={<InfoOutlinedIcon sx={{ fontSize: 14 }} />} label="Planner ID" value={selectedCoursePlannerId} />}
                  <BatchBadge batchNo={batchNo} />
                  {isAdminOrManager && isFixedOutOfBatch && isAutoOutOfType && <OutOfOverrideBadge />}
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
                  <Chip label={`${learners.length} learners`} size="small"
                    sx={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 11, background: TOKENS.accentLight, color: TOKENS.accent, border: `1px solid ${TOKENS.accent}33` }} />
                  {marksEnteredCount > 0 && (
                    <Chip label={`${marksEnteredCount} entered`} size="small"
                      sx={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 11, background: TOKENS.success.light, color: TOKENS.success.text, border: `1px solid ${TOKENS.success.fill}44` }} />
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
                        <TableCell sx={{ ...tableHeadSx, width: 150 }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                            Marks{outOff ? ` / ${outOff}` : ""}
                            <Tooltip title="Enter numbers (e.g. 10 or 10.5) or AB for absent">
                              <InfoOutlinedIcon sx={{ fontSize: 14, color: TOKENS.textSub }} />
                            </Tooltip>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ ...tableHeadSx, width: 80 }}>%</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {learners.map((l, idx) => {
                        const markData = marks[l.id];
                        const hasMarks = markData?.points && markData.points.trim() !== "";
                        const points   = markData?.points || "";
                        const pct      = markData?.percentage;
                        const pctNum   = pct ? parseFloat(pct) : 0;
                        const isAbsent = points === "AB";
                        const pctColor =
                          !hasMarks || pct === "" ? TOKENS.textSub :
                          isAbsent                ? TOKENS.warning.fill :
                          pctNum >= 75            ? TOKENS.success.fill :
                          pctNum >= 50            ? TOKENS.warning.fill :
                                                    TOKENS.error.fill;

                        return (
                          <TableRow key={l.id}
                            sx={{
                              "&:nth-of-type(even)": { background: TOKENS.surfaceAlt },
                              "&:hover": { background: TOKENS.accentLight + "66", transition: "background 0.15s" },
                              // Highlight rows with saved marks
                              ...(hasMarks ? { borderLeft: `3px solid ${isAbsent ? TOKENS.warning.fill : TOKENS.accent}44` } : {}),
                            }}>
                            <TableCell sx={{ ...tableCellSx, color: TOKENS.textSub, fontFamily: "'DM Mono', monospace", fontSize: 11 }}>{idx + 1}</TableCell>
                            <TableCell sx={{ ...tableCellSx, fontWeight: 600 }}>{l.name}</TableCell>
                            <TableCell sx={{ ...tableCellSx, color: TOKENS.textSub, fontSize: 12 }}>{l.email}</TableCell>
                            <TableCell sx={{ ...tableCellSx, py: 0.5 }}>
                              <TextField size="small"
                                value={points}
                                onChange={e => handleMarksInput(l.id, e.target.value)}
                                placeholder={marksEditDisabled ? "" : "e.g. 10.5 or AB"}
                                disabled={marksEditDisabled}
                                inputProps={{
                                  style: {
                                    fontFamily: "'DM Mono', monospace",
                                    fontSize: 13,
                                    fontWeight: 700,
                                    textTransform: "uppercase",
                                  }
                                }}
                                sx={{
                                  width: 110,
                                  "& .MuiInputBase-root": {
                                    borderRadius: "8px",
                                    background: marksEditDisabled
                                      ? TOKENS.surfaceAlt
                                      : hasMarks
                                        ? (isAbsent ? "#fef3c7" : TOKENS.accentLight)
                                        : "transparent",
                                    "& .MuiOutlinedInput-notchedOutline": {
                                      borderColor: hasMarks
                                        ? (isAbsent ? TOKENS.warning.fill + "66" : TOKENS.accent + "44")
                                        : TOKENS.border
                                    },
                                    "&:hover .MuiOutlinedInput-notchedOutline": {
                                      borderColor: marksEditDisabled ? TOKENS.border : TOKENS.accent
                                    },
                                  }
                                }}
                              />
                            </TableCell>
                            <TableCell sx={{ ...tableCellSx }}>
                              {hasMarks ? (
                                isAbsent ? (
                                  <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, px: 1.2, py: 0.3, borderRadius: "20px", background: `${TOKENS.warning.fill}18`, border: `1px solid ${TOKENS.warning.fill}44` }}>
                                    <Typography sx={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 800, color: TOKENS.warning.fill }}>AB</Typography>
                                  </Box>
                                ) : pct !== undefined && pct !== "" ? (
                                  <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, px: 1.2, py: 0.3, borderRadius: "20px", background: `${pctColor}18`, border: `1px solid ${pctColor}44` }}>
                                    <Typography sx={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 800, color: pctColor }}>{pct}%</Typography>
                                  </Box>
                                ) : (
                                  <Typography sx={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: TOKENS.textSub }}>--</Typography>
                                )
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
                  {marksEditDisabled ? (
                    /* Read-only: non-Admin/Coordinator viewing saved marks */
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2.5, py: 1.2, borderRadius: "10px", background: TOKENS.success.light, border: `1px solid ${TOKENS.success.fill}44` }}>
                      <LockIcon sx={{ fontSize: 16, color: TOKENS.success.fill }} />
                      <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700, color: TOKENS.success.text }}>
                        Marks already saved — only Admin or Coordinator can edit
                      </Typography>
                    </Box>
                  ) : (
                    <>
                      <Button variant="contained" onClick={handleSave}
                        disabled={saving || !batchNo || !selectedDate || !outOff || (!isAutoDateAssessment && !selectedCoursePlannerId)}
                        startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon sx={{ fontSize: 18 }} />}
                        sx={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 13, borderRadius: "10px", textTransform: "none", px: 3, py: 1.2, background: TOKENS.accent, "&:hover": { background: "#2a3fd4" }, "&:disabled": { opacity: 0.5 } }}>
                        {saving ? "Saving…" : `${marksAlreadySaved ? "Update" : "Save"} Marks${marksEnteredCount > 0 ? ` (${marksEnteredCount})` : ""}`}
                      </Button>

                      {/* Info about AB */}
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, px: 2, py: 0.8, borderRadius: "10px", background: TOKENS.surfaceAlt, border: `1px solid ${TOKENS.border}` }}>
                        <InfoOutlinedIcon sx={{ fontSize: 14, color: TOKENS.textSub }} />
                        <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: TOKENS.textSub }}>
                          Enter <strong>AB</strong> for absent · decimals like <strong>10.5</strong> are supported
                        </Typography>
                      </Box>

                      {marksAlreadySaved && (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, px: 2, py: 0.8, borderRadius: "10px", background: TOKENS.warning.light, border: `1px solid ${TOKENS.warning.fill}55` }}>
                          <InfoOutlinedIcon sx={{ fontSize: 14, color: TOKENS.warning.fill }} />
                          <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600, color: TOKENS.warning.text }}>
                            Editing saved marks
                          </Typography>
                        </Box>
                      )}
                    </>
                  )}
                </Box>

                <StatusBanner message={message} />
              </>
            ) : (
              batchNo ? (
                <Box sx={{ textAlign: "center", py: 6 }}>
                  <GroupIcon sx={{ fontSize: 40, color: TOKENS.border, mb: 1 }} />
                  <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: TOKENS.textSub }}>No learners found for batch {batchNo}.</Typography>
                </Box>
              ) : (
                <Box sx={{ textAlign: "center", py: 6 }}>
                  <AssignmentIcon sx={{ fontSize: 40, color: TOKENS.border, mb: 1 }} />
                  <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: TOKENS.textSub }}>Select a batch above to load learners.</Typography>
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