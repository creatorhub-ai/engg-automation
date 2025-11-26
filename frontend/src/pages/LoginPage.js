import React, { useState } from "react";
import {
  Box,
  TextField,
  Button,
  Paper,
  Typography,
  InputAdornment,
  IconButton,
  Fade,
  Grow,
  Collapse,
  Alert,
} from "@mui/material";
import {
  Email as EmailIcon,
  Lock as LockIcon,
  Visibility,
  VisibilityOff,
  Login as LoginIcon,
  RestartAlt as ResetIcon,
} from "@mui/icons-material";

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Reset password related states
  const [resetMode, setResetMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Email and password required");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      setLoading(false);
      if (!data || !data.success) {
        setError(data?.error || "Login failed");
        return;
      }
      const userSession = {
        role: data.role,
        name: data.name,
        email: data.email,
        loginTime: Date.now(),
      };
      localStorage.setItem("userSession", JSON.stringify(userSession));
      onLogin(userSession);
    } catch (err) {
      console.error("Login error", err);
      setLoading(false);
      setError("Network error");
    }
  }

  async function handleResetSubmit(e) {
    e.preventDefault();
    setResetError("");
    if (!email) {
      setResetError("Enter your email to reset password");
      return;
    }
    if (!newPassword) {
      setResetError("New password is required");
      return;
    }
    if (!confirmNewPassword) {
      setResetError("Please confirm your new password");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setResetError("Passwords do not match");
      return;
    }
    setResetLoading(true);
    try {
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, new_password: newPassword }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Reset failed");
      }
      setResetSuccess(true);
      setTimeout(() => {
        localStorage.removeItem("userSession");
        window.location.reload();
      }, 3000);
    } catch (err) {
      console.error("Reset password error", err);
      setResetError(err.message || "Reset failed");
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Animated Background Elements */}
      <Box
        sx={{
          position: "absolute",
          width: "500px",
          height: "500px",
          borderRadius: "50%",
          background: "rgba(255, 255, 255, 0.1)",
          top: "-250px",
          left: "-250px",
          animation: "float 6s ease-in-out infinite",
          "@keyframes float": {
            "0%, 100%": { transform: "translateY(0px)" },
            "50%": { transform: "translateY(20px)" },
          },
        }}
      />
      <Box
        sx={{
          position: "absolute",
          width: "400px",
          height: "400px",
          borderRadius: "50%",
          background: "rgba(255, 255, 255, 0.1)",
          bottom: "-200px",
          right: "-200px",
          animation: "float 8s ease-in-out infinite",
        }}
      />

      {/* Login Card */}
      <Grow in={true} timeout={800}>
        <Paper
          elevation={24}
          sx={{
            width: { xs: "90%", sm: 450 },
            p: 5,
            borderRadius: 4,
            background: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(10px)",
            boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.37)",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* Logo/Title Section */}
          <Box sx={{ textAlign: "center", mb: 4 }}>
            <Box
              sx={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
                boxShadow: "0 4px 20px rgba(102, 126, 234, 0.4)",
              }}
            >
              <LoginIcon sx={{ fontSize: 40, color: "white" }} />
            </Box>
            <Typography
              variant="h4"
              fontWeight="bold"
              sx={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                mb: 1,
              }}
            >
              Welcome Back
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {resetMode ? "Reset your password below" : "Sign in to access your dashboard"}
            </Typography>
          </Box>
          {resetSuccess && (
            <Collapse in={resetSuccess}>
              <Alert severity="success" sx={{ mb: 2 }}>
                Password reset successful! Logging out...
              </Alert>
            </Collapse>
          )}

          {!resetSuccess && (
            <form onSubmit={resetMode ? handleResetSubmit : handleSubmit}>
              <TextField
                label="Email Address"
                fullWidth
                margin="normal"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailIcon sx={{ color: "#667eea" }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  mb: 2,
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 2,
                    "&:hover fieldset": {
                      borderColor: "#667eea",
                    },
                    "&.Mui-focused fieldset": {
                      borderColor: "#667eea",
                    },
                  },
                  "& .MuiInputLabel-root.Mui-focused": {
                    color: "#667eea",
                  },
                }}
                disabled={loading || resetLoading}
                required
                type="email"
              />
              {/* --- Password input for sign-in mode --- */}
              {!resetMode && (
                <TextField
                  label="Password"
                  fullWidth
                  margin="normal"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockIcon sx={{ color: "#667eea" }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    mb: 2,
                    "& .MuiOutlinedInput-root": {
                      borderRadius: 2,
                      "&:hover fieldset": {
                        borderColor: "#667eea",
                      },
                      "&.Mui-focused fieldset": {
                        borderColor: "#667eea",
                      },
                    },
                    "& .MuiInputLabel-root.Mui-focused": {
                      color: "#667eea",
                    },
                  }}
                  disabled={loading || resetLoading}
                  required
                />
              )}
              {/* --- Passwords input for reset mode --- */}
              {resetMode && (
                <>
                  <TextField
                    label="New Password"
                    fullWidth
                    margin="normal"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockIcon sx={{ color: "#667eea" }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            edge="end"
                            disabled={loading || resetLoading}
                          >
                            {showNewPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      mb: 2,
                      "& .MuiOutlinedInput-root": {
                        borderRadius: 2,
                        "&:hover fieldset": {
                          borderColor: "#667eea",
                        },
                        "&.Mui-focused fieldset": {
                          borderColor: "#667eea",
                        },
                      },
                      "& .MuiInputLabel-root.Mui-focused": {
                        color: "#667eea",
                      },
                    }}
                    required
                  />
                  <TextField
                    label="Confirm New Password"
                    fullWidth
                    margin="normal"
                    type={showConfirmNewPassword ? "text" : "password"}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockIcon sx={{ color: "#667eea" }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() =>
                              setShowConfirmNewPassword(!showConfirmNewPassword)
                            }
                            edge="end"
                            disabled={loading || resetLoading}
                          >
                            {showConfirmNewPassword ? (
                              <VisibilityOff />
                            ) : (
                              <Visibility />
                            )}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      mb: 2,
                      "& .MuiOutlinedInput-root": {
                        borderRadius: 2,
                        "&:hover fieldset": {
                          borderColor: "#667eea",
                        },
                        "&.Mui-focused fieldset": {
                          borderColor: "#667eea",
                        },
                      },
                      "& .MuiInputLabel-root.Mui-focused": {
                        color: "#667eea",
                      },
                    }}
                    required
                  />
                </>
              )}
              <Fade in={!!(error || resetError)}>
                <Box
                  sx={{
                    mt: 2,
                    p: 2,
                    borderRadius: 2,
                    background: "rgba(244, 67, 54, 0.1)",
                    border: "1px solid rgba(244, 67, 54, 0.3)",
                  }}
                >
                  <Typography color="error" variant="body2" textAlign="center">
                    {resetMode ? resetError : error}
                  </Typography>
                </Box>
              </Fade>
              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={loading || resetLoading}
                sx={{
                  mt: 3,
                  py: 1.5,
                  borderRadius: 2,
                  fontSize: 16,
                  fontWeight: "bold",
                  textTransform: "none",
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  boxShadow: "0 4px 15px rgba(102, 126, 234, 0.4)",
                  "&:hover": {
                    background: "linear-gradient(135deg, #764ba2 0%, #667eea 100%)",
                    boxShadow: "0 6px 20px rgba(102, 126, 234, 0.6)",
                    transform: "translateY(-2px)",
                  },
                  "&:disabled": {
                    background: "linear-gradient(135deg, #ccc 0%, #999 100%)",
                  },
                  transition: "all 0.3s ease",
                }}
              >
                {(loading || resetLoading) ? (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box
                      sx={{
                        width: 20,
                        height: 20,
                        border: "3px solid rgba(255,255,255,0.3)",
                        borderTop: "3px solid white",
                        borderRadius: "50%",
                        animation: "spin 1s linear infinite",
                        "@keyframes spin": {
                          "0%": { transform: "rotate(0deg)" },
                          "100%": { transform: "rotate(360deg)" },
                        },
                      }}
                    />
                    {resetMode ? "Resetting..." : "Signing in..."}
                  </Box>
                ) : resetMode ? (
                  "Reset Password"
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          )}
          {!resetSuccess && (
            <Box sx={{ mt: 2, textAlign: "center" }}>
              <Button
                variant="text"
                color="primary"
                onClick={() => {
                  setResetError("");
                  setError("");
                  setResetSuccess(false);
                  setResetMode(!resetMode);
                  setNewPassword("");
                  setConfirmNewPassword("");
                }}
                sx={{ textTransform: "none" }}
                startIcon={<ResetIcon />}
              >
                {resetMode ? "Back to Sign In" : "Forgot password? Reset here"}
              </Button>
            </Box>
          )}
          <Box sx={{ textAlign: "center", mt: 3 }}>
            <Typography variant="caption" color="text.secondary">
              Automation Platform for Delivery Operations
            </Typography>
          </Box>
        </Paper>
      </Grow>
    </Box>
  );
}
