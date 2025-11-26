import React, { useState, useEffect, useMemo } from "react";
import {
  Paper,
  Typography,
  Button,
  TextField,
  Alert,
  Fade,
  Box,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  Divider,
  InputAdornment,
} from "@mui/material";

const colorPalette = [
  "#edc7cf", "#bdd9bf", "#c7ceea", "#ffeebb", "#a4c2f4",
  "#a1eafb", "#e6c7e3", "#f7cac9", "#ffe066", "#f8b195",
  "#80ced6", "#d5f4e6", "#f0a6ca", "#b5ead7", "#ead3d7",
  "#ffe0ac", "#b3cdd1", "#eec9e6"
];

function getBatchColorMap(allMatrixTable) {
  const batchSet = new Set();
  allMatrixTable.forEach(row =>
    row.forEach(cell => {
      if (Array.isArray(cell)) cell.forEach(bn => batchSet.add(bn));
    })
  );
  const paletteLength = colorPalette.length;
  const batchArr = Array.from(batchSet).filter(Boolean).sort();
  const batchColorMap = {};
  batchArr.forEach((bn, idx) => {
    batchColorMap[bn] = colorPalette[idx % paletteLength];
  });
  return batchColorMap;
}

function getWeeksInRange(start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const weeks = [];
  let cur = new Date(startDate);
  cur.setDate(cur.getDate() - cur.getDay());
  while (cur <= endDate) {
    const y = cur.getFullYear();
    const m = cur.getMonth();
    const weekNum = Math.ceil((cur.getDate() + 1 - new Date(y, m, 1).getDay()) / 7);
    weeks.push({
      year: y,
      month: cur.toLocaleString('default', { month: 'long' }),
      monthNum: m,
      weekNum,
      weekStart: new Date(cur),
      key: `${y}-${m + 1}-W${weekNum}`,
    });
    cur.setDate(cur.getDate() + 7);
  }
  return weeks;
}

function isDateOverlap(start1, end1, start2, end2) {
  return !(
    new Date(end1) < new Date(start2) ||
    new Date(start1) > new Date(end2)
  );
}

function extractDomainFromBatchNo(batchNo) {
  if (!batchNo) return "";
  if (/^PDFT/i.test(batchNo)) return "PD";
  if (/^DVFT/i.test(batchNo)) return "DV";
  if (/^DFT/i.test(batchNo)) return "DFT";
  return ""; // fallback or add patterns as needed
}

