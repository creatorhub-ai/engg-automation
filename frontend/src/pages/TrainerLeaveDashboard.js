import React, { useEffect, useState } from "react";
import api from "../api";

export default function TrainerLeaveDashboard() {
  // ✅ READ LOGIN SESSION (CORRECT SOURCE)
  const session = JSON.parse(localStorage.getItem("userSession"));

  const trainerId = session?.id;
  const role = session?.role;

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reason, setReason] = useState("");
  const [leaves, setLeaves] = useState([]);
  const [error, setError] = useState("");

  // ===============================
  // AUTH CHECK
  // ===============================
  useEffect(() => {
    if (!session || role !== "trainer") {
      setError("Please login as Trainer");
      return;
    }
    loadLeaves();
  }, []);

  // ===============================
  // LOAD LEAVES
  // ===============================
  const loadLeaves = async () => {
    try {
      const res = await api.get(`/api/leave/trainer/${trainerId}`);
      setLeaves(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Load leaves error:", err);
      setLeaves([]);
    }
  };

  // ===============================
  // APPLY LEAVE
  // ===============================
  const applyLeave = async () => {
    if (!fromDate || !toDate || !reason) {
      alert("Missing required fields");
      return;
    }

    try {
      await api.post("/api/leave/apply", {
        trainer_id: trainerId,   // ✅ CORRECT ID
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
      console.error("Apply leave error:", err.response?.data || err.message);
      alert("Failed to apply leave");
    }
  };

  // ===============================
  // UI
  // ===============================
  if (error) {
    return (
      <div style={{ padding: 20 }}>
        <h3 style={{ color: "red" }}>{error}</h3>
      </div>
    );
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
        <table border="1" cellPadding="6">
          <thead>
            <tr>
              <th>From</th>
              <th>To</th>
              <th>Reason</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {leaves.map((l) => (
              <tr key={l.id}>
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
