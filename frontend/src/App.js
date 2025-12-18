import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import DashboardLayout from "./components/DashboardLayout";

import TrainerDashboard from "./pages/TrainerDashboard";
import MockInterviewSchedule from "./pages/MockInterviewSchedule";
import SoftSkillAnnouncement from "./pages/SoftSkillAnnouncement";
import HomeDashboard from "./pages/HomeDashboard";
import InternalCommunication from "./pages/InternalCommunication";
import FinalAssessmentSchedule from "./pages/FinalAssessmentSchedule";
import MailStatusDashboard from "./pages/MailStatusDashboard";
import AttendanceMailer from "./pages/AttendanceMailer";
import CourseProgress from "./pages/CourseProgress";
import LoginPage from "./pages/LoginPage";
import DateChangeReport from "./pages/DateChangeReport";
import UsersDashboard from "./pages/UsersDashboard";
import TutorsDashboard from "./pages/TutorsDashboard";
import LearnersDashboard from "./pages/LearnersDashboard";
import ClassroomScheduler from "./pages/ClassroomScheduler";
import AttendanceDashboard from "./pages/AttendanceDashboard"; // <-- imported new attendance dashboard
import MarkSheet from "./pages/MarkSheet";
import ReportsDashboard from "./pages/ReportsDashboard";
import AnnouncementDashboard from "./pages/AnnouncementDashboard";
import ClassroomPlanner from "./pages/ClassroomPlanner";
import TrainerLeaveDashboard from "./pages/TrainerLeaveDashboard";
import ManagerLeaveDashboard from "./pages/ManagerLeaveDashboard";
import HolidayUpload from "./pages/HolidayUpload";

const roleMenus = {
  admin: [
    { text: "Home", path: "/home" },
    { text: "Trainer Dashboard", path: "/dashboard" },
    { text: "Mock Interview Schedule", path: "/mock-interview-schedule" },
    { text: "Internal Communication", path: "/internal" },
    { text: "Final Assessment Schedule", path: "/final-assessments" },
    { text: "Soft Skill Announcement", path: "/soft-skill-announcement" },
    { text: "Mail Status Check", path: "/mail-status" },
    { text: "Attendance Mailer", path: "/attendance-mailer" },
    { text: "Reports", path: "/reports" },
    { text: "Users Management", path: "/users" },
    { text: "Course Progress", path: "/course-progress" },
    { text: "Classroom Planner", path: "/schedule" },
    { text: "Attendance", path: "/attendance" }, // <-- added attendance menu
    { text: "Mark Entry", path: "/marks-entry" }, 
    { text: "Announcement", path: "/announcement" }, 
    { text: "Classroom Planner-2", path: "/classroom-planner" }, 
    { text: "Manager Leave Dashboard", path: "/manager/leaves" }, 
    { text: "Manager Leave Dashboard", path: "/holiday-upload" },
  ],
  manager: [
    { text: "Home", path: "/home" },
    { text: "Trainer Dashboard", path: "/dashboard" },
    { text: "Mock Interview Schedule", path: "/mock-interview-schedule" },
    { text: "Internal Communication", path: "/internal" },
    { text: "Final Assessment Schedule", path: "/final-assessments" },
    { text: "Soft Skill Announcement", path: "/soft-skill-announcement" },
    { text: "Mail Status Check", path: "/mail-status" },
    { text: "Attendance Mailer", path: "/attendance-mailer" },
    { text: "Reports", path: "/reports" },
    { text: "Users Management", path: "/users" },
    { text: "Course Progress", path: "/course-progress" },
    { text: "Classroom Planner", path: "/schedule" },
    { text: "Attendance", path: "/attendance" }, // <-- added attendance menu
    { text: "Mark Entry", path: "/marks-entry" }, 
    { text: "Announcement", path: "/announcement" }, 
    { text: "Manager Leave Dashboard", path: "/manager/leaves" },
    { text: "Upload Holidays", path: "/holiday-upload" }, 
  ],
  trainer: [
    { text: "Trainer Dashboard", path: "/dashboard" },
    { text: "Mock Interview Schedule", path: "/mock-interview-schedule" },
    { text: "Soft Skill Announcement", path: "/soft-skill-announcement" },
    { text: "Attendance", path: "/attendance" }, // <-- added attendance menu
    { text: "Mark Entry", path: "/marks-entry" },
    { text: "Trainer Leave Dashboard", path: "/trainer/leaves" }, 
  ],
  coordinator: [
    { text: "Home", path: "/home" },
    { text: "Internal Communication", path: "/internal" },
    { text: "Final Assessment Schedule", path: "/final-assessments" },
    { text: "Mail Status Check", path: "/mail-status" },
    { text: "Course Progress", path: "/course-progress" },
  ],
};

