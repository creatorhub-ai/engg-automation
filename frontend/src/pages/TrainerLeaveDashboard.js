import { useEffect, useState } from 'react';
import axios from 'axios';

export default function TrainerLeaveDashboard({ trainerId, managerId }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [reason, setReason] = useState('');
  const [leaves, setLeaves] = useState([]);   // ✅ always array
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ================= FETCH LEAVES =================
  const fetchLeaves = async () => {
    try {
      setLoading(true);
      setError('');

      const res = await axios.get(
        `/api/leave/trainer/${trainerId}`
      );

      // ✅ HARD GUARANTEE ARRAY
      if (Array.isArray(res.data)) {
        setLeaves(res.data);
      } else {
        setLeaves([]);
      }

    } catch (err) {
      console.error(err);
      setLeaves([]);
      setError('Failed to load leaves');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (trainerId) {
      fetchLeaves();
    }
  }, [trainerId]);

  // ================= APPLY LEAVE =================
  const applyLeave = async () => {
    try {
      await axios.post('/api/leave/apply', {
        trainer_id: trainerId,
        manager_id: managerId,
        from_date: from,
        to_date: to,
        reason
      });

      // clear form
      setFrom('');
      setTo('');
      setReason('');

      // refresh list
      fetchLeaves();
    } catch (err) {
      alert('Failed to apply leave');
    }
  };

  // ================= UI =================
  return (
    <div style={{ padding: 20 }}>
      <h2>Apply Leave</h2>

      <input
        type="date"
        value={from}
        onChange={e => setFrom(e.target.value)}
      />

      <input
        type="date"
        value={to}
        onChange={e => setTo(e.target.value)}
      />

      <textarea
        placeholder="Reason"
        value={reason}
        onChange={e => setReason(e.target.value)}
      />

      <br />
      <button onClick={applyLeave}>Apply Leave</button>

      <hr />

      <h3>My Leaves</h3>

      {loading && <p>Loading...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {!loading && Array.isArray(leaves) && leaves.length === 0 && (
        <p>No leaves applied</p>
      )}

      {!loading && Array.isArray(leaves) && leaves.map(l => (
        <div
          key={l.id}
          style={{
            border: '1px solid #ccc',
            marginBottom: 10,
            padding: 10
          }}
        >
          <strong>{l.from_date}</strong> → <strong>{l.to_date}</strong>
          <br />
          Reason: {l.reason || '-'}
          <br />
          Status: <b>{l.status}</b>
        </div>
      ))}
    </div>
  );
}
