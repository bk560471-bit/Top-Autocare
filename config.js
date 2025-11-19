// config.js - Centralized Configuration for Top Autocare Garage
// Self-contained module with Firebase config, app constants, and utilities
// Import this in other scripts: import * as Config from './config.js';

// Firebase Configuration (Production - Replace with your actual config if different)
export const firebaseConfig = {
  apiKey: "AIzaSyBkVYS0CaKe1kHPp9GVnURiZz5WP5tE3iM",
  authDomain: "top-autocare.firebaseapp.com",
  projectId: "top-autocare",
  storageBucket: "top-autocare.firebasestorage.app",
  messagingSenderId: "879247821822",
  appId: "1:879247821822:web:e6a418395d52aac99a4eaf",
  measurementId: "G-T5NDM5M33Z"
};

// Environment Configuration (Detects dev/prod based on location)
export const environment = {
  isProduction: () => location.hostname !== 'localhost' && location.hostname !== '127.0.0.1',
  isDevelopment: () => location.hostname === 'localhost' || location.hostname === '127.0.0.1',
  apiBaseUrl: () => {
    if (environment.isDevelopment()) {
      return 'http://localhost:3000/api'; // Local dev server
    }
    return 'https://top-autocare.firebaseio.com'; // Firebase or production API
  },
  offlineFallbackUrl: '/offline.html',
  defaultRedirectUrl: '/dashboard.html',
  adminRedirectUrl: '/admin.html',
  authPages: ['/signin.html', '/signup.html', '/verify-email.html'],
  maxNotificationLimit: 50, // For queries
  itemsPerPage: 10 // For tables/pagination
};

// App Theme & Styling Constants
export const theme = {
  primaryColor: '#d4af37', // Gold
  primaryHover: '#b8962e',
  secondaryColor: '#333',
  successColor: '#4CAF50',
  errorColor: '#ff6b6b',
  infoColor: '#2196F3',
  background: '#1a1a1a', // Dark theme
  textPrimary: '#ffffff',
  textSecondary: '#BDBDBD',
  borderColor: '#333'
};

// App Constants & Enums
export const appConstants = {
  appName: 'Top Autocare Garage',
  appVersion: '2.0.0', // Update for deployments
  appDescription: 'Professional automotive care and booking app for Top Autocare Garage in Nairobi, Kenya.',
  defaultTimeZone: 'Africa/Nairobi',
  currency: 'KES', // Kenyan Shilling
  phoneFormat: '+254 XXX XXX XXX',
  dateFormat: 'en-US', // For Intl.DateTimeFormat
  maxFileSize: 5 * 1024 * 1024, // 5MB for image uploads
  allowedImageTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'],
  roles: {
    ADMIN: 'admin',
    USER: 'user',
    GUEST: 'guest'
  },
  appointmentStatuses: [
    'pending',
    'approved',
    'completed',
    'cancelled',
    'rejected'
  ],
  serviceTypes: [
    'Routine Maintenance',
    'Engine Overhaul',
    'Brake Service',
    'Oil Change',
    'Tire Rotation',
    'Transmission Repair',
    'AC Service'
  ],
  notificationTypes: [
    'appointment',
    'reminder',
    'service',
    'payment',
    'system',
    'promotion'
  ],
  userFields: [
    'fullName',
    'email',
    'phone',
    'role',
    'createdAt',
    'lastLogin',
    'photoURL'
  ],
  vehicleFields: [
    'make',
    'model',
    'year',
    'plate',
    'vin',
    'mileage',
    'userId'
  ],
  // Firestore Collection Names
  collections: {
    USERS: 'users',
    APPOINTMENTS: 'appointments',
    VEHICLES: 'vehicles',
    SERVICES: 'services',
    NOTIFICATIONS: 'notifications',
    SETTINGS: 'settings'
  },
  // LocalStorage Keys
  storageKeys: {
    USER_TOKEN: 'top-autocare-token',
    USER_DATA: 'top-autocare-user',
    USER_PREFERENCES: 'top-autocare-prefs',
    LAST_SYNC: 'top-autocare-last-sync',
    OFFLINE_QUEUE: 'top-autocare-offline-queue'
  },
  // PWA Constants
  pwa: {
    cacheName: 'top-autocare-v2.0',
    offlinePage: '/offline.html',
    manifestUrl: '/manifest.json',
    serviceWorkerUrl: '/sw.js'
  },
  // API Endpoints (Firebase Functions or REST)
  apiEndpoints: {
    // Example Firebase Functions (replace with actual if using Cloud Functions)
    CREATE_APPOINTMENT: '/api/appointments/create',
    GET_USER_APPOINTMENTS: '/api/appointments/user',
    UPDATE_USER_PROFILE: '/api/users/update',
    SEND_NOTIFICATION: '/api/notifications/send',
    // Firebase Realtime Database/Firestore paths (if direct access)
    USERS_PATH: '/users',
    APPOINTMENTS_PATH: '/appointments'
  },
  // Validation Rules
  validation: {
    emailRegex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    phoneRegex: /^[\+]?[1-9][\d]{0,15}$/,
    passwordMinLength: 6,
    passwordRequirements: {
      minLength: 6,
      hasUppercase: /[A-Z]/,
      hasLowercase: /[a-z]/,
      hasNumber: /\d/,
      hasSpecial: /[!@#$%^&*(),.?":{}|<>]/
    },
    maxTextLength: {
      name: 50,
      email: 100,
      phone: 20,
      notes: 500,
      message: 1000
    }
  },
  // Error Messages
  errorMessages: {
    NETWORK_ERROR: 'Network error. Please check your connection and try again.',
    AUTH_ERROR: 'Authentication failed. Please try signing in again.',
    PERMISSION_DENIED: 'Access denied. Admin privileges required.',
    INVALID_INPUT: 'Invalid input provided.',
    OFFLINE_ERROR: 'You are offline. Some features are unavailable.',
    SERVER_ERROR: 'Server error occurred. Please try again later.'
  },
  // Success Messages
  successMessages: {
    REGISTRATION_SUCCESS: 'Account created successfully!',
    LOGIN_SUCCESS: 'Welcome back!',
    UPDATE_SUCCESS: 'Profile updated successfully.',
    BOOKING_SUCCESS: 'Appointment booked! You\'ll receive a confirmation soon.',
    NOTIFICATION_SENT: 'Notification sent successfully.'
  }
};

// Utility Functions
export const utils = {
  // Validate Email
  validateEmail(email) {
    return appConstants.validation.emailRegex.test(email);
  },

  // Validate Phone
  validatePhone(phone) {
    return appConstants.validation.phoneRegex.test(phone.replace(/\D/g, ''));
  },

  // Validate Password (meets requirements)
  validatePassword(password) {
    const rules = appConstants.validation.passwordRequirements;
    return password.length >= rules.minLength &&
           rules.hasUppercase.test(password) &&
           rules.hasLowercase.test(password) &&
           rules.hasNumber.test(password) &&
           rules.hasSpecial.test(password);
  },

  // Format Phone Number (Kenyan format)
  formatPhone(phone) {
    let clean = phone.replace(/\D/g, '');
    if (clean.startsWith('0')) clean = '254' + clean.slice(1);
    if (clean.length === 12 && clean.startsWith('254')) {
      return `+${clean}`;
    }
    return phone;
  },

  // Format Currency (KES)
  formatCurrency(amount) {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: appConstants.currency,
      minimumFractionDigits: 0
    }).format(amount);
  },

  // Format Date (Local timezone)
  formatDate(date, options = { year: 'numeric', month: 'short', day: 'numeric' }) {
    return new Intl.DateTimeFormat(appConstants.dateFormat, {
      ...options,
      timeZone: appConstants.defaultTimeZone
    }).format(date);
  },

  // Generate ID (Simple UUID-like)
  generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },

  // Check if Admin Role
  isAdminRole(role) {
    return role === appConstants.roles.ADMIN;
  },

  // Get Role Display Name
  getRoleDisplay(role) {
    const roles = appConstants.roles;
    switch (role) {
      case roles.ADMIN: return 'Administrator';
      case roles.USER: return 'Customer';
      default: return 'Guest';
    }
  },

  // Get Status Badge Class (for UI)
  getStatusClass(status) {
    const statuses = appConstants.appointmentStatuses;
    const classes = {
      pending: 'status-pending',
      approved: 'status-approved',
      completed: 'status-completed',
      cancelled: 'status-cancelled',
      rejected: 'status-rejected'
    };
    return classes[status] || 'status-pending';
  },

  // Get Notification Icon (Font Awesome)
  getNotificationIcon(type) {
    const icons = appConstants.notificationTypes.reduce((acc, t) => {
      acc[t] = `fas fa-${t === 'appointment' ? 'calendar-check' : t === 'payment' ? 'credit-card' : t === 'promotion' ? 'tag' : t === 'system' ? 'info-circle' : 'bell'}`;
      return acc;
    }, {});
    return icons[type] || 'fas fa-bell';
  },

  // Check Online Status
  isOnline() {
    return navigator.onLine;
  },

  // Debounce Function (Utility)
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  // Throttle Function (Utility)
  throttle(func, limit) {
    let inThrottle;
    return function() {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
};

// PWA Configuration (Integration with sw.js and manifest)
export const pwaConfig = {
  // Service Worker
  serviceWorker: {
    url: appConstants.pwa.serviceWorkerUrl,
    cacheName: appConstants.pwa.cacheName,
    offlinePage: appConstants.pwa.offlinePage
  },
  
  // Manifest
  manifest: {
    url: appConstants.pwa.manifestUrl,
    name: appConstants.appName,
    shortName: 'Top Autocare',
    themeColor: theme.primaryColor,
    backgroundColor: theme.background,
    icons: [
      { src: '/assets/images/app-icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/assets/images/app-icon-512.png', sizes: '512x512', type: 'image/png' }
    ],
    startUrl: appConstants.defaultRedirectUrl,
    display: 'standalone'
  },

  // Install Prompt Settings
  installPrompt: {
    delay: 5000, // Show after 5s
    maxDismissals: 3, // Max times to show before permanent dismiss
    showOnPages: ['/dashboard.html', '/book-appointment.html'] // Only on main pages
  }
};

// Export all configs as a single object for easy import
export default {
  firebaseConfig,
  environment,
  theme,
  appConstants,
  utils,
  pwaConfig
};

// Log config load (for debugging)
console.log('⚙️ Config loaded:', { version: appConstants.appVersion, env: environment.isProduction() ? 'Production' : 'Development' });
