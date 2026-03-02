import React, { useState } from "react";
import { Box, Typography, Tabs, Tab } from "@mui/material";
import TrainerDashboard from "./TrainerDashboard";
import MarksEntryDashboard from "./MarkEntryDashboard";
import AttendanceDashboard from "./AttendanceDashboard";

/* ─── Shared design tokens ───────────────────────────────────────────────── */
export const DASH_T = {
  pageBg:      "#d4e0fd",
  surface:     "#ffffff",
  surfaceAlt:  "#eef3ff",
  border:      "#c3d3f8",
  accent:      "#2563eb",
  accentDark:  "#1d4ed8",
  accentLight: "#dbeafe",
  text:        "#1e2d5a",
  textSub:     "#5b6f9c",
};

const TAB_ITEMS = [
  { value: "trainer-dashboard", emoji: "🏠", label: "Trainer Dashboard" },
  { value: "marks-entry",       emoji: "📝", label: "Marks Dashboard"   },
  { value: "attendance",        emoji: "📋", label: "Attendance"        },
];

export default function TrainerParentDashboard({ user, token }) {
  const [activeTab, setActiveTab] = useState("trainer-dashboard");

  return (
    <Box
      sx={{
        minHeight:  "100vh",
        background: DASH_T.pageBg,
        p:          { xs: 1.5, sm: 2, md: 3 },
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
      `}</style>

      <Box sx={{ maxWidth: 1700, mx: "auto" }}>

        {/* ── Header card ── */}
        <Box
          sx={{
            background:   DASH_T.surface,
            borderRadius: "20px",
            border:       `1px solid ${DASH_T.border}`,
            boxShadow:    "0 4px 24px rgba(37,99,235,0.10)",
            px:           { xs: 2.5, md: 4 },
            pt:           3,
            pb:           0,
            mb:           2.5,
          }}
        >
          {/* Title row */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2.5 }}>
            <Box
              sx={{
                width:          52,
                height:         52,
                borderRadius:   "15px",
                background:     `linear-gradient(135deg, ${DASH_T.accent} 0%, ${DASH_T.accentDark} 100%)`,
                display:        "flex",
                alignItems:     "center",
                justifyContent: "center",
                fontSize:       24,
                flexShrink:     0,
                boxShadow:      `0 6px 16px ${DASH_T.accent}44`,
              }}
            >
              👨‍🏫
            </Box>
            <Box>
              <Typography
                sx={{
                  fontFamily:    "'DM Sans', sans-serif",
                  fontWeight:    800,
                  fontSize:      { xs: 20, md: 26 },
                  color:         DASH_T.text,
                  letterSpacing: "-0.03em",
                  lineHeight:    1.1,
                }}
              >
                Trainer Portal
              </Typography>
              <Typography
                sx={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize:   13,
                  color:      DASH_T.textSub,
                  fontWeight: 500,
                  mt:         0.2,
                }}
              >
                Welcome back,{" "}
                <Box component="span" sx={{ color: DASH_T.accent, fontWeight: 700 }}>
                  {user?.name || "Trainer"}
                </Box>
              </Typography>
            </Box>
          </Box>

          {/* Navigation tabs */}
          <Tabs
            value={activeTab}
            onChange={(_, v) => setActiveTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              "& .MuiTabs-indicator": {
                height:       3,
                borderRadius: "3px 3px 0 0",
                background:   `linear-gradient(90deg, ${DASH_T.accent}, ${DASH_T.accentDark})`,
              },
              "& .MuiTab-root": {
                fontFamily:    "'DM Sans', sans-serif",
                fontWeight:    600,
                fontSize:      13,
                color:         DASH_T.textSub,
                textTransform: "none",
                minHeight:     50,
                px:            2.5,
                letterSpacing: "0.01em",
                transition:    "color 0.2s",
              },
              "& .Mui-selected": {
                color:      `${DASH_T.accent} !important`,
                fontWeight: "800 !important",
              },
            }}
          >
            {TAB_ITEMS.map((tab) => (
              <Tab
                key={tab.value}
                value={tab.value}
                label={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
                    <span style={{ fontSize: 15 }}>{tab.emoji}</span>
                    <span>{tab.label}</span>
                  </Box>
                }
              />
            ))}
          </Tabs>
        </Box>

        {/* ── Content area ── */}
        <Box sx={{ minHeight: 600 }}>
          {activeTab === "trainer-dashboard" && <TrainerDashboard user={user} token={token} />}
          {activeTab === "marks-entry"       && <MarksEntryDashboard user={user} token={token} />}
          {activeTab === "attendance"        && <AttendanceDashboard user={user} token={token} />}
        </Box>

      </Box>
    </Box>
  );
}