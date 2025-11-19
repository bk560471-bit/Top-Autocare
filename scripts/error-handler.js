// error-handler.js - Global Error Handling for Top Autocare Garage
// Self-contained vanilla JS for catching, logging, and recovering from errors
// Integrates with analytics.js for tracking and config.js for settings
// Handles sync/async errors, network issues, and provides graceful fallbacks

// Import configuration (if using modules) or fallback to global
let Config;
try {
  // If using ES modules (recommended in <script type="module">)
  Config = await import('./config.js');
  Config = Config.default; // Handle default export
} catch (error) {
  // Fallback for non-module scripts (load config globally if needed)
  Config = window.Config || {};
  console.warn('Error Handler: Config not loaded as module, using fallback');
}

const DEBUG = Config.environment?.isDevelopment?.() || false;
const ERROR_TRACKING_ENABLED = true; // Disable for production if needed
const MAX_ERROR_LOG_SIZE = 50; // Limit stored errors
const ERROR_STORAGE_KEY = 'top-autocare-errors-log'; // LocalStorage for offline errors
const RETRY_ATTEMPTS = 3; // Max retries for recoverable errors
const RECOVERABLE_ERROR_TYPES = ['network-error', 'timeout', 'validation-error']; // Types that can retry

// Analytics integration (if available)
let Analytics;
try {
  Analytics = await import('./analytics.js');
} catch (error) {
  console.warn('Error Handler: Analytics not loaded, skipping tracking');
}

// Utility: Log errors (with context)
function logError(message, error, context = {}) {
  if (DEBUG) {
    console.error(`[Error Handler] ${message}`, { error, context });
  }
}

// Queue errors for offline/sync (LocalStorage)
function queueError(errorData) {
  if (!ERROR_TRACKING_ENABLED) return;
  
  try {
    let errorLog = JSON.parse(localStorage.getItem(ERROR_STORAGE_KEY) || '[]');
    errorLog.unshift({
      ...errorData,
      timestamp: Date.now(),
      browser: navigator.userAgent,
      url: window.location.href
    });
    
    // Limit log size (FIFO)
    if (errorLog.length > MAX_ERROR_LOG_SIZE) {
      errorLog = errorLog.slice(0, MAX_ERROR_LOG_SIZE);
    }
    
    localStorage.setItem(ERROR_STORAGE_KEY, JSON.stringify(errorLog));
    logError('Queued error for sync', errorData);
  } catch (storageError) {
    console.warn('Error Handler: Failed to queue error', storageError);
  }
}

// Sync queued errors (when online or on analytics init)
function syncErrorQueue() {
  if (!ERROR_TRACKING_ENABLED || !navigator.onLine || !Analytics) return;
  
  try {
    let errorLog = JSON.parse(localStorage.getItem(ERROR_STORAGE_KEY) || '[]');
    if (errorLog.length === 0) return;
    
    // Filter old errors (keep 7 days)
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    errorLog = errorLog.filter(err => err.timestamp > cutoff);
    
    logError(`Syncing ${errorLog.length} queued errors`);
    
    errorLog.forEach((err) => {
      if (Analytics.trackError) {
        Analytics.trackError(new Error(err.message || 'Unknown'), {
          type: err.type,
          fatal: err.fatal || false,
          url: err.url,
          timestamp: err.timestamp
        });
      }
    });
    
    // Clear queue after sync
    localStorage.setItem(ERROR_STORAGE_KEY, JSON.stringify([]));
    logError('Error queue synced successfully');
    
  } catch (syncError) {
    console.warn('Error Handler: Failed to sync error queue', syncError);
  }
}

