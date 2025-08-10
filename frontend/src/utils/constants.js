// Application constants
export const APP_CONSTANTS = {
  // File upload constants
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_FILE_TYPES: {
    IMAGES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    VIDEOS: ['video/mp4', 'video/webm', 'video/ogg'],
    DOCUMENTS: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ]
  },
  
  // UI Constants
  DEBOUNCE_DELAY: 300,
  TOAST_DURATION: 4000,
  PAGINATION_SIZE: 10,
  
  // API Constants
  API_TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3,
  
  // Local Storage Keys
  STORAGE_KEYS: {
    TOKEN: 'token',
    USER_INFO: 'userInfo',
    THEME: 'theme',
    SETTINGS: 'app_settings'
  },
  
  // Route Paths
  ROUTES: {
    LOGIN: '/login',
    REGISTER: '/register',
    FORGOT_PASSWORD: '/forgot-password',
    RESET_PASSWORD: '/reset-password',
    DASHBOARD: '/',
    SCAN_DEVICE: '/scan-device',
    CONTACTS: '/contacts',
    AI_CHATBOT: '/ai-chatbot',
    CAMPAIGNS: '/campaigns',
    MEDIA_STORAGE: '/media-storage',
    ACCOUNT: '/account',
    SETTINGS: '/settings',
    ADMIN_USERS: '/admin/users'
  },
  
  // Status Constants
  STATUSES: {
    LOADING: 'loading',
    SUCCESS: 'success',
    ERROR: 'error',
    IDLE: 'idle'
  },
  
  // Campaign Types
  CAMPAIGN_TYPES: {
    BULK: 'bulk',
    AI_CHATBOT: 'ai_chatbot'
  },
  
  // User Roles
  USER_ROLES: {
    ADMIN: 'admin',
    USER: 'user'
  },
  
  // Membership Plans
  MEMBERSHIP_PLANS: {
    FREE: 'Free',
    BASIC: 'Basic',
    PRO: 'Pro'
  },
  
  // Plan Limits
  PLAN_LIMITS: {
    Free: {
      devices: 1,
      contacts: 100,
      campaigns: 5,
      mediaStorage: 100 // MB
    },
    Basic: {
      devices: 3,
      contacts: 1000,
      campaigns: 20,
      mediaStorage: 500 // MB
    },
    Pro: {
      devices: 5,
      contacts: 10000,
      campaigns: 100,
      mediaStorage: 2000 // MB
    }
  }
};

export default APP_CONSTANTS;