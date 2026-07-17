import React, { useState } from "react";
import { Box, Typography, Tabs, Tab } from "@mui/material";
import {
  CalendarToday    as DateChangeIcon,
  AssignmentLate   as MarksExtIcon,
  PeopleAlt        as AttendanceIcon,
  BarChart         as WeeklyIcon,
} from "@mui/icons-material";
import DateChangeReport     from "./DateChangeReport";
import MarkExtensionReport  from "./MarkExtensionReport";
import AttendanceReport     from "./AttendanceReport";
import WeeklyReports        from "./WeeklyReports";

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
  { value: "date-change",     label: "Date Change",        icon: <DateChangeIcon sx={{ fontSize: 16 }} />  },
  { value: "marks-extension", label: "Marks Extensions",   icon: <MarksExtIcon   sx={{ fontSize: 16 }} />  },
  { value: "attendance-report",label: "Attendance",        icon: <AttendanceIcon sx={{ fontSize: 16 }} />  },
  { value: "weekly-reports",  label: "Weekly Reports",     icon: <WeeklyIcon     sx={{ fontSize: 16 }} />  },
];

export default function ReportsDashboard({ user, token }) {
  const [activeTab, setActiveTab] = useState("date-change");

  return (
    <Box sx={{ minHeight: "100vh", background: TOKENS.bg, p: { xs: 1, md: 2 }, fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');`}</style>

      {/* Tab bar */}
      <Box sx={{ background: TOKENS.surface, border: `1px solid ${TOKENS.border}`, borderRadius: "16px", mb: 1, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
        <Box sx={{ px: 3, pt: 2.5, pb: 0, borderBottom: `1px solid ${TOKENS.border}` }}>
          <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 20, fontWeight: 800, color: TOKENS.text, letterSpacing: "-0.02em", mb: 1.5 }}>
            Reports
          </Typography>
          <Tabs
            value={activeTab}
            onChange={(_, v) => setActiveTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            TabIndicatorProps={{ style: { background: TOKENS.accent, height: 3, borderRadius: "3px 3px 0 0" } }}
            sx={{ minHeight: 40 }}
          >
            {TABS.map(t => (
              <Tab
                key={t.value}
                value={t.value}
                label={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
                    <Box sx={{ color: activeTab === t.value ? TOKENS.accent : TOKENS.textSub, display: "flex" }}>{t.icon}</Box>
                    <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: activeTab === t.value ? 700 : 500, color: activeTab === t.value ? TOKENS.accent : TOKENS.textSub, textTransform: "none", letterSpacing: 0 }}>
                      {t.label}
                    </Typography>
                  </Box>
                }
                sx={{ minHeight: 40, px: 2, py: 1, "&.Mui-selected": { color: TOKENS.accent } }}
              />
            ))}
          </Tabs>
        </Box>
      </Box>

      {/* Content — each sub-dashboard handles its own background */}
      <Box>
        {activeTab === "date-change"      && <DateChangeReport     user={user} token={token} />}
        {activeTab === "marks-extension"  && <MarkExtensionReport  user={user} token={token} />}
        {activeTab === "attendance-report"&& <AttendanceReport     user={user} token={token} />}
        {activeTab === "weekly-reports"   && <WeeklyReports        user={user} token={token} />}
      </Box>
    </Box>
  );
}