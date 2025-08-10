// Application configuration based on environment
const config = {
  API_URL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  SOCKET_URL: import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000',
  APP_NAME: import.meta.env.VITE_APP_NAME || 'Waziper',
  APP_ENV: import.meta.env.VITE_APP_ENV || 'development',
  
  // Feature flags
  DEBUG: import.meta.env.VITE_DEBUG === 'true' || import.meta.env.VITE_APP_ENV === 'development',
  
  // API Configuration
  API_TIMEOUT: 30000, // 30 seconds
  
  // File upload limits
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/webm', 'video/ogg'],
  ALLOWED_DOCUMENT_TYPES: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv'],
  
  // Pagination
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
  
  // UI Configuration
  TOAST_DURATION: 4000,
  DEBOUNCE_DELAY: 300,
  
  // Socket configuration
  SOCKET_CONFIG: {
    transports: ['websocket', 'polling'],
    timeout: 20000,
    forceNew: true,
  },
  
  // Development only
  isDevelopment: import.meta.env.VITE_APP_ENV === 'development',
  isProduction: import.meta.env.VITE_APP_ENV === 'production',
};

export default config;