// AttendanceReport.js
import React, { useEffect, useState } from "react";
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
} from "@mui/material";
import jsPDF from "jspdf";
import "jspdf-autotable";

const API_BASE = process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

export default function AttendanceReport({ user, token }) {
  const [batches, setBatches] = useState([]);
  const [batchNo, setBatchNo] = useState("");
  const [rows, setRows] = useState([]); // {name,email,totalDays,presentDays,leaveDays,absentDays,attendancePercentage}
  const [courseStartDate, setCourseStartDate] = useState("");
  const [courseEndDate, setCourseEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const authHeaders = () => (token ? { Authorization: `Bearer ${token}` } : {});

  // Load distinct batch numbers once
  useEffect(() => {
    async function loadBatches() {
      try {
        const res = await axios.get(`${API_BASE}/api/attendance/distinct_batches`, {
          headers: authHeaders(),
        });
        setBatches(res.data || []);
      } catch (e) {
        console.error("Failed to load batches", e);
        setMsg("Failed to load batches for attendance report");
      }
    }
    loadBatches();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load report when batch changes
  useEffect(() => {
    if (!batchNo) {
      setRows([]);
      setCourseStartDate("");
      setCourseEndDate("");
      return;
    }

    async function loadReport() {
      setLoading(true);
      setMsg("");
      try {
        // Backend should return:
        // {
        //   start_date, end_date,
        //   data: [
        //     {
        //       name,
        //       email,
        //       total_days,
        //       present_days,
        //       leave_days,
        //       absent_days,
        //       attendance_percentage
        //     }, ...
        //   ]
        // }
        const res = await axios.get(`${API_BASE}/api/attendance/report_by_batch`, {
          params: { batch_no: batchNo },
          headers: authHeaders(),
        });

        const { start_date, end_date, data } = res.data || {};
        setCourseStartDate(start_date || "");
        setCourseEndDate(end_date || "");
        setRows(data || []);

        if (!data || data.length === 0) {
          setMsg("No attendance data found for this batch");
        }
      } catch (e) {
        console.error("Failed to load attendance report", e);
        setMsg("Failed to load attendance report");
        setRows([]);
      }
      setLoading(false);
    }

    loadReport();
  }, [batchNo]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDownloadPdf = () => {
    if (!rows || rows.length === 0) return;

    const doc = new jsPDF("landscape");
    const title = `Attendance Report - Batch ${batchNo}`;
    const subtitle = courseStartDate && courseEndDate
      ? `Course: ${courseStartDate} to ${courseEndDate}`
      : "";

    doc.setFontSize(16);
    doc.text(title, 14, 18);
    if (subtitle) {
      doc.setFontSize(11);
      doc.text(subtitle, 14, 26);
    }

    const head = [
      [
        "Sr No",
        "Learner Name",
        "Email",
        "Total Days",
        "Present",
        "Leave",
        "Absent",
        "Attendance %"
      ],
    ];

    const body = rows.map((row, idx) => [
      idx + 1,
      row.name || "",
      row.email || "",
      row.total_days ?? "",
      row.present_days ?? "",
      row.leave_days ?? "",
      row.absent_days ?? "",
      row.attendance_percentage != null
        ? `${row.attendance_percentage.toFixed(2)}`
        : "",
    ]);

    doc.autoTable({
      head,
      body,
      startY: 34,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [25, 118, 210] }, // MUI primary-like
    });

    doc.save(`attendance_report_${batchNo}.pdf`);
  };

  return (
    <Box sx={{ maxWidth: 1700 }}>
      <Paper elevation={3} sx={{ p: 2, borderRadius: 2 }}>
        <Typography variant="h6" color="primary" gutterBottom>
          Attendance Report
        </Typography>

        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 2 }}>
          <FormControl sx={{ minWidth: 220 }}>
            <InputLabel>Select Batch</InputLabel>
            <Select
              label="Select Batch"
              value={batchNo}
              onChange={e => setBatchNo(e.target.value)}
            >
              {batches.map((b, idx) => (
                <MenuItem key={idx} value={b.batch_no || b}>
                  {b.batch_no || b}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box sx={{ flexGrow: 1, display: "flex", alignItems: "center" }}>
            {courseStartDate && courseEndDate && (
              <Typography variant="body2" color="text.secondary">
                Course: {courseStartDate} to {courseEndDate}
              </Typography>
            )}
          </Box>

          <Button
            variant="contained"
            color="primary"
            disabled={!rows.length}
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

        {!loading && msg && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {msg}
          </Alert>
        )}

        {!loading && rows.length > 0 && (
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
              {rows.map((row, idx) => (
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
