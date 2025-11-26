import React, { useState } from 'react';

export default function ScheduleWelcomeEmails() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function handleScheduleEmails() {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch('/api/schedule-welcome', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Expected JSON but got: ${text.substring(0, 100)}`);
      }

      if (!response.ok) {
        const errorJson = await response.json();
        throw new Error(errorJson.error || 'Server error');
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: 'auto', padding: 20 }}>
      <h2>Schedule Welcome Emails</h2>
      <button onClick={handleScheduleEmails} disabled={loading}>
        {loading ? 'Scheduling...' : 'Schedule Emails'}
      </button>
      {result && <pre style={{ marginTop: 20 }}>{JSON.stringify(result, null, 2)}</pre>}
      {error && <p style={{ marginTop: 20, color: 'red' }}>Error: {error}</p>}
    </div>
  );
}
