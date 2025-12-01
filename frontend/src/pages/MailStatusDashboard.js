import React, { useState, useEffect } from "react";
import {
  Box,
  Paper,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Alert,
  Fade,
  Divider,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Collapse,
  Chip,
} from "@mui/material";
import {
  Edit as EditIcon,
  Close as CloseIcon,
  Send as SendIcon,
  KeyboardArrowDown as ExpandMoreIcon,
  KeyboardArrowUp as ExpandLessIcon,
} from "@mui/icons-material";

const API_BASE =
  process.env.REACT_APP_API_URL || "https://engg-automation.onrender.com";

export default function MailStatusDashboard({ user }) {
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [rows, setRows] = useState([]);
  const [groupedData, setGroupedData] = useState([]);
  const [message, setMessage] = useState("");

  // Expanded templates tracking
  const [expandedTemplates, setExpandedTemplates] = useState({});

  // Reply to mail states
  const [replyBatch, setReplyBatch] = useState("");
  const [replyMode, setReplyMode] = useState("");
  const [templates, setTemplates] = useState([]);
  const [replyTemplate, setReplyTemplate] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendMessage, setSendMessage] = useState("");

  // Edit email states
  const [editingEmail, setEditingEmail] = useState(null);
  const [editedEmailValue, setEditedEmailValue] = useState("");

  // Email content modal states
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [selectedEmailContent, setSelectedEmailContent] = useState(null);
  const [editedEmailSubject, setEditedEmailSubject] = useState("");
  const [editedEmailBody, setEditedEmailBody] = useState("");
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  // Fetch distinct batches on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/batches`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => setBatches(data || []))
      .catch((err) => {
        console.error("Failed to load batches:", err);
        setBatches([]);
      });
  }, []);

  // Fetch templates filtered by mode for Reply section
  useEffect(() => {
    if (!replyMode) {
      setTemplates([]);
      setReplyTemplate("");
      return;
    }
    fetch(`${API_BASE}/api/templates?mode=${encodeURIComponent(replyMode)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setTemplates(data || []);
        setReplyTemplate("");
      })
      .catch((err) => {
        console.error("Failed to load templates:", err);
        setTemplates([]);
        setReplyTemplate("");
      });
  }, [replyMode]);

  // Fetch mail status table data on filter change
  useEffect(() => {
    if (!selectedBatch.trim() && !recipientEmail.trim()) {
      setRows([]);
      setGroupedData([]);
      setMessage("");
      return;
    }

    const params = new URLSearchParams();
    if (selectedBatch.trim()) params.append("batch_no", selectedBatch.trim());
    if (recipientEmail.trim())
      params.append("recipient_email", recipientEmail.trim());

    fetch(`${API_BASE}/api/mail-dashboard/list?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setRows(data || []);
        if (!data || data.length === 0) {
          setMessage("No mails found.");
          setGroupedData([]);
        } else {
          setMessage("");
          groupDataByTemplate(data);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch mail status data:", err);
        setMessage("Failed to fetch mail status data.");
        setGroupedData([]);
      });
  }, [selectedBatch, recipientEmail]);

  // Group data by template name
  const groupDataByTemplate = (data) => {
    const grouped = {};

    data.forEach((row) => {
      const templateName = row.template_name || "Unknown Template";
      if (!grouped[templateName]) {
        grouped[templateName] = {
          templateName,
          emails: [],
          totalCount: 0,
          sentCount: 0,
          failedCount: 0,
          scheduledCount: 0,
        };
      }

      grouped[templateName].emails.push(row);
      grouped[templateName].totalCount += 1;

      if (row.status === "sent") grouped[templateName].sentCount += 1;
      else if (row.status === "failed") grouped[templateName].failedCount += 1;
      else if (row.status === "scheduled")
        grouped[templateName].scheduledCount += 1;
    });

    setGroupedData(Object.values(grouped));
  };

  // Toggle template expansion
  const toggleTemplate = (templateName) => {
    setExpandedTemplates((prev) => ({
      ...prev,
      [templateName]: !prev[templateName],
    }));
  };

  // Handle email click to enable editing
  const handleEmailClick = (emailId, currentEmail) => {
    setEditingEmail(emailId);
    setEditedEmailValue(currentEmail);
  };

  // Save edited email
  const handleSaveEmail = async (emailId) => {
    if (!editedEmailValue.trim()) {
      alert("Email cannot be empty");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/mail/update-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mail_id: emailId,
          new_email: editedEmailValue.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        const updatedRows = rows.map((row) =>
          row.id === emailId || row.mail_id === emailId
            ? { ...row, recipient_email: editedEmailValue.trim() }
            : row
        );
        setRows(updatedRows);
        groupDataByTemplate(updatedRows);
        setEditingEmail(null);
        setMessage("✅ Email updated successfully");
      } else {
        alert("Failed to update email: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      alert("Error updating email: " + err.message);
    }
  };

  // Handle status click to view/edit email content
  const handleStatusClick = async (row) => {
    if (row.status !== "sent") {
      alert("You can only view/edit sent emails");
      return;
    }

    const mailId = row.id || row.mail_id || row.email_id;

    if (!mailId) {
      alert("Error: Mail ID not found");
      console.error("Row data:", row);
      return;
    }

    try {
      const res = await fetch(
        `${API_BASE}/api/mail/content?mail_id=${encodeURIComponent(mailId)}`
      );
      const data = await res.json();

      if (data.success) {
        setSelectedEmailContent({
          ...data.email,
          id: mailId,
        });
        setEditedEmailSubject(data.email.subject || "");
        setEditedEmailBody(data.email.body || "");
        setEmailModalOpen(true);
        setResendMessage("");
      } else {
        alert(
          "Failed to fetch email content: " + (data.error || "Unknown error")
        );
      }
    } catch (err) {
      alert("Error fetching email: " + err.message);
    }
  };

  // Handle resending edited email
  const handleResendEmail = async () => {
    if (!editedEmailSubject.trim() || !editedEmailBody.trim()) {
      setResendMessage("Subject and body cannot be empty");
      return;
    }

    setResendingEmail(true);
    setResendMessage("");

    try {
      const res = await fetch(`${API_BASE}/api/mail/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mail_id: selectedEmailContent.id,
          recipient_email: selectedEmailContent.recipient_email,
          subject: editedEmailSubject.trim(),
          body: editedEmailBody.trim(),
        }),
      });

      const data = await res.json();
      setResendingEmail(false);

      if (data.success) {
        setResendMessage("✅ Email resent successfully!");
        setTimeout(() => {
          setEmailModalOpen(false);
        }, 2000);
      } else {
        setResendMessage(
          "❌ Failed to resend: " + (data.error || "Unknown error")
        );
      }
    } catch (err) {
      setResendingEmail(false);
      setResendMessage("❌ Error: " + err.message);
    }
  };

  // Handle sending reply emails
  const handleSendEmails = () => {
    setSendMessage("");
    if (!replyBatch) {
      setSendMessage("Please select a batch number.");
      return;
    }
    if (!replyMode) {
      setSendMessage("Please select a mode.");
      return;
    }
    if (!replyTemplate) {
      setSendMessage("Please select a template name.");
      return;
    }
    if (!emailBody.trim()) {
      setSendMessage("Please enter the email body.");
      return;
    }

    setSending(true);
    fetch(`${API_BASE}/api/mail/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        batch_no: replyBatch,
        mode: replyMode,
        template_name: replyTemplate,
        email_body: emailBody.trim(),
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        setSending(false);
        if (data.success) {
          setSendMessage("Emails sent successfully.");
          setEmailBody("");
          setReplyTemplate("");
          setReplyBatch("");
          setReplyMode("");
        } else {
          setSendMessage(data.error || "Failed to send emails.");
        }
      })
      .catch((err) => {
        console.error("Failed to send emails:", err);
        setSending(false);
        setSendMessage("Failed to send emails.");
      });
  };

  const roleTitle = user?.role
    ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
    : "Dashboard";
  const welcomeName = user?.name || "User";

  return (
    <Box maxWidth={1100} mx="auto" my={3}>
      <Paper elevation={5} sx={{ p: 4, mb: 4, borderRadius: 3 }}>
        <Typography variant="h4" color="primary" gutterBottom>
          {roleTitle} Dashboard
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" mb={2}>
          Welcome, {welcomeName}!
        </Typography>

        {/* Mail Status Section */}
        <Typography variant="h6" color="primary" gutterBottom>
          📊 Sent Mail Status Dashboard
        </Typography>
        <Divider sx={{ mb: 2 }} light />

        <Box display="flex" gap={2} alignItems="center" mb={3} flexWrap="wrap">
          <FormControl sx={{ minWidth: 220 }}>
            <InputLabel>Batch No</InputLabel>
            <Select
              value={selectedBatch}
              label="Batch No"
              onChange={(e) => setSelectedBatch(e.target.value)}
              displayEmpty
            >
              <MenuItem value=""></MenuItem>
              {batches.map((batch) => (
                <MenuItem key={batch.batch_no} value={batch.batch_no}>
                  {batch.batch_no}{" "}
                  {batch.start_date ? `(${batch.start_date})` : ""}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Recipient Email"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            sx={{ width: 300, minWidth: 220 }}
            placeholder="Filter by recipient email"
          />
        </Box>

        {/* Grouped Table */}
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: "#f5f5f5" }}>
              <TableCell width="40px"></TableCell>
              <TableCell>
                <strong>Template Name</strong>
              </TableCell>
              <TableCell align="center">
                <strong>Total</strong>
              </TableCell>
              <TableCell align="center">
                <strong>Sent</strong>
              </TableCell>
              <TableCell align="center">
                <strong>Failed</strong>
              </TableCell>
              <TableCell align="center">
                <strong>Scheduled</strong>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {groupedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  No mails found. Please select batch or enter recipient email.
                </TableCell>
              </TableRow>
            ) : (
              groupedData.map((group) => (
                <React.Fragment key={group.templateName}>
                  {/* Template Summary Row */}
                  <TableRow
                    sx={{
                      bgcolor: "#fafafa",
                      cursor: "pointer",
                      "&:hover": { bgcolor: "#f0f0f0" },
                    }}
                    onClick={() => toggleTemplate(group.templateName)}
                  >
                    <TableCell>
                      <IconButton size="small">
                        {expandedTemplates[group.templateName] ? (
                          <ExpandLessIcon />
                        ) : (
                          <ExpandMoreIcon />
                        )}
                      </IconButton>
                    </TableCell>
                    <TableCell>
                      <strong>{group.templateName}</strong>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={group.totalCount}
                        size="small"
                        color="default"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={group.sentCount}
                        size="small"
                        color="success"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={group.failedCount}
                        size="small"
                        color="error"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={group.scheduledCount}
                        size="small"
                        color="warning"
                      />
                    </TableCell>
                  </TableRow>

                  {/* Expanded Email Details */}
                  <TableRow>
                    <TableCell colSpan={6} sx={{ p: 0, border: 0 }}>
                      <Collapse
                        in={expandedTemplates[group.templateName]}
                        timeout="auto"
                        unmountOnExit
                      >
                        <Box sx={{ bgcolor: "#f9f9f9", p: 2 }}>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Batch No</TableCell>
                                <TableCell>Recipient Email</TableCell>
                                <TableCell>Status</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {group.emails.map((email, idx) => {
                                const emailId =
                                  email.id || email.mail_id || email.email_id;
                                const isEditing = editingEmail === emailId;

                                let statusColor = "inherit";
                                if (email.status === "sent")
                                  statusColor = "#11b511";
                                else if (email.status === "failed")
                                  statusColor = "#df1c1c";
                                else if (email.status === "scheduled")
                                  statusColor = "#ffab40";

                                return (
                                  <TableRow key={idx}>
                                    <TableCell>{email.batch_no}</TableCell>
                                    <TableCell>
                                      {isEditing ? (
                                        <Box
                                          display="flex"
                                          gap={1}
                                          alignItems="center"
                                        >
                                          <TextField
                                            size="small"
                                            value={editedEmailValue}
                                            onChange={(e) =>
                                              setEditedEmailValue(
                                                e.target.value
                                              )
                                            }
                                            fullWidth
                                          />
                                          <Button
                                            size="small"
                                            variant="contained"
                                            onClick={() =>
                                              handleSaveEmail(emailId)
                                            }
                                          >
                                            Save
                                          </Button>
                                          <Button
                                            size="small"
                                            onClick={() =>
                                              setEditingEmail(null)
                                            }
                                          >
                                            Cancel
                                          </Button>
                                        </Box>
                                      ) : (
                                        <Box
                                          onClick={() =>
                                            handleEmailClick(
                                              emailId,
                                              email.recipient_email
                                            )
                                          }
                                          sx={{
                                            cursor: "pointer",
                                            color: "#1976d2",
                                            textDecoration: "underline",
                                            "&:hover": { color: "#1565c0" },
                                          }}
                                          title="Click to edit email"
                                        >
                                          {email.recipient_email}
                                        </Box>
                                      )}
                                    </TableCell>
                                    <TableCell
                                      onClick={() => handleStatusClick(email)}
                                      sx={{
                                        color: statusColor,
                                        fontWeight: "bold",
                                        bgcolor:
                                          email.status === "sent"
                                            ? "#e4fbe3"
                                            : email.status === "failed"
                                            ? "#fde4e4"
                                            : email.status === "scheduled"
                                            ? "#ffe9cc"
                                            : undefined,
                                        cursor:
                                          email.status === "sent"
                                            ? "pointer"
                                            : "default",
                                        textDecoration:
                                          email.status === "sent"
                                            ? "underline"
                                            : "none",
                                        "&:hover":
                                          email.status === "sent"
                                            ? { opacity: 0.8 }
                                            : {},
                                      }}
                                      title={
                                        email.status === "sent"
                                          ? "Click to view/edit email"
                                          : ""
                                      }
                                    >
                                      {email.status}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              ))
            )}
          </TableBody>
        </Table>

        <Fade in={!!message}>
          <Box mt={2}>
            {message && (
              <Alert
                severity={
                  groupedData.length === 0
                    ? "warning"
                    : message.startsWith("✅")
                    ? "success"
                    : "info"
                }
                variant="outlined"
              >
                {message}
              </Alert>
            )}
          </Box>
        </Fade>
      </Paper>

      {/* Email Content Modal */}
      <Dialog
        open={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="h6">📧 View/Edit Email</Typography>
            <IconButton onClick={() => setEmailModalOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Box mb={2}>
            <Typography variant="body2" color="text.secondary">
              <strong>To:</strong> {selectedEmailContent?.recipient_email}
            </Typography>
          </Box>
          <TextField
            label="Subject"
            fullWidth
            value={editedEmailSubject}
            onChange={(e) => setEditedEmailSubject(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            label="Email Body"
            fullWidth
            multiline
            rows={10}
            value={editedEmailBody}
            onChange={(e) => setEditedEmailBody(e.target.value)}
          />
          {resendMessage && (
            <Alert
              severity={
                resendMessage.startsWith("✅") ? "success" : "error"
              }
              sx={{ mt: 2 }}
            >
              {resendMessage}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmailModalOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleResendEmail}
            disabled={resendingEmail}
            startIcon={<SendIcon />}
          >
            {resendingEmail ? "Sending..." : "Resend Email"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reply to Mail Section */}
      <Paper elevation={5} sx={{ p: 4, borderRadius: 3 }}>
        <Typography variant="h6" color="primary" gutterBottom>
          ✉️ Reply to Mail
        </Typography>
        <Divider sx={{ mb: 2 }} light />
        <Box
          display="flex"
          gap={2}
          flexWrap="wrap"
          mb={3}
          alignItems="center"
        >
          <FormControl sx={{ minWidth: 220 }}>
            <InputLabel>Batch No</InputLabel>
            <Select
              value={replyBatch}
              label="Batch No"
              onChange={(e) => setReplyBatch(e.target.value)}
              displayEmpty
            >
              <MenuItem value=""></MenuItem>
              {batches.map((batch) => (
                <MenuItem key={batch.batch_no} value={batch.batch_no}>
                  {batch.batch_no}{" "}
                  {batch.start_date ? `(${batch.start_date})` : ""}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 120 }}>
            <InputLabel>Mode</InputLabel>
            <Select
              value={replyMode}
              label="Mode"
              onChange={(e) => setReplyMode(e.target.value)}
              displayEmpty
            >
              <MenuItem value=""></MenuItem>
              <MenuItem value="Online">Online</MenuItem>
              <MenuItem value="Offline">Offline</MenuItem>
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 220 }}>
            <InputLabel>Template Name</InputLabel>
            <Select
              value={replyTemplate}
              label="Template Name"
              onChange={(e) => setReplyTemplate(e.target.value)}
              displayEmpty
              disabled={!replyMode || templates.length === 0}
            >
              <MenuItem value=""></MenuItem>
              {templates.map((t) => (
                <MenuItem key={t.template_name} value={t.template_name}>
                  {t.template_name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <TextField
          label="Email Body"
          multiline
          rows={5}
          fullWidth
          value={emailBody}
          onChange={(e) => setEmailBody(e.target.value)}
          placeholder="Enter email body here"
          sx={{ mb: 2 }}
        />

        <Button
          variant="contained"
          color="primary"
          onClick={handleSendEmails}
          disabled={sending}
          sx={{ py: 1.5, fontWeight: "bold", fontSize: "1rem", boxShadow: 4 }}
        >
          {sending ? "Sending..." : "Send Emails"}
        </Button>

        {sendMessage && (
          <Box mt={2}>
            <Alert
              severity={
                sendMessage.includes("successfully") ? "success" : "error"
              }
              variant="outlined"
            >
              {sendMessage}
            </Alert>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
