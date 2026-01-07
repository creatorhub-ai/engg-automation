// src/pages/TrainerAssignmentDashboard.js - DATABASE ONLY
import React, { useEffect, useState } from "react";
import {
  Box, Typography, Table, TableHead, TableBody, TableCell, TableRow,
  TableContainer, Chip, Button, Paper, Alert, CircularProgress
} from "@mui/material";

const API_BASE = "https://engg-automation.onrender.com";

function TrainerAssignmentDashboard() {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("Connecting to database...");

  useEffect(() => {
    const fetchData = async () => {
      setStatus("Querying trainer_unavailability table...");
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(`${API_BASE}/api/trainer-unavailability`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (Array.isArray(data)) {
          setLeaves(data);
          setStatus(`✅ SUCCESS: Loaded ${data.length} records from trainer_unavailability table`);
          console.log("✅ DATABASE DATA:", data);
        } else {
          setLeaves([]);
          setStatus("⚠️ No data found in trainer_unavailability table");
        }
      } catch (error) {
        console.error("💥 API ERROR:", error.message);
        setStatus(`❌ Failed: ${error.name} - ${error.message}`);
        setLeaves([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" fontWeight="bold" mb={4} color="primary.main">
        Trainer Unavailability Dashboard
      </Typography>

      {/* STATUS HEADER */}
      <Paper elevation={2} sx={{ p: 3, mb: 4 }}>
        <Alert 
          severity={status.includes("✅") ? "success" : status.includes("❌") ? "error" : "info"}
          sx={{ 
            '& .MuiAlert-message': { fontSize: '1.1rem', fontWeight: 500 }
          }}
        >
          {status}
        </Alert>
        {leaves.length > 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Showing {leaves.length} trainer records • Last updated: {new Date().toLocaleTimeString()}
          </Typography>
        )}
      </Paper>

      {/* TRAINER TABLE */}
      <Paper elevation={3} sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <TableContainer sx={{ maxHeight: 600 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: "primary.main" }}>
                <TableCell sx={{ color: "white", fontWeight: "bold", py: 2.5 }}>
                  Trainer Name
                </TableCell>
                <TableCell sx={{ color: "white", fontWeight: "bold", py: 2.5 }}>
                  Email
                </TableCell>
                <TableCell sx={{ color: "white", fontWeight: "bold", py: 2.5, minWidth: 80 }}>
                  Domain
                </TableCell>
                <TableCell sx={{ color: "white", fontWeight: "bold", py: 2.5 }}>
                  Date Range
                </TableCell>
                <TableCell sx={{ color: "white", fontWeight: "bold", py: 2.5, minWidth: 100 }}>
                  Status
                </TableCell>
                <TableCell sx={{ color: "white", fontWeight: "bold", py: 2.5, minWidth: 140 }}>
                  Action
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                    <CircularProgress size={32} sx={{ mb: 2 }} />
                    <Typography variant="h6" color="text.secondary">
                      Connecting to database (10s max)...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : leaves.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                    <Typography variant="h6" color="text.secondary">
                      No trainer unavailability records found
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Table "trainer_unavailability" is empty
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                leaves.map((leave) => (
                  <TableRow 
                    key={leave.id} 
                    hover 
                    sx={{ 
                      '&:hover': { bgcolor: '#f5f5f5' },
                      transition: 'all 0.2s'
                    }}
                  >
                    <TableCell sx={{ py: 2.5 }}>
                      <Typography variant="subtitle1" fontWeight="bold">
                        {leave.trainer_name || "Unknown"}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 2.5 }}>
                      <Typography variant="body2" sx={{ maxWidth: 220 }}>
                        {leave.trainer_email || "No email"}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 2.5 }}>
                      <Chip 
                        label={leave.domain || "N/A"} 
                        color="primary" 
                        size="small" 
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell sx={{ py: 2.5 }}>
                      <Box>
                        <Typography variant="body2" fontWeight={500}>
                          {leave.start_date || "N/A"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          to {leave.end_date || "N/A"}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ py: 2.5 }}>
                      <Chip 
                        label={leave.status?.toUpperCase() || "PENDING"}
                        color={
                          leave.status === "assigned" ? "success" : 
                          leave.status === "rejected" ? "error" : 
                          "warning"
                        }
                        size="small"
                      />
                    </TableCell>
                    <TableCell sx={{ py: 2.5 }}>
                      <Button 
                        variant="contained" 
                        size="small"
                        disabled={leave.status === "assigned"}
                        sx={{ 
                          minWidth: 130,
                          px: 2,
                          fontSize: '0.75rem'
                        }}
                      >
                        {leave.status === "assigned" ? "ASSIGNED ✓" : "Assign Topics"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* RAW DATA DEBUG */}
      <Paper sx={{ mt: 4, p: 2 }}>
        <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
          Raw Database Response:
        </Typography>
        <pre style={{
          fontSize: '11px',
          background: '#f8f9fa',
          padding: '16px',
          borderRadius: '8px',
          maxHeight: '300px',
          overflow: 'auto',
          fontFamily: 'Monaco, Consolas, monospace',
          border: '1px solid #e0e0e0'
        }}>
          {JSON.stringify(leaves, null, 2)}
        </pre>
      </Paper>
    </Box>
  );
}

export default TrainerAssignmentDashboard;
