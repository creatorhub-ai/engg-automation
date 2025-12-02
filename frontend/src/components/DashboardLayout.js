// frontend/src/components/DashboardLayout.js
import React, { useEffect, useState } from "react";
import { useNavigate, Outlet, useLocation } from "react-router-dom";
import {
  Home as HomeIcon,
  School as TrainerIcon,
  CalendarMonth as ScheduleIcon,
  Chat as CommunicationIcon,
  Assignment as AssessmentIcon,
  Campaign as AnnouncementIcon,
  Email as EmailIcon,
  GroupAdd as AttendanceIcon,
  TrendingUp as ProgressIcon,
  Menu as MenuIcon,
  People as PeopleIcon,
  Logout as LogoutIcon,
} from "@mui/icons-material";

// Icon mapping for menu items
const ICON_MAP = {
  "/home": <HomeIcon />,
  "/dashboard": <TrainerIcon />,
  "/mock-interview-schedule": <ScheduleIcon />,
  "/internal": <CommunicationIcon />,
  "/final-assessments": <AssessmentIcon />,
  "/soft-skill-announcement": <AnnouncementIcon />,
  "/mail-status": <EmailIcon />,
  "/attendance-mailer": <AttendanceIcon />,
  "/date-change-report": <ProgressIcon />,
  "/users": <PeopleIcon />,
  "/course-progress": <ProgressIcon />,
  "/schedule": <ScheduleIcon />,
  "/matrix": <ScheduleIcon />,
  "/attendance": <PeopleIcon />,
  "/marks-entry": <AssessmentIcon />,
  "/announcement": <AnnouncementIcon />,
};

// Define menus that match the routes in App.js
const MENUS_BY_ROLE = {
  admin: [
    { id: 1, name: "Home", path: "/home" },
    { id: 2, name: "Trainer Dashboard", path: "/dashboard" },
    { id: 3, name: "Mock Interview Schedule", path: "/mock-interview-schedule" },
    { id: 4, name: "Internal Communication", path: "/internal" },
    { id: 5, name: "Final Assessment Schedule", path: "/final-assessments" },
    { id: 6, name: "Soft Skill Announcement", path: "/soft-skill-announcement" },
    { id: 7, name: "Mail Status Check", path: "/mail-status" },
    { id: 8, name: "Attendance Mailer", path: "/attendance-mailer" },
    { id: 9, name: "Course Progress", path: "/course-progress" },
    { id: 10, name: "Report", path: "/reports" },
    { id: 11, name: "User Dashboard", path: "/users" },
    { id: 12, name: "Classroom Planner", path: "/schedule" },
    { id: 13, name: "Classroom Planner", path: "/Matrix" },
    { id: 14, name: "Attendance", path: "/attendance" },
    { id: 15, name: "Mark Entry", path: "/marks-entry" },
    { id: 16, name: "Announcement", path: "/announcement" },
  ],
  manager: [
    { id: 1, name: "Home", path: "/home" },
    { id: 2, name: "Trainer Dashboard", path: "/dashboard" },
    { id: 3, name: "Mock Interview Schedule", path: "/mock-interview-schedule" },
    { id: 4, name: "Internal Communication", path: "/internal" },
    { id: 5, name: "Final Assessment Schedule", path: "/final-assessments" },
    { id: 6, name: "Soft Skill Announcement", path: "/soft-skill-announcement" },
    { id: 7, name: "Mail Status Check", path: "/mail-status" },
    { id: 8, name: "Attendance Mailer", path: "/attendance-mailer" },
    { id: 9, name: "Course Progress", path: "/course-progress" },
    { id: 10, name: "Report", path: "/reports" },
    { id: 11, name: "User Dashboard", path: "/users" },
    { id: 12, name: "Classroom Planner", path: "/schedule" },
    { id: 13, name: "Classroom Planner", path: "/Matrix" },
  ],
  trainer: [
    { id: 1, name: "Trainer Dashboard", path: "/dashboard" },
    { id: 2, name: "Mock Interview Schedule", path: "/mock-interview-schedule" },
    { id: 3, name: "Soft Skill Announcement", path: "/soft-skill-announcement" },
  ],
  coordinator: [
    { id: 1, name: "Home", path: "/home" },
    { id: 2, name: "Internal Communication", path: "/internal" },
    { id: 3, name: "Final Assessment Schedule", path: "/final-assessments" },
    { id: 4, name: "Mail Status Check", path: "/mail-status" },
    { id: 5, name: "Course Progress", path: "/course-progress" },
  ],
};

