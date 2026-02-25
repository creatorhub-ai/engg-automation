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

  // Selected period details — now includes course_planner_id
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

    // Auto-date assessments don't need periods from the planner
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
        // De-duplicate by the composite key that uniquely identifies one assessment slot
        // Include planner_id so we can distinguish same-date assessments
        const uniqueMap = new Map();
        (data || []).forEach((item) => {
          // Use planner id as the unique key — each row in course_planner_data is one assessment
          const key = item.id ?? `${item.week_no}-${item.date}-${item.topic_name}`;
          if (!uniqueMap.has(key)) uniqueMap.set(key, item);
        });
        setPeriods(Array.from(uniqueMap.values()));
      })
      .catch(() => setPeriods([]));

    // Reset selections whenever batch or type changes
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

    // Value format: "plannerId::weekNo::date::topicName"
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
    if (!batchNo || !selectedDate || !outOff) {
      setMessage("❌ Please complete all required fields.");
      return;
    }

    // For non-auto assessments, require a period to be selected
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
          learner_id:       l.id,
          batch_no:         batchNo,
          assessment_date:  selectedDate,
          assessment_name:  topicName || cfg.label,
          out_off:          Number(outOff),
          points:           Number(marks[l.id].points),
          percentage:       marks[l.id].percentage || null,

          // ─── KEY FIX ──────────────────────────────────────────────────────
          // Send course_planner_id directly so the backend uses it as-is.
          // This ensures two assessments on the same date each get their own
          // row in final_assessment_scores (different course_planner_id = different unique key).
          course_planner_id: selectedCoursePlannerId
            ? Number(selectedCoursePlannerId)
            : undefined,
        };

        // Add week_no or module_no for planner-based assessments
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
        setMarks({});
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
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 3 }}>
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
              onChange={(e) => setBatchNo(e.target.value)}
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
            <FormControl sx={{ minWidth: 340 }}>
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
                   * Using plannerId as the first segment is the key change —
                   * it makes two assessments on the same date produce different
                   * values, so each gets its own entry in the DB.
                   */
                  const plannerId = p.id ?? idx;
                  const weekNo    = p.week_no ?? p.module_no ?? "";
                  const val       = `${plannerId}::${weekNo}::${p.date}::${p.topic_name}`;
                  return (
                    <MenuItem key={val} value={val}>
                      {p.week_no ? `Week ${p.week_no}` : ""} ({p.date}) — {p.topic_name}
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
          <TextField
            label="Out Of"
            value={outOff}
            sx={{ width: 110 }}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "");
              setOutOff(v);
              // Recalculate all percentages when out_of changes
              setMarks((prev) => {
                const updated = { ...prev };
                Object.keys(updated).forEach((id) => {
                  if (updated[id]?.points) {
                    updated[id] = {
                      ...updated[id],
                      percentage:
                        Number(v) > 0
                          ? Math.round(
                              (Number(updated[id].points) / Number(v)) * 100
                            )
                          : "",
                    };
                  }
                });
                return updated;
              });
            }}
          />
        </Box>

        {/* ── Window status banner ─────────────────────────────────────────── */}
        {!isAutoDateAssessment && selectedDate && (
          <Alert
            severity={isWindowOpen ? "success" : "error"}
            sx={{ mb: 2 }}
          >
            {isWindowOpen
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
                <>&nbsp;|&nbsp;<strong>Planner ID:</strong> {selectedCoursePlannerId}</>
              )}
            </Typography>
          </Box>
        )}

        {/* ── Learners table ───────────────────────────────────────────────── */}
        {loadingLearners ? (
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
            !batchNo ||
            !selectedDate ||
            !outOff ||
            (!isAutoDateAssessment && !selectedCoursePlannerId)
          }
          startIcon={saving ? <CircularProgress size={18} color="inherit" /> : null}
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