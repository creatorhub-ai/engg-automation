import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import {
  Box, Typography, FormControl, InputLabel, Select, MenuItem,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  Button, IconButton,
} from "@mui/material";
import {
  PeopleAlt      as PeopleIcon,
  EventAvailable as SessionIcon,
  Close          as CloseIcon,
  Person         as PersonIcon,
} from "@mui/icons-material";

const API_BASE = process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

/* ─── Design tokens (matches CourseProgress) ────────────────────────────── */
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

const tableHeadSx = {
  fontFamily:    "'DM Sans', sans-serif",
  fontSize:      11,
  fontWeight:    700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color:         TOKENS.textSub,
  background:    TOKENS.surfaceAlt,
  borderBottom:  `2px solid ${TOKENS.border}`,
  py:            1.4,
  whiteSpace:    "nowrap",
};

const tableCellSx = {
  fontFamily:   "'DM Sans', sans-serif",
  fontSize:     13,
  color:        TOKENS.text,
  borderBottom: `1px solid ${TOKENS.border}`,
  py:           1.5,
};

const inputSx = {
  fontFamily: "'DM Sans', sans-serif",
  fontSize: 13,
  borderRadius: "10px",
  "& .MuiOutlinedInput-notchedOutline": { borderColor: TOKENS.border },
  "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: TOKENS.accent },
  "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: TOKENS.accent },
};

/* ─── Attendance percentage badge ────────────────────────────────────────── */
function PctBadge({ pct }) {
  const tok = pct >= 75 ? TOKENS.success : pct >= 50 ? TOKENS.warning : TOKENS.error;
  return (
    <Box sx={{
      display: "inline-flex", px: 1.5, py: 0.4, borderRadius: "20px",
      background: `${tok.fill}18`, border: `1px solid ${tok.fill}44`,
    }}>
      <Typography sx={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 800, color: tok.fill }}>
        {pct.toFixed(1)}%
      </Typography>
    </Box>
  );
}

/* ─── Detail row inside dialog ───────────────────────────────────────────── */
function DetailRow({ label, value, total }) {
  const pct  = total > 0 ? (value / total) * 100 : 0;
  const tok  = pct >= 75 ? TOKENS.success : pct >= 50 ? TOKENS.warning : TOKENS.error;
  return (
    <Box sx={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      px: 2, py: 1.3, borderBottom: `1px solid ${TOKENS.border}`,
      "&:last-child": { borderBottom: "none" },
    }}>
      <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: TOKENS.textSub }}>
        {label}
      </Typography>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <Typography sx={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: TOKENS.text }}>
          {value}
          <span style={{ color: TOKENS.textSub, fontWeight: 400 }}> / {total}</span>
        </Typography>
        {total > 0 && (
          <Box sx={{ px: 1, py: 0.2, borderRadius: "20px", background: `${tok.fill}18`, border: `1px solid ${tok.fill}44` }}>
            <Typography sx={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 700, color: tok.fill }}>
              {pct.toFixed(1)}%
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}

