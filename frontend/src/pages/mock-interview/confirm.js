import React, { useState, useEffect } from 'react';

function ConfirmMockInterviewDate() {
  // Parse URL query params to get batch_no, trainer_email, topic_name, initial date
  const [params, setParams] = useState({});
  const [date, setDate] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const search = window.location.search;
    const query = new URLSearchParams(search);
    const batch_no = query.get('batch_no') || '';
    const trainer_email = query.get('trainer_email') || '';
    const topic_name = query.get('topic_name') || '';
    const initialDate = query.get('date') || '';

    setParams({ batch_no, trainer_email, topic_name });
    setDate(initialDate);
  }, []);

  const handleChange = (e) => {
    setDate(e.target.value);
  };

  const handleConfirm = async () => {
    if (!date) {
      setMessage('⚠️ Please enter a date to confirm.');
      return;
    }

    try {
      const res = await fetch('/api/mock-interview/confirm-date', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          batch_no: params.batch_no,
          trainer_email: params.trainer_email,
          topic_name: params.topic_name,
          confirmed_date: date,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage('✅ Date confirmed successfully. Coordinator has been notified.');
      } else {
        setMessage('❌ Confirmation failed: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      setMessage('❌ Network error: ' + err.message);
    }
  };

  return React.createElement(
    'div',
    { style: { maxWidth: 600, margin: '2rem auto', padding: '1rem', border: '1px solid #ccc', borderRadius: '8px' } },
    React.createElement('h2', null, 'Confirm Mock Interview Date'),
    React.createElement('p', null, 'Topic: ', params.topic_name),
    React.createElement(
      'label',
      null,
      'Interview Date: ',
      React.createElement('input', { type: 'date', value: date, onChange: handleChange, style: { marginLeft: '1rem' } })
    ),
    React.createElement('br'),
    React.createElement('br'),
    React.createElement(
      'button',
      { onClick: handleConfirm, style: { padding: '8px 16px', cursor: 'pointer' } },
      'Confirm Date'
    ),
    message && React.createElement('p', { style: { marginTop: '1rem' } }, message)
  );
}

export default ConfirmMockInterviewDate;
