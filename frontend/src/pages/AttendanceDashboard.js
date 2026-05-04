import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import {
  Box,
  Typography,
  Grid,
  Select,
  MenuItem,
  FormControl,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Button,
  Alert,
  CircularProgress,
  Chip,
  Fade,
} from "@mui/material";

const API_BASE       = process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";
const sessionsPerDay = 3;

/* ─── Design tokens ──────────────────────────────────────────────────────── */
const T = {
  surface:     "#ffffff",
  surfaceAlt:  "#eef3ff",
  border:      "#c3d3f8",
  accent:      "#2563eb",
  accentDark:  "#1d4ed8",
  accentLight: "#dbeafe",
  text:        "#1e2d5a",
  textSub:     "#5b6f9c",
};

const cardSx = {
  background:   T.surface,
  borderRadius: "16px",
  border:       `1px solid ${T.border}`,
  boxShadow:    "0 2px 16px rgba(37,99,235,0.08)",
  overflow:     "hidden",
};

const labelSx = {
  fontFamily:    "'DM Sans', sans-serif",
  fontSize:      10,
  fontWeight:    700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color:         T.textSub,
};

const selectSx = {
  borderRadius: "10px",
  fontFamily:   "'DM Sans', sans-serif",
  fontSize:     13,
  background:   T.surfaceAlt,
  "& fieldset":             { borderColor: T.border },
  "&:hover fieldset":       { borderColor: T.accent },
  "&.Mui-focused fieldset": { borderColor: T.accent },
};

/* ─── Session status display config ─────────────────────────────────────── */
const SESSION_CFG = {
  P:  { label: "P",  bg: "#dcfce7", text: "#15803d", border: "#86efac", hov: "#16a34a" },
  A:  { label: "A",  bg: "#fee2e2", text: "#b91c1c", border: "#fca5a5", hov: "#dc2626" },
  L:  { label: "L",  bg: "#fef3c7", text: "#b45309", border: "#fcd34d", hov: "#d97706" },
  NA: { label: "NA", bg: "#f3f4f6", text: "#6b7280", border: "#d1d5db", hov: "#6b7280" },
};

