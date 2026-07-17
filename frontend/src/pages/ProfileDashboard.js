// frontend/src/pages/ProfileDashboard.js
// Shows the login details of the currently logged-in user.
import React from "react";
import {
  Box,
  Card,
  CardContent,
  Avatar,
  Typography,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import {
  Person as PersonIcon,
  Email as EmailIcon,
  Badge as BadgeIcon,
  AccessTime as TimeIcon,
} from "@mui/icons-material";

function formatLoginTime(loginTime) {
  if (!loginTime) return "—";
  try {
    return new Date(loginTime).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return String(loginTime);
  }
}

export default function ProfileDashboard({ user }) {
  const displayName =
    user?.name || (user?.email ? user.email.split("@")[0] : "User");
  const roleLabel = user?.role
    ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
    : "—";
  const initials =
    (displayName || "U")
      .split(/[\s._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => (p[0] || "").toUpperCase())
      .join("") || "U";

  const rows = [
    { icon: <PersonIcon />, label: "Full Name", value: displayName },
    { icon: <EmailIcon />, label: "Email", value: user?.email || "—" },
    { icon: <BadgeIcon />, label: "Role", value: roleLabel },
    {
      icon: <TimeIcon />,
      label: "Logged in at",
      value: formatLoginTime(user?.loginTime),
    },
  ];

  return (
    <Box sx={{ maxWidth: 640, mx: "auto", py: 2 }}>
      <Typography
        variant="h4"
        sx={{ fontWeight: 800, mb: 2, color: "#0a3e74" }}
      >
        My Profile
      </Typography>

      <Card
        elevation={3}
        sx={{ borderRadius: 3, overflow: "hidden", width: "100%" }}
      >
        {/* Header banner */}
        <Box
          sx={{
            background:
              "linear-gradient(160deg, #075399 0%, #0a3e74 55%, #0f2747 100%)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            gap: 2,
            p: 3,
            flexWrap: "wrap",
          }}
        >
          <Avatar
            sx={{
              width: 72,
              height: 72,
              fontSize: 26,
              fontWeight: 700,
              bgcolor: "#fc5b32",
              boxShadow: "0 6px 16px rgba(252,91,50,0.5)",
            }}
          >
            {initials}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              {displayName}
            </Typography>
            <Chip
              label={roleLabel}
              size="small"
              sx={{
                mt: 1,
                color: "#bfd3ff",
                bgcolor: "rgba(9,109,202,0.35)",
                border: "1px solid rgba(191,211,255,0.4)",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            />
          </Box>
        </Box>

        <CardContent sx={{ p: 0 }}>
          <List disablePadding>
            {rows.map((row, i) => (
              <React.Fragment key={row.label}>
                <ListItem sx={{ py: 1.5, px: 3 }}>
                  <ListItemIcon sx={{ minWidth: 44, color: "#075399" }}>
                    {row.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={row.label}
                    secondary={row.value}
                    primaryTypographyProps={{
                      variant: "caption",
                      sx: {
                        color: "#64748b",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        fontWeight: 700,
                      },
                    }}
                    secondaryTypographyProps={{
                      sx: {
                        color: "#0f172a",
                        fontSize: "1rem",
                        fontWeight: 600,
                        wordBreak: "break-word",
                      },
                    }}
                  />
                </ListItem>
                {i < rows.length - 1 && <Divider component="li" />}
              </React.Fragment>
            ))}
          </List>
        </CardContent>
      </Card>
    </Box>
  );
}
