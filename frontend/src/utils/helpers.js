import { APP_CONSTANTS } from './constants';

// Format file size to human readable format
export const formatFileSize = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

// Validate file type and size
export const validateFile = (file, allowedTypes = [], maxSize = APP_CONSTANTS.MAX_FILE_SIZE) => {
  const errors = [];
  
  if (!file) {
    errors.push('No file selected');
    return { isValid: false, errors };
  }
  
  // Check file size
  if (file.size > maxSize) {
    errors.push(`File size must be less than ${formatFileSize(maxSize)}`);
  }
  
  // Check file type
  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    errors.push(`File type ${file.type} is not allowed`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Debounce function
export const debounce = (func, wait = APP_CONSTANTS.DEBOUNCE_DELAY) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Format date for datetime-local input
export const formatDateForInput = (dateString) => {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch (e) {
    console.error('Error formatting date:', e);
    return '';
  }
};

// Format phone number
export const formatPhoneNumber = (phone) => {
  if (!phone) return '';
  
  // Remove @c.us suffix if present
  const cleanPhone = phone.replace('@c.us', '');
  
  // Add country code if not present
  if (!cleanPhone.startsWith('60') && !cleanPhone.startsWith('+60')) {
    return `60${cleanPhone}`;
  }
  
  return cleanPhone;
};

// Validate email
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validate phone number (Malaysian format)
export const isValidPhone = (phone) => {
  const cleanPhone = phone.replace(/[\s-+()]/g, '');
  const phoneRegex = /^(60)?[1-9][0-9]{7,9}$/;
  return phoneRegex.test(cleanPhone);
};

// Generate random string
export const generateRandomString = (length = 8) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Truncate text
export const truncateText = (text, maxLength = 100) => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

// Get file extension
export const getFileExtension = (filename) => {
  if (!filename) return '';
  return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
};

// Check if file is image
export const isImageFile = (file) => {
  return file && file.type && file.type.startsWith('image/');
};

// Check if file is video
export const isVideoFile = (file) => {
  return file && file.type && file.type.startsWith('video/');
};

// Get user plan limits
export const getUserPlanLimits = (plan = 'Free') => {
  return APP_CONSTANTS.PLAN_LIMITS[plan] || APP_CONSTANTS.PLAN_LIMITS.Free;
};

// Check if user has reached plan limit
export const hasReachedLimit = (currentUsage, limit) => {
  return currentUsage >= limit;
};

// Format number with commas
export const formatNumber = (num) => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

// Get badge variant based on status
export const getBadgeVariant = (status, type = 'general') => {
  const variants = {
    general: {
      success: 'success',
      error: 'destructive',
      warning: 'secondary',
      info: 'outline'
    },
    plan: {
      Free: 'outline',
      Basic: 'secondary',
      Pro: 'default'
    },
    role: {
      admin: 'destructive',
      user: 'secondary'
    },
    status: {
      Enabled: 'success',
      Disabled: 'destructive',
      connected: 'success',
      disconnected: 'destructive'
    }
  };
  
  return variants[type]?.[status] || 'secondary';
};

// Download file from URL
export const downloadFile = (url, filename) => {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Copy text to clipboard
export const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textArea);
    return success;
  }
};

// Local storage helpers
export const storage = {
  get: (key) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return null;
    }
  },
  
  set: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Error writing to localStorage:', error);
      return false;
    }
  },
  
  remove: (key) => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Error removing from localStorage:', error);
      return false;
    }
  },
  
  clear: () => {
    try {
      localStorage.clear();
      return true;
    } catch (error) {
      console.error('Error clearing localStorage:', error);
      return false;
    }
  }
};

export default {
  formatFileSize,
  validateFile,
  debounce,
  formatDateForInput,
  formatPhoneNumber,
  isValidEmail,
  isValidPhone,
  generateRandomString,
  truncateText,
  getFileExtension,
  isImageFile,
  isVideoFile,
  getUserPlanLimits,
  hasReachedLimit,
  formatNumber,
  getBadgeVariant,
  downloadFile,
  copyToClipboard,
  storage
};