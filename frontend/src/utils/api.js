import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const BASE_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({ 
  baseURL: `${BASE_URL}/api`, 
  timeout: 30000 
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    // Keep the real axios error (so `err.response.data.*` works) while also
    // shimming the flat `err.error` / `err.errors` shape older call sites expect.
    if (err.response?.data) {
      err.error = err.response.data.error;
      err.errors = err.response.data.errors;
    }
    return Promise.reject(err);
  }
);

export default api;
