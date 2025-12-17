import { useState } from 'react';
import axios from 'axios';

export default function ManagerLeaveDashboard() {
  const [filterType, setFilterType] = useState('');
  const [filterValue, setFilterValue] = useState('');
  const [leaves, setLeaves] = useState([]);   // ✅ always array
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ================= FETCH LEAVES =================
  const fetchLeaves = async () => {
    if (!filterType || !filterValue) {
      alert('Please select filter and value');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const res = await axios.post('/api/leave/manager/filter', {
        type: filterType,
        value: filterValue
      });

      // ✅ GUARANTEE ARRAY
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

  // ================= UPDATE STATUS =================
  const updateStatus = async (leaveId, status) => {
    try {
      await axios.put('/api/leave/update', {
        leave_id: leaveId,
        status
      });

      fetchLeaves();
    } catch (err) {
      alert('Failed to update leave');
    }
  };

  // ================= MONTH OPTIONS =================
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

  return (
    <div style={{ padding: 20 }}>
      <h2>Manager Leave Dashboard</h2>

      {/* FILTER TYPE */}
      <select
        value={filterType}
        onChange={e => {
          setFilterType(e.target.value);
          setFilterValue('');
          setLeaves([]);
        }}
      >
        <option value="">Select Filter</option>
        <option value="date">Date</option>
        <option value="week">Week</option>
        <option value="month">Month</option>
      </select>

      {/* FILTER VALUE */}
      {filterType === 'date' && (
        <input
          type="date"
          value={filterValue}
          onChange={e => setFilterValue(e.target.value)}
        />
      )}

      {filterType === 'week' && (
        <input
          type="date"
          value={filterValue}
          onChange={e => setFilterValue(e.target.value)}
        />
      )}

      {filterType === 'month' && (
        <select
          value={filterValue}
          onChange={e => setFilterValue(e.target.value)}
        >
          <option value="">Select Month</option>
          {months.map(m => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      )}

      <br /><br />
      <button onClick={fetchLeaves}>Apply Filter</button>

      <hr />

      {/* STATUS */}
      {loading && <p>Loading...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {!loading && Array.isArray(leaves) && leaves.length === 0 && (
        <p>No leaves found</p>
      )}

      {/* LEAVES LIST */}
      {!loading && Array.isArray(leaves) && leaves.map(l => (
        <div
          key={l.id}
          style={{
            border: '1px solid #ccc',
            padding: 10,
            marginBottom: 10
          }}
        >
          <b>{l.from_date}</b> → <b>{l.to_date}</b>
          <br />
          Trainer ID: {l.trainer_id}
          <br />
          Reason: {l.reason || '-'}
          <br />
          Status: <b>{l.status}</b>
          <br /><br />

          {l.status === 'pending' && (
            <>
              <button onClick={() => updateStatus(l.id, 'approved')}>
                Approve
              </button>
              &nbsp;
              <button onClick={() => updateStatus(l.id, 'rejected')}>
                Reject
              </button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
