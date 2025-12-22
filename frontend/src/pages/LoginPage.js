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
} from "@mui/icons-material";

export default function LoginPage({ onLogin }) {
  const BACKEND_URL = "https://engg-automation.onrender.com"; // ✅ FIXED

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Reset Password state
  const [resetMode, setResetMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  // ======================================================
  // LOGIN SUBMIT
  // ======================================================
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Email and password required");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${BACKEND_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      // Avoid JSON parse crash
      let data = {};
      try {
        data = await res.json();
      } catch (err) {
        setError("Invalid server response");
        setLoading(false);
        return;
      }

      setLoading(false);

      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }

      if (!data.success || !data.user) {
        setError("Invalid login details");
        return;
      }

      // Final correct session format
      const userSession = {
        id: data.user.id,
        role: data.user.role,
        name: data.user.name,
        email: data.user.email,
        token: data.token,
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

  // ======================================================
  // RESET PASSWORD SUBMIT
  // ======================================================
  async function handleResetSubmit(e) {
    e.preventDefault();
    setResetError("");

    if (!email) return setResetError("Enter your email");
    if (!newPassword) return setResetError("Enter new password");
    if (!confirmNewPassword) return setResetError("Confirm new password");
    if (newPassword !== confirmNewPassword)
      return setResetError("Passwords do not match");

    setResetLoading(true);

    try {
      const res = await fetch(`${BACKEND_URL}/api/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, new_password: newPassword }),
      });

      let data = {};
      try {
        data = await res.json();
      } catch (err) {
        setResetError("Invalid server response");
        setResetLoading(false);
        return;
      }

      if (!res.ok) {
        setResetError(data.error || "Reset failed");
        setResetLoading(false);
        return;
      }

      setResetSuccess(true);

      setTimeout(() => {
        localStorage.removeItem("userSession");
        window.location.reload();
      }, 2500);

    } catch (err) {
      setResetError("Network error");
    } finally {
      setResetLoading(false);
    }
  }

  // ======================================================
  // UI
  // ======================================================
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      }}
    >
      <Grow in={true} timeout={800}>
        <Paper
          elevation={24}
          sx={{
            width: { xs: "90%", sm: 450 },
            p: 5,
            borderRadius: 4,
            background: "rgba(255,255,255,0.95)",
          }}
        >
          <Box sx={{ textAlign: "center", mb: 4 }}>
            <Typography variant="h4" fontWeight="bold">
              {resetMode ? "Reset Password" : "Welcome Back"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {resetMode
                ? "Reset your password below"
                : "Sign in to access your dashboard"}
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
              {/* Email */}
              <TextField
                label="Email Address"
                fullWidth
                margin="normal"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailIcon />
                    </InputAdornment>
                  ),
                }}
                required
              />

              {/* Password */}
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
                        <LockIcon />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  required
                />
              )}

              {/* Reset Mode Fields */}
              {resetMode && (
                <>
                  <TextField
                    label="New Password"
                    fullWidth
                    margin="normal"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />

                  <TextField
                    label="Confirm New Password"
                    fullWidth
                    margin="normal"
                    type={showConfirmNewPassword ? "text" : "password"}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    required
                  />
                </>
              )}

              {/* Error Box */}
              {(error || resetError) && (
                <Fade in={true}>
                  <Box sx={{ mt: 2 }}>
                    <Typography
                      color="error"
                      variant="body2"
                      textAlign="center"
                    >
                      {resetMode ? resetError : error}
                    </Typography>
                  </Box>
                </Fade>
              )}

              <Button
                type="submit"
                fullWidth
                variant="contained"
                sx={{ mt: 3, py: 1.3 }}
                disabled={loading || resetLoading}
              >
                {resetMode
                  ? resetLoading
                    ? "Resetting..."
                    : "Reset Password"
                  : loading
                  ? "Signing in..."
                  : "Login"}
              </Button>

              {/* Toggle reset mode */}
              <Button
                fullWidth
                sx={{ mt: 2 }}
                onClick={() => {
                  setResetMode(!resetMode);
                  setError("");
                  setResetError("");
                }}
              >
                {resetMode ? "Back to Login" : "Forgot Password?"}
              </Button>
            </form>
          )}
        </Paper>
      </Grow>
    </Box>
  );
}
