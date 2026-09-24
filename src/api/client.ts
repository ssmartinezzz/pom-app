import axios from 'axios';
import { getToken, removeToken } from '../utils/storage';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:9080';

export const api = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  timeout: 60000, // extract/generate can be slow
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let onUnauthorized: (() => void) | null = null;

export function setOnUnauthorized(fn: () => void) {
  onUnauthorized = fn;
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && onUnauthorized) {
      await removeToken();
      onUnauthorized();
    }
    return Promise.reject(error);
  }
);
