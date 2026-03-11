import React, { useState } from "react";
import { Box, Typography, Button, CircularProgress } from "@mui/material";
import {
  UploadFile    as UploadFileIcon,
  Send          as SendIcon,
  CheckCircle   as CheckCircleIcon,
  Error         as ErrorIcon,
} from "@mui/icons-material";

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
  success:     { fill: "#10b981", light: "#d1fae5", text: "#065f46" },
  error:       { fill: "#ef4444", light: "#fee2e2", text: "#991b1b" },
  warning:     { fill: "#f59e0b", light: "#fef3c7", text: "#92400e" },
};

const cardSx = {
  background:   TOKENS.surface,
  border:       `1px solid ${TOKENS.border}`,
  borderRadius: "16px",
  boxShadow:    "0 2px 12px rgba(0,0,0,0.06)",
  overflow:     "hidden",
};

const labelSx = {
  fontFamily:    "'DM Sans', sans-serif",
  fontSize:      11,
  fontWeight:    700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color:         TOKENS.textSub,
};

export default function AttendanceMailer() {
  const [file,    setFile]    = useState(null);
  const [msg,     setMsg]     = useState("");
  const [loading, setLoading] = useState(false);

  const handleFileChange = e => setFile(e.target.files[0] || null);

  async function handleSend() {
    if (!file) { setMsg("⚠️ Please select a file."); return; }
    setLoading(true);
    setMsg("Sending emails, please wait…");
    const formData = new FormData();
    formData.append("file", file);
    const res  = await fetch("/api/send-attendance-emails", { method: "POST", body: formData });
    const data = await res.json();
    setLoading(false);
    setMsg(data.success
      ? "✅ Emails sent to students with absent days!"
      : `❌ Error: ${data.error || "Unknown error"}`);
  }

  const isSuccess = msg.startsWith("✅");
  const isError   = msg.startsWith("❌");
  const isInfo    = msg.startsWith("Sending") || msg.startsWith("⚠️");

  return (
    <Box sx={{ minHeight: "100vh", background: TOKENS.bg, p: { xs: 2, md: 4 }, fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');`}</style>

      <Box sx={{ width: "100%", maxWidth: 480 }}>
        {/* Header */}
        <Box sx={{ mb: 4, textAlign: "center" }}>
          <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 28, fontWeight: 800, color: TOKENS.text, letterSpacing: "-0.03em", mb: 0.5 }}>
            Attendance Mailer
          </Typography>
          <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: TOKENS.textSub }}>
            Upload an Excel file to send absence alerts to learners
          </Typography>
        </Box>

        <Box sx={cardSx}>
          {/* Card header */}
          <Box sx={{ px: 3, py: 2.5, background: `linear-gradient(135deg, ${TOKENS.accent}0d 0%, ${TOKENS.accentLight} 100%)`, borderBottom: `1px solid ${TOKENS.border}`, display: "flex", alignItems: "center", gap: 1.5 }}>
            <SendIcon sx={{ fontSize: 20, color: TOKENS.accent }} />
            <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 800, color: TOKENS.text }}>
              Send Attendance Emails
            </Typography>
          </Box>

          <Box sx={{ p: 3 }}>
            {/* Upload area */}
            <Box sx={{ mb: 3 }}>
              <Typography sx={{ ...labelSx, mb: 1.5 }}>Attendance File (.xlsx)</Typography>
              <Box sx={{ border: `2px dashed ${file ? TOKENS.accent : TOKENS.border}`, borderRadius: "12px", p: 3, textAlign: "center", background: file ? TOKENS.accentLight : TOKENS.surfaceAlt, transition: "all 0.2s", cursor: "pointer", position: "relative" }}
                onClick={() => document.getElementById("attendance-file-input").click()}>
                <input id="attendance-file-input" type="file" accept=".xlsx" onChange={handleFileChange} style={{ display: "none" }} />
                <UploadFileIcon sx={{ fontSize: 32, color: file ? TOKENS.accent : TOKENS.textSub, mb: 1 }} />
                {file ? (
                  <>
                    <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700, color: TOKENS.accent }}>{file.name}</Typography>
                    <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: TOKENS.textSub, mt: 0.3 }}>
                      {(file.size / 1024).toFixed(1)} KB · Click to change
                    </Typography>
                  </>
                ) : (
                  <>
                    <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: TOKENS.textSub }}>Click to upload</Typography>
                    <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: TOKENS.textSub, mt: 0.3 }}>Supports .xlsx files</Typography>
                  </>
                )}
              </Box>
            </Box>

            {/* Send button */}
            <Button variant="contained" fullWidth onClick={handleSend} disabled={loading}
              startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <SendIcon sx={{ fontSize: 16 }} />}
              sx={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 14, textTransform: "none", borderRadius: "10px", py: 1.4, background: TOKENS.accent, "&:hover": { background: "#2a3fd4" }, "&:disabled": { opacity: 0.5 } }}>
              {loading ? "Sending…" : "Send Emails"}
            </Button>

            {/* Message */}
            {msg && (
              <Box sx={{ mt: 2.5, px: 2.5, py: 1.5, borderRadius: "10px",
                background: isSuccess ? TOKENS.success.light : isError ? TOKENS.error.light : TOKENS.warning.light,
                border: `1px solid ${isSuccess ? TOKENS.success.fill : isError ? TOKENS.error.fill : TOKENS.warning.fill}44`,
                display: "flex", alignItems: "center", gap: 1 }}>
                {isSuccess
                  ? <CheckCircleIcon sx={{ fontSize: 15, color: TOKENS.success.fill, flexShrink: 0 }} />
                  : isError
                  ? <ErrorIcon sx={{ fontSize: 15, color: TOKENS.error.fill, flexShrink: 0 }} />
                  : null}
                <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600,
                  color: isSuccess ? TOKENS.success.text : isError ? TOKENS.error.text : TOKENS.warning.text }}>{msg}</Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}