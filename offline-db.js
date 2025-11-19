// offline-db.js - IndexedDB for Offline Queuing in Top Autocare PWA
// Handles offline forms (e.g., bookings), syncs via Background Sync or on online

const DB_NAME = 'TopAutocareOfflineDB';
const DB_VERSION = 1;
const STORE_NAME = 'queue'; // For pending actions (bookings, updates)

// Open DB and handle upgrades
let db;
const request = indexedDB.open(DB_NAME, DB_VERSION);
request.onerror = () => console.error('Offline DB failed to open');
request.onsuccess = (event) => { db = event.target.result; };
request.onupgradeneeded = (event) => {
  db = event.target.result;
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
  }
};

// Add action to queue (e.g., booking)
export async function queueAction(actionType, data) {
  if (!db) return false;
  
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const queuedItem = {
    id: Date.now() + Math.random(), // Unique ID
    type: actionType, // e.g., 'bookAppointment'
    data,
    timestamp: Date.now(),
    retries: 0,
    status: 'pending'
  };
  
  const request = store.add(queuedItem);
  request.onsuccess = () => console.log('Queued offline:', queuedItem);
  request.onerror = (e) => console.error('Queue failed:', e);
  
  // Show user feedback
  showToast(`Action queued. Will sync when online.`, 'info');
  return true;
}

// Sync queue (call on 'online' or background sync)
export async function syncQueue() {
  if (!db || !navigator.onLine) return;
  
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const getAllRequest = store.getAll();
  
  getAllRequest.onsuccess = async () => {
    const pending = getAllRequest.result.filter(item => item.status === 'pending');
    
    for (const item of pending) {
      try {
        // Simulate API call (replace with your firebase-utils.js call)
        if (item.type === 'bookAppointment') {
          // e.g., await firebaseUtils.bookAppointment(item.data, user.uid);
          console.log('Syncing booking:', item.data);
          // On success:
          item.status = 'synced';
        }
        
        // Retry logic (up to 3)
        if (item.retries < 3) {
          item.retries++;
        } else {
          item.status = 'failed';
          showToast('Some offline actions failed. Check dashboard.', 'error');
        }
        
        await store.put(item);
        
      } catch (error) {
        console.error('Sync failed for item:', item.id, error);
        item.status = 'failed';
        await store.put(item);
      }
    }
    
    // Clear old/failed items (keep 7 days)
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const oldItems = getAllRequest.result.filter(item => Date.now() - item.timestamp > cutoff);
    oldItems.forEach(item => store.delete(item.id));
  };
}

// Background Sync Registration (call in main JS or SW message)
export function registerBackgroundSync() {
  if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
    navigator.serviceWorker.ready.then(registration => {
      registration.sync.register('sync-queue')
        .then(() => console.log('Background sync registered'))
        .catch(err => console.error('Background sync failed:', err));
    });
  }
  
  // On online, sync
  window.addEventListener('online', syncQueue);
}

// Utility: Show toast (from error-handler.js or inline)
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed; bottom: 20px; right: 20px; background: ${type === 'error' ? '#ff6b6b' : '#4CAF50'}; 
    color: white; padding: 1rem; border-radius: 5px; z-index: 1000;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// Export for use (e.g., in book-appointment.html)
window.OfflineDB = { queueAction, syncQueue, registerBackgroundSync };
