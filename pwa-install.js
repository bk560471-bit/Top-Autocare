// pwa-install.js - PWA Installation Handler for Top Autocare Garage
// Self-contained vanilla JS for custom install prompt and handling

// Global variables to track PWA state
let deferredPrompt = null; // Stores the beforeinstallprompt event
let isInstalled = false; // Tracks if PWA is already installed
let installButton = null; // Reference to custom install button (if provided)
let installBanner = null; // Reference to custom install banner (if provided)

// DOM Elements - These can be set externally or fallback to default
const defaultInstallButtonId = 'installPWA'; // ID of button to show install prompt
const defaultInstallBannerId = 'pwaInstallBanner'; // ID of banner to show install prompt
const defaultCloseBannerId = 'closeInstallBanner'; // ID of close button for banner

// Utility: Log messages (can be disabled in production)
const debug = true;
function log(message, data = null) {
  if (debug) {
    console.log(`[PWA Installer] ${message}`, data || '');
  }
}

// Check if PWA is already installed (for Chrome/Edge)
function isPWAInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches || 
         window.navigator.standalone === true ||
         window.matchMedia('(display-mode: minimal-ui)').matches;
}

// Initialize PWA installation listener
function initializePWAInstall() {
  log('Initializing PWA installer...');

  // Check if already installed
  if (isPWAInstalled()) {
    log('PWA already installed or running in standalone mode');
    isInstalled = true;
    hideInstallUI();
    return;
  }

  // Listen for beforeinstallprompt event (Chrome/Edge)
  window.addEventListener('beforeinstallprompt', (e) => {
    log('beforeinstallprompt event fired', e);
    
    // Prevent default browser prompt
    e.preventDefault();
    
    // Store the event for later use
    deferredPrompt = e;
    
    // Show custom install UI
    showInstallUI();
  });

  // Listen for appinstalled event (confirm installation)
  window.addEventListener('appinstalled', (e) => {
    log('PWA was installed successfully', e);
    isInstalled = true;
    deferredPrompt = null;
    hideInstallUI();
    // Optional: Show thank you message
    showMessage('PWA installed successfully! Welcome to Top Autocare app.', 'success');
  });

  // Listen for abortinstall event (user dismissed install)
  window.addEventListener('appinstallabort', (e) => {
    log('PWA installation was aborted', e);
  });

  // Auto-hide install UI on page unload or if already installed
  window.addEventListener('beforeunload', () => {
    if (!isInstalled && deferredPrompt) {
      deferredPrompt = null;
    }
  });

  // Check for Safari iOS support (uses different approach)
  if ('serviceWorker' in navigator && window.safari) {
    log('Safari detected - using custom install logic');
    // For iOS Safari, show a persistent banner encouraging add to home screen
    showiOSInstallBanner();
  }

  log('PWA installer initialized');
}

// Show custom install UI (button or banner)
function showInstallUI() {
  log('Showing install UI');

  // Get or create install button
  installButton = document.getElementById(defaultInstallButtonId);
  if (!installButton) {
    // Create default button if not exists
    installButton = createDefaultInstallButton();
    document.body.appendChild(installButton);
  }
  installButton.style.display = 'block';
  installButton.addEventListener('click', handleInstallClick);

  // Get or create install banner
  installBanner = document.getElementById(defaultInstallBannerId);
  if (installBanner) {
    installBanner.style.display = 'block';
  }

  // Add close functionality to banner if present
  const closeButton = document.getElementById(defaultCloseBannerId);
  if (closeButton) {
    closeButton.addEventListener('click', hideInstallUI);
  }

  // Optional: Show banner after a delay or on scroll
  setTimeout(() => {
    if (installBanner) {
      installBanner.classList.add('show');
    }
  }, 2000); // Show after 2 seconds
}

// Hide install UI
function hideInstallUI() {
  log('Hiding install UI');
  
  if (installButton) {
    installButton.style.display = 'none';
    installButton.removeEventListener('click', handleInstallClick);
  }
  
  if (installBanner) {
    installBanner.style.display = 'none';
    installBanner.classList.remove('show');
  }

  // Clear stored prompt if dismissed
  if (deferredPrompt) {
    deferredPrompt.userChoice.then((choiceResult) => {
      log('User choice:', choiceResult.outcome);
    });
    deferredPrompt = null;
  }
}

