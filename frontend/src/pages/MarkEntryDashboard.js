import React, { useState } from "react";
import { Box, Typography, Tabs, Tab } from "@mui/material";
import MarkSheet from "./MarkSheet";
import MarksDashboard from "./MarksDashboard";

/* ─── Design tokens ──────────────────────────────────────────────────────── */
const T = {
  surface:     "#ffffff",
  surfaceAlt:  "#eef3ff",
  border:      "#c3d3f8",
  accent:      "#2563eb",
  accentDark:  "#1d4ed8",
  accentLight: "#dbeafe",
  text:        "#1e2d5a",
  textSub:     "#5b6f9c",
};

const ALL_TAB_ITEMS = [
  { value: "mark-entry",      emoji: "📝", label: "Mark Entry"      },
  { value: "marks-dashboard", emoji: "📊", label: "Marks Dashboard" },
];

export default function MarkEntryDashboard({ user, token }) {
  const isTrainer = user?.role === "Trainers";

  // Trainers only see Mark Entry, so filter the tab list accordingly
  const TAB_ITEMS = isTrainer
    ? ALL_TAB_ITEMS.filter((t) => t.value === "mark-entry")
    : ALL_TAB_ITEMS;

  const [activeTab, setActiveTab] = useState("mark-entry");

  return (
    <Box sx={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* ── Sub-header + tab bar ── */}
      <Box
        sx={{
          background:   T.surface,
          borderRadius: "16px",
          border:       `1px solid ${T.border}`,
          boxShadow:    "0 2px 14px rgba(37,99,235,0.07)",
          px:           { xs: 2, md: 3 },
          pt:           2.5,
          pb:           0,
          mb:           2,
        }}
      >
        {/* Section title */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
          <Box
            sx={{
              width:          38,
              height:         38,
              borderRadius:   "11px",
              background:     `linear-gradient(135deg, ${T.accent} 0%, ${T.accentDark} 100%)`,
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              fontSize:       17,
              flexShrink:     0,
              boxShadow:      `0 3px 10px ${T.accent}33`,
            }}
          >
            📝
          </Box>
          <Typography
            sx={{
              fontFamily:    "'DM Sans', sans-serif",
              fontWeight:    800,
              fontSize:      18,
              color:         T.text,
              letterSpacing: "-0.02em",
            }}
          >
            Mark Entry Dashboard
          </Typography>
        </Box>

        {/* Tabs — only rendered if there is more than one tab to show */}
        {TAB_ITEMS.length > 1 && (
          <Tabs
            value={activeTab}
            onChange={(_, v) => setActiveTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              "& .MuiTabs-indicator": {
                height:       3,
                borderRadius: "3px 3px 0 0",
                background:   `linear-gradient(90deg, ${T.accent}, ${T.accentDark})`,
              },
              "& .MuiTab-root": {
                fontFamily:    "'DM Sans', sans-serif",
                fontWeight:    600,
                fontSize:      13,
                color:         T.textSub,
                textTransform: "none",
                minHeight:     46,
                px:            2,
                transition:    "color 0.2s",
              },
              "& .Mui-selected": {
                color:      `${T.accent} !important`,
                fontWeight: "800 !important",
              },
            }}
          >
            {TAB_ITEMS.map((tab) => (
              <Tab
                key={tab.value}
                value={tab.value}
                label={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.7 }}>
                    <span style={{ fontSize: 14 }}>{tab.emoji}</span>
                    <span>{tab.label}</span>
                  </Box>
                }
              />
            ))}
          </Tabs>
        )}
      </Box>

      {/* ── Content ── */}
      <Box>
        {activeTab === "mark-entry" && <MarkSheet />}
        {activeTab === "marks-dashboard" && !isTrainer && (
          <MarksDashboard user={user} token={token} />
        )}
      </Box>
    </Box>
  );
}