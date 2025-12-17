import { useEffect, useState } from 'react';
import api from '../api';

export default function TrainerLeaveDashboard({ trainerId, managerId }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [reason, setReason] = useState('');
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(false);

  // ================= FETCH LEAVES =================
  const fetchLeaves = async () => {
    try {
      const res = await api.get(`/api/leave/trainer/${trainerId}`);
      setLeaves(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      setLeaves([]);
    }
  };

  useEffect(() => {
    if (trainerId) fetchLeaves();
  }, [trainerId]);

  // ================= APPLY LEAVE =================
  const applyLeave = async () => {
    if (!from || !to || !trainerId || !managerId) {
      alert('Missing required fields');
      return;
    }

    try {
      setLoading(true);

      const res = await api.post('/api/leave/apply', {
        trainer_id: trainerId,
        manager_id: managerId,
        from_date: from,
        to_date: to,
        reason
      });

      console.log('Leave applied:', res.data);

      setFrom('');
      setTo('');
      setReason('');

      fetchLeaves();
    } catch (err) {
      console.error(err);
      alert('Failed to apply leave');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Apply Leave</h2>

      <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
      <input type="date" value={to} onChange={e => setTo(e.target.value)} />
      <textarea
        placeholder="Reason"
        value={reason}
        onChange={e => setReason(e.target.value)}
      />

      <br />
      <button onClick={applyLeave} disabled={loading}>
        {loading ? 'Applying...' : 'Apply Leave'}
      </button>

      <hr />

      <h3>My Leaves</h3>

      {leaves.length === 0 && <p>No leaves applied</p>}

      {leaves.map(l => (
        <div key={l.id}>
          {l.from_date} → {l.to_date} | {l.status}
        </div>
      ))}
    </div>
  );
}
