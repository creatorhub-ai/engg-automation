// frontend/src/api.js
const API_BASE = "http://localhost:5000";

export async function login(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return res.json();
}

export async function fetchBatches(token) {
  const res = await fetch(`${API_BASE}/trainer/batches`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

export async function fetchTopics(token, batchNo) {
  const res = await fetch(`${API_BASE}/trainer/topics/${encodeURIComponent(batchNo)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

export async function completeTopic(token, topicId) {
  const res = await fetch(`${API_BASE}/trainer/topics/${topicId}/complete`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}
