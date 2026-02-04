import React, { useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
} from "@mui/material";
import MarkSheet from "./MarkSheet";
import MarksDashboard from "./MarksDashboard";

export default function MarkEntryDashboard({ user, token }) {
  const [activeTab, setActiveTab] = useState("mark-entry");

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  return (
    <Box sx={{ maxWidth: 1700, mx: "auto", my: 3, px: 2 }}>
      <Paper elevation={4} sx={{ p: 2, borderRadius: 3 }}>
        <Typography variant="h4" color="primary" gutterBottom>
          Mark Entry Dashboard
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
            label="📝 Mark Entry"
            value="mark-entry"
          />
          <Tab
            label="📊 Marks Dashboard"
            value="marks-dashboard"
          />
        </Tabs>

        {/* Content area */}
        <Box sx={{ mt: 1 }}>
          {activeTab === "mark-entry" && (
            <MarkSheet />
          )}
          {activeTab === "marks-dashboard" && (
            <MarksDashboard user={user} token={token} />
          )}
        </Box>
      </Paper>
    </Box>
  );
}
