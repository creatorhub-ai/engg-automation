import React, { useEffect, useState } from "react";
import api from "../api";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

export default function ManagerLeaveDashboard() {
  const [month, setMonth] = useState("");
  const [leaves, setLeaves] = useState([]);

  const loadLeaves = async () => {
    try {
      const res = await api.get("/api/leave/all", {
        params: { month }
      });
      setLeaves(Array.isArray(res.data) ? res.data : []);
    } catch {
      setLeaves([]);
    }
  };

  useEffect(() => {
    loadLeaves();
  }, [month]);

  return (
    <div style={{ padding: 20 }}>
      <h2>Manager Leave Dashboard</h2>

      <select value={month} onChange={(e) => setMonth(e.target.value)}>
        <option value="">Select Month</option>
        {MONTHS.map((m, i) => (
          <option key={i} value={i + 1}>
            {m}
          </option>
        ))}
      </select>

      <hr />

      {leaves.length === 0 ? (
        <p>No leaves found</p>
      ) : (
        <table border="1">
          <thead>
            <tr>
              <th>Trainer</th>
              <th>From</th>
              <th>To</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {leaves.map((l, i) => (
              <tr key={i}>
                <td>{l.trainer_name}</td>
                <td>{l.from_date}</td>
                <td>{l.to_date}</td>
                <td>{l.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
