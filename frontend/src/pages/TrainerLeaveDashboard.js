import { useEffect, useState } from 'react';
import axios from 'axios';

export default function TrainerLeaveDashboard({ trainerId, managerId }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [reason, setReason] = useState('');
  const [leaves, setLeaves] = useState([]);

  useEffect(() => {
    axios.get(`/api/leave/trainer/${trainerId}`)
      .then(res => setLeaves(res.data));
  }, [trainerId]);

  const applyLeave = async () => {
    await axios.post('/api/leave/apply', {
      trainer_id: trainerId,
      manager_id: managerId,
      from_date: from,
      to_date: to,
      reason
    });
    window.location.reload();
  };

  return (
    <>
      <h2>Apply Leave</h2>
      <input type="date" onChange={e => setFrom(e.target.value)} />
      <input type="date" onChange={e => setTo(e.target.value)} />
      <textarea onChange={e => setReason(e.target.value)} />
      <button onClick={applyLeave}>Apply</button>

      <h3>My Leaves</h3>
      {leaves.map(l => (
        <div key={l.id}>
          {l.from_date} → {l.to_date} | {l.status}
        </div>
      ))}
    </>
  );
}
