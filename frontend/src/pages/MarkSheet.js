import React, { useState, useEffect, useCallback } from "react";
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
  Tooltip,
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

/* ─── PDFT fixed Out Of values by topic keyword ─────────────────────────── */
const PDFT_OUT_OF_RULES = [
  { keywords: ["intermediate"], outOf: 25 },
  { keywords: ["digital design"], outOf: 30 },
  { keywords: ["cmos"], outOf: 20 },
  { keywords: ["tcl"], outOf: 25 },
  { keywords: ["physical design"], outOf: 100 },
  { keywords: ["final project"], outOf: 100 },
  { keywords: ["viva"], outOf: 25 },
];

function getPdftOutOf(topicName, assessmentType) {
  if (!topicName && !assessmentType) return null;
  const combined = `${topicName || ""} ${ASSESSMENT_MAP[assessmentType]?.label || ""}`.toLowerCase();

  for (const rule of PDFT_OUT_OF_RULES) {
    if (rule.keywords.every((kw) => combined.includes(kw))) {
      return rule.outOf;
    }
  }
  return null;
}

const todayDate = new Date().toISOString().split("T")[0];

const parseDate = (str) => {
  if (!str) return null;
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/* ─── Get user info from localStorage ───────────────────────────────────── */
function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
}

function isAdminOrManager(user) {
  return user?.role === "Admin" || user?.role === "Manager";
}