/* ─── Stat pill ──────────────────────────────────────────────────────────── */
function StatPill({ icon, label, value, sub, accent }) {
  return (
    <Box sx={{
      px: 2.5, py: 1.5, borderRadius: "12px",
      background: accent ? TOKENS.accentLight : TOKENS.surfaceAlt,
      border: `1px solid ${accent ? TOKENS.accent + "44" : TOKENS.border}`,
      display: "flex", alignItems: "center", gap: 1.2,
    }}>
      <Box sx={{ color: accent ? TOKENS.accent : TOKENS.textSub, display: "flex" }}>{icon}</Box>
      <Box>
        <Typography sx={{ ...labelSx, fontSize: 9, color: accent ? TOKENS.accent : TOKENS.textSub }}>
          {label}
        </Typography>
        <Typography sx={{ fontFamily: "'DM Mono', monospace", fontSize: 16, fontWeight: 800, color: accent ? TOKENS.accent : TOKENS.text, lineHeight: 1 }}>
          {value}
          {sub && <span style={{ fontSize: 12, fontWeight: 400, color: TOKENS.textSub }}>{sub}</span>}
        </Typography>
      </Box>
    </Box>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  Main component
 * ═══════════════════════════════════════════════════════════════════════════ */
export default function AttendanceReport({ user, token }) {
  const [batches,            setBatches]            = useState([]);
  const [batchNo,            setBatchNo]            = useState("");
  const [attendanceData,     setAttendanceData]     = useState([]);
  const [learnersData,       setLearnersData]       = useState([]);
  const [plannerDates,       setPlannerDates]       = useState([]);
  const [totalBatchSessions, setTotalBatchSessions] = useState(0);
  const [sessionsTillToday,  setSessionsTillToday]  = useState(0);
  const [loading,            setLoading]            = useState(false);
  const [selectedLearner,    setSelectedLearner]    = useState(null);
  const [detailDialogOpen,   setDetailDialogOpen]   = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  /* ── Load batches ── */
  useEffect(() => {
    const fetchBatches = async () => {
      const { data } = await axios.get(`${API_BASE}/api/batches`, { headers });
      const batchList = Array.isArray(data)
        ? data.map(b => String(b.batch_no || b)).filter(Boolean)
        : [];
      const unique = [...new Set(batchList)].sort();
      setBatches(unique);
      if (unique.length > 0) setBatchNo(unique[0]);
    };
    fetchBatches();
  }, [token]);

  /* ── Load attendance + learners ── */
  useEffect(() => {
    if (!batchNo) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const attendanceRes = await axios.get(
          `${API_BASE}/api/learner-attendance`,
          { params: { batch_no: batchNo }, headers }
        );
        const { attendance, total_batch_sessions, sessions_till_today, planner_dates } = attendanceRes.data;
        setAttendanceData(attendance || []);
        setTotalBatchSessions(total_batch_sessions || 0);
        setSessionsTillToday(sessions_till_today || 0);
        setPlannerDates((planner_dates || []).map(d => typeof d === "string" ? d : d.date));
        const learnersRes = await axios.get(`${API_BASE}/api/learners`, { params: { batch_no: batchNo }, headers });
        setLearnersData(learnersRes.data || []);
      } catch (err) {
        console.error(err);
        setAttendanceData([]); setLearnersData([]); setPlannerDates([]);
        setTotalBatchSessions(0); setSessionsTillToday(0);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [batchNo, token]);

  /* ── Summary ── */
  const summary = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const stats = {};
    attendanceData.forEach(row => {
      if (!row.learner_email || row.date > today) return;
      const email = row.learner_email.trim().toLowerCase();
      if (!stats[email]) stats[email] = { name: "", email: row.learner_email, present: 0 };
      if (row.status?.toUpperCase() === "P" || row.status?.toUpperCase() === "PRESENT") {
        stats[email].present++;
      }
    });
    Object.keys(stats).forEach(k => {
      const l = learnersData.find(l => l.email?.trim().toLowerCase() === k);
      stats[k].name = l?.name || k.split("@")[0];
    });
    return { learners: Object.values(stats) };
  }, [attendanceData, learnersData]);

  /* ── Per-learner detail ── */
  const calculateLearnerDetails = (learnerEmail) => {
    const today = new Date().toISOString().split("T")[0];
    const email = learnerEmail.trim().toLowerCase();
    const distinctDates      = [...new Set(plannerDates)];
    const totalBatchDays     = distinctDates.length;
    const totalDaysTillToday = distinctDates.filter(d => d <= today).length;
    const learnerRows        = attendanceData.filter(r =>
      r.learner_email?.trim().toLowerCase() === email && r.date <= today
    );
    const presentDays = new Set(
      learnerRows
        .filter(r => r.status?.toUpperCase() === "P" || r.status?.toUpperCase() === "PRESENT")
        .map(r => r.date)
    ).size;
    return {
      totalBatchSessions, sessionsTillToday,
      sessionsPresent: summary.learners.find(l => l.email === learnerEmail)?.present || 0,
      totalBatchDays, totalDaysTillToday, presentDays,
    };
  };

  /* ════════════════════════════════════════════════════════════════════════ */
  return (
    <Box sx={{ minHeight: "100vh", background: TOKENS.bg, p: { xs: 2, md: 4 }, fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');`}</style>
      <Box sx={{ maxWidth: 1400, mx: "auto" }}>

        {/* ── Page header ── */}
        <Box sx={{ mb: 4 }}>
          <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: { xs: 24, md: 30 }, fontWeight: 800, color: TOKENS.text, letterSpacing: "-0.03em", mb: 0.5 }}>
            Attendance Report
          </Typography>
          <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: TOKENS.textSub }}>
            Click any learner row to view a detailed attendance breakdown
          </Typography>
        </Box>

        {/* ── Filter + stat pills row ── */}
        <Box sx={{ ...cardSx, p: 3, mb: 3 }}>
          <Box sx={{ display: "flex", alignItems: "flex-end", gap: 3, flexWrap: "wrap" }}>
            <Box>
              <Typography sx={{ ...labelSx, mb: 1 }}>Batch</Typography>
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>Select Batch</InputLabel>
                <Select value={batchNo} label="Select Batch" onChange={e => setBatchNo(e.target.value)} sx={inputSx}>
                  {batches.map(b => (
                    <MenuItem key={b} value={b} sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>{b}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {batchNo && !loading && (
              <>
                <StatPill
                  icon={<SessionIcon sx={{ fontSize: 16 }} />}
                  label="Sessions Conducted"
                  value={sessionsTillToday}
                  sub={` / ${totalBatchSessions}`}
                  accent
                />
                <StatPill
                  icon={<PeopleIcon sx={{ fontSize: 16 }} />}
                  label="Learners"
                  value={summary.learners.length}
                />
              </>
            )}
          </Box>
        </Box>

        {/* ── Loading state ── */}
        {loading && (
          <Box sx={{ ...cardSx, py: 8, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <CircularProgress size={32} sx={{ color: TOKENS.accent }} />
            <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: TOKENS.textSub }}>
              Loading attendance data…
            </Typography>
          </Box>
        )}

        {/* ── Learner table ── */}
        {!loading && batchNo && (
          <Box sx={cardSx}>
            <Box sx={{
              px: 3, py: 2.5,
              background: `linear-gradient(135deg, ${TOKENS.accent}0d 0%, ${TOKENS.accentLight} 100%)`,
              borderBottom: `1px solid ${TOKENS.border}`,
              display: "flex", alignItems: "center", gap: 1.5,
            }}>
              <PeopleIcon sx={{ fontSize: 20, color: TOKENS.accent }} />
              <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 800, color: TOKENS.text }}>
                Learner Attendance — {batchNo}
              </Typography>
              {summary.learners.length > 0 && (
                <Box sx={{ ml: "auto", px: 1.5, py: 0.4, borderRadius: "20px", background: TOKENS.accentLight, border: `1px solid ${TOKENS.accent}33` }}>
                  <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, color: TOKENS.accent }}>
                    {summary.learners.length} learners
                  </Typography>
                </Box>
              )}
            </Box>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ ...tableHeadSx, width: 56 }}>#</TableCell>
                    <TableCell sx={tableHeadSx}>Learner</TableCell>
                    <TableCell sx={tableHeadSx}>Email</TableCell>
                    <TableCell align="center" sx={tableHeadSx}>Present / {sessionsTillToday}</TableCell>
                    <TableCell align="center" sx={tableHeadSx}>Attendance %</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {summary.learners.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 7 }}>
                        <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: TOKENS.textSub }}>
                          No attendance records found for this batch.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    summary.learners.map((learner, idx) => {
                      const pct = sessionsTillToday > 0
                        ? (learner.present / sessionsTillToday) * 100
                        : 0;
                      return (
                        <TableRow
                          key={learner.email}
                          onClick={() => { setSelectedLearner(learner); setDetailDialogOpen(true); }}
                          sx={{
                            cursor: "pointer",
                            "&:nth-of-type(even)": { background: TOKENS.surfaceAlt },
                            "&:hover": { background: `${TOKENS.accent}08` },
                            transition: "background 0.15s",
                          }}
                        >
                          <TableCell sx={{ ...tableCellSx, fontFamily: "'DM Mono', monospace", fontSize: 12, color: TOKENS.textSub }}>
                            {idx + 1}
                          </TableCell>
                          <TableCell sx={{ ...tableCellSx, fontWeight: 700 }}>{learner.name}</TableCell>
                          <TableCell sx={{ ...tableCellSx, fontSize: 12, color: TOKENS.textSub }}>{learner.email}</TableCell>
                          <TableCell align="center" sx={tableCellSx}>
                            <Typography sx={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: TOKENS.text }}>
                              {learner.present}
                              <span style={{ color: TOKENS.textSub, fontWeight: 400 }}> / {sessionsTillToday}</span>
                            </Typography>
                          </TableCell>
                          <TableCell align="center" sx={tableCellSx}>
                            <PctBadge pct={pct} />
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {!batchNo && !loading && (
          <Box sx={{ ...cardSx, py: 10, textAlign: "center" }}>
            <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600, color: TOKENS.textSub }}>
              Select a batch to view attendance
            </Typography>
          </Box>
        )}
      </Box>

      {/* ── Detail Dialog ── */}
      <Dialog
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: "16px", overflow: "hidden" } }}
      >
        <DialogTitle sx={{ p: 0 }}>
          <Box sx={{
            px: 3, py: 2.5,
            background: `linear-gradient(135deg, ${TOKENS.accent}0d 0%, ${TOKENS.accentLight} 100%)`,
            borderBottom: `1px solid ${TOKENS.border}`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <PersonIcon sx={{ fontSize: 20, color: TOKENS.accent }} />
              <Box>
                <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 800, color: TOKENS.text }}>
                  {selectedLearner?.name}
                </Typography>
                <Typography sx={{ ...labelSx, fontSize: 10, mt: 0.1 }}>Attendance Breakdown</Typography>
              </Box>
            </Box>
            <IconButton size="small" onClick={() => setDetailDialogOpen(false)} sx={{ color: TOKENS.textSub }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 3 }}>
          {selectedLearner && (() => {
            const d = calculateLearnerDetails(selectedLearner.email);
            return (
              <Box>
                <Typography sx={{ ...labelSx, mb: 1.5 }}>Sessions</Typography>
                <Box sx={{ mb: 3, border: `1px solid ${TOKENS.border}`, borderRadius: "10px", overflow: "hidden" }}>
                  <DetailRow label="Total Batch Sessions" value={d.sessionsPresent} total={d.totalBatchSessions} />
                  <DetailRow label="Sessions Till Today"  value={d.sessionsPresent} total={d.sessionsTillToday}  />
                  <DetailRow label="Sessions Present"     value={d.sessionsPresent} total={d.sessionsTillToday}  />
                </Box>

                <Typography sx={{ ...labelSx, mb: 1.5 }}>Days</Typography>
                <Box sx={{ border: `1px solid ${TOKENS.border}`, borderRadius: "10px", overflow: "hidden" }}>
                  <DetailRow label="Total Batch Days"  value={d.presentDays} total={d.totalBatchDays}     />
                  <DetailRow label="Days Till Today"   value={d.presentDays} total={d.totalDaysTillToday} />
                  <DetailRow label="Days Present"      value={d.presentDays} total={d.totalDaysTillToday} />
                </Box>
              </Box>
            );
          })()}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, borderTop: `1px solid ${TOKENS.border}` }}>
          <Button
            onClick={() => setDetailDialogOpen(false)}
            sx={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 13, textTransform: "none", borderRadius: "10px", color: TOKENS.textSub }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}