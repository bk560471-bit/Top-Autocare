// analytics.js - Analytics Tracking for Top Autocare Garage
// Self-contained vanilla JS implementation using Firebase Analytics
// Tracks page views, events, performance, and errors without external dependencies
// Integrates with config.js for settings and privacy compliance

// Import configuration (if using modules) or fallback to global
let Config;
try {
  // If using ES modules (recommended in <script type="module">)
  Config = await import('./config.js');
  Config = Config.default; // Handle default export
} catch (error) {
  // Fallback for non-module scripts (load config globally if needed)
  Config = window.Config || {};
  console.warn('Analytics: Config not loaded as module, using fallback');
}

const DEBUG = Config.environment?.isDevelopment?.() || false;
const ANALYTICS_ENABLED = true; // Set to false for privacy/disabled mode
const OFFLINE_QUEUE_KEY = Config.appConstants?.storageKeys?.OFFLINE_QUEUE || 'top-autocare-analytics-queue';
const MAX_QUEUE_SIZE = 100; // Prevent unlimited growth
const USER_ID_KEY = 'top-autocare-anon-id'; // Anonymous user ID

// Firebase Analytics (if Firebase is loaded)
let firebaseAnalytics = null;
let gtag = null; // For Google Analytics 4 (GA4) if preferred

// Initialize Anonymous User ID
function getOrCreateAnonId() {
  let anonId = localStorage.getItem(USER_ID_KEY);
  if (!anonId) {
    anonId = 'anon_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem(USER_ID_KEY, anonId);
  }
  return anonId;
}

// Utility: Log messages (debug mode only)
function log(message, data = null) {
  if (DEBUG || !ANALYTICS_ENABLED) {
    console.log(`[Analytics] ${message}`, data || '');
  }
}

// Queue events for offline (LocalStorage fallback)
function queueEvent(eventName, params = {}) {
  if (!ANALYTICS_ENABLED) return;
  
  try {
    let queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
    queue.unshift({ // Add to front (most recent first)
      event: eventName,
      params,
      timestamp: Date.now(),
      userId: getOrCreateAnonId()
    });
    
    // Limit queue size
    if (queue.length > MAX_QUEUE_SIZE) {
      queue = queue.slice(0, MAX_QUEUE_SIZE);
    }
    
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    log(`Queued event offline: ${eventName}`);
  } catch (error) {
    console.warn('Analytics: Failed to queue event', error);
  }
}

// Sync queued events when online
function syncOfflineQueue() {
  if (!ANALYTICS_ENABLED || !navigator.onLine || firebaseAnalytics === null) return;
  
  try {
    let queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
    if (queue.length === 0) return;
    
    log(`Syncing ${queue.length} offline events`);
    let syncedCount = 0;
    
    queue.forEach((item) => {
      try {
        // Filter old events (keep only 24h old)
        if (Date.now() - item.timestamp > 24 * 60 * 60 * 1000) {
          log('Skipping old offline event');
          return;
        }
        
        // Send to Firebase Analytics
        firebaseAnalytics.logEvent(item.event, item.params);
        syncedCount++;
      } catch (error) {
        console.warn('Analytics: Failed to sync offline event', error);
      }
    });
    
    // Clear queue after sync (or remove synced items)
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue.slice(syncedCount)));
    log(`Synced ${syncedCount} offline events`);
    
  } catch (error) {
    console.warn('Analytics: Failed to sync queue', error);
  }
}

// Initialize Firebase Analytics (if Firebase is available)
function initializeFirebaseAnalytics() {
  if (!ANALYTICS_ENABLED) {
    log('Analytics disabled');
    return;
  }
  
  try {
    // Check if Firebase Analytics is loaded (from main Firebase script)
    if (typeof firebase !== 'undefined' && firebase.analytics) {
      import('https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js')
        .then(({ getAnalytics }) => {
          firebaseAnalytics = getAnalytics(firebase.app());
          log('Firebase Analytics initialized');
          
          // Set anonymous user ID
          firebaseAnalytics.setUserId(getOrCreateAnonId());
          
          // Sync any queued events
          syncOfflineQueue();
        })
        .catch((error) => {
          console.warn('Analytics: Failed to load Firebase Analytics', error);
          // Fallback to GA4 or custom logging
          initializeGoogleAnalytics();
        });
    } else {
      log('Firebase not loaded, falling back to GA4');
      initializeGoogleAnalytics();
    }
  } catch (error) {
    console.warn('Analytics: Initialization failed', error);
  }
}

// Fallback: Initialize Google Analytics 4 (GA4) via gtag.js
function initializeGoogleAnalytics() {
  if (!ANALYTICS_ENABLED) return;
  
  const gaMeasurementId = Config.firebaseConfig?.measurementId || 'G-T5NDM5M33Z';
  if (!gaMeasurementId || gaMeasurementId === 'G-T5NDM5M33Z') {
    log('No valid GA Measurement ID, skipping GA4');
    return;
  }
  
  // Load gtag.js if not already loaded
  if (typeof gtag === 'undefined') {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`;
    document.head.appendChild(script);
    
    window.dataLayer = window.dataLayer || [];
    window.gtag = function() { dataLayer.push(arguments); };
    gtag('js', new Date());
    gtag('config', gaMeasurementId, {
      anonymize_ip: true, // Privacy: Anonymize IP
      send_page_view: false // Manual page view tracking
    });
    
    log('Google Analytics 4 initialized');
  }
  
  // Set anonymous user ID
  gtag('set', 'user_id', getOrCreateAnonId());
  
  // Sync queue (GA4 events)
  syncOfflineQueueGA4();
}

// Sync offline queue for GA4
function syncOfflineQueueGA4() {
  let queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
  if (queue.length === 0) return;
  
  queue.forEach((item) => {
    if (Date.now() - item.timestamp > 24 * 60 * 60 * 1000) return;
    gtag('event', item.event, { ...item.params, event_callback: () => log(`GA4 event sent: ${item.event}`) });
  });
  
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify([])); // Clear after sync
}

// Track Page View
export function trackPageView(pageTitle = document.title, pageLocation = window.location.href) {
  if (!ANALYTICS_ENABLED) return;
  
  log('Tracking page view:', pageTitle);
  
  if (firebaseAnalytics) {
    firebaseAnalytics.logEvent('page_view', {
      page_title: pageTitle,
      page_location: pageLocation,
      page_referrer: document.referrer || ''
    });
  } else if (gtag) {
    gtag('event', 'page_view', {
      page_title: pageTitle,
      page_location: pageLocation,
      page_referrer: document.referrer || ''
    });
  } else {
    // Queue if not initialized
    queueEvent('page_view', { page_title: pageTitle, page_location: pageLocation });
  }
  
  // Auto-track on page load if not already called
  if (!window._analyticsPageTracked) {
    window.addEventListener('load', () => trackPageView());
    window._analyticsPageTracked = true;
  }
}

// Track Custom Event
export function trackEvent(eventName, params = {}) {
  if (!ANALYTICS_ENABLED) return;
  
  // Standardize params
  const eventParams = {
    event_category: 'user_action',
    event_timestamp: Date.now(),
    user_id: getOrCreateAnonId(),
    ...params
  };
  
  log(`Tracking event: ${eventName}`, eventParams);
  
  if (firebaseAnalytics) {
    firebaseAnalytics.logEvent(eventName, eventParams);
  } else if (gtag) {
    gtag('event', eventName, eventParams);
  } else {
    queueEvent(eventName, eventParams);
  }
}

// Track User Properties (set once, like role)
export function setUserProperties(properties = {}) {
  if (!ANALYTICS_ENABLED || firebaseAnalytics) return;
  
  const userProps = {
    user_id: getOrCreateAnonId(),
    role: properties.role || 'guest',
    ...properties
  };
  
  if (firebaseAnalytics) {
    firebaseAnalytics.setUserProperties(userProps);
  } else if (gtag) {
    // GA4 doesn't have direct user properties, use custom dimensions or events
    gtag('set', { ...userProps });
    gtag('event', 'user_properties_set', userProps);
  }
  
  log('User properties set:', userProps);
}

// Track Errors (console.error wrapper)
export function trackError(error, context = {}) {
  if (!ANALYTICS_ENABLED) return console.error(error);
  
  const errorData = {
    error_message: error.message || error,
    error_type: error.name || 'unknown',
    error_stack: error.stack || '',
    context: context,
    user_id: getOrCreateAnonId()
  };
  
  log('Tracking error:', errorData);
  
  if (firebaseAnalytics) {
    firebaseAnalytics.logEvent('exception', {
      description: `${errorData.error_type}: ${errorData.error_message}`,
      fatal: context.fatal || false
    });
  } else if (gtag) {
    gtag('event', 'exception', {
      description: `${errorData.error_type}: ${errorData.error_message}`,
      fatal: context.fatal || false
    });
  } else {
    queueEvent('exception', errorData);
  }
  
  // Also log to console
  console.error('[Analytics Error]', error, context);
}

// Track Performance (e.g., page load time)
export function trackPerformance(metric = 'page_load', value = performance.now()) {
  if (!ANALYTICS_ENABLED) return;
  
  const perfData = {
    metric_type: metric,
    value,
    user_id: getOrCreateAnonId()
  };
  
  log(`Tracking performance: ${metric}`, perfData);
  
  if (firebaseAnalytics) {
    firebaseAnalytics.logEvent('timing_complete', {
      name: metric,
      event_category: 'performance',
      value: Math.round(value),
      event_label: document.title
    });
  } else if (gtag) {
    gtag('event', 'timing_complete', {
      name: metric,
      event_category: 'performance',
      value: Math.round(value),
      event_label: document.title
    });
  } else {
    queueEvent('timing_complete', perfData);
  }
}

// Auto-track common interactions (e.g., button clicks)
export function autoTrackInteractions(selectors = ['button', '[data-track]', 'a']) {
  selectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((element) => {
      element.addEventListener('click', (e) => {
        const trackName = element.dataset.track || element.textContent?.trim().slice(0, 50) || 'click';
        const trackLabel = element.innerText?.trim().slice(0, 100) || 'unknown';
        
        trackEvent('user_interaction', {
          interaction_type: 'click',
          element: selector,
          track_name: trackName,
          track_label: trackLabel,
          url: window.location.href
        });
      });
    });
  });
  
  log('Interaction auto-tracking enabled');
}

// Initialize Analytics on Load
function initializeAnalytics() {
  if (!ANALYTICS_ENABLED) {
    log('Analytics disabled globally');
    return;
  }
  
  // Track initial page load performance
  if (performance.timing) {
    const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
    trackPerformance('page_load_time_ms', loadTime);
  }
  
  // Track page view
  trackPageView();
  
  // Auto-track interactions (after DOM ready)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => autoTrackInteractions());
  } else {
    autoTrackInteractions();
  }
  
  // Listen for online/offline for queue sync
  window.addEventListener('online', syncOfflineQueue);
  window.addEventListener('load', syncOfflineQueue);
  
  // Error tracking
  window.addEventListener('error', (e) => {
    trackError(e.error, { fatal: true, url: window.location.href });
  });
  
  window.addEventListener('unhandledrejection', (e) => {
    trackError(e.reason, { fatal: false, type: 'promise_rejection' });
  });
  
  // Initialize Firebase Analytics
  initializeFirebaseAnalytics();
  
  log('Analytics fully initialized');
}

// Export functions for external use
export {
  trackPageView,
  trackEvent,
  setUserProperties,
  trackError,
  trackPerformance,
  autoTrackInteractions,
  queueEvent,
  syncOfflineQueue,
  getOrCreateAnonId,
  initializeAnalytics
};

// Auto-initialize if script is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeAnalytics);
} else {
  initializeAnalytics();
}

log('Analytics script loaded');
