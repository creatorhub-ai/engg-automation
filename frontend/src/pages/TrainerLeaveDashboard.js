import React, { useEffect, useState } from "react";
import api from "../api";

export default function TrainerLeaveDashboard() {
  // ✅ SAFE READ
  const trainerId = localStorage.getItem("trainer_id");

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reason, setReason] = useState("");
  const [leaves, setLeaves] = useState([]);
  const [error, setError] = useState("");

  // 🚨 STOP if trainerId missing
  useEffect(() => {
    if (!trainerId) {
      setError("Trainer not logged in. Please login again.");
      return;
    }
    loadLeaves();
  }, []);

  const loadLeaves = async () => {
    try {
      const res = await api.get(`/api/leave/trainer/${trainerId}`);
      setLeaves(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      setLeaves([]);
    }
  };

  const applyLeave = async () => {
    if (!trainerId) {
      alert("Trainer ID missing. Please login again.");
      return;
    }

    if (!fromDate || !toDate || !reason) {
      alert("Missing required fields");
      return;
    }

    try {
      await api.post("/api/leave/apply", {
        trainer_id: Number(trainerId), // ✅ FORCE NUMBER
        from_date: fromDate,
        to_date: toDate,
        reason: reason.trim(),
      });

      alert("Leave applied successfully");

      setFromDate("");
      setToDate("");
      setReason("");
      loadLeaves();
    } catch (err) {
      console.error("Apply Leave Error:", err.response?.data || err.message);
      alert("Failed to apply leave");
    }
  };

  if (error) {
    return <h3 style={{ color: "red" }}>{error}</h3>;
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Apply Leave</h2>

      <input
        type="date"
        value={fromDate}
        onChange={(e) => setFromDate(e.target.value)}
      />

      <input
        type="date"
        value={toDate}
        onChange={(e) => setToDate(e.target.value)}
      />

      <textarea
        placeholder="Reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />

      <br />
      <button onClick={applyLeave}>Apply Leave</button>

      <hr />

      <h3>My Leaves</h3>

      {leaves.length === 0 ? (
        <p>No leaves applied</p>
      ) : (
        <table border="1">
          <thead>
            <tr>
              <th>From</th>
              <th>To</th>
              <th>Reason</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {leaves.map((l, i) => (
              <tr key={i}>
                <td>{l.from_date}</td>
                <td>{l.to_date}</td>
                <td>{l.reason}</td>
                <td>{l.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
