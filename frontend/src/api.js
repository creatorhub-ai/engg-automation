import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'https://engg-automation-f191.onrender.com'
});

export default api;