export default function DashboardLayout({ user, logout, children }) {
  const [menu, setMenu] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    console.log("User object in DashboardLayout:", user);
    if (user && user.role) {
      const menuItems = MENUS_BY_ROLE[user.role] || [];
      setMenu(menuItems);
      console.log("[DashboardLayout] Role:", user.role);
      console.log("[DashboardLayout] menu items loaded:", menuItems);
    } else {
      console.warn("[DashboardLayout] No user or role found");
      setMenu([]);
    }
  }, [user]);

  const handleLogout = () => {
    logout();
  };

  const isActivePath = (path) => location.pathname === path;

  // Inline styles for guaranteed rendering
  const containerStyle = {
    display: "flex",
    height: "100vh",
    backgroundColor: "#749fcaff",
  };

  const sidebarStyle = {
    width: isExpanded ? "270px" : "80px",
    background: "linear-gradient(to bottom, #001d6eff, #323a52ff)",
    color: "white",
    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
    display: "flex",
    flexDirection: "column",
    transition: "width 0.3s ease-in-out",
    position: "relative",
    zIndex: 10,
  };

  const headerStyle = {
    padding: "16px",
    borderBottom: "1px solid rgba(53, 107, 196, 0.3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const navStyle = {
    flex: 1,
    overflowY: "auto",
    paddingTop: "16px",
    paddingBottom: "16px",
  };

  const menuButtonStyle = (isActive) => ({
    width: "100%",
    display: "flex",
    alignItems: "center",
    padding: "12px 16px",
    backgroundColor: isActive ? "#5d87e0ff" : "transparent",
    borderLeft: isActive ? "4px solid #fba524ff" : "4px solid transparent",
    cursor: "pointer",
    transition: "all 0.2s ease-in-out",
    border: "none",
    color: "white",
    fontSize: "14px",
    fontWeight: "500",
  });

  const logoutContainerStyle = {
    padding: "16px",
    borderTop: "1px solid rgba(50, 103, 189, 0.3)",
  };

  const logoutButtonStyle = {
    width: "100%",
    display: "flex",
    alignItems: "center",
    padding: "12px 16px",
    backgroundColor: "rgba(255, 9, 9, 1)",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "all 0.2s ease-in-out",
    border: "none",
    color: "white",
    fontWeight: "500",
  };

  const mainStyle = {
    flex: 1,
    overflowY: "auto",
    background: "radial-gradient(circle at top left, #dbeafe, #f0f9ff)",
  };

  const contentStyle = {
    padding: "24px",
  };

  return (
    <div style={containerStyle}>
      {/* Collapsible Sidebar */}
      <aside
        style={sidebarStyle}
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
      >
        {/* Header */}
        <div style={headerStyle}>
          <MenuIcon style={{ color: "white", fontSize: "32px" }} />
          {isExpanded && (
            <span
              style={{
                marginLeft: "12px",
                fontWeight: "bold",
                fontSize: "18px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                transition: "opacity 0.3s",
              }}
            >
              Engineering Automation
            </span>
          )}
        </div>

        {/* Menu Items */}
        <nav style={navStyle}>
          {menu.length === 0 ? (
            <div
              style={{
                padding: "16px",
                color: "#d1d5db",
                textAlign: "center",
                fontSize: "14px",
              }}
            >
              {isExpanded ? "No menu items" : ""}
            </div>
          ) : (
            menu.map((item) => (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                style={menuButtonStyle(isActivePath(item.path))}
                onMouseEnter={(e) => {
                  if (!isActivePath(item.path)) {
                    e.currentTarget.style.backgroundColor = "#1d4ed8";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActivePath(item.path)) {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }
                }}
                title={!isExpanded ? item.name : ""}
              >
                <span style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
                  {ICON_MAP[item.path] || <HomeIcon />}
                </span>
                {isExpanded && (
                  <span
                    style={{
                      marginLeft: "16px",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      transition: "opacity 0.3s",
                    }}
                  >
                    {item.name}
                  </span>
                )}
              </button>
            ))
          )}
        </nav>

        {/* Logout Button */}
        <div style={logoutContainerStyle}>
          <button
            onClick={handleLogout}
            style={logoutButtonStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "hsla(0, 91%, 78%, 1.00)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#fc0000ff";
            }}
            title={!isExpanded ? "Logout" : ""}
          >
            <LogoutIcon />
            {isExpanded && (
              <span style={{ marginLeft: "16px", transition: "opacity 0.3s" }}>
                Logout
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={mainStyle}>
        <div style={contentStyle}>
          {children}
          <Outlet />
        </div>
      </main>
    </div>
  );
}
