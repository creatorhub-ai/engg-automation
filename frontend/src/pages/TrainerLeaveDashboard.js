import React, { useEffect, useState } from "react";
import api from "../api";

export default function TrainerLeaveDashboard() {
  const trainerId = localStorage.getItem("trainer_id");

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reason, setReason] = useState("");
  const [leaves, setLeaves] = useState([]);

  // 🔹 Fetch leaves
  const loadLeaves = async () => {
    try {
      const res = await api.get(`/api/leave/trainer/${trainerId}`);
      setLeaves(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      setLeaves([]);
    }
  };

  useEffect(() => {
    loadLeaves();
  }, []);

  // 🔹 Apply leave
  const applyLeave = async () => {
    if (!fromDate || !toDate || !reason) {
      alert("Missing required fields");
      return;
    }

    try {
      await api.post("/api/leave/apply", {
        trainer_id: trainerId,
        from_date: fromDate,
        to_date: toDate,
        reason,
      });

      alert("Leave applied successfully");
      setFromDate("");
      setToDate("");
      setReason("");
      loadLeaves();
    } catch (err) {
      alert("Failed to apply leave");
      console.error(err);
    }
  };

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
