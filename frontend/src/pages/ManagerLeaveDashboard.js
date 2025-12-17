import { useState } from 'react';
import api from '../api';

export default function ManagerLeaveDashboard() {
  const [filterType, setFilterType] = useState('');
  const [filterValue, setFilterValue] = useState('');
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(false);

  const months = [
    { label: 'January', value: 1 },
    { label: 'February', value: 2 },
    { label: 'March', value: 3 },
    { label: 'April', value: 4 },
    { label: 'May', value: 5 },
    { label: 'June', value: 6 },
    { label: 'July', value: 7 },
    { label: 'August', value: 8 },
    { label: 'September', value: 9 },
    { label: 'October', value: 10 },
    { label: 'November', value: 11 },
    { label: 'December', value: 12 }
  ];

  const fetchLeaves = async () => {
    if (!filterType || !filterValue) {
      alert('Select filter');
      return;
    }

    try {
      setLoading(true);
      const res = await api.post('/api/leave/manager/filter', {
        type: filterType,
        value: filterValue
      });
      setLeaves(Array.isArray(res.data) ? res.data : []);
    } catch {
      setLeaves([]);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id, status) => {
    await api.put('/api/leave/update', {
      leave_id: id,
      status
    });
    fetchLeaves();
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Manager Leave Dashboard</h2>

      <select
        value={filterType}
        onChange={e => {
          setFilterType(e.target.value);
          setFilterValue('');
          setLeaves([]);
        }}
      >
        <option value="">Select</option>
        <option value="date">Date</option>
        <option value="week">Week</option>
        <option value="month">Month</option>
      </select>

      {filterType === 'date' && (
        <input type="date" value={filterValue} onChange={e => setFilterValue(e.target.value)} />
      )}

      {filterType === 'week' && (
        <input type="date" value={filterValue} onChange={e => setFilterValue(e.target.value)} />
      )}

      {filterType === 'month' && (
        <select value={filterValue} onChange={e => setFilterValue(e.target.value)}>
          <option value="">Select Month</option>
          {months.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      )}

      <br /><br />
      <button onClick={fetchLeaves}>Apply Filter</button>

      <hr />

      {loading && <p>Loading...</p>}
      {leaves.length === 0 && !loading && <p>No leaves found</p>}

      {leaves.map(l => (
        <div key={l.id}>
          {l.from_date} → {l.to_date} | {l.status}
          {l.status === 'pending' && (
            <>
              <button onClick={() => updateStatus(l.id, 'approved')}>Approve</button>
              <button onClick={() => updateStatus(l.id, 'rejected')}>Reject</button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
