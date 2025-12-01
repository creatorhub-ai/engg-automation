import React, { useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItemButton,
  ListItemText,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import DateChangeReport from "./DateChangeReport";
import MarksExtensionReport from "./MarksExtensionReport";

export default function ReportsDashboard({ user, token }) {
  const [activeSub, setActiveSub] = useState("date-change");

  return (
    <Box sx={{ maxWidth: 1700, mx: "auto", my: 3, px: 2 }}>
      <Paper elevation={4} sx={{ p: 2, borderRadius: 3 }}>
        <Typography variant="h4" color="primary" gutterBottom>
          Reports
        </Typography>

        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">Reports</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 0 }}>
            <List component="nav" dense>
              <ListItemButton
                selected={activeSub === "date-change"}
                onClick={() => setActiveSub("date-change")}
              >
                <ListItemText primary="Date Change Report" />
              </ListItemButton>
              <ListItemButton
                selected={activeSub === "marks-extension"}
                onClick={() => setActiveSub("marks-extension")}
              >
                <ListItemText primary="Marks Extension Requests" />
              </ListItemButton>
            </List>
          </AccordionDetails>
        </Accordion>

        <Box sx={{ mt: 3 }}>
          {activeSub === "date-change" && (
            <DateChangeReport user={user} token={token} />
          )}
          {activeSub === "marks-extension" && (
            <MarksExtensionReport user={user} token={token} />
          )}
        </Box>
      </Paper>
    </Box>
  );
}