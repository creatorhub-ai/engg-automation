import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Box,
  Card,
  CardContent,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Stack,
  Alert,
  CircularProgress,
  Divider,
} from "@mui/material";

const API_BASE =
  process.env.REACT_APP_API_URL || "https://engg-automation-f191.onrender.com";

// Dropdown options (exactly as specified for the generator)
const DOMAINS = ["PD", "DV", "DFT"];
const BATCH_TYPES = ["Offline", "Online"];
const SESSION1 = ["7.30AM to 9.00AM", "1.30PM to 3.00PM"];
const SESSION2 = ["9.30AM to 11.00AM", "3.30PM to 5.00PM"];
const SESSION3 = ["11.15AM to 1.15PM", "5.30PM to 7.00PM"];
const LAB_TIMINGS = [
  "11.30AM to 1.30PM, 6.00 AM to 11:00 AM",
  "9.00PM to 7.00AM, 5:30 PM to 8.00 PM",
];

export default function CoursePlannerGenerator({ user }) {
  // "Generate CP for System" (xlsx -> system CSV) is admin-only; it is disabled
  // for Trainer, Manager and Coordinator roles.
  const role = (user?.role || "").toString().toLowerCase();
  const canConvert = role === "admin";

  const [domain, setDomain] = useState("");
  const [batchType, setBatchType] = useState("");
  const [batchNo, setBatchNo] = useState("");
  const [session1, setSession1] = useState("");
  const [session2, setSession2] = useState("");
  const [session3, setSession3] = useState("");
  const [labTimings, setLabTimings] = useState("");
  const [startDate, setStartDate] = useState("");

  const [generating, setGenerating] = useState(false);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null); // { id, filename, template, holidaysMarked }
  const [csv, setCsv] = useState(null); // { csvFilename, rows }

  // Trainer pickers (Theory / Lab). Names come from internal_users; the email
  // auto-fills from the selected name but stays editable. These are applied to
  // trainer_name / trainer_email only in the system CSV ("Generate CP for
  // System"), never in the trainer-facing planner.
  const [trainers, setTrainers] = useState([]); // [{ name, email }]
  const [theoryTrainerName, setTheoryTrainerName] = useState("");
  const [theoryTrainerEmail, setTheoryTrainerEmail] = useState("");
  const [labTrainerName, setLabTrainerName] = useState("");
  const [labTrainerEmail, setLabTrainerEmail] = useState("");

  useEffect(() => {
    axios
      .get(`${API_BASE}/api/course-planner/trainers`)
      .then(({ data }) => setTrainers(Array.isArray(data?.trainers) ? data.trainers : []))
      .catch(() => setTrainers([]));
  }, []);

  const emailForName = (name) =>
    (trainers.find((t) => t.name === name)?.email) || "";

  const handleTheoryName = (name) => {
    setTheoryTrainerName(name);
    setTheoryTrainerEmail(emailForName(name)); // auto-fill; still editable
  };
  const handleLabName = (name) => {
    setLabTrainerName(name);
    setLabTrainerEmail(emailForName(name)); // auto-fill; still editable
  };

  const showSession3 = domain === "PD"; // Session 3 only for the PD domain

  const handleGenerate = async () => {
    setError("");
    setResult(null);
    setCsv(null);
    if (!domain || !batchType || !batchNo) {
      setError("Please select a Domain, a Batch Type and enter a Batch No.");
      return;
    }
    setGenerating(true);
    try {
      const { data } = await axios.post(`${API_BASE}/api/course-planner/generate`, {
        domain,
        batchType,
        batchNo: batchNo.trim(),
        session1,
        session2,
        session3: showSession3 ? session3 : "",
        labTimings,
        startDate, // "" is allowed; dates are only stamped when provided
      });
      setResult(data);
    } catch (e) {
      setError(e.response?.data?.error || e.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const handleConvert = async () => {
    if (!result?.id) return;
    setError("");
    setConverting(true);
    try {
      const { data } = await axios.post(`${API_BASE}/api/course-planner/convert`, {
        id: result.id,
        theoryTrainerName,
        theoryTrainerEmail,
        labTrainerName,
        labTrainerEmail,
      });
      setCsv(data);
    } catch (e) {
      setError(e.response?.data?.error || e.message || "Conversion failed");
    } finally {
      setConverting(false);
    }
  };

  const downloadUrl = (kind) =>
    `${API_BASE}/api/course-planner/download/${result.id}/${kind}`;

  return (
    <Box sx={{ maxWidth: 720, mx: "auto", p: 2 }}>
      <Typography variant="h5" gutterBottom fontWeight={600}>
        Course Planner Generator
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Pick the batch details, generate the course planner from its domain
        template (weekends &amp; company holidays applied), then convert it to the
        system CSV.
      </Typography>

      <Card variant="outlined" sx={{ mt: 2 }}>
        <CardContent>
          <Stack spacing={2}>
            <FormControl fullWidth required>
              <InputLabel>Domain</InputLabel>
              <Select
                label="Domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
              >
                {DOMAINS.map((d) => (
                  <MenuItem key={d} value={d}>
                    {d}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth required>
              <InputLabel>Batch Type</InputLabel>
              <Select
                label="Batch Type"
                value={batchType}
                onChange={(e) => setBatchType(e.target.value)}
              >
                {BATCH_TYPES.map((b) => (
                  <MenuItem key={b} value={b}>
                    {b}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Session 1</InputLabel>
              <Select
                label="Session 1"
                value={session1}
                onChange={(e) => setSession1(e.target.value)}
              >
                {SESSION1.map((s) => (
                  <MenuItem key={s} value={s}>
                    {s}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Session 2</InputLabel>
              <Select
                label="Session 2"
                value={session2}
                onChange={(e) => setSession2(e.target.value)}
              >
                {SESSION2.map((s) => (
                  <MenuItem key={s} value={s}>
                    {s}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {showSession3 && (
              <FormControl fullWidth>
                <InputLabel>Session 3</InputLabel>
                <Select
                  label="Session 3"
                  value={session3}
                  onChange={(e) => setSession3(e.target.value)}
                >
                  {SESSION3.map((s) => (
                    <MenuItem key={s} value={s}>
                      {s}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <TextField
              label="Batch No"
              required
              value={batchNo}
              onChange={(e) => setBatchNo(e.target.value)}
              placeholder="e.g. PDFT19"
              fullWidth
            />

            <FormControl fullWidth>
              <InputLabel>Lab Access Timings</InputLabel>
              <Select
                label="Lab Access Timings"
                value={labTimings}
                onChange={(e) => setLabTimings(e.target.value)}
              >
                {LAB_TIMINGS.map((s) => (
                  <MenuItem key={s} value={s}>
                    {s}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Batch Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              helperText={
                batchType === "Online"
                  ? "Online batches run on weekends: only Saturday (Theory) and Sunday (Lab) dates are stamped."
                  : "Used to place weekday dates, weekends and holidays on the grid."
              }
              fullWidth
            />

            <Divider textAlign="left">
              <Typography variant="caption" color="text.secondary">
                Trainer assignment (applied to the System CP only)
              </Typography>
            </Divider>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <FormControl fullWidth>
                <InputLabel>Theory Trainer Name</InputLabel>
                <Select
                  label="Theory Trainer Name"
                  value={theoryTrainerName}
                  onChange={(e) => handleTheoryName(e.target.value)}
                >
                  {trainers.map((t) => (
                    <MenuItem key={`th-${t.name}`} value={t.name}>
                      {t.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Theory Trainer Email ID"
                value={theoryTrainerEmail}
                onChange={(e) => setTheoryTrainerEmail(e.target.value)}
                placeholder="auto-filled from name (editable)"
                fullWidth
              />
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <FormControl fullWidth>
                <InputLabel>Lab Trainer Name</InputLabel>
                <Select
                  label="Lab Trainer Name"
                  value={labTrainerName}
                  onChange={(e) => handleLabName(e.target.value)}
                >
                  {trainers.map((t) => (
                    <MenuItem key={`lab-${t.name}`} value={t.name}>
                      {t.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Lab Trainer Email ID"
                value={labTrainerEmail}
                onChange={(e) => setLabTrainerEmail(e.target.value)}
                placeholder="auto-filled from name (editable)"
                fullWidth
              />
            </Stack>

            {error && <Alert severity="error">{error}</Alert>}

            <Stack direction="row" spacing={2} flexWrap="wrap">
              <Button
                variant="contained"
                onClick={handleGenerate}
                disabled={generating}
                startIcon={generating ? <CircularProgress size={18} /> : null}
              >
                {generating ? "Generating..." : "Generate Course Planner"}
              </Button>

              <Button
                variant="outlined"
                onClick={handleConvert}
                disabled={!result || converting || !canConvert}
                startIcon={converting ? <CircularProgress size={18} /> : null}
              >
                {converting ? "Converting..." : "Generate CP for System"}
              </Button>
            </Stack>

            {!canConvert && (
              <Typography variant="caption" color="text.secondary">
                “Generate CP for System” is available to Admin users only.
              </Typography>
            )}
          </Stack>
        </CardContent>
      </Card>

      {result && (
        <Card variant="outlined" sx={{ mt: 2 }}>
          <CardContent>
            <Alert severity="success" sx={{ mb: 2 }}>
              Course planner generated from{" "}
              <strong>{result.template || "template"}</strong>
              {result.holidaysMarked ? (
                <> — {result.holidaysMarked} holiday(s) marked.</>
              ) : (
                <>.</>
              )}
            </Alert>
            <Button
              variant="contained"
              color="success"
              href={downloadUrl("xlsx")}
            >
              Download Course Planner (.xlsx)
            </Button>

            {csv && (
              <>
                <Divider sx={{ my: 2 }} />
                <Alert severity="success" sx={{ mb: 2 }}>
                  Converted to system CSV
                  {csv.rows ? <> — {csv.rows} rows.</> : <>.</>}
                </Alert>
                <Button
                  variant="contained"
                  color="secondary"
                  href={downloadUrl("csv")}
                >
                  Download CP for System (.csv)
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