// Normalize roles for consistent checking
function normalizeRole(role) {
  if (!role) return "";
  if (typeof role === "object" && role.role) role = role.role;
  const r = (role || "").toString().trim().toLowerCase();

  if (["admin", "it admin", "it_admin", "it-admin"].includes(r)) return "admin";
  if (["manager", "management"].includes(r)) return "manager";
  if (["trainer", "training"].includes(r)) return "trainer";
  if (["coordinator", "co-ordinator", "coordinator "].includes(r)) return "coordinator";
  if (["user", "enduser"].includes(r)) return "user";

  return r;
}

function getSidebarMenu(role) {
  return roleMenus[role] || [];
}

function getDefaultRoute(menu) {
  return menu.length > 0 ? menu[0].path : "/home";
}

// Match path to component including the AttendanceDashboard
function getComponentForPath(path, login) {
  switch (path) {
    case "/home":
      return <HomeDashboard user={login} />;
    case "/dashboard":
      return <TrainerDashboard user={login} />;
    case "/mock-interview-schedule":
      return <MockInterviewSchedule user={login} />;
    case "/internal":
      return <InternalCommunication user={login} />;
    case "/final-assessments":
      return <FinalAssessmentSchedule user={login} />;
    case "/soft-skill-announcement":
      return <SoftSkillAnnouncement user={login} />;
    case "/mail-status":
      return <MailStatusDashboard user={login} />;
    case "/attendance-mailer":
      return <AttendanceMailer user={login} />;
    case "/course-progress":
      return <CourseProgress user={login} />;
    case "/reports":
      return <ReportsDashboard user={login} />;
    case "/users":
      return <UsersDashboard user={login} />;
    case "/tutors":
      return <TutorsDashboard user={login} />;
    case "/learners":
      return <LearnersDashboard user={login} />;
    case "/schedule":
      return <ClassroomScheduler user={login} />;
    case "/marks-entry":
      return <MarkSheet user={login} />;
    case "/announcement":
      return <AnnouncementDashboard user={login} />;
    case "/attendance":
      return <AttendanceDashboard user={login} />; // <-- mapped attendance route to AttendanceDashboard component
    case "/classroom-planner":
      return <ClassroomPlanner user={login} />;
    case "/trainer/leaves":
      return <TrainerLeaveDashboard user={login} />;
    case "/manager/leaves":
      return <ManagerLeaveDashboard user={login} />;
    case "/holiday-upload":
      return <HolidayUpload user={login} />;
    default:
      return <div>Page not found</div>;
  }
}

function RoleRouter({ login, onLogout }) {
  if (!login) return null;
  const sidebarMenu = getSidebarMenu(login.role);
  const defaultRoute = getDefaultRoute(sidebarMenu);

  return (
    <DashboardLayout user={login} logout={onLogout}>
      <Routes>
        {sidebarMenu.map(({ path }) => (
          <Route key={path} path={path} element={getComponentForPath(path, login)} />
        ))}
        <Route path="*" element={<Navigate to={defaultRoute} replace />} />
      </Routes>
    </DashboardLayout>
  );
}

export default function App() {
  const [login, setLogin] = useState(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    const checkSession = () => {
      try {
        const savedSession = localStorage.getItem("userSession");
        if (savedSession) {
          const userSession = JSON.parse(savedSession);
          const SESSION_DURATION = 24 * 60 * 60 * 1000;
          const currentTime = Date.now();
          const sessionAge = currentTime - userSession.loginTime;
          if (sessionAge < SESSION_DURATION) {
            const normalizedUser = {
              role: normalizeRole(userSession.role),
              name: userSession.name,
              email: userSession.email,
              loginTime: userSession.loginTime,
            };
            setLogin(normalizedUser);
          } else {
            localStorage.removeItem("userSession");
          }
        }
      } catch {
        localStorage.removeItem("userSession");
      } finally {
        setIsCheckingSession(false);
      }
    };
    checkSession();
  }, []);

  function handleLogin(arg1, arg2, arg3) {
    let payload;
    if (typeof arg1 === "object" && arg1 !== null && !arg2 && !arg3) {
      payload = {
        role: arg1.role,
        name: arg1.name,
        email: arg1.email,
        loginTime: arg1.loginTime || Date.now(),
      };
    } else {
      payload = {
        role: arg1,
        name: arg2,
        email: arg3,
        loginTime: Date.now(),
      };
    }
    payload.role = normalizeRole(payload.role);
    setLogin(payload);
  }

  function handleLogout() {
    localStorage.removeItem("userSession");
    setLogin(null);
  }

  if (isCheckingSession) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          fontSize: "18px",
          color: "#666",
        }}
      >
        Loading...
      </div>
    );
  }

  if (!login) return <LoginPage onLogin={handleLogin} />;

  return (
    <Router>
      <Routes>
        <Route path="/*" element={<RoleRouter login={login} onLogout={handleLogout} />} />
      </Routes>
    </Router>
  );
}