export default function ClassroomScheduler() {
  const [form, setForm] = useState({
    batch_no: "",
    domain: "",
    students: "",
    start_date: "",
    end_date: "",
    required_tools: "",
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [matrixData, setMatrixData] = useState([]);
  const [downloadType, setDownloadType] = useState("");

  // Auto-fill domain from batch_no
  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "batch_no") {
      if (!value) {
        setForm((prev) => ({
          ...prev,
          batch_no: "",
          domain: "",
        }));
        return;
      }
      const inferredDomain = extractDomainFromBatchNo(value);
      setForm((prev) => ({
        ...prev,
        batch_no: value,
        domain: (prev.domain && prev.domain !== "" && prev.batch_no && value.startsWith(prev.batch_no))
          ? prev.domain
          : inferredDomain,
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const fetchMatrixData = async () => {
    const res = await fetch("/api/classroom-matrix");
    if (res.ok) {
      const data = await res.json();
      setMatrixData(data);
    }
  };

  useEffect(() => {
    fetchMatrixData();
  }, []);

  let allDates = [];
  matrixData.forEach((row) => {
    allDates.push(row.occupancy_start, row.occupancy_end);
  });
  if (form.start_date && form.end_date) {
    allDates.push(form.start_date, form.end_date);
  }

  const matrixStart = form.start_date || (allDates.length ? allDates.reduce((a, b) => (a < b ? a : b)) : "");
  const matrixEnd = form.end_date || (allDates.length ? allDates.reduce((a, b) => (a > b ? a : b)) : "");
  const weeks = (matrixStart && matrixEnd) ? getWeeksInRange(matrixStart, matrixEnd) : [];

  const existingBatchNos = useMemo(() => {
    return new Set(matrixData.map(row => row.batch_no && row.batch_no.trim()).filter(Boolean));
  }, [matrixData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    const { batch_no, domain, students, start_date, end_date, required_tools } = form;
    if (!batch_no || !domain || !students || !start_date || !end_date) {
      setError("Please fill all required fields");
      return;
    }
    if (existingBatchNos.has(batch_no.trim())) {
      setError(`Batch No "${batch_no}" already exists. Please use a unique batch number.`);
      return;
    }
    const res = await fetch("/api/suggestClassroom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        batch_no,
        domain,
        students: Number(students),
        start_date,
        end_date,
        required_tools: required_tools
          ? required_tools.split(",").map((t) => t.trim())
          : undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error || "Failed to schedule batch");
    else {
      setResult(data);
      fetchMatrixData();
    }
  };

  const classrooms = [...new Set(matrixData.map((d) => d.classroom_name))];
  const slots = ["morning", "evening"];
  const table = [];
  classrooms.forEach((room) => {
    slots.forEach((slot) => {
      const row = [room, slot];
      weeks.forEach((week) => {
        const weekStart = week.weekStart;
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const batches = matrixData
          .filter(
            (o) =>
              o.classroom_name === room &&
              o.slot === slot &&
              isDateOverlap(
                o.occupancy_start,
                o.occupancy_end,
                weekStart.toISOString().slice(0, 10),
                weekEnd.toISOString().slice(0, 10)
              )
          )
          .map((c) => c.batch_no)
          .filter(Boolean);
        row.push(batches);
      });
      table.push(row);
    });
  });

  // Compute unique color for each batch in table (and use this for download export as well)
  const batchColorMap = useMemo(() => getBatchColorMap(table), [table]);

  const handleDownload = async () => {
    if (!["xlsx", "pdf"].includes(downloadType)) {
      alert("Please select file type");
      return;
    }
    const exportPayload = {
      fileType: downloadType,
      batchDetails: form,
      licensesData: result?.licenses ?? [],
      matrixTable: table,
      weeks,
      batchColorMap
    };
    const res = await fetch("/api/download-schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(exportPayload),
    });
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = downloadType === "xlsx"
      ? "schedule_export.xlsx"
      : "schedule_export.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <Box sx={{ maxWidth: "98vw", mx: "auto", my: 4 }}>
      <Paper elevation={5} sx={{ p: 4, borderRadius: 3, mb: 4 }}>
        <Typography variant="h4" color="primary" gutterBottom>
          Classroom Scheduler
        </Typography>
        <Divider sx={{ mb: 3 }} />
        <form onSubmit={handleSubmit} autoComplete="off">
          <TextField
            label="Batch No"
            name="batch_no"
            value={form.batch_no}
            onChange={handleChange}
            variant="outlined"
            fullWidth
            required
            sx={{ mb: 2 }}
          />
          <TextField
            label="Domain"
            name="domain"
            value={form.domain}
            onChange={handleChange}
            variant="outlined"
            fullWidth
            required
            sx={{ mb: 2 }}
            InputProps={{ style: { background: "#fbfaf7" } }} // visually shows editable
          />
          <TextField
            label="Number of Learners"
            name="students"
            value={form.students}
            type="number"
            inputProps={{ min: 1 }}
            onChange={handleChange}
            variant="outlined"
            required
            fullWidth
            sx={{ mb: 2 }}
            InputProps={{
              endAdornment: <InputAdornment position="end">learners</InputAdornment>,
            }}
          />
          <TextField
            label="Start Date"
            name="start_date"
            type="date"
            value={form.start_date}
            onChange={handleChange}
            InputLabelProps={{ shrink: true }}
            variant="outlined"
            required
            fullWidth
            sx={{ mb: 2 }}
          />
          <TextField
            label="End Date"
            name="end_date"
            type="date"
            value={form.end_date}
            onChange={handleChange}
            InputLabelProps={{ shrink: true }}
            variant="outlined"
            required
            fullWidth
            sx={{ mb: 2 }}
          />
          <TextField
            label="Required Tools (optional)"
            name="required_tools"
            type="text"
            value={form.required_tools}
            onChange={handleChange}
            variant="outlined"
            fullWidth
            sx={{ mb: 3 }}
            placeholder="e.g., projector"
          />
          <Button
            variant="contained"
            color="primary"
            type="submit"
            sx={{ fontWeight: "bold", py: 1.5, fontSize: "1rem", boxShadow: 2 }}
            size="large"
            fullWidth
          >
            Suggest Classroom
          </Button>
        </form>

        <Box sx={{ display: "flex", alignItems: "center", gap: 2, my: 2 }}>
          <Typography variant="subtitle1">Download as: </Typography>
          <Button
            variant={downloadType === "xlsx" ? "contained" : "outlined"}
            onClick={() => setDownloadType("xlsx")}
          >
            XLSX
          </Button>
          <Button
            variant={downloadType === "pdf" ? "contained" : "outlined"}
            onClick={() => setDownloadType("pdf")}
          >
            PDF
          </Button>
          <Button variant="contained" color="success" onClick={handleDownload}>
            Download
          </Button>
        </Box>

        <Fade in={!!error}>
          <Box>{error && <Alert severity="error" sx={{ mt: 3 }}>{error}</Alert>}</Box>
        </Fade>
        <Fade in={!!result}>
          <Box>
            {result && (
              <Alert severity="success" sx={{ mt: 3, mb: 3 }}>
                <b>Batch scheduled successfully</b>
                <br />
                Classroom: <b>{result.classroom}</b>
                <br />
                Slot: <b>{result.slot || result.preferred_slot}</b>
              </Alert>
            )}
            {result?.licenses && (
              <Box sx={{ my: 2 }}>
                <Typography
                  variant="subtitle1"
                  fontWeight="bold"
                  sx={{ mb: 1 }}
                >
                  License Information:
                </Typography>
                <TableContainer component={Paper} sx={{ maxWidth: 450 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>License Name</TableCell>
                        <TableCell>Count</TableCell>
                        <TableCell>Additional Needed</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {result.licenses.map(
                        ({ license_name, count, additional_needed }) => (
                          <TableRow key={license_name}>
                            <TableCell>{license_name}</TableCell>
                            <TableCell>{count}</TableCell>
                            <TableCell
                              sx={{
                                color: additional_needed > 0 ? "red" : "black",
                              }}
                            >
                              {additional_needed}
                            </TableCell>
                          </TableRow>
                        )
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </Box>
        </Fade>
      </Paper>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 3, minHeight: 320 }}>
        <Typography variant="h5" fontWeight="bold" mb={2}>
          Classroom Occupancy Matrix
        </Typography>
        <TableContainer>
          <Table size="small" sx={{ minWidth: 700 }}>
            <TableHead>
              <TableRow>
                <TableCell>Classroom</TableCell>
                <TableCell>Slot</TableCell>
                {weeks.map((w, idx) => (
                  <TableCell key={idx} align="center">
                    {w.month} W{w.weekNum}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {table.map((row, idx) => (
                <TableRow key={idx}>
                  {row.map((cell, jdx) =>
                    jdx < 2 ? (
                      <TableCell
                        key={jdx}
                        sx={{
                          whiteSpace: "pre-wrap",
                          minWidth: 60,
                          fontWeight: "bold"
                        }}
                        align="left"
                      >
                        {cell}
                      </TableCell>
                    ) : (
                      <TableCell
                        key={jdx}
                        sx={{ minWidth: 60, p: 0, textAlign: "center" }}
                      >
                        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                          {Array.isArray(cell)
                            ? cell.filter(Boolean).map((batch, bid) => (
                                <Box
                                  key={bid}
                                  sx={{
                                    backgroundColor: batchColorMap[batch] || "#e0e0e0",
                                    color: "#222",
                                    px: 1,
                                    py: 0.5,
                                    borderRadius: 1,
                                    m: 0.1,
                                    fontWeight: 600,
                                    minWidth: 32,
                                  }}
                                >
                                  {batch}
                                </Box>
                              ))
                            : null}
                        </Box>
                      </TableCell>
                    )
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