/* ─── Check if batch is PDFT ─────────────────────────────────────────────── */
function isPdftBatch(batchNo) {
  return batchNo?.toUpperCase().includes("PDFT");
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
  const [windowOpen, setWindowOpen] = useState(true);
  const [windowCloseDate, setWindowCloseDate] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingOutOf, setSavingOutOf] = useState(false);
  const [loadingMarks, setLoadingMarks] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());

  const currentUser = getCurrentUser();
  const canEditOutOf = isAdminOrManager(currentUser);
  const isPdft = isPdftBatch(batchNo);
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
      // Auto-populate out_of for PDFT batches
      if (isPdft) {
        const fixed = getPdftOutOf("", assessmentType);
        if (fixed !== null) {
          setOutOff(String(fixed));
        }
      }
      return;
    }
    const apiType = ASSESSMENT_MAP[assessmentType].api;
    fetch(`${API_BASE}/apiperiods/${batchNo}/${apiType}`)
      .then((res) => res.json())
      .then((data) => {
        // De-duplicate by planner id (each row = one unique assessment slot)
        // Two assessments on same date with different topics will have different ids
        const uniqueMap = new Map();
        (data || []).forEach((item) => {
          const key =
            item.id ?? `${item.week_no}-${item.date}-${item.topic_name}`;
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
    setOutOff("");
  }, [batchNo, assessmentType]);

  /* ── Window Logic ─────────────────────────── */
  useEffect(() => {
    if (isAutoDateAssessment) {
      setWindowOpen(true);
      return;
    }
    if (!selectedDate) return;
    const assessmentDate = parseDate(selectedDate);
    if (!assessmentDate) return;
    let close = new Date(assessmentDate);
    const type = ASSESSMENT_MAP[assessmentType]?.type;
    if (type === "weekly") {
      close.setDate(close.getDate() + 3);
    } else if (type === "mid") {
      close.setDate(close.getDate() + 5);
    } else if (type === "final") {
      close.setDate(close.getDate() + 7);
    }
    close.setHours(23, 59, 59, 999);
    setWindowOpen(currentDate <= close);
    setWindowCloseDate(close.toLocaleDateString("en-GB"));
  }, [selectedDate, assessmentType, currentDate]);

  /* ── Load existing marks when period is selected ─────────────────────── */
  const loadExistingMarks = useCallback(
    async (plannerId, date, weekNo) => {
      if (!batchNo || !plannerId || !date) return;
      setLoadingMarks(true);
      try {
        const cfg = ASSESSMENT_MAP[assessmentType];
        const res = await fetch(
          `${API_BASE}/api/marks/${cfg.api}?batch_no=${batchNo}&course_planner_id=${plannerId}&assessment_date=${date}`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          // Populate out_off from saved data
          const savedOutOf = data[0]?.out_off;
          if (savedOutOf) {
            setOutOff(String(savedOutOf));
          }
          // Populate marks per learner
          const marksMap = {};
          data.forEach((row) => {
            marksMap[row.learner_id] = {
              points: String(row.points ?? ""),
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
    },
    [batchNo, assessmentType]
  );

  /* ── Period selection ─────────────────────────────────────────────────── */
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

    // Auto-populate out_of for PDFT batches
    if (isPdft) {
      const fixed = getPdftOutOf(topic, assessmentType);
      if (fixed !== null) {
        setOutOff(String(fixed));
      }
    }

    // Load existing marks (will also overwrite out_off if already saved)
    if (plannerId && datePart) {
      loadExistingMarks(plannerId, datePart, weekPart);
    }
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

  /* ── Out Of change (admin/manager only) ───────────────────────────────── */
  const handleOutOfChange = (v) => {
    const val = v.replace(/\D/g, "");
    setOutOff(val);
    // Recalculate percentages for already-entered marks
    setMarks((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((id) => {
        if (updated[id]?.points) {
          updated[id] = {
            ...updated[id],
            percentage:
              Number(val) > 0
                ? Math.round((Number(updated[id].points) / Number(val)) * 100)
                : "",
          };
        }
      });
      return updated;
    });
  };

  /* ── Save Out Of (admin/manager only) ────────────────────────────────── */
  const handleSaveOutOf = async () => {
    if (!outOff || !batchNo) return;
    setSavingOutOf(true);
    try {
      const cfg = ASSESSMENT_MAP[assessmentType];
      const payload = {
        batch_no: batchNo,
        assessment_type: cfg.api,
        course_planner_id: selectedCoursePlannerId
          ? Number(selectedCoursePlannerId)
          : undefined,
        assessment_date: selectedDate,
        out_off: Number(outOff),
      };
      const res = await fetch(`${API_BASE}/api/marks/update-out-of`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setMessage("✅ Out Of updated successfully.");
      } else {
        const err = await res.json().catch(() => ({}));
        setMessage(`❌ Failed to update Out Of: ${err.error || "Unknown error"}`);
      }
    } catch (e) {
      setMessage("❌ Network error while updating Out Of.");
    } finally {
      setSavingOutOf(false);
      setTimeout(() => setMessage(""), 4000);
    }
  };

  /* ── Save Marks ───────────────────────────────────────────────────────── */
  const handleSave = async () => {
    if (!windowOpen) {
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
          if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            console.error("Save failed for", l.name, errBody);
            failCount++;
          } else {
            savedCount++;
          }
        } catch (fetchErr) {
          console.error("Network error for", l.name, fetchErr);
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

  /* ── Derived: is out_of field locked? ────────────────────────────────── */
  // Admins/Managers can ALWAYS edit Out Of regardless of window or PDFT.
  // Regular users: locked if window is closed OR if it's a PDFT fixed value.
  const outOfLocked = canEditOutOf
    ? false
    : !windowOpen || isPdft;

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

        {/* ── Filters row ─────────────────────────────────────────────────── */}
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 3, alignItems: "flex-end" }}>
          {/* Assessment Type */}
          <FormControl sx={{ minWidth: 220 }}>
            <InputLabel>Assessment Type</InputLabel>
            <Select
              value={assessmentType}
              label="Assessment Type"
              onChange={(e) => {
                setAssessmentType(e.target.value);
                setPeriodValue("");
                setSelectedDate("");
                setSelectedCoursePlannerId("");
                setSelectedWeekNo("");
                setTopicName("");
                setMarks({});
                setOutOff("");
              }}
            >
              <MenuItem value="weekly">Weekly Assessment</MenuItem>
              <MenuItem value="intermediate">Intermediate Assessment</MenuItem>
              <MenuItem value="module">Module Level Assessment</MenuItem>
              <MenuItem value="final">Final Assessment</MenuItem>
              <MenuItem value="final_project">Final Project</MenuItem>
              <MenuItem value="viva">Viva</MenuItem>
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
                setPeriodValue("");
                setSelectedDate("");
                setSelectedCoursePlannerId("");
                setSelectedWeekNo("");
                setTopicName("");
                setMarks({});
                setOutOff("");
              }}
            >
              {availableBatches.map((b) => (
                <MenuItem key={b} value={b}>
                  {b}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Period picker (planner-based assessments) */}
          {!isAutoDateAssessment && (
            <FormControl sx={{ minWidth: 360 }}>
              <InputLabel>Assessment Date / Topic</InputLabel>
              <Select
                value={periodValue}
                label="Assessment Date / Topic"
                onChange={handlePeriodSelect}
              >
                {periods.length === 0 && (
                  <MenuItem disabled value="">
                    {batchNo ? "No assessments found" : "Select a batch first"}
                  </MenuItem>
                )}
                {periods.map((p, idx) => {
                  /*
                   * Value format: "plannerId::weekNo::date::topicName"
                   * Each assessment slot (different planner id) gets its own entry.
                   * Two assessments on the same date with different topics are
                   * shown as separate options.
                   */
                  const plannerId = p.id ?? idx;
                  const weekNo = p.week_no ?? p.module_no ?? "";
                  const val = `${plannerId}::${weekNo}::${p.date}::${p.topic_name}`;
                  const weekLabel = p.week_no
                    ? `Week ${p.week_no}`
                    : p.module_no
                    ? `Module ${p.module_no}`
                    : "";
                  return (
                    <MenuItem key={val} value={val}>
                      {weekLabel ? `${weekLabel} — ` : ""}
                      {p.date} — {p.topic_name}
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>
          )}

          {/* Auto-date display (Final Project / Viva) */}
          {isAutoDateAssessment && (
            <TextField
              label="Assessment Date"
              value={todayDate}
              disabled
              sx={{ width: 160 }}
            />
          )}

          {/* Out Of */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Tooltip
              title={
                isPdft && !canEditOutOf
                  ? "Out Of is fixed for PDFT batches"
                  : ""
              }
            >
              <span>
                <TextField
                  label="Out Of"
                  value={outOff}
                  disabled={outOfLocked}
                  sx={{ width: 110 }}
                  onChange={(e) => handleOutOfChange(e.target.value)}
                  inputProps={{ inputMode: "numeric" }}
                  helperText={
                    isPdft && outOff && !canEditOutOf ? "Fixed" : ""
                  }
                />
              </span>
            </Tooltip>

            {/* Save Out Of button — only for Admin / Manager, only when a date is selected */}
            {canEditOutOf && selectedDate && (
              <Button
                variant="outlined"
                size="small"
                onClick={handleSaveOutOf}
                disabled={savingOutOf || !outOff}
                startIcon={
                  savingOutOf ? (
                    <CircularProgress size={14} color="inherit" />
                  ) : null
                }
                sx={{ whiteSpace: "nowrap", height: 40 }}
              >
                {savingOutOf ? "Saving…" : "Save Out Of"}
              </Button>
            )}
          </Box>
        </Box>

        {/* ── Window status banner ─────────────────────────────────────────── */}
        {!isAutoDateAssessment && selectedDate && (
          <Alert severity={windowOpen ? "success" : "error"} sx={{ mb: 2 }}>
            {windowOpen
              ? `✅ Marks entry window is OPEN. Closes on ${windowCloseDate}.`
              : `🔒 Marks entry window CLOSED on ${windowCloseDate}. Contact admin for extension.`}
          </Alert>
        )}

        {/* ── Selected assessment info ─────────────────────────────────────── */}
        {topicName && (
          <Box sx={{ mb: 2, p: 1.5, bgcolor: "#f5f5f5", borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">
              <strong>Assessment:</strong> {topicName} &nbsp;|&nbsp;
              <strong>Date:</strong> {selectedDate} &nbsp;|&nbsp;
              <strong>Out of:</strong> {outOff || "—"}
              {selectedCoursePlannerId && (
                <>
                  &nbsp;|&nbsp;
                  <strong>Planner ID:</strong> {selectedCoursePlannerId}
                </>
              )}
              {isPdft && outOff && (
                <>
                  &nbsp;|&nbsp;
                  <strong style={{ color: "#1976d2" }}>PDFT Fixed</strong>
                </>
              )}
            </Typography>
          </Box>
        )}

        {/* ── Learners table ───────────────────────────────────────────────── */}
        {loadingLearners || loadingMarks ? (
          <Box sx={{ display: "flex", justifyContent: "center", my: 3 }}>
            <CircularProgress size={28} />
          </Box>
        ) : learners.length > 0 ? (
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: "#f0f4ff" }}>
                <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>
                  Marks {outOff ? `(out of ${outOff})` : ""}
                </TableCell>
                <TableCell sx={{ fontWeight: 700 }}>%</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {learners.map((l, idx) => (
                <TableRow
                  key={l.id}
                  sx={{ "&:nth-of-type(odd)": { bgcolor: "#fafafa" } }}
                >
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell>{l.name}</TableCell>
                  <TableCell sx={{ fontSize: 12, color: "text.secondary" }}>
                    {l.email}
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      sx={{ width: 90 }}
                      disabled={!windowOpen}
                      value={marks[l.id]?.points || ""}
                      onChange={(e) => handleMarksInput(l.id, e.target.value)}
                      inputProps={{ inputMode: "numeric" }}
                    />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>
                    {marks[l.id]?.percentage !== undefined &&
                    marks[l.id]?.percentage !== ""
                      ? `${marks[l.id].percentage}%`
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          batchNo && (
            <Alert severity="info">No learners found for batch {batchNo}.</Alert>
          )
        )}

        {/* ── Save button ──────────────────────────────────────────────────── */}
        <Button
          sx={{ mt: 3 }}
          variant="contained"
          onClick={handleSave}
          disabled={
            saving ||
            !windowOpen ||
            !batchNo ||
            !selectedDate ||
            !outOff ||
            (!isAutoDateAssessment && !selectedCoursePlannerId)
          }
          startIcon={
            saving ? <CircularProgress size={18} color="inherit" /> : null
          }
        >
          {saving ? "Saving…" : "Save Marks"}
        </Button>

        {/* ── Status message ───────────────────────────────────────────────── */}
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