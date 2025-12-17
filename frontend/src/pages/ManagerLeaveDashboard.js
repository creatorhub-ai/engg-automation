import { useState } from 'react';
import axios from 'axios';

export default function ManagerLeaveDashboard() {
  const [type, setType] = useState('');
  const [value, setValue] = useState('');
  const [leaves, setLeaves] = useState([]);

  const fetchLeaves = async () => {
    const res = await axios.post('/api/leave/manager/filter', { type, value });
    setLeaves(res.data);
  };

  const updateStatus = async (id, status) => {
    await axios.put('/api/leave/update', { leave_id: id, status });
    fetchLeaves();
  };

  return (
    <>
      <select onChange={e => setType(e.target.value)}>
        <option value="">Select</option>
        <option value="date">Date</option>
        <option value="week">Week</option>
        <option value="month">Month</option>
      </select>

      <input
        type={type === 'month' ? 'number' : 'date'}
        onChange={e => setValue(e.target.value)}
      />

      <button onClick={fetchLeaves}>Filter</button>

      {leaves.map(l => (
        <div key={l.id}>
          {l.from_date} → {l.to_date}
          <button onClick={() => updateStatus(l.id, 'approved')}>Approve</button>
          <button onClick={() => updateStatus(l.id, 'rejected')}>Reject</button>
        </div>
      ))}
    </>
  );
}