export default function AttendanceDashboard({ token, currentUser }) {
  const [domains,         setDomains]         = useState([]);
  const [domain,          setDomain]          = useState("");
  const [batches,         setBatches]         = useState([]);
  const [batchNo,         setBatchNo]         = useState("");
  const [learners,        setLearners]        = useState([]);
  const [todayDate,       setTodayDate]       = useState("");
  const [courseStartDate, setCourseStartDate] = useState("");
  const [courseEndDate,   setCourseEndDate]   = useState("");

  /* attendance[learnerEmail][date][session] = { status, savedStatus, locked } */
  const [attendance,  setAttendance]  = useState({});
  const [loading,     setLoading]     = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [message,     setMessage]     = useState("");
  const [dirtyEmails, setDirtyEmails] = useState(new Set());

  const authHeaders = useCallback(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );

  /* ── Load domains ── */
  useEffect(() => {
    axios.get(`${API_BASE}/api/get_domains`).then((res) => setDomains(res.data || []));
  }, []);

  /* ── Load batches when domain changes ── */
  useEffect(() => {
    if (!domain) {
      setBatches([]); setBatchNo(""); setLearners([]); setTodayDate("");
      setCourseStartDate(""); setCourseEndDate(""); setAttendance({});
      setDirtyEmails(new Set());
      return;
    }
    axios
      .get(`${API_BASE}/api/get_batches_by_domain`, { params: { domain } })
      .then((res) => setBatches(res.data || []));
  }, [domain]);

  /* ── Build local attendance map from learners + saved data ── */
  const buildAttendanceMap = useCallback((learnersList, today, serverData) => {
    const map = {};
    learnersList.forEach((learner) => {
      map[learner.email] = { [today]: {} };
      for (let session = 1; session <= sessionsPerDay; session++) {
        if (learner.status === "Disabled") {
          map[learner.email][today][session] = { status: "NA", savedStatus: "NA", locked: true };
          continue;
        }
        const savedVal = serverData?.[learner.email]?.[today]?.[session] || "";
        map[learner.email][today][session] = {
          status:      savedVal,
          savedStatus: savedVal,
          locked:      false,
        };
      }
    });
    return map;
  }, []);

  /* ── Reload saved attendance from the table ── */
  const reloadSavedAttendance = useCallback(
    async (learnersList, today) => {
      try {
        const res = await axios.get(`${API_BASE}/api/get_attendance_table`, {
          params: { batch_no: batchNo },
        });
        setAttendance(buildAttendanceMap(learnersList, today, res.data || {}));
        setDirtyEmails(new Set());
      } catch (e) {
        console.error("Failed to reload attendance from table:", e);
      }
    },
    [batchNo, buildAttendanceMap]
  );

  /* ── Load learners, course dates, and saved attendance on batch select ── */
  useEffect(() => {
    if (!batchNo) {
      setLearners([]); setTodayDate(""); setCourseStartDate("");
      setCourseEndDate(""); setAttendance({}); setDirtyEmails(new Set());
      return;
    }

    async function fetchBatchDetails() {
      setLoading(true);
      setMessage("");
      setDirtyEmails(new Set());

      try {
        const today = new Date().toISOString().slice(0, 10);
        setTodayDate(today);

        const [learnersRes, datesRes] = await Promise.all([
          axios.get(`${API_BASE}/api/get_learners`,    { params: { batch_no: batchNo } }),
          axios.get(`${API_BASE}/api/get_batch_dates`, { params: { batch_no: batchNo } }),
        ]);

        const filteredLearners = (learnersRes.data || []).filter((l) => l.status !== "Dropout");
        setLearners(filteredLearners);

        const { start_date, end_date } = datesRes.data || {};
        setCourseStartDate(start_date);
        setCourseEndDate(end_date);

        if (!start_date || !end_date || today < start_date || today > end_date) {
          setMessage("Today is outside the course duration. You can view but not mark attendance.");
          setAttendance({});
          setLoading(false);
          return;
        }

        let serverData = {};
        try {
          const attRes = await axios.get(`${API_BASE}/api/get_attendance_table`, {
            params: { batch_no: batchNo },
          });
          serverData = attRes.data || {};
        } catch (_) { /* allow blank start if endpoint fails */ }

        setAttendance(buildAttendanceMap(filteredLearners, today, serverData));
      } catch (e) {
        console.error(e);
        setMessage("Failed to load batch data");
        setLearners([]); setTodayDate(""); setCourseStartDate(""); setCourseEndDate("");
        setAttendance({});
      }

      setLoading(false);
    }

    fetchBatchDetails();
  }, [batchNo, buildAttendanceMap]);

  /* ── Mark P / A / L ── */
  function markAttendance(learnerEmail, session, status) {
    setAttendance((prev) => {
      const prevCell = prev[learnerEmail]?.[todayDate]?.[session] || {};
      return {
        ...prev,
        [learnerEmail]: {
          ...prev[learnerEmail],
          [todayDate]: {
            ...prev[learnerEmail]?.[todayDate],
            [session]: { ...prevCell, status, locked: false },
          },
        },
      };
    });

    setDirtyEmails((prev) => {
      const next = new Set(prev);
      next.add(learnerEmail);
      return next;
    });

    if (message) setMessage("");
  }

  /* ── Save attendance, then reload from the table ── */
  async function saveAttendance() {
    setSaving(true);
    setMessage("");

    try {
      /* Build { email: { date: { session: "P|A|L" } } }, skipping NA / unmarked */
      const saveObj = {};
      Object.keys(attendance).forEach((email) => {
        for (let session = 1; session <= sessionsPerDay; session++) {
          const cell = attendance[email]?.[todayDate]?.[session];
          if (!cell || cell.locked) continue;
          if (!cell.status) continue;
          if (!saveObj[email]) saveObj[email] = { [todayDate]: {} };
          saveObj[email][todayDate][session] = cell.status;
        }
      });

      await axios.post(
        `${API_BASE}/api/save_attendance_table`,
        {
          batch_no:      batchNo,
          attendance:    saveObj,
          /* fallback if no JWT — server tries header first, then body */
          trainer_email: currentUser?.email || undefined,
        },
        { headers: authHeaders() }
      );

      /* Reload from the attendance table so the UI reflects what's persisted */
      await reloadSavedAttendance(learners, todayDate);

      setMessage("✅ Attendance saved and loaded from table.");
    } catch (err) {
      console.error(err);
      const apiMsg = err?.response?.data?.error;
      setMessage(`❌ Failed to save attendance${apiMsg ? `: ${apiMsg}` : ""}.`);
    }

    setSaving(false);
  }

  /* ── Session cell renderer ── */
  function renderSessionCell(learner, session) {
    const cell = attendance[learner.email]?.[todayDate]?.[session] || {
      status: "", savedStatus: "", locked: false,
    };

    if (cell.locked) {
      const cfg = SESSION_CFG[cell.status] || SESSION_CFG.NA;
      return (
        <Box sx={{ display: "inline-flex", alignItems: "center", px: 1.5, py: 0.4, borderRadius: "20px", background: cfg.bg, border: `1px solid ${cfg.border}` }}>
          <Typography sx={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 800, color: cfg.text }}>
            {cfg.label}
          </Typography>
        </Box>
      );
    }

    return (
      <Box sx={{ display: "flex", gap: 0.6, justifyContent: "center", alignItems: "center" }}>
        {["P", "A", "L"].map((key) => {
          const cfg        = SESSION_CFG[key];
          const isSelected = cell.status === key;
          const isSaved    = cell.savedStatus === key;

          return (
            <Box key={key} sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.3 }}>
              <Box
                onClick={() => markAttendance(learner.email, session, key)}
                sx={{
                  width:        30,
                  height:       30,
                  borderRadius: "8px",
                  background:   isSelected ? cfg.hov : cfg.bg,
                  display:      "flex",
                  alignItems:   "center",
                  justifyContent: "center",
                  cursor:       "pointer",
                  fontFamily:   "'DM Mono', monospace",
                  fontSize:     12,
                  fontWeight:   800,
                  color:        isSelected ? "#fff" : cfg.text,
                  border:       `1.5px solid ${isSelected ? cfg.hov : cfg.border}`,
                  transition:   "all 0.15s",
                  userSelect:   "none",
                  transform:    isSelected ? "scale(1.1)" : "scale(1)",
                  boxShadow:    isSelected ? `0 2px 8px ${cfg.hov}66` : "none",
                  "&:hover": {
                    background: cfg.hov,
                    color:      "#fff",
                    transform:  "scale(1.12)",
                    boxShadow:  `0 2px 8px ${cfg.hov}66`,
                  },
                }}
              >
                {key}
              </Box>
              <Box
                sx={{
                  width:        5,
                  height:       5,
                  borderRadius: "50%",
                  background:   isSaved ? cfg.hov : "transparent",
                  transition:   "background 0.2s",
                }}
              />
            </Box>
          );
        })}
      </Box>
    );
  }

  /* ── Summary stats ── */
  const totalSessions = learners.filter((l) => l.status !== "Disabled").length * sessionsPerDay;
  const markedCount   = Object.values(attendance).reduce((sum, dates) =>
    sum + Object.values(dates).reduce((s2, sessions) =>
      s2 + Object.values(sessions).filter((c) => c.status !== "" && c.status !== "NA").length, 0), 0);
  const presentCount  = Object.values(attendance).reduce((sum, dates) =>
    sum + Object.values(dates).reduce((s2, sessions) =>
      s2 + Object.values(sessions).filter((c) => c.status === "P").length, 0), 0);
  const absentCount   = Object.values(attendance).reduce((sum, dates) =>
    sum + Object.values(dates).reduce((s2, sessions) =>
      s2 + Object.values(sessions).filter((c) => c.status === "A").length, 0), 0);
  const savedCount    = Object.values(attendance).reduce((sum, dates) =>
    sum + Object.values(dates).reduce((s2, sessions) =>
      s2 + Object.values(sessions).filter((c) => c.savedStatus !== "" && c.savedStatus !== "NA").length, 0), 0);
  const hasDirtyChanges = dirtyEmails.size > 0;

  /* ════════════════════ RENDER ════════════════════ */
  return (
    <Box sx={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* ── Header / filter card ── */}
      <Box sx={{ ...cardSx, p: { xs: 2.5, md: 3 }, mb: 2.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2.5 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: "12px", background: `linear-gradient(135deg, ${T.accent}, ${T.accentDark})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, boxShadow: `0 3px 12px ${T.accent}44` }}>
            📋
          </Box>
          <Box>
            <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 800, fontSize: 18, color: T.text, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
              Attendance Dashboard
            </Typography>
            <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: T.textSub }}>
              {courseStartDate && courseEndDate
                ? `Course: ${courseStartDate} → ${courseEndDate} · Marking for today only`
                : "Select a domain and batch to begin"}
            </Typography>
          </Box>
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Typography sx={{ ...labelSx, mb: 0.8 }}>Domain</Typography>
            <FormControl fullWidth size="small">
              <Select
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                displayEmpty
                sx={selectSx}
                MenuProps={{ PaperProps: { sx: { borderRadius: "12px", maxHeight: 280 } } }}
              >
                <MenuItem value="" sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: T.textSub }}>
                  <em>Select domain…</em>
                </MenuItem>
                {domains.map((d) => (
                  <MenuItem key={d} value={d} sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>{d}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography sx={{ ...labelSx, mb: 0.8 }}>Batch No</Typography>
            <FormControl fullWidth size="small" disabled={!domain}>
              <Select
                value={batchNo}
                onChange={(e) => setBatchNo(e.target.value)}
                displayEmpty
                sx={selectSx}
                MenuProps={{ PaperProps: { sx: { borderRadius: "12px", maxHeight: 280 } } }}
              >
                <MenuItem value="" sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: T.textSub }}>
                  <em>Select batch…</em>
                </MenuItem>
                {batches.map((b) => (
                  <MenuItem key={b} value={b} sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>{b}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        {todayDate && (
          <Box sx={{ mt: 2, display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
            <Box sx={{ px: 2, py: 0.8, borderRadius: "10px", background: T.accentLight, border: `1px solid ${T.accent}44` }}>
              <Typography sx={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: T.accent }}>
                📅 {todayDate}
              </Typography>
            </Box>
            {learners.length > 0 && (
              <>
                <Box sx={{ px: 2, py: 0.8, borderRadius: "10px", background: "#dcfce7", border: "1px solid #86efac" }}>
                  <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, color: "#15803d" }}>
                    {presentCount} Present
                  </Typography>
                </Box>
                <Box sx={{ px: 2, py: 0.8, borderRadius: "10px", background: "#fee2e2", border: "1px solid #fca5a5" }}>
                  <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, color: "#b91c1c" }}>
                    {absentCount} Absent
                  </Typography>
                </Box>
                <Box sx={{ px: 2, py: 0.8, borderRadius: "10px", background: T.surfaceAlt, border: `1px solid ${T.border}` }}>
                  <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600, color: T.textSub }}>
                    {markedCount}/{totalSessions} sessions marked
                  </Typography>
                </Box>
                {savedCount > 0 && (
                  <Box sx={{ px: 2, py: 0.8, borderRadius: "10px", background: "#f0fdf4", border: "1px solid #86efac" }}>
                    <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600, color: "#15803d" }}>
                      ✓ {savedCount} sessions saved
                    </Typography>
                  </Box>
                )}
                {hasDirtyChanges && (
                  <Box sx={{ px: 2, py: 0.8, borderRadius: "10px", background: "#fef3c7", border: "1px solid #fcd34d" }}>
                    <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, color: "#b45309" }}>
                      ⚠ Unsaved changes
                    </Typography>
                  </Box>
                )}
              </>
            )}
          </Box>
        )}
      </Box>

      {loading && (
        <Box sx={{ ...cardSx, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", py: 8, gap: 2, mb: 2.5 }}>
          <CircularProgress size={36} sx={{ color: T.accent }} />
          <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: T.textSub }}>
            Loading batch data…
          </Typography>
        </Box>
      )}

      {!loading && learners.length > 0 && todayDate && (
        <Box sx={{ ...cardSx, mb: 2.5 }}>
          <Box sx={{ px: 2.5, py: 1.5, background: `linear-gradient(135deg, ${T.accent}14, ${T.accentLight})`, borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box sx={{ width: 4, height: 20, borderRadius: "2px", background: T.accent }} />
            <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 800, fontSize: 14, color: T.text }}>
              Learner Attendance — {todayDate}
            </Typography>
            <Chip
              label={`${learners.length} learner${learners.length !== 1 ? "s" : ""}`}
              size="small"
              sx={{ ml: "auto", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 10, height: 20, background: T.accent, color: "#fff" }}
            />
          </Box>

          <Box sx={{ px: 2.5, py: 1.2, borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap", background: T.surfaceAlt }}>
            <Typography sx={{ ...labelSx, fontSize: 9 }}>Legend:</Typography>
            {[
              { key: "P", desc: "Present" },
              { key: "A", desc: "Absent" },
              { key: "L", desc: "Late" },
            ].map(({ key, desc }) => {
              const cfg = SESSION_CFG[key];
              return (
                <Box key={key} sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
                  <Box sx={{ width: 20, height: 20, borderRadius: "5px", background: cfg.hov, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Typography sx={{ fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 800, color: "#fff" }}>{key}</Typography>
                  </Box>
                  <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: T.textSub }}>{desc}</Typography>
                </Box>
              );
            })}
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
              <Box sx={{ width: 5, height: 5, borderRadius: "50%", background: T.accent }} />
              <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: T.textSub }}>Dot = already saved</Typography>
            </Box>
          </Box>

          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {["#", "Learner Name", "Email", ...Array.from({ length: sessionsPerDay }, (_, i) => `Session ${i + 1}`)].map((h) => (
                    <TableCell
                      key={h}
                      align={["Learner Name", "Email", "#"].includes(h) ? "left" : "center"}
                      sx={{ ...labelSx, background: T.surfaceAlt, borderBottom: `2px solid ${T.border}`, py: 1.3, whiteSpace: "nowrap" }}
                    >
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {learners.map((learner, idx) => {
                  const isDirty = dirtyEmails.has(learner.email);
                  return (
                    <TableRow
                      key={learner.email}
                      sx={{
                        "&:nth-of-type(even)": { background: T.surfaceAlt },
                        "&:hover":             { background: T.accentLight, transition: "background 0.15s" },
                        ...(isDirty ? { borderLeft: `3px solid #f59e0b` } : {}),
                      }}
                    >
                      <TableCell sx={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: T.textSub, width: 36 }}>
                        {idx + 1}
                      </TableCell>
                      <TableCell sx={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 13, color: T.text, whiteSpace: "nowrap" }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
                          {learner.name}
                          {isDirty && (
                            <Box sx={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b", flexShrink: 0 }} title="Unsaved changes" />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell sx={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: T.textSub, maxWidth: 220, wordBreak: "break-all" }}>
                        {learner.email}
                      </TableCell>
                      {Array.from({ length: sessionsPerDay }, (_, i) => (
                        <TableCell key={`cell_${learner.email}_${i + 1}`} align="center" sx={{ py: 1 }}>
                          {renderSessionCell(learner, i + 1)}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        </Box>
      )}

      {!loading && (
        <Button
          variant="contained"
          fullWidth
          onClick={saveAttendance}
          disabled={saving || !todayDate || learners.length === 0}
          sx={{
            fontFamily:    "'DM Sans', sans-serif",
            fontWeight:    800,
            fontSize:      14,
            borderRadius:  "12px",
            py:            1.6,
            textTransform: "none",
            background:    hasDirtyChanges
              ? `linear-gradient(135deg, #d97706 0%, #b45309 100%)`
              : `linear-gradient(135deg, ${T.accent} 0%, ${T.accentDark} 100%)`,
            boxShadow:     hasDirtyChanges
              ? "0 4px 16px #f59e0b44"
              : `0 4px 16px ${T.accent}44`,
            mb: 2,
            "&:hover": {
              background: hasDirtyChanges
                ? `linear-gradient(135deg, #b45309 0%, #d97706 100%)`
                : `linear-gradient(135deg, ${T.accentDark} 0%, ${T.accent} 100%)`,
            },
            "&.Mui-disabled": { background: T.border, color: T.textSub, boxShadow: "none" },
          }}
        >
          {saving
            ? <CircularProgress size={20} color="inherit" />
            : hasDirtyChanges
              ? "💾 Save Changes"
              : "💾 Save Today's Attendance"}
        </Button>
      )}

      <Fade in={!!message}>
        <Box>
          {message && (
            <Alert
              severity={message.startsWith("✅") ? "success" : message.startsWith("❌") ? "error" : "info"}
              sx={{ borderRadius: "10px", fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}
            >
              {message}
            </Alert>
          )}
        </Box>
      </Fade>
    </Box>
  );
}