// Show user-friendly error message (non-intrusive toast)
function showUserError(message, type = 'error', duration = 5000) {
  const toast = document.createElement('div');
  toast.className = `error-toast ${type}`;
  toast.innerHTML = `
    <i class="fas ${type === 'error' ? 'fa-exclamation-triangle' : 'fa-info-circle'}"></i>
    <span>${message}</span>
    <button class="close-toast" onclick="this.parentElement.remove()">&times;</button>
  `;
  
  // Styles (injected if not in CSS)
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'error' ? 'rgba(255, 107, 107, 0.95)' : 'rgba(33, 150, 243, 0.95)'};
    color: white;
    padding: 12px 20px;
    border-radius: 6px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    z-index: 10001;
    max-width: 350px;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
    animation: slideInRight 0.3s ease;
  `;
  
  const closeBtn = toast.querySelector('.close-toast');
  closeBtn.style.cssText = `
    background: none;
    border: none;
    color: white;
    font-size: 18px;
    cursor: pointer;
    margin-left: auto;
    padding: 0 4px;
    opacity: 0.8;
  `;
  closeBtn.addEventListener('mouseenter', () => closeBtn.style.opacity = '1');
  closeBtn.addEventListener('mouseleave', () => closeBtn.style.opacity = '0.8');
  
  document.body.appendChild(toast);
  
  // Auto-remove
  setTimeout(() => {
    if (toast.parentNode) toast.remove();
  }, duration);
  
  // Inject animation if needed
  if (!document.querySelector('#error-toast-styles')) {
    const style = document.createElement('style');
    style.id = 'error-toast-styles';
    style.textContent = `
      @keyframes slideInRight {
        from { opacity: 0; transform: translateX(100%); }
        to { opacity: 1; transform: translateX(0); }
      }
    `;
    document.head.appendChild(style);
  }
}

// Handle global sync errors (window.onerror)
function handleGlobalError(message, source, lineno, colno, error) {
  if (!ERROR_TRACKING_ENABLED) return false; // Allow default handling
  
  const errorData = {
    message,
    source: source || window.location.href,
    line: lineno,
    column: colno,
    type: 'javascript-error',
    fatal: true
  };
  
  logError('Global error caught', errorData);
  
  // Don't track if it's a resource load error (ignore CSS/JS 404s)
  if (source && source.includes('chrome-extension://') || message.includes('Script error')) {
    logError('Ignoring browser/extension error', errorData);
    return false;
  }
  
  // Queue and track
  queueError(errorData);
  if (Analytics && Analytics.trackError) {
    Analytics.trackError(error || new Error(message), { ...errorData, fatal: true });
  }
  
  // Show user message if not in dev tools or iframe
  if (!DEBUG && !window.parent !== window) {
    showUserError('An unexpected error occurred. Please refresh the page.', 'error');
  }
  
  // Prevent default bubbling if we handled it
  return true; // Return true to prevent default console error
}

// Handle async errors (unhandledrejection)
function handleUnhandledRejection(event) {
  if (!ERROR_TRACKING_ENABLED) return;
  
  const error = event.reason || event;
  const errorData = {
    message: error.message || 'Unhandled promise rejection',
    stack: error.stack,
    type: 'promise-rejection',
    fatal: true
  };
  
  logError('Unhandled promise rejection', errorData);
  queueError(errorData);
  
  if (Analytics && Analytics.trackError) {
    Analytics.trackError(error, errorData);
  }
  
  // Prevent default (don't show unhandled rejection warning)
  event.preventDefault();
  
  if (!DEBUG) {
    showUserError('A background task failed. The app will continue working.', 'error', 4000);
  }
}

// Network error handler
function handleNetworkError(event) {
  if (!ERROR_TRACKING_ENABLED) return;
  
  const errorData = {
    message: event.message || 'Network request failed',
    type: 'network-error',
    url: event.target?.url || window.location.href,
    status: event.status || 'unknown',
    fatal: false // Recoverable
  };
  
  logError('Network error', errorData);
  queueError(errorData);
  
  if (Analytics && Analytics.trackError) {
    Analytics.trackError(new Error(errorData.message), errorData);
  }
  
  // Show offline message if needed
  if (!navigator.onLine && event.type === 'error') {
    showUserError('You are offline. Some features may be limited.', 'error');
  }
}

// Retry mechanism for recoverable errors
export function retryOperation(operation, maxRetries = RETRY_ATTEMPTS, delay = 1000) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    
    function attempt() {
      attempts++;
      operation()
        .then(resolve)
        .catch((error) => {
          const errorData = { type: 'retry-failure', attempt: attempts, error: error.message };
          logError(`Retry attempt ${attempts} failed`, errorData);
          
          if (attempts < maxRetries && RECOVERABLE_ERROR_TYPES.includes(errorData.type)) {
            // Exponential backoff
            const nextDelay = delay * Math.pow(2, attempts - 1);
            setTimeout(attempt, nextDelay);
            queueError(errorData);
          } else {
            queueError({ ...errorData, final: true, fatal: true });
            if (Analytics && Analytics.trackError) {
              Analytics.trackError(error, { ...errorData, final: true });
            }
            reject(error);
          }
        });
    }
    
    attempt();
  });
}

// Wrap async functions with error handling
export function safeAsync(fn, context = {}) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      const errorData = {
        type: 'async-error',
        function: fn.name || 'anonymous',
        ...context
      };
      logError('Async function error', errorData);
      queueError({ ...errorData, message: error.message, stack: error.stack });
      
      if (Analytics && Analytics.trackError) {
        Analytics.trackError(error, errorData);
      }
      
      // Re-throw for caller to handle
      throw error;
    }
  };
}

// Initialize Error Handler
function initializeErrorHandler() {
  if (!ERROR_TRACKING_ENABLED) {
    logError('Error handling disabled');
    return;
  }
  
  // Global error handler
  window.onerror = handleGlobalError;
  
  // Unhandled promise rejections
  window.addEventListener('unhandledrejection', handleUnhandledRejection);
  
  // Network errors (XHR/fetch)
  window.addEventListener('error', handleNetworkError, true); // Capture phase for network
  
  // Resource load errors (images, scripts)
  // Note: These are handled in global onerror above
  
  // Sync queue on online (if analytics available)
  if (Analytics) {
    window.addEventListener('online', syncErrorQueue);
  }
  
  // Initial sync
  syncErrorQueue();
  
  logError('Error handler initialized');
  
  // Export for external use
  window.ErrorHandler = {
    retry: retryOperation,
    safeAsync,
    queueError,
    syncQueue: syncErrorQueue,
    showUserError
  };
}

// Handle early errors (before DOM ready)
if (window.addEventListener) {
  // Syntax errors might occur before this
  initializeErrorHandler();
} else if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeErrorHandler);
} else {
  initializeErrorHandler();
}

// Export main functions
export {
  retryOperation,
  safeAsync,
  queueError,
  syncErrorQueue,
  showUserError,
  handleGlobalError, // For advanced use
  handleUnhandledRejection // For advanced use
};

logError('Error handler script loaded');
