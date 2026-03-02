import React, { useEffect, useState } from "react";
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
  "& fieldset":            { borderColor: T.border },
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

export default function AttendanceDashboard({ token }) {
  const [domains,        setDomains]        = useState([]);
  const [domain,         setDomain]         = useState("");
  const [batches,        setBatches]        = useState([]);
  const [batchNo,        setBatchNo]        = useState("");
  const [learners,       setLearners]       = useState([]);
  const [todayDate,      setTodayDate]      = useState("");
  const [courseStartDate, setCourseStartDate] = useState("");
  const [courseEndDate,  setCourseEndDate]  = useState("");
  /* attendance[learnerEmail][todayDate][session] = { status: "", locked: false } */
  const [attendance,     setAttendance]     = useState({});
  const [loading,        setLoading]        = useState(false);
  const [message,        setMessage]        = useState("");

  const authHeaders = () => (token ? { Authorization: `Bearer ${token}` } : {});

  /* ── Load domains ── */
  useEffect(() => {
    axios.get(`${API_BASE}/api/get_domains`).then((res) => setDomains(res.data || []));
  }, []);

  /* ── Load batches when domain changes ── */
  useEffect(() => {
    if (!domain) {
      setBatches([]); setBatchNo(""); setLearners([]); setTodayDate("");
      setCourseStartDate(""); setCourseEndDate(""); setAttendance({});
      return;
    }
    axios.get(`${API_BASE}/api/get_batches_by_domain`, { params: { domain } })
      .then((res) => setBatches(res.data || []));
  }, [domain]);

  /* ── Load learners, course dates, today's attendance ── */
  useEffect(() => {
    if (!batchNo) {
      setLearners([]); setTodayDate(""); setCourseStartDate("");
      setCourseEndDate(""); setAttendance({});
      return;
    }
    async function fetchBatchDetails() {
      setLoading(true);
      try {
        const [learnersRes, datesRes] = await Promise.all([
          axios.get(`${API_BASE}/api/get_learners`,    { params: { batch_no: batchNo } }),
          axios.get(`${API_BASE}/api/get_batch_dates`, { params: { batch_no: batchNo } }),
        ]);

        const filteredLearners = (learnersRes.data || []).filter((l) => l.status !== "Dropout");
        setLearners(filteredLearners);

        const { start_date, end_date } = datesRes.data || {};
        setCourseStartDate(start_date);
        setCourseEndDate(end_date);

        const today = new Date().toISOString().slice(0, 10);
        setTodayDate(today);

        if (!start_date || !end_date || today < start_date || today > end_date) {
          setMessage("Today is outside the course duration. You can view but not mark attendance.");
          setAttendance({}); setLoading(false); return;
        }

        let serverAttendance = {};
        try {
          const attRes = await axios.get(`${API_BASE}/api/get_batch_attendance`, { params: { batch_no: batchNo } });
          serverAttendance = attRes.data || {};
        } catch (_) {}

        const newAttendance = {};
        filteredLearners.forEach((learner) => {
          newAttendance[learner.email] = { [today]: {} };
          for (let session = 1; session <= sessionsPerDay; session++) {
            const serverCell = serverAttendance[learner.email]?.[today]?.[session];
            if (serverCell) {
              newAttendance[learner.email][today][session] = { status: serverCell.status, locked: true };
            } else if (learner.status === "Disabled") {
              newAttendance[learner.email][today][session] = { status: "NA", locked: true };
            } else {
              newAttendance[learner.email][today][session] = { status: "", locked: false };
            }
          }
        });

        setAttendance(newAttendance);
        setMessage("");
      } catch (e) {
        console.error(e);
        setMessage("Failed to load batch data");
        setLearners([]); setTodayDate(""); setCourseStartDate(""); setCourseEndDate(""); setAttendance({});
      }
      setLoading(false);
    }
    fetchBatchDetails();
  }, [batchNo]);

  /* ── Mark P / A / L ── */
  function markAttendance(learnerEmail, session, status) {
    setAttendance((prev) => ({
      ...prev,
      [learnerEmail]: {
        ...prev[learnerEmail],
        [todayDate]: {
          ...prev[learnerEmail]?.[todayDate],
          [session]: { status, locked: true },
        },
      },
    }));
  }

  /* ── Save attendance (sends course dates for backend % calc) ── */
  async function saveAttendance() {
    setLoading(true); setMessage("");
    try {
      const saveObj = {};
      Object.keys(attendance).forEach((email) => {
        saveObj[email] = { [todayDate]: {} };
        for (let session = 1; session <= sessionsPerDay; session++) {
          saveObj[email][todayDate][session] = attendance[email]?.[todayDate]?.[session]?.status || "";
        }
      });
      await axios.post(
        `${API_BASE}/api/save_attendance_ui`,
        { batch_no: batchNo, attendance: saveObj, course_start_date: courseStartDate, course_end_date: courseEndDate },
        { headers: authHeaders() }
      );
      setMessage("✅ Today's attendance saved successfully");
    } catch (err) {
      console.error(err);
      setMessage("❌ Failed to save attendance");
    }
    setLoading(false);
  }

  /* ── Session cell renderer ── */
  function renderSessionCell(learner, session) {
    const cell = attendance[learner.email]?.[todayDate]?.[session] || { status: "", locked: false };

    if (cell.locked) {
      const cfg = SESSION_CFG[cell.status];
      return cfg ? (
        <Box sx={{ display: "inline-flex", alignItems: "center", px: 1.5, py: 0.4, borderRadius: "20px", background: cfg.bg, border: `1px solid ${cfg.border}` }}>
          <Typography sx={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 800, color: cfg.text }}>{cfg.label}</Typography>
        </Box>
      ) : (
        <Box sx={{ display: "inline-flex", alignItems: "center", px: 1.5, py: 0.4, borderRadius: "20px", background: "#f3f4f6", border: "1px solid #d1d5db" }}>
          <Typography sx={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700, color: "#6b7280" }}>—</Typography>
        </Box>
      );
    }

    /* Unlocked → three clickable tiles */
    return (
      <Box sx={{ display: "flex", gap: 0.6, justifyContent: "center" }}>
        {["P", "A", "L"].map((key) => {
          const cfg = SESSION_CFG[key];
          return (
            <Box
              key={key}
              onClick={() => markAttendance(learner.email, session, key)}
              sx={{
                width: 30, height: 30, borderRadius: "8px",
                background:     cfg.bg,
                display:        "flex", alignItems: "center", justifyContent: "center",
                cursor:         "pointer",
                fontFamily:     "'DM Mono', monospace",
                fontSize:       12, fontWeight: 800, color: cfg.text,
                border:         `1.5px solid ${cfg.border}`,
                transition:     "all 0.15s",
                userSelect:     "none",
                "&:hover": { background: cfg.hov, color: "#fff", transform: "scale(1.12)", boxShadow: `0 2px 8px ${cfg.hov}66` },
              }}
            >
              {key}
            </Box>
          );
        })}
      </Box>
    );
  }

  /* ── Summary stats ── */
  const totalSessions = learners.length * sessionsPerDay;
  const markedCount   = Object.values(attendance).reduce((sum, dates) =>
    sum + Object.values(dates).reduce((s2, sessions) =>
      s2 + Object.values(sessions).filter((c) => c.status !== "").length, 0), 0);
  const presentCount  = Object.values(attendance).reduce((sum, dates) =>
    sum + Object.values(dates).reduce((s2, sessions) =>
      s2 + Object.values(sessions).filter((c) => c.status === "P").length, 0), 0);
  const absentCount   = Object.values(attendance).reduce((sum, dates) =>
    sum + Object.values(dates).reduce((s2, sessions) =>
      s2 + Object.values(sessions).filter((c) => c.status === "A").length, 0), 0);

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

        {/* Domain + Batch selectors */}
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
                <MenuItem value="" sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: T.textSub }}><em>Select domain…</em></MenuItem>
                {domains.map((d) => <MenuItem key={d} value={d} sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>{d}</MenuItem>)}
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
                <MenuItem value="" sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: T.textSub }}><em>Select batch…</em></MenuItem>
                {batches.map((b) => <MenuItem key={b} value={b} sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>{b}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        {/* Date + summary badges */}
        {todayDate && (
          <Box sx={{ mt: 2, display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
            <Box sx={{ px: 2, py: 0.8, borderRadius: "10px", background: T.accentLight, border: `1px solid ${T.accent}44` }}>
              <Typography sx={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: T.accent }}>📅 {todayDate}</Typography>
            </Box>
            {learners.length > 0 && (
              <>
                <Box sx={{ px: 2, py: 0.8, borderRadius: "10px", background: "#dcfce7", border: "1px solid #86efac" }}>
                  <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, color: "#15803d" }}>{presentCount} Present</Typography>
                </Box>
                <Box sx={{ px: 2, py: 0.8, borderRadius: "10px", background: "#fee2e2", border: "1px solid #fca5a5" }}>
                  <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, color: "#b91c1c" }}>{absentCount} Absent</Typography>
                </Box>
                <Box sx={{ px: 2, py: 0.8, borderRadius: "10px", background: T.surfaceAlt, border: `1px solid ${T.border}` }}>
                  <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600, color: T.textSub }}>{markedCount}/{totalSessions} sessions marked</Typography>
                </Box>
              </>
            )}
          </Box>
        )}
      </Box>

      {/* ── Loading ── */}
      {loading && (
        <Box sx={{ ...cardSx, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", py: 8, gap: 2, mb: 2.5 }}>
          <CircularProgress size={36} sx={{ color: T.accent }} />
          <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: T.textSub }}>Loading batch data…</Typography>
        </Box>
      )}

      {/* ── Attendance table ── */}
      {!loading && learners.length > 0 && todayDate && (
        <Box sx={{ ...cardSx, mb: 2.5 }}>

          {/* Table header strip */}
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
                {learners.map((learner, idx) => (
                  <TableRow
                    key={learner.email}
                    sx={{
                      "&:nth-of-type(even)": { background: T.surfaceAlt },
                      "&:hover": { background: T.accentLight, transition: "background 0.15s" },
                    }}
                  >
                    <TableCell sx={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: T.textSub, width: 36 }}>
                      {idx + 1}
                    </TableCell>
                    <TableCell sx={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 13, color: T.text, whiteSpace: "nowrap" }}>
                      {learner.name}
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
                ))}
              </TableBody>
            </Table>
          </Box>
        </Box>
      )}

      {/* ── Save button ── */}
      {!loading && (
        <Button
          variant="contained"
          fullWidth
          onClick={saveAttendance}
          disabled={loading || !todayDate || learners.length === 0}
          sx={{
            fontFamily:    "'DM Sans', sans-serif",
            fontWeight:    800,
            fontSize:      14,
            borderRadius:  "12px",
            py:            1.6,
            textTransform: "none",
            background:    `linear-gradient(135deg, ${T.accent} 0%, ${T.accentDark} 100%)`,
            boxShadow:     `0 4px 16px ${T.accent}44`,
            mb:            2,
            "&:hover":     { background: `linear-gradient(135deg, ${T.accentDark} 0%, ${T.accent} 100%)`, boxShadow: `0 6px 20px ${T.accent}55` },
            "&.Mui-disabled": { background: T.border, color: T.textSub, boxShadow: "none" },
          }}
        >
          {loading ? <CircularProgress size={20} color="inherit" /> : "💾 Save Today's Attendance"}
        </Button>
      )}

      {/* ── Status message ── */}
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