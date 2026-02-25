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
  process.env.REACT_APP_API_URL ||
  "https://engg-automation.onrender.com";

export default function MarksDashboard({ user }) {
  const [batchNo, setBatchNo] = useState("");
  const [assessmentType, setAssessmentType] =
    useState("weekly");
  const [marksData, setMarksData] = useState([]);
  const [batches, setBatches] = useState([]);
  const [fetchLoading, setFetchLoading] =
    useState(false);
  const [message, setMessage] = useState("");

  /* =========================
     FETCH BATCHES
  ========================== */
  useEffect(() => {
    const fetchBatches = async () => {
      try {
        const res = await axios.get(
          `${API_BASE}/api/batches`
        );
        if (Array.isArray(res.data)) {
          setBatches(res.data);
        }
      } catch (err) {
        setMessage("Error loading batches");
      }
    };
    fetchBatches();
  }, []);

  /* =========================
     FETCH DATA
  ========================== */
  const fetchMarks = async () => {
    if (!batchNo) {
      setMessage("⚠️ Please select batch");
      return;
    }

    setFetchLoading(true);
    setMessage("");

    try {
      const url =
        assessmentType === "scorecard"
          ? `${API_BASE}/api/scorecard/${batchNo}`
          : `${API_BASE}/api/assessments/${batchNo}/${assessmentType}`;

      const res = await axios.get(url);

      if (
        res.data &&
        Array.isArray(res.data.data)
      ) {
        setMarksData(res.data.data);
        setMessage(
          `✅ Loaded ${res.data.data.length} records`
        );
      } else {
        setMarksData([]);
        setMessage("No data found");
      }
    } catch (error) {
      console.error(error);
      setMarksData([]);
      setMessage("Error fetching data");
    } finally {
      setFetchLoading(false);
    }
  };

  /* =========================
     DOWNLOADS (UNCHANGED)
  ========================== */
  const downloadExcel = () => {
    const ws =
      XLSX.utils.json_to_sheet(marksData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      ws,
      "Marks Data"
    );

    const filename = `marks_${batchNo}_${assessmentType}_${new Date()
      .toISOString()
      .split("T")[0]}.xlsx`;

    XLSX.writeFile(wb, filename);
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(
      `Marks Report - ${batchNo}`,
      14,
      20
    );

    doc.autoTable({
      startY: 30,
      head: [
        Object.keys(marksData[0] || {}).map(
          (k) => k
        ),
      ],
      body: marksData.map((row) =>
        Object.values(row)
      ),
    });

    doc.save(
      `marks_${batchNo}_${assessmentType}.pdf`
    );
  };

  const roleTitle = user?.role
    ? user.role.charAt(0).toUpperCase() +
      user.role.slice(1)
    : "Marks Dashboard";

  const welcomeName =
    user?.name || "User";

  /* =========================
     NORMAL TABLE COLUMNS
  ========================== */
  const getDynamicColumns = () => {
    if (!marksData.length) return [];

    if (assessmentType === "scorecard")
      return [];

    const sampleRow = marksData[0];

    const columns = [
      {
        key: "learner_id",
        label: "Learner ID",
      },
      {
        key: "course_planner_id",
        label: "Course ID",
      },
      {
        key: "batch_no",
        label: "Batch",
      },
    ];

    if (sampleRow.week_no !== undefined)
      columns.push({
        key: "week_no",
        label: "Week",
      });

    if (sampleRow.module_no !== undefined)
      columns.push({
        key: "module_no",
        label: "Module",
      });

    columns.push(
      {
        key: "assessment_date",
        label: "Date",
      },
      sampleRow.assessment_name
        ? {
            key: "assessment_name",
            label: "Assessment",
          }
        : null,
      {
        key: "out_off",
        label: "Out Of",
      },
      {
        key: "points",
        label: "Points",
      },
      {
        key: "percentage",
        label: "Percentage",
      }
    );

    return columns.filter(Boolean);
  };

  return (
    <Box sx={{ maxWidth: 1400, mx: "auto", my: 3 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4">
          {roleTitle}
        </Typography>

        <Typography
          variant="subtitle1"
          mb={3}
        >
          Welcome, {welcomeName}!
        </Typography>

        {/* Filters */}
        <Box
          sx={{
            display: "flex",
            gap: 3,
            flexWrap: "wrap",
            mb: 3,
          }}
        >
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>
              Select Batch
            </InputLabel>
            <Select
              value={batchNo}
              label="Select Batch"
              onChange={(e) =>
                setBatchNo(e.target.value)
              }
            >
              <MenuItem value="">
                -- Select Batch --
              </MenuItem>
              {batches.map((b, i) => (
                <MenuItem
                  key={i}
                  value={b.batch_no}
                >
                  {b.batch_no} (
                  {b.start_date})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 220 }}>
            <InputLabel>
              Assessment Type
            </InputLabel>
            <Select
              value={assessmentType}
              label="Assessment Type"
              onChange={(e) =>
                setAssessmentType(
                  e.target.value
                )
              }
            >
              <MenuItem value="weekly">
                Weekly Assessment
              </MenuItem>
              <MenuItem value="intermediate">
                Intermediate Assessment
              </MenuItem>
              <MenuItem value="module">
                Module Level Assessment
              </MenuItem>
              <MenuItem value="scorecard">
                Scorecard
              </MenuItem>
            </Select>
          </FormControl>

          <Button
            variant="contained"
            onClick={fetchMarks}
            disabled={
              !batchNo || fetchLoading
            }
            startIcon={
              fetchLoading ? (
                <CircularProgress size={20} />
              ) : (
                <TableChartIcon />
              )
            }
          >
            {fetchLoading
              ? "Loading..."
              : "Fetch Marks"}
          </Button>
        </Box>

        {/* Download */}
        {marksData.length > 0 && (
          <Box
            sx={{ display: "flex", gap: 2 }}
          >
            <Button
              variant="outlined"
              onClick={downloadExcel}
              startIcon={
                <DownloadIcon />
              }
            >
              Download XLSX
            </Button>
            <Button
              variant="outlined"
              onClick={downloadPDF}
              startIcon={
                <DownloadIcon />
              }
            >
              Download PDF
            </Button>
          </Box>
        )}

        {/* =========================
            SCORECARD TABLE
        ========================== */}
        {assessmentType ===
          "scorecard" &&
          marksData.length > 0 && (
            <TableContainer sx={{ mt: 3 }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>
                      Name
                    </TableCell>
                    <TableCell>
                      Email
                    </TableCell>

                    {batchNo.includes(
                      "PDFT"
                    ) ? (
                      <>
                        <TableCell>
                          Digital
                          Design
                        </TableCell>
                        <TableCell>
                          CMOS
                        </TableCell>
                        <TableCell>
                          TCL
                        </TableCell>
                        <TableCell>
                          Physical
                          Design
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell>
                          Digital
                        </TableCell>
                        <TableCell>
                          Verilog
                        </TableCell>
                        <TableCell>
                          SV
                        </TableCell>
                        <TableCell>
                          UVM
                        </TableCell>
                        <TableCell>
                          Python
                        </TableCell>
                      </>
                    )}

                    <TableCell>
                      Project
                    </TableCell>
                    <TableCell>
                      Overall %
                    </TableCell>
                    <TableCell>
                      Grade
                    </TableCell>
                    <TableCell>
                      Certification
                    </TableCell>
                    <TableCell>
                      Placement
                    </TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {marksData.map(
                    (row, i) => (
                      <TableRow
                        key={i}
                      >
                        <TableCell>
                          {row.name}
                        </TableCell>
                        <TableCell>
                          {row.email}
                        </TableCell>

                        {Object.values(
                          row.breakdown ||
                            {}
                        ).map(
                          (
                            val,
                            idx
                          ) => (
                            <TableCell
                              key={
                                idx
                              }
                            >
                              {val?.toFixed
                                ? val.toFixed(
                                    2
                                  )
                                : val}
                            </TableCell>
                          )
                        )}

                        <TableCell>
                          {row.project}
                        </TableCell>
                        <TableCell>
                          {row.overall}
                        </TableCell>
                        <TableCell>
                          {row.grade}
                        </TableCell>
                        <TableCell>
                          {
                            row.certification
                          }
                        </TableCell>
                        <TableCell>
                          {
                            row.placement
                          }
                        </TableCell>
                      </TableRow>
                    )
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}

        {/* =========================
            NORMAL TABLE
        ========================== */}
        {assessmentType !==
          "scorecard" &&
          marksData.length > 0 && (
            <TableContainer sx={{ mt: 3 }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    {getDynamicColumns().map(
                      (col) => (
                        <TableCell
                          key={
                            col.key
                          }
                        >
                          {
                            col.label
                          }
                        </TableCell>
                      )
                    )}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {marksData.map(
                    (row, i) => (
                      <TableRow
                        key={i}
                      >
                        {getDynamicColumns().map(
                          (col) => (
                            <TableCell
                              key={
                                col.key
                              }
                            >
                              {
                                row[
                                  col.key
                                ]
                              }
                            </TableCell>
                          )
                        )}
                      </TableRow>
                    )
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}

        {/* Messages */}
        <Fade in={!!message}>
          <Box mt={2}>
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
