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
  Fade,
} from "@mui/material";

const ASSESSMENT_TYPES = [
  { key: 'weekly-assessment', label: 'Weekly Assessment Score', topic: 'Weekly Assessment' },
  { key: 'intermediate-assessment', label: 'Intermediate Assessment Score', topic: 'Intermediate Assessment' },
  { key: 'module-level-assessment', label: 'Module Level Assessment', topic: 'Module Level Assessment' },
  { key: 'weekly-quiz', label: 'Weekly Quiz', topic: 'Weekly Quiz' }
];

function MarkSheet() {
  const [batchNo, setBatchNo] = useState('');
  const [assessmentType, setAssessmentType] = useState(ASSESSMENT_TYPES[0].key);
  const [learners, setLearners] = useState([]);
  const [marks, setMarks] = useState({});
  const [outOff, setOutOff] = useState('');
  const [periods, setPeriods] = useState([]);
  const [periodValue, setPeriodValue] = useState('');
  const [selectedWeekNo, setSelectedWeekNo] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [message, setMessage] = useState("");

  const numberField = "week_no";
  const numberLabel = "Week No";

  useEffect(() => {
    if (batchNo) {
      fetch(`/apigetlearners?batchno=${batchNo}`)
        .then(res => res.json())
        .then(data => {
          const learnersClean = data.filter(l => l.id).map(l => ({ ...l, id: l.id }));
          setLearners(learnersClean);
        })
        .catch(() => setLearners([]));
    } else {
      setLearners([]);
    }
  }, [batchNo]);

  useEffect(() => {
    if (batchNo) {
      fetch(`/apiperiods/${batchNo}/${assessmentType}`)
        .then(res => res.json())
        .then(data => setPeriods(Array.isArray(data) ? data : []))
        .catch(() => setPeriods([]));
      setPeriodValue('');
      setSelectedWeekNo('');
      setSelectedDate('');
      setSelectedTopic('');
    } else {
      setPeriods([]);
    }
  }, [assessmentType, batchNo]);

  const handlePeriodSelect = (e) => {
    setPeriodValue(e.target.value);
    const [w, d, t] = e.target.value.split('::');
    setSelectedWeekNo(w);
    setSelectedDate(d);
    setSelectedTopic(t);
  };

  const handleMarksInput = (learnerId, value) => {
    let val = value.replace(/[^0-9.]/g, '');
    let percentage = '';
    if (outOff && val !== '') {
      percentage = Math.round((parseFloat(val) / parseFloat(outOff)) * 100);
    }
    setMarks(prev => ({
      ...prev,
      [learnerId]: {
        ...prev[learnerId],
        points: val,
        percentage: percentage !== '' ? percentage : ''
      }
    }));
  };

  const handleSave = async () => {
    let endpoint = `/api/marks/${assessmentType}`;
    let anySaved = false;
    for (let learner of learners) {
      if (!marks[learner.id] || !marks[learner.id].points) continue;
      let baseData = {
        learner_id: learner.id,
        batch_no: batchNo,
        week_no: selectedWeekNo,
        assessment_date: selectedDate,
        out_off: outOff
      };
      const payload = { ...baseData, ...marks[learner.id] };
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      anySaved = true;
    }
    if (anySaved) {
      setMessage("✅ Marks saved successfully!");
    } else {
      setMessage("⚠️ Please enter points for at least one learner.");
    }
    setTimeout(() => setMessage(""), 3000);
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", my: 3 }}>
      <Paper elevation={6} sx={{ p: 4, borderRadius: 3 }}>
        <Typography variant="h4" color="primary" gutterBottom>
          Marks Entry Dashboard
        </Typography>

        <Box sx={{ display: "flex", gap: 3, mb: 2, flexWrap: "wrap" }}>
          <FormControl sx={{ minWidth: 180 }}>
            <TextField
              label="Batch No"
              value={batchNo}
              onChange={e => setBatchNo(e.target.value)}
              size="small"
            />
          </FormControl>
          <FormControl sx={{ minWidth: 260 }}>
            <InputLabel>Assessment Type</InputLabel>
            <Select
              label="Assessment Type"
              value={assessmentType}
              onChange={e => setAssessmentType(e.target.value)}
              size="small"
            >
              {ASSESSMENT_TYPES.map(at => (
                <MenuItem key={at.key} value={at.key}>{at.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>{numberLabel}</InputLabel>
            <Select
              label={numberLabel}
              value={periodValue}
              onChange={handlePeriodSelect}
              size="small"
            >
              <MenuItem value="">Select {numberLabel}</MenuItem>
              {Array.isArray(periods) && periods.map((p) => (
                <MenuItem
                  key={`${p.week_no}::${p.date}::${p.topic_name}`}
                  value={`${p.week_no}::${p.date}::${p.topic_name}`}
                >
                  {p.week_no} {p.date ? `(${p.date})` : ""}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl sx={{ minWidth: 160 }}>
            <TextField
              label="Out Off (Marks)"
              type="number"
              inputProps={{ min: 1 }}
              value={outOff}
              onChange={e => setOutOff(e.target.value.replace(/[^0-9]/g, ""))}
              size="small"
            />
          </FormControl>
          {selectedDate && (
            <Box sx={{ display: "flex", alignItems: "center", px: 2 }}>
              <Typography variant="body2" color="text.secondary">
                <b>Date:</b> {selectedDate}
              </Typography>
            </Box>
          )}
        </Box>

        <Typography variant="h6" color="primary" sx={{ mb: 2, mt: 4 }}>
          {ASSESSMENT_TYPES.find(at => at.key === assessmentType)?.label}
        </Typography>

        <Paper sx={{ mb: 3 }}>
          <Table sx={{ minWidth: 800 }}>
            <TableHead>
              <TableRow>
                <TableCell><b>Name</b></TableCell>
                <TableCell><b>Email</b></TableCell>
                <TableCell><b>Topic Name</b></TableCell>
                <TableCell><b>Marks Scored</b></TableCell>
                <TableCell><b>Percentage</b></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {learners.map(learner => (
                <TableRow key={String(learner.id)}>
                  <TableCell>{learner.name}</TableCell>
                  <TableCell>{learner.email}</TableCell>
                  <TableCell>{selectedTopic}</TableCell>
                  <TableCell>
                    <TextField
                      type="number"
                      value={marks[learner.id]?.points || ""}
                      inputProps={{
                        min: 0,
                        max: outOff || ""
                      }}
                      onChange={e => handleMarksInput(learner.id, e.target.value)}
                      size="small"
                      disabled={!selectedWeekNo || !outOff}
                    />
                  </TableCell>
                  <TableCell>
                    {(marks[learner.id]?.percentage && outOff)
                      ? `${marks[learner.id].percentage}%`
                      : ""}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
        <Button
          variant="contained"
          color="primary"
          fullWidth
          onClick={handleSave}
          sx={{ py: 1.5, fontWeight: "bold", mb: 2, fontSize: "1rem", boxShadow: 4 }}
          disabled={!selectedWeekNo || !outOff}
        >
          Save All
        </Button>
        <Fade in={!!message}>
          <Box>
            {message && (
              <Alert severity={message.startsWith("✅") ? "success" : "info"}>
                {message}
              </Alert>
            )}
          </Box>
        </Fade>
      </Paper>
    </Box>
  );
}

export default MarkSheet;
