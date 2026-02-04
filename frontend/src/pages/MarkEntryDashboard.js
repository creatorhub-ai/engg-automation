import React, { useState } from "react";
import {
  Box,
  Paper,
  Typography,
  AppBar,
  Tabs,
  Tab,
  Container,
} from "@mui/material";
import MarkSheet from "./MarkSheet";
import MarksDashboard from "./MarksDashboard";

export default function MarkEntryDashboard({ user }) {
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  return (
    <Container maxWidth="xl" sx={{ my: 3 }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 3 }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h3" color="primary" gutterBottom>
            Mark Entry Dashboard
          </Typography>
          <Typography variant="h6" color="text.secondary">
            Complete assessment management system for trainers
          </Typography>
          {user && (
            <Typography variant="body1" sx={{ mt: 1 }}>
              Welcome, {user.name || "Trainer"}!
            </Typography>
          )}
        </Box>

        {/* Tabs */}
        <AppBar position="static" color="default" elevation={0} sx={{ mb: 4 }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            centered
            textColor="primary"
            indicatorColor="primary"
            variant="fullWidth"
            sx={{
              "& .MuiTab-root": {
                fontSize: "1.1rem",
                fontWeight: 500,
                py: 2,
              },
            }}
          >
            <Tab label="📝 Mark Entry" />
            <Tab label="📊 Marks Dashboard" />
          </Tabs>
        </AppBar>

        {/* Tab Content */}
        <Box sx={{ minHeight: 600 }}>
          {activeTab === 0 && (
            <Box sx={{ p: 2 }}>
              <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
                <Typography variant="h5" color="primary" gutterBottom sx={{ mb: 3 }}>
                  Enter Assessment Marks
                </Typography>
                <MarkSheet />
              </Paper>
            </Box>
          )}

          {activeTab === 1 && (
            <Box sx={{ p: 2 }}>
              <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
                <Typography variant="h5" color="primary" gutterBottom sx={{ mb: 3 }}>
                  View & Export Marks Data
                </Typography>
                <MarksDashboard user={user} />
              </Paper>
            </Box>
          )}
        </Box>
      </Paper>
    </Container>
  );
}
