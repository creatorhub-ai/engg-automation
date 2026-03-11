import React, { useState } from "react";
import { Box, Typography, Tabs, Tab } from "@mui/material";
import {
  School    as TutorIcon,
  MenuBook  as LearnerIcon,
} from "@mui/icons-material";
import TutorsDashboard   from "./TutorsDashboard";
import LearnersDashboard from "./LearnersDashboard";

/* ─── Design tokens ──────────────────────────────────────────────────────── */
const TOKENS = {
  bg:          "#d4e0fd",
  surface:     "#ffffff",
  surfaceAlt:  "#f8f9fc",
  border:      "#e4e8f0",
  accent:      "#3d5afe",
  accentLight: "#e8ecff",
  text:        "#1a1f36",
  textSub:     "#6b7280",
};

const TABS = [
  { index: 0, label: "Tutors",   icon: <TutorIcon   sx={{ fontSize: 16 }} /> },
  { index: 1, label: "Learners", icon: <LearnerIcon sx={{ fontSize: 16 }} /> },
];

export default function UsersDashboard({ user, token }) {
  const [currentTab, setCurrentTab] = useState(0);

  return (
    <Box sx={{ minHeight: "100vh", background: TOKENS.bg, p: { xs: 1, md: 2 }, fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');`}</style>

      {/* Tab bar */}
      <Box sx={{ background: TOKENS.surface, border: `1px solid ${TOKENS.border}`, borderRadius: "16px", mb: 1, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
        <Box sx={{ px: 3, pt: 2.5, pb: 0, borderBottom: `1px solid ${TOKENS.border}` }}>
          <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 20, fontWeight: 800, color: TOKENS.text, letterSpacing: "-0.02em", mb: 1.5 }}>
            Users
          </Typography>
          <Tabs
            value={currentTab}
            onChange={(_, v) => setCurrentTab(v)}
            TabIndicatorProps={{ style: { background: TOKENS.accent, height: 3, borderRadius: "3px 3px 0 0" } }}
            sx={{ minHeight: 40 }}
          >
            {TABS.map(t => (
              <Tab
                key={t.index}
                value={t.index}
                label={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
                    <Box sx={{ color: currentTab === t.index ? TOKENS.accent : TOKENS.textSub, display: "flex" }}>{t.icon}</Box>
                    <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: currentTab === t.index ? 700 : 500, color: currentTab === t.index ? TOKENS.accent : TOKENS.textSub, textTransform: "none", letterSpacing: 0 }}>
                      {t.label}
                    </Typography>
                  </Box>
                }
                sx={{ minHeight: 40, px: 2, py: 1 }}
              />
            ))}
          </Tabs>
        </Box>
      </Box>

      <Box>
        {currentTab === 0 && <TutorsDashboard   user={user} token={token} />}
        {currentTab === 1 && <LearnersDashboard user={user} token={token} />}
      </Box>
    </Box>
  );
}