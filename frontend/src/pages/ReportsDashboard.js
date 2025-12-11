import React, { useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
} from "@mui/material";
import DateChangeReport from "./DateChangeReport";
import MarksExtensionReport from "./MarksExtensionReport";
import AttendanceReport from "./AttendanceReport"; // <-- create this
import WeeklyReports from "./WeeklyReports";

export default function ReportsDashboard({ user, token }) {
  const [activeTab, setActiveTab] = useState("date-change");

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  return (
    <Box sx={{ maxWidth: 1700, mx: "auto", my: 3, px: 2 }}>
      <Paper elevation={4} sx={{ p: 2, borderRadius: 3 }}>
        <Typography variant="h4" color="primary" gutterBottom>
          Reports
        </Typography>

        {/* Top horizontal sub‑dashboards */}
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}
        >
          <Tab
            label="Date Change Report"
            value="date-change"
          />
          <Tab
            label="Marks Extension Requests"
            value="marks-extension"
          />
          <Tab
            label="Attendance Report"
            value="attendance-report"
          />
          <Tab label="Weekly Reports - CMS" value="weekly-reports" />
        </Tabs>

        {/* Content area */}
        <Box sx={{ mt: 1 }}>
          {activeTab === "date-change" && (
            <DateChangeReport user={user} token={token} />
          )}
          {activeTab === "marks-extension" && (
            <MarksExtensionReport user={user} token={token} />
          )}
          {activeTab === "attendance-report" && (
            <AttendanceReport user={user} token={token} />
          )}
          {activeTab === "weekly-reports" && (
            <WeeklyReports user={user} token={token} />
          )}
        </Box>
      </Paper>
    </Box>
  );
}
