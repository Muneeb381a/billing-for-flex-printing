import axios from 'axios';
import toast from 'react-hot-toast';

const TOKEN_KEY = 'pp_token';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// Attach Bearer token from localStorage on every request
client.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (res) => res.data,
  (err) => {
    // Expired / invalid token → clear session and redirect to login
    if (err.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('pp_user');
      // Avoid redirect loop if already on /login
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
      return Promise.reject(err);
    }

    const message = err.response?.data?.error || err.message || 'Something went wrong';
    if (err.response?.status !== 404) toast.error(message);
    return Promise.reject(err);
  }
);

export default client;
