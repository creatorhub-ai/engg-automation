import React, { useState } from "react";
import { Box, Paper, Tabs, Tab, Typography } from "@mui/material";
import TutorsDashboard from "./TutorsDashboard";
import LearnersDashboard from "./LearnersDashboard";

export default function UsersDashboard({ user, token }) {
  const [currentTab, setCurrentTab] = useState(0);

  return (
    <Box sx={{ maxWidth: 1600, mx: "auto", my: 3, px: 2 }}>
      <Paper elevation={4} sx={{ borderRadius: 3 }}>
        <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
          <Tabs
            value={currentTab}
            onChange={(e, newValue) => setCurrentTab(newValue)}
            centered
          >
            <Tab label="Tutors" />
            <Tab label="Learners" />
          </Tabs>
        </Box>

        <Box sx={{ p: 0 }}>
          {currentTab === 0 && <TutorsDashboard user={user} token={token} />}
          {currentTab === 1 && <LearnersDashboard user={user} token={token} />}
        </Box>
      </Paper>
    </Box>
  );
}
