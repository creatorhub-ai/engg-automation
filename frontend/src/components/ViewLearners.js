import React, { useState } from 'react';

function ScheduleWelcomeEmails() {
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
        // No body sent here, backend uses saved course planner data
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to schedule emails.');
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err.message || 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: 'auto', fontFamily: 'Arial, sans-serif', padding: 20 }}>
      <h2>Schedule Welcome Emails</h2>
      <p>
        This will schedule welcome emails for all batches automatically using backend course planner data.
      </p>
      <button onClick={handleScheduleEmails} disabled={loading} style={{ padding: '8px 16px', fontSize: '16px' }}>
        {loading ? 'Scheduling...' : 'Schedule Emails'}
      </button>
      {result && (
        <div style={{ marginTop: 20, color: 'green' }}>
          <strong>Success!</strong>
          <pre style={{ background: '#f0f0f0', padding: 10, whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
      {error && (
        <div style={{ marginTop: 20, color: 'red' }}>
          <strong>Error:</strong> {error}
        </div>
      )}
    </div>
  );
}

export default ScheduleWelcomeEmails;