// Handle install button click
async function handleInstallClick() {
  log('Install button clicked');
  
  if (!deferredPrompt) {
    log('No deferred prompt available');
    return;
  }

  hideInstallUI();
  
  // Trigger the install prompt
  deferredPrompt.prompt();
  
  // Wait for user choice
  const { outcome } = await deferredPrompt.userChoice;
  log('User response to install prompt:', outcome);
  
  deferredPrompt = null;
  
  if (outcome === 'accepted') {
    // User accepted - wait for appinstalled event
    showMessage('Installation started. You can now use the app from your home screen!', 'success');
  } else {
    // User dismissed - offer to show again later
    setTimeout(() => {
      if (deferredPrompt && !isInstalled) {
        showInstallUI();
      }
    }, 10000); // Show again after 10 seconds
  }
}

// iOS Safari specific handling (no beforeinstallprompt support)
function showiOSInstallBanner() {
  const banner = document.createElement('div');
  banner.id = 'iOSInstallBanner';
  banner.innerHTML = `
    <div style="
      position: fixed; 
      bottom: 0; 
      left: 0; 
      right: 0; 
      background: rgba(212, 175, 55, 0.95); 
      color: #000; 
      padding: 1rem; 
      text-align: center; 
      font-weight: 600; 
      z-index: 10000; 
      display: none;
      box-shadow: 0 -2px 10px rgba(0,0,0,0.3);
      border-top: 2px solid #b8962e;
    ">
      <i class="fas fa-mobile-alt"></i> 
      Add Top Autocare to your home screen for the best experience! 
      <span style="cursor: pointer; color: #ff6b6b; margin-left: 1rem;" onclick="this.parentElement.style.display='none'">&times;</span>
    </div>
  `;
  document.body.appendChild(banner);
  
  // Show banner after delay
  setTimeout(() => {
    banner.style.display = 'block';
    banner.classList.add('slide-up');
  }, 3000);
  
  log('iOS install banner shown');
}

// Create default install button (if none exists in HTML)
function createDefaultInstallButton() {
  const button = document.createElement('button');
  button.id = defaultInstallButtonId;
  button.innerHTML = `
    <i class="fas fa-download"></i> Install App
  `;
  button.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #d4af37;
    color: #000;
    border: none;
    border-radius: 50px;
    padding: 12px 20px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 15px rgba(212, 175, 55, 0.3);
    transition: all 0.3s ease;
    z-index: 9999;
    display: none;
    min-width: 120px;
    justify-content: center;
    align-items: center;
    gap: 5px;
  `;
  
  button.addEventListener('mouseenter', () => {
    button.style.background = '#b8962e';
    button.style.transform = 'translateY(-2px)';
  });
  
  button.addEventListener('mouseleave', () => {
    button.style.background = '#d4af37';
    button.style.transform = 'translateY(0)';
  });
  
  // Mobile responsiveness
  if (window.innerWidth < 768) {
    button.style.position = 'fixed';
    button.style.bottom = '80px'; // Above bottom nav if exists
    button.style.left = '50%';
    button.style.right = 'auto';
    button.style.transform = 'translateX(-50%)';
    button.style.minWidth = '200px';
  }
  
  log('Created default install button');
  return button;
}

// Show custom message (utility for install feedback)
function showMessage(message, type = 'info') {
  const existingMessage = document.querySelector('.pwa-message');
  if (existingMessage) existingMessage.remove();
  
  const div = document.createElement('div');
  div.className = `pwa-message message ${type}`;
  div.innerHTML = `
    <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
    ${message}
  `;
  div.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'success' ? 'rgba(76, 175, 80, 0.9)' : type === 'error' ? 'rgba(255, 0, 0, 0.9)' : 'rgba(33, 150, 243, 0.9)'};
    color: white;
    padding: 12px 20px;
    border-radius: 6px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    z-index: 10001;
    max-width: 300px;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
    animation: slideInRight 0.3s ease;
  `;
  
  document.body.appendChild(div);
  
  setTimeout(() => {
    if (div.parentNode) {
      div.remove();
    }
  }, 4000); // Auto-hide after 4 seconds
}

// Add CSS animations if needed
const style = document.createElement('style');
style.textContent = `
  @keyframes slideInRight {
    from { opacity: 0; transform: translateX(100%); }
    to { opacity: 1; transform: translateX(0); }
  }
  .slide-up {
    animation: slide-up 0.3s ease;
  }
  @keyframes slide-up {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }
  .pwa-message {
    animation: slideInRight 0.3s ease;
  }
`;
document.head.appendChild(style);

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePWAInstall);
} else {
  initializePWAInstall();
}

// Export functions for external use (e.g., from HTML onclick)
window.PWAInstall = {
  initialize: initializePWAInstall,
  showUI: showInstallUI,
  hideUI: hideInstallUI,
  isInstalled: () => isInstalled,
  install: () => deferredPrompt ? handleInstallClick() : log('No install prompt available')
};

log('PWA Installer script loaded successfully');
