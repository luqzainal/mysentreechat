import axios from 'axios';
import config from '../config';

// Cipta instance Axios
const api = axios.create({
  baseURL: config.API_URL,
  timeout: config.API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor untuk menambah token pada setiap permintaan jika ada
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Remove Content-Type header for FormData to let axios set it with boundary
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor response untuk mengendalikan 401 error
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Token tidak sah atau telah tamat tempoh
      localStorage.removeItem('token');
      localStorage.removeItem('userInfo');
      // Redirect ke halaman login jika diperlukan
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api; 