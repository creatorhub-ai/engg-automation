import React, { useState, useEffect } from "react";

function InternalCommunication() {
  const [roles, setRoles] = useState([]);
  const [domain, setDomain] = useState("");
  const [batchNo, setBatchNo] = useState("");
  const [batches, setBatches] = useState([]);
  const [batchStartDate, setBatchStartDate] = useState("");
  const [message, setMessage] = useState("");

  // Feedback sharing states
  const [feedbackBatchNo, setFeedbackBatchNo] = useState("");
  const [feedbackRoles, setFeedbackRoles] = useState([]);
  const [feedbackType, setFeedbackType] = useState("");
  const [feedbackFile, setFeedbackFile] = useState(null);
  const [coursePlannerBatches, setCoursePlannerBatches] = useState([]);

  // Fetch batches on load (for Internal Communication section)
  useEffect(() => {
    fetch("http://localhost:5000/api/batches")
      .then((res) => res.json())
      .then((data) => {
        if (data) setBatches(data);
      })
      .catch((err) => console.error("Failed to load batches:", err));
  }, []);

  // Fetch distinct batch_no from course_planner_data for feedback sharing
  useEffect(() => {
    fetch("http://localhost:5000/api/course-planner/batches")
      .then((res) => res.json())
      .then((data) => setCoursePlannerBatches(data))
      .catch((err) => console.error("Error fetching feedback batches:", err));
  }, []);

  const handleRoleChange = (e) => {
    const { value, checked } = e.target;
    setRoles((prev) =>
      checked ? [...prev, value] : prev.filter((r) => r !== value)
    );
  };

  const handleBatchChange = (e) => {
    const selected = e.target.value;
    setBatchNo(selected);

    // Find start date from selected batch
    const batchObj = batches.find((b) => b.batch_no === selected);
    if (batchObj) {
      setBatchStartDate(batchObj.start_date);
    } else {
      setBatchStartDate("");
    }
  };

  const handleSchedule = async () => {
    if (roles.length === 0) {
      setMessage("⚠️ Please select at least one role");
      return;
    }
    if (!batchNo) {
      setMessage("⚠️ Please select a Batch No");
      return;
    }

    const body = {
      role: roles.length === 1 ? roles[0] : roles,
      batchNo,
      startDate: batchStartDate,
    };

    if (roles.includes("Trainer")) {
      body.domain = domain;
    }

    try {
      const res = await fetch("http://localhost:5000/api/internal/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const result = await res.json();
      if (res.ok) {
        setMessage(result.message || "✅ Scheduled successfully");
      } else {
        setMessage("❌ Failed to schedule: " + (result.error || "Unknown error"));
      }
    } catch (err) {
      setMessage("❌ Failed to schedule: " + err.message);
    }
  };

  // Feedback Sharing handlers
  const handleFeedbackRoleChange = (e) => {
    const { value, checked } = e.target;
    setFeedbackRoles((prev) =>
      checked ? [...prev, value] : prev.filter((r) => r !== value)
    );
  };
  const handleFeedbackFile = (e) => setFeedbackFile(e.target.files[0]);

  const handleSendFeedbackEmail = async () => {
    if (!feedbackBatchNo || feedbackRoles.length === 0 || !feedbackType || !feedbackFile) {
      setMessage("⚠️ Please fill all feedback sharing fields and upload a file.");
      return;
    }

    const formData = new FormData();
    formData.append("batchNo", feedbackBatchNo);
    formData.append("roles", JSON.stringify(feedbackRoles));
    formData.append("feedbackType", feedbackType);
    formData.append("file", feedbackFile);

    try {
      const res = await fetch("http://localhost:5000/api/internal/feedback-share", {
        method: "POST",
        body: formData,
      });
      const result = await res.json();
      setMessage(res.ok ? "✅ Feedback mail sent!" : "❌ " + result.error);
    } catch (err) {
      setMessage("❌ Error: " + err.message);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>📩 Internal Communication</h2>

      <div>
        <label><strong>User Role:</strong></label><br />
        {["IT Admin", "Learning Coordinator", "Trainer", "Management"].map((role) => (
          <label key={role} style={{ marginRight: "15px" }}>
            <input
              type="checkbox"
              value={role}
              checked={roles.includes(role)}
              onChange={handleRoleChange}
            />{" "}
            {role}
          </label>
        ))}
      </div>

      {roles.includes("Trainer") && (
        <div style={{ marginTop: "15px" }}>
          <label><strong>Domain:</strong></label><br />
          <select value={domain} onChange={(e) => setDomain(e.target.value)}>
            <option value="">--select--</option>
            <option value="PD">PD</option>
            <option value="DV">DV</option>
            <option value="DFT">DFT</option>
          </select>
        </div>
      )}

      <div style={{ marginTop: "15px" }}>
        <label><strong>Batch No:</strong></label><br />
        <select value={batchNo} onChange={handleBatchChange}>
          <option value="">--select--</option>
          {batches.map((b) => (
            <option key={b.batch_no} value={b.batch_no}>
              {b.batch_no} (Start: {b.start_date})
            </option>
          ))}
        </select>
      </div>

      {batchStartDate && (
        <p style={{ marginTop: "10px" }}>
          📅 <strong>Start Date:</strong> {batchStartDate}
        </p>
      )}

      <div style={{ marginTop: "20px" }}>
        <button onClick={handleSchedule}>📤 Schedule Emails</button>
      </div>

      {/* Feedback Sharing Section */}
      <div style={{ marginTop: "40px", borderTop: "2px solid #eee", paddingTop: "16px" }}>
        <h3>🗣️ Feedback Sharing</h3>
        <div>
          <label><strong>Batch No:</strong></label><br />
          <select value={feedbackBatchNo} onChange={(e) => setFeedbackBatchNo(e.target.value)}>
            <option value="">--select--</option>
            {coursePlannerBatches.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
        <div style={{ marginTop: "10px" }}>
          <label><strong>Send To:</strong></label><br />
          {["IT Admin", "Learning Coordinator", "Trainer", "Management"].map((role) => (
            <label key={role} style={{ marginRight: "12px" }}>
              <input
                type="checkbox"
                value={role}
                checked={feedbackRoles.includes(role)}
                onChange={handleFeedbackRoleChange}
              /> {role}
            </label>
          ))}
        </div>
        <div style={{ marginTop: "10px" }}>
          <label><strong>Feedback Type:</strong></label><br />
          <select value={feedbackType} onChange={(e) => setFeedbackType(e.target.value)}>
            <option value="">--select--</option>
            <option value="Intermediate Feedback">Intermediate Feedback</option>
            <option value="Final Feedback">Final Feedback</option>
          </select>
        </div>
        <div style={{ marginTop: "10px" }}>
          <label><strong>Upload CSV/XLSX:</strong></label><br />
          <input type="file" accept=".csv,.xlsx" onChange={handleFeedbackFile} />
        </div>
        <div style={{ marginTop: "18px" }}>
          <button onClick={handleSendFeedbackEmail}>📤 Send Email</button>
        </div>
      </div>

      {message && (
        <p style={{ marginTop: "15px", color: "blue" }}>{message}</p>
      )}
    </div>
  );
}

export default InternalCommunication;
