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
      const [intermediateRes, moduleRes] = await Promise.all([
        axios.get(`${API_BASE}/api/assessments/${batchNo}/intermediate`),
        axios.get(`${API_BASE}/api/assessments/${batchNo}/module`)
      ]);

      const intermediateData = intermediateRes.data.data || [];
      const moduleData = moduleRes.data.data || [];

      const grouped = {};

      const initLearner = (id) => {
        if (!grouped[id]) {
          grouped[id] = {
            id,
            intermediate: [],
            finalCore: [],
            finalPD: [],
            finalDV: [],
            project: [],
            viva: []
          };
        }
      };

      /* =====================
        INTERMEDIATE
      ====================== */
      intermediateData.forEach((row) => {
        initLearner(row.learner_id);
        grouped[row.learner_id].intermediate.push(row);
      });

      /* =====================
        MODULE DATA FILTERING
      ====================== */
      moduleData.forEach((row) => {
        initLearner(row.learner_id);

        const topic = (row.assessment_name || "").toLowerCase();

        // Final Project
        if (topic.includes("project")) {
          grouped[row.learner_id].project.push(row);
        }

        // Viva
        else if (topic.includes("viva")) {
          grouped[row.learner_id].viva.push(row);
        }

        // PD Finals
        else if (
          topic.includes("cmos") ||
          topic.includes("digital design") ||
          topic.includes("tcl")
        ) {
          grouped[row.learner_id].finalCore.push(row);
        }

        else if (topic.includes("physical design")) {
          grouped[row.learner_id].finalPD.push(row);
        }

        // DV Finals
        else if (
          topic.includes("digital") ||
          topic.includes("verilog") ||
          topic.includes("sv") ||
          topic.includes("uvm") ||
          topic.includes("python")
        ) {
          grouped[row.learner_id].finalDV.push(row);
        }
      });

      /* =====================
        DOMAIN DETECTION
      ====================== */
      const sample =
        intermediateData[0] || moduleData[0];

      const domain =
        sample?.course_planner_id?.toString().includes("PD")
          ? "PD"
          : "DV";

      const convertTo100 = (points, outOff) => {
        if (!points || !outOff) return 0;
        return (points / outOff) * 100;
      };

      const average = (arr) => {
        if (!arr.length) return 0;
        return arr.reduce((a, b) => a + b, 0) / arr.length;
      };

      const results = Object.values(grouped).map((learner) => {
        const intermediateAvg =
          average(
            learner.intermediate.map((m) =>
              convertTo100(m.points, m.out_off)
            )
          ) * 0.1;

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

        let finalWeight = 0;

        if (domain === "PD") {
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

          finalWeight = finalCoreAvg + finalPD;
        } else {
          const finalDVAvg =
            average(
              learner.finalDV.map((m) =>
                convertTo100(m.points, m.out_off)
              )
            ) * 0.3;

          finalWeight = finalDVAvg;
        }

        const total =
          intermediateAvg + finalWeight + project + viva;

        return {
          learner_id: learner.id,
          total_percentage: total.toFixed(2)
        };
      });

      setMarksData(results);
      setMessage(
        `✅ Weighted result calculated for ${results.length} learners (${domain})`
      );

    } catch (err) {
      console.error(err);
      setMessage("❌ Error calculating weightage");
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
