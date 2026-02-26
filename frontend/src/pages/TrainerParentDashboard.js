import React, { useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
} from "@mui/material";
import TrainerDashboard from "./TrainerDashboard";
import MarksEntryDashboard from "./MarkEntryDashboard";
import AttendanceDashboard from "./AttendanceDashboard";

export default function TrainerParentDashboard({ user, token }) {
  const [activeTab, setActiveTab] = useState("trainer-dashboard");

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const tabLabels = {
    "trainer-dashboard": "Trainer Dashboard",
    "marks-entry": "Marks Entry",
    "marks-dashboard": "Marks Overview",
    "attendance": "Attendance"
  };

  return (
    <Box sx={{ maxWidth: 1700, mx: "auto", my: 3, px: 2 }}>
      <Paper elevation={4} sx={{ p: 2, borderRadius: 3 }}>
        <Typography variant="h4" color="primary" gutterBottom fontWeight="bold">
          👨‍🏫 Trainer Dashboard
        </Typography>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          Welcome, {user?.name || "Trainer"}
        </Typography>

        {/* Top horizontal tabs */}
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
          scrollButtons="auto"
          sx={{ 
            borderBottom: 1, 
            borderColor: "divider", 
            mb: 3,
            '& .MuiTab-root': {
              fontWeight: 600,
              fontSize: '1.05rem',
              minHeight: 56
            }
          }}
        >
          <Tab
            label="🏠 Trainer Dashboard"
            value="trainer-dashboard"
            sx={{ fontWeight: 700 }}
          />
          <Tab
            label="📝 Marks Dashboard"
            value="marks-entry"
          />
          <Tab
            label="📋 Attendance"
            value="attendance"
          />
        </Tabs>

        {/* Content area - Render active sub-dashboard */}
        <Box sx={{ minHeight: 600 }}>
          {activeTab === "trainer-dashboard" && (
            <TrainerDashboard user={user} token={token} />
          )}
          {activeTab === "marks-entry" && (
            <MarksEntryDashboard user={user} token={token} />
          )}
          {activeTab === "attendance" && (
            <AttendanceDashboard user={user} token={token} />
          )}
        </Box>
      </Paper>
    </Box>
  );
}
