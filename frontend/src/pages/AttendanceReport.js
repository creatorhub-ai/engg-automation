// AttendanceReport.js
import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import {
  Box,
  Paper,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  CircularProgress,
  Alert,
  Grid,
  Card,
  CardContent,
} from "@mui/material";
import jsPDF from "jspdf";
import "jspdf-autotable";

const API_BASE =
  process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

export default function AttendanceReport({ user, token }) {
  const [batches, setBatches] = useState([]); // array of batch_no strings
  const [batchNo, setBatchNo] = useState("");
  const [rawAttendance, setRawAttendance] = useState([]); // rows from learner_attendance
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const authHeaders = () => (token ? { Authorization: `Bearer ${token}` } : {});

  // Load distinct batch numbers once from /api/batches
  useEffect(() => {
    async function loadBatches() {
      try {
        const res = await axios.get(`${API_BASE}/api/batches`, {
          headers: authHeaders(),
        });
        const data = res.data || [];

        let normalized = [];
        if (Array.isArray(data)) {
          normalized = data
            .map((item) => {
              if (!item) return null;
              if (typeof item === "string") return item.trim();
              if (typeof item === "object") {
                const v =
                  item.batch_no || item.batchNo || item.batch || "";
                return String(v).trim();
              }
              return null;
            })
            .filter((v) => v);
        }

        normalized = Array.from(new Set(normalized)).sort();
        setBatches(normalized);

        if (normalized.length && !batchNo) {
          setBatchNo(normalized[0]);
        }
      } catch (e) {
        console.error("Failed to load batches", e);
        setMsg("Failed to load batches for attendance report");
        setBatches([]);
      }
    }
    loadBatches();
  }, [token]);

  // Load raw learner_attendance rows when batch changes
  useEffect(() => {
    if (!batchNo) {
      setRawAttendance([]);
      return;
    }

    async function loadAttendance() {
      setLoading(true);
      setMsg("");
      try {
        // CALL THE EXISTING BACKEND ENDPOINT
        const res = await axios.get(
          `${API_BASE}/api/attendance/by_batch`,
          {
            params: { batch_no: String(batchNo).trim() },   // backend reads batch_no or batchno
            headers: authHeaders(),
          }
        );

        const data = Array.isArray(res.data) ? res.data : [];
        setRawAttendance(data);

        if (!data.length) {
          setMsg("No attendance data found for this batch");
        }
      } catch (e) {
        console.error("Failed to load attendance for batch", e);
        if (e?.response?.status === 404) {
          setMsg("No attendance data found for this batch");
        } else {
          setMsg("Failed to load attendance for the selected batch");
        }
        setRawAttendance([]);
      }
      setLoading(false);
    }

    loadAttendance();
  }, [batchNo, token]);

  // Aggregate per learner: total_days, present, leave, absent, percentage
  const aggregatedRows = useMemo(() => {
    if (!rawAttendance.length) return [];

    const map = new Map(); // key: learner_email

    rawAttendance.forEach((row) => {
      const email = row.learner_email || row.email || "";
      if (!email) return;

      const name = row.learner_name || row.name || row.learner || "";
      const key = email;

      if (!map.has(key)) {
        map.set(key, {
          name,
          email,
          total_days: 0,
          present_days: 0,
          leave_days: 0,
          absent_days: 0,
        });
      }

      const agg = map.get(key);
      agg.total_days += 1;

      const status = (row.status || "").toLowerCase();
      if (status === "present" || status === "p") agg.present_days += 1;
      else if (
        status === "leave" ||
        status === "onleave" ||
        status === "on_leave" ||
        status === "l"
      )
        agg.leave_days += 1;
      else if (status === "absent" || status === "a")
        agg.absent_days += 1;
    });

    const result = Array.from(map.values()).map((r) => {
      const pct =
        r.total_days > 0 ? (r.present_days / r.total_days) * 100 : 0;
      return { ...r, attendance_percentage: pct };
    });

    result.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    return result;
  }, [rawAttendance]);

  // Batch‑level summary stats
  const batchStats = useMemo(() => {
    if (!aggregatedRows.length) {
      return {
        batchPercentage: 0,
        totalLearners: 0,
        totalSessions: 0,
      };
    }

    const totalLearners = aggregatedRows.length;
    const totalSessions = aggregatedRows.reduce(
      (sum, r) => sum + (r.total_days || 0),
      0
    );
    const avgPct =
      aggregatedRows.reduce(
        (sum, r) => sum + (r.attendance_percentage || 0),
        0
      ) / totalLearners;

    return {
      batchPercentage: avgPct,
      totalLearners,
      totalSessions,
    };
  }, [aggregatedRows]);

  const handleDownloadPdf = () => {
    if (!aggregatedRows || !aggregatedRows.length) return;

    const doc = new jsPDF("landscape");
    const title = `Attendance Report - Batch ${batchNo}`;

    doc.setFontSize(16);
    doc.text(title, 14, 18);

    const head = [
      [
        "Sr No",
        "Learner Name",
        "Email",
        "Total Days",
        "Present",
        "Leave",
        "Absent",
        "Attendance %",
      ],
    ];

    const body = aggregatedRows.map((row, idx) => [
      idx + 1,
      row.name || "",
      row.email || "",
      row.total_days ?? "",
      row.present_days ?? "",
      row.leave_days ?? "",
      row.absent_days ?? "",
      row.attendance_percentage != null
        ? row.attendance_percentage.toFixed(2)
        : "",
    ]);

    doc.autoTable({
      head,
      body,
      startY: 28,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [25, 118, 210] },
    });

    doc.save(`attendance_report_${batchNo}.pdf`);
  };

  return (
    <Box sx={{ maxWidth: 1700 }}>
      <Paper elevation={3} sx={{ p: 2, borderRadius: 2 }}>
        <Typography variant="h6" color="primary" gutterBottom>
          Attendance Report
        </Typography>

        {/* Batch selector + actions */}
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 3 }}>
          <FormControl sx={{ minWidth: 220 }}>
            <InputLabel>Select Batch</InputLabel>
            <Select
              label="Select Batch"
              value={batchNo}
              onChange={(e) => setBatchNo(e.target.value)}
            >
              {batches.map((b) => (
                <MenuItem key={b} value={b}>
                  {b}
                </MenuItem>
              ))}
              {batches.length === 0 && (
                <MenuItem disabled value="">
                  No batches found
                </MenuItem>
              )}
            </Select>
          </FormControl>

          <Box sx={{ flexGrow: 1 }} />

          <Button
            variant="contained"
            color="primary"
            disabled={!aggregatedRows.length}
            onClick={handleDownloadPdf}
          >
            Download PDF
          </Button>
        </Box>

        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
            <CircularProgress />
          </Box>
        )}

        {!loading && msg && !aggregatedRows.length && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {msg}
          </Alert>
        )}

        {/* Summary cards */}
        {!loading && aggregatedRows.length > 0 && (
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={4}>
              <Card elevation={2}>
                <CardContent>
                  <Typography
                    variant="subtitle2"
                    color="text.secondary"
                    gutterBottom
                  >
                    Batch Attendance %
                  </Typography>
                  <Typography variant="h5" color="primary">
                    {batchStats.batchPercentage.toFixed(2)}%
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card elevation={2}>
                <CardContent>
                  <Typography
                    variant="subtitle2"
                    color="text.secondary"
                    gutterBottom
                  >
                    Total Learners
                  </Typography>
                  <Typography variant="h5">
                    {batchStats.totalLearners}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card elevation={2}>
                <CardContent>
                  <Typography
                    variant="subtitle2"
                    color="text.secondary"
                    gutterBottom
                  >
                    Total Sessions (rows in learner_attendance)
                  </Typography>
                  <Typography variant="h5">
                    {batchStats.totalSessions}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Per‑learner table */}
        {!loading && aggregatedRows.length > 0 && (
          <Table size="small" sx={{ overflowX: "auto", display: "block" }}>
            <TableHead>
              <TableRow>
                <TableCell>Sr No</TableCell>
                <TableCell>Learner Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell align="right">Total Days</TableCell>
                <TableCell align="right">Present</TableCell>
                <TableCell align="right">Leave</TableCell>
                <TableCell align="right">Absent</TableCell>
                <TableCell align="right">Attendance %</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {aggregatedRows.map((row, idx) => (
                <TableRow key={row.email || idx}>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell sx={{ maxWidth: 260, wordBreak: "break-all" }}>
                    {row.email}
                  </TableCell>
                  <TableCell align="right">{row.total_days}</TableCell>
                  <TableCell align="right">{row.present_days}</TableCell>
                  <TableCell align="right">{row.leave_days}</TableCell>
                  <TableCell align="right">{row.absent_days}</TableCell>
                  <TableCell align="right">
                    {row.attendance_percentage != null
                      ? row.attendance_percentage.toFixed(2)
                      : "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>
    </Box>
  );
}
