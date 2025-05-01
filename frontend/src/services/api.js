import axios from 'axios';

// Cipta instance Axios
const api = axios.create({
  // Tetapkan baseURL kepada alamat backend API anda
  // Pastikan ia sepadan dengan port backend anda (default: 5000 jika tiada .env)
  // Tambah /api pada akhir baseURL
  baseURL: 'http://localhost:5000/api',
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
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api; 