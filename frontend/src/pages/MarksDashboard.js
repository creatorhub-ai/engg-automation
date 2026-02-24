import React, { useEffect, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import {
  Paper,
  Typography,
  Button,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Box,
  Alert,
  Fade,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
} from "@mui/material";
import {
  Download as DownloadIcon,
  TableChart as TableChartIcon,
} from "@mui/icons-material";

const API_BASE =
  process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

export default function MarksDashboard({ user }) {
  const [batchNo, setBatchNo] = useState("");
  const [assessmentType, setAssessmentType] = useState("weekly");
  const [marksData, setMarksData] = useState([]);
  const [batches, setBatches] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [message, setMessage] = useState("");

  /* =========================
     FETCH BATCHES
  ========================== */
  useEffect(() => {
    axios
      .get(`${API_BASE}/api/batches`)
      .then((res) => setBatches(res.data || []))
      .catch(() => setMessage("Error loading batches"));
  }, []);

  /* =========================
     COMMON HELPERS
  ========================== */

  const convertTo100 = (points, outOff) => {
    if (!points || !outOff) return 0;
    return (points / outOff) * 100;
  };

  const average = (arr) => {
    if (!arr.length) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  };

  /* =========================
     PD WEIGHTAGE
  ========================== */

  const calculatePD = (grouped) => {
    return Object.values(grouped).map((learner) => {
      let total = 0;

      const intermediateAvg =
        average(
          learner.intermediate.map((m) =>
            convertTo100(m.points, m.out_off)
          )
        ) * 0.1;

      const finalCoreAvg =
        average(
          learner.finalCore.map((m) =>
            convertTo100(m.points, m.out_off)
          )
        ) * 0.2;

      const finalPD =
        average(
          learner.finalPD.map((m) =>
            convertTo100(m.points, m.out_off)
          )
        ) * 0.3;

      const project =
        learner.project.length > 0
          ? convertTo100(
              learner.project[0].points,
              learner.project[0].out_off
            ) * 0.3
          : 0;

      const viva =
        learner.viva.length > 0
          ? convertTo100(
              learner.viva[0].points,
              learner.viva[0].out_off
            ) * 0.1
          : 0;

      total =
        intermediateAvg + finalCoreAvg + finalPD + project + viva;

      return {
        learner_id: learner.id,
        total_percentage: total.toFixed(2),
      };
    });
  };

  /* =========================
     DV WEIGHTAGE
  ========================== */

  const calculateDV = (grouped) => {
    return Object.values(grouped).map((learner) => {
      let total = 0;

      const intermediateAvg =
        average(
          learner.intermediate.map((m) =>
            convertTo100(m.points, m.out_off)
          )
        ) * 0.1;

      const finalAvg =
        average(
          learner.final.map((m) =>
            convertTo100(m.points, m.out_off)
          )
        ) * 0.3; // DV finals 30%

      const project =
        learner.project.length > 0
          ? convertTo100(
              learner.project[0].points,
              learner.project[0].out_off
            ) * 0.3
          : 0;

      const viva =
        learner.viva.length > 0
          ? convertTo100(
              learner.viva[0].points,
              learner.viva[0].out_off
            ) * 0.1
          : 0;

      total = intermediateAvg + finalAvg + project + viva;

      return {
        learner_id: learner.id,
        total_percentage: total.toFixed(2),
      };
    });
  };

  /* =========================
     WEIGHTED FETCH
  ========================== */

  const fetchWeighted = async () => {
    try {
      const [intermediate, final, project, viva] =
        await Promise.all([
          axios.get(
            `${API_BASE}/api/assessments/${batchNo}/intermediate`
          ),
          axios.get(
            `${API_BASE}/api/assessments/${batchNo}/final`
          ),
          axios.get(
            `${API_BASE}/api/assessments/${batchNo}/final-project`
          ),
          axios.get(
            `${API_BASE}/api/assessments/${batchNo}/viva`
          ),
        ]);

      const grouped = {};

      const initLearner = (id) => {
        if (!grouped[id]) {
          grouped[id] = {
            id,
            intermediate: [],
            finalCore: [],
            finalPD: [],
            final: [],
            project: [],
            viva: [],
          };
        }
      };

      intermediate.data.data.forEach((row) => {
        initLearner(row.learner_id);
        grouped[row.learner_id].intermediate.push(row);
      });

      final.data.data.forEach((row) => {
        initLearner(row.learner_id);

        const topic = row.assessment_name || "";

        if (
          topic.includes("CMOS") ||
          topic.includes("Digital Design") ||
          topic.includes("TCL")
        ) {
          grouped[row.learner_id].finalCore.push(row);
        } else if (topic.includes("Physical Design")) {
          grouped[row.learner_id].finalPD.push(row);
        }

        // For DV
        if (
          topic.includes("Digital") ||
          topic.includes("Verilog") ||
          topic.includes("SV") ||
          topic.includes("UVM") ||
          topic.includes("Python")
        ) {
          grouped[row.learner_id].final.push(row);
        }
      });

      project.data.data.forEach((row) => {
        initLearner(row.learner_id);
        grouped[row.learner_id].project.push(row);
      });

      viva.data.data.forEach((row) => {
        initLearner(row.learner_id);
        grouped[row.learner_id].viva.push(row);
      });

      // Detect Domain (PD or DV)
      const sample =
        intermediate.data.data[0] ||
        final.data.data[0];

      const domain =
        sample?.course_planner_id?.toString().includes("PD")
          ? "PD"
          : "DV";

      const calculated =
        domain === "PD"
          ? calculatePD(grouped)
          : calculateDV(grouped);

      setMarksData(calculated);
      setMessage(
        `✅ Weighted result calculated for ${calculated.length} learners (${domain})`
      );
    } catch (err) {
      console.error(err);
      setMessage("Error calculating weightage");
    }
  };

  /* =========================
     NORMAL FETCH
  ========================== */

  const fetchMarks = async () => {
    if (!batchNo) {
      setMessage("⚠️ Please select batch");
      return;
    }

    if (assessmentType === "weighted") {
      setFetchLoading(true);
      await fetchWeighted();
      setFetchLoading(false);
      return;
    }

    setFetchLoading(true);
    setMessage("");

    try {
      const res = await axios.get(
        `${API_BASE}/api/assessments/${batchNo}/${assessmentType}`
      );

      if (res.data && Array.isArray(res.data.data)) {
        setMarksData(res.data.data);
        setMessage(
          `✅ Loaded ${res.data.data.length} records`
        );
      } else {
        setMarksData([]);
        setMessage("No assessment data found");
      }
    } catch (error) {
      console.error(error);
      setMarksData([]);
      setMessage("Error fetching assessment data");
    } finally {
      setFetchLoading(false);
    }
  };

  /* =========================
     UI
  ========================== */

  return (
    <Box sx={{ maxWidth: 1300, mx: "auto", my: 3 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h5" gutterBottom>
          🎯 Marks Dashboard
        </Typography>

        <Box sx={{ display: "flex", gap: 3, mb: 3 }}>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Batch</InputLabel>
            <Select
              value={batchNo}
              label="Batch"
              onChange={(e) =>
                setBatchNo(e.target.value)
              }
            >
              {batches.map((b, i) => (
                <MenuItem
                  key={i}
                  value={b.batch_no}
                >
                  {b.batch_no}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 250 }}>
            <InputLabel>
              Assessment Type
            </InputLabel>
            <Select
              value={assessmentType}
              label="Assessment Type"
              onChange={(e) =>
                setAssessmentType(e.target.value)
              }
            >
              <MenuItem value="weekly">
                Weekly
              </MenuItem>
              <MenuItem value="intermediate">
                Intermediate
              </MenuItem>
              <MenuItem value="module">
                Module
              </MenuItem>
              <MenuItem value="final">
                Final
              </MenuItem>
              <MenuItem value="weighted">
                🎯 Weighted Final Result
              </MenuItem>
            </Select>
          </FormControl>

          <Button
            variant="contained"
            onClick={fetchMarks}
            disabled={fetchLoading}
          >
            {fetchLoading
              ? "Processing..."
              : "Fetch"}
          </Button>
        </Box>

        {marksData.length > 0 && (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  {assessmentType ===
                  "weighted" ? (
                    <>
                      <TableCell>
                        Learner ID
                      </TableCell>
                      <TableCell>
                        Total %
                      </TableCell>
                    </>
                  ) : (
                    Object.keys(
                      marksData[0]
                    ).map((key) => (
                      <TableCell key={key}>
                        {key}
                      </TableCell>
                    ))
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {marksData.map((row, i) => (
                  <TableRow key={i}>
                    {assessmentType ===
                    "weighted" ? (
                      <>
                        <TableCell>
                          {
                            row.learner_id
                          }
                        </TableCell>
                        <TableCell>
                          {
                            row.total_percentage
                          }
                          %
                        </TableCell>
                      </>
                    ) : (
                      Object.values(row).map(
                        (val, idx) => (
                          <TableCell
                            key={idx}
                          >
                            {val}
                          </TableCell>
                        )
                      )
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        <Fade in={!!message}>
          <Box sx={{ mt: 2 }}>
            {message && (
              <Alert>
                {message}
              </Alert>
            )}
          </Box>
        </Fade>
      </Paper>
    </Box>
  );
}
