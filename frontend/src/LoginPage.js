// frontend/src/api.js
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export async function login(email, password) {
  try {
    const res = await fetch(`${API_BASE}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    // Read raw text first to avoid JSON parse errors on empty response
    const text = await res.text();

    if (!text) {
      return { success: false, error: `Empty response from server (HTTP ${res.status})` };
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error('Invalid JSON from /api/login:', text);
      return { success: false, error: `Invalid JSON from server (HTTP ${res.status})` };
    }

    // Optionally normalize
    return data;
  } catch (err) {
    console.error('Network error calling /api/login:', err);
    return { success: false, error: 'Network error. Please try again.' };
  }
}
