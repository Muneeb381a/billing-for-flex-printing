import axios from 'axios';
import toast from 'react-hot-toast';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// Unwrap .data so callers receive the payload directly
client.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const message = err.response?.data?.error || err.message || 'Something went wrong';
    // Don't toast on 404 — let components handle "not found" gracefully
    if (err.response?.status !== 404) toast.error(message);
    return Promise.reject(err);
  }
);

export default client;
