import React, { useState, useEffect } from 'react';

export default function ClassroomPlanner() {
  const [domains, setDomains] = useState([]);
  const [form, setForm] = useState({
    domain: '',
    batch_no: '',
    students: '',
    start_date: '',
    end_date: '',
    preferred_slot: 'morning',
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Fetch domains for dropdown
    fetch('/api/domains')
      .then(res => res.json())
      .then(data => setDomains(data))
      .catch(() => setDomains([]));
  }, []);

  const handleChange = (e) => {
    setForm({...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    // Basic validation
    if (!form.domain || !form.batch_no || !form.students || !form.start_date || !form.end_date) {
      setError('Please fill all fields');
      return;
    }
    try {
      const res = await fetch('/api/scheduleBatch', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ ...form, students: Number(form.students) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to schedule batch');
      } else {
        setResult(data);
      }
    } catch {
      setError('API request failed');
    }
  };

  return (
    <div style={{maxWidth: 600, margin: 'auto'}}>
      <h2>Classroom Planner</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Domain:
          <select name="domain" value={form.domain} onChange={handleChange}>
            <option value="">-- Select Domain --</option>
            {domains.map((d) => (<option key={d} value={d}>{d}</option>))}
          </select>
        </label><br/><br/>

        <label>
          Batch No:
          <input name="batch_no" value={form.batch_no} onChange={handleChange} />
        </label><br/><br/>

        <label>
          Number of Learners:
          <input name="students" type="number" value={form.students} onChange={handleChange} min={1} />
        </label><br/><br/>

        <label>
          Start Date:
          <input name="start_date" type="date" value={form.start_date} onChange={handleChange} />
        </label><br/><br/>

        <label>
          End Date:
          <input name="end_date" type="date" value={form.end_date} onChange={handleChange} />
        </label><br/><br/>

        <label>
          Preferred Slot:
          <select name="preferred_slot" value={form.preferred_slot} onChange={handleChange}>
            <option value="morning">Morning</option>
            <option value="afternoon">Afternoon</option>
          </select>
        </label><br/><br/>

        <button type="submit">Schedule Batch</button>
      </form>

      {error && <p style={{color: 'red'}}>{error}</p>}
      {result && (
        <div style={{marginTop: 20, padding: 10, border: '1px solid green'}}>
          <h3>Batch Scheduled Successfully</h3>
          <p>Classroom: {result.classroom}</p>
          <p>Slot: {result.preferred_slot}</p>
        </div>
      )}
    </div>
  );
}
