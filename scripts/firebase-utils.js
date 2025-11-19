// firebase-utils.js - Firebase Utilities for Top Autocare Garage
// Self-contained module for Firebase operations (Auth, Firestore, Storage)
// Integrates with config.js (firebaseConfig) and error-handler.js
// Usage: import { authUtils, firestoreUtils } from './firebase-utils.js';

let firebaseApp, auth, db, storage, analytics;
let Config, ErrorHandler, Analytics;

// Lazy load Firebase SDKs and config
async function initializeFirebase() {
  if (firebaseApp) return; // Already initialized
  
  try {
    // Load config
    Config = (await import('./config.js')).default;
    
    // Load Firebase SDKs
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
    const { 
      getAuth, 
      createUserWithEmailAndPassword, 
      signInWithEmailAndPassword, 
      signOut, 
      sendEmailVerification, 
      updateProfile,
      onAuthStateChanged,
      sendPasswordResetEmail
    } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
    const { 
      getFirestore, 
      doc, 
      getDoc, 
      setDoc, 
      addDoc, 
      updateDoc, 
      deleteDoc, 
      collection, 
      query, 
      where, 
      orderBy, 
      limit, 
      getDocs, 
      onSnapshot,
      serverTimestamp,
      writeBatch 
    } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const { getStorage, ref, uploadBytes, getDownloadURL } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js');
    const { getAnalytics, logEvent } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js');
    
    // Initialize Firebase App
    firebaseApp = initializeApp(Config.firebaseConfig);
    
    // Initialize services
    auth = getAuth(firebaseApp);
    db = getFirestore(firebaseApp);
    storage = getStorage(firebaseApp);
    analytics = getAnalytics(firebaseApp);
    
    // Load optional integrations
    try {
      ErrorHandler = (await import('./error-handler.js')).safeAsync;
      Analytics = await import('./analytics.js');
    } catch (err) {
      console.warn('Firebase Utils: Optional integrations not loaded');
    }
    
    console.log('🔥 Firebase initialized successfully');
    
  } catch (error) {
    console.error('Firebase Utils: Initialization failed', error);
    if (ErrorHandler) ErrorHandler.trackError(error, { context: 'firebase-init' });
    throw error;
  }
}

// === AUTH UTILITIES ===
export const authUtils = {
  // Sign up new user
  async signUp(email, password, profile = {}) {
    await initializeFirebase();
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Send verification email
      await sendEmailVerification(user);
      
      // Update profile if provided
      if (profile.displayName || profile.photoURL) {
        await updateProfile(user, profile);
      }
      
      // Save to Firestore
      await firestoreUtils.saveUser(user.uid, {
        email,
        fullName: profile.displayName || email.split('@')[0],
        phone: profile.phone || '',
        role: 'user',
        photoURL: profile.photoURL || null,
        emailVerified: false
      });
      
      if (Analytics) Analytics.trackEvent('user_signup', { method: 'email' });
      return user;
      
    } catch (error) {
      if (ErrorHandler) ErrorHandler.trackError(error, { context: 'auth-signup' });
      throw error;
    }
  },
  
  // Sign in user
  async signIn(email, password) {
    await initializeFirebase();
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Update last login
      await firestoreUtils.updateUser(user.uid, { lastLogin: new Date() });
      
      if (Analytics) Analytics.trackEvent('user_login', { method: 'email' });
      return user;
      
    } catch (error) {
      if (ErrorHandler) ErrorHandler.trackError(error, { context: 'auth-signin' });
      throw error;
    }
  },
  
  // Sign out user
  async signOut() {
    await initializeFirebase();
    try {
      await signOut(auth);
      if (Analytics) Analytics.trackEvent('user_signout');
      localStorage.removeItem(Config.appConstants.storageKeys.USER_TOKEN);
      return true;
    } catch (error) {
      if (ErrorHandler) ErrorHandler.trackError(error, { context: 'auth-signout' });
      throw error;
    }
  },
  
  // Send password reset email
  async sendPasswordReset(email) {
    await initializeFirebase();
    try {
      await sendPasswordResetEmail(auth, email);
      if (Analytics) Analytics.trackEvent('password_reset_requested');
      return true;
    } catch (error) {
      if (ErrorHandler) ErrorHandler.trackError(error, { context: 'password-reset' });
      throw error;
    }
  },
  
  // Auth state listener (returns unsubscribe function)
  onAuthStateChanged(callback) {
    initializeFirebase(); // Ensure init
    return onAuthStateChanged(auth, callback);
  },
  
  // Get current user
  getCurrentUser() {
    initializeFirebase();
    return auth.currentUser;
  },
  
  // Update user profile
  async updateProfile(uid, updates) {
    await initializeFirebase();
    try {
      const userRef = doc(db, Config.appConstants.collections.USERS, uid);
      await updateDoc(userRef, updates);
      if (Analytics) Analytics.trackEvent('profile_updated', updates);
      return true;
    } catch (error) {
      if (ErrorHandler) ErrorHandler.trackError(error, { context: 'update-profile' });
      throw error;
    }
  }
};

// === FIRESTORE UTILITIES ===
export const firestoreUtils = {
  // Initialize (returns db)
  getDB() {
    initializeFirebase();
    return db;
  },
  
  // Get collection reference
  collection(collectionName) {
    initializeFirebase();
    return collection(db, collectionName);
  },
  
  // Get document reference
  doc(collectionName, id) {
    initializeFirebase();
    return doc(db, collectionName, id);
  },
  
  // Get single document
  async getDoc(collectionName, id) {
    await initializeFirebase();
    try {
      const docRef = doc(db, collectionName, id);
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
    } catch (error) {
      if (ErrorHandler) ErrorHandler.trackError(error, { context: 'firestore-get-doc', collection: collectionName });
      throw error;
    }
  },
  
  // Save/Update document (setDoc with merge)
  async saveDoc(collectionName, id, data, merge = true) {
    await initializeFirebase();
    try {
      const docRef = doc(db, collectionName, id);
      await setDoc(docRef, data, { merge });
      if (Analytics && data.status) Analytics.trackEvent(`${collectionName}_updated`, { id, status: data.status });
      return docRef;
    } catch (error) {
      if (ErrorHandler) ErrorHandler.trackError(error, { context: 'firestore-save-doc', collection: collectionName });
      throw error;
    }
  },
  
  // Add new document (addDoc)
  async addDoc(collectionName, data) {
    await initializeFirebase();
    try {
      const docRef = await addDoc(collection(db, collectionName), { ...data, createdAt: serverTimestamp() });
      if (Analytics) Analytics.trackEvent(`${collectionName}_created`, { id: docRef.id });
      return docRef;
    } catch (error) {
      if (ErrorHandler) ErrorHandler.trackError(error, { context: 'firestore-add-doc', collection: collectionName });
      throw error;
    }
  },
  
  // Update document (updateDoc)
  async updateDoc(collectionName, id, updates) {
    await initializeFirebase();
    try {
      const docRef = doc(db, collectionName, id);
      await updateDoc(docRef, updates);
      if (Analytics) Analytics.trackEvent(`${collectionName}_updated`, { id });
      return docRef;
    } catch (error) {
      if (ErrorHandler) ErrorHandler.trackError(error, { context: 'firestore-update-doc', collection: collectionName });
      throw error;
    }
  },
  
  // Delete document
  async deleteDoc(collectionName, id) {
    await initializeFirebase();
    try {
      const docRef = doc(db, collectionName, id);
      await deleteDoc(docRef);
      if (Analytics) Analytics.trackEvent(`${collectionName}_deleted`, { id });
      return true;
    } catch (error) {
      if (ErrorHandler) ErrorHandler.trackError(error, { context: 'firestore-delete-doc', collection: collectionName });
      throw error;
    }
  },
  
  // Query collection (with options)
  async queryCollection(collectionName, qOptions = {}) {
    await initializeFirebase();
    try {
      let q = collection(db, collectionName);
      
      // Apply filters
      if (qOptions.where) {
        qOptions.where.forEach(({ field, op, value }) => {
          q = query(q, where(field, op, value));
        });
      }
      
      // Order by
      if (qOptions.orderBy) {
        q = query(q, orderBy(qOptions.orderBy.field, qOptions.orderBy.direction || 'desc'));
      }
      
      // Limit
      if (qOptions.limit) {
        q = query(q, limit(qOptions.limit));
      }
      
      const querySnapshot = await getDocs(q);
      const docs = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      
      if (Analytics) Analytics.trackEvent('collection_queried', { collection: collectionName, count: docs.length });
      return docs;
      
    } catch (error) {
      if (ErrorHandler) ErrorHandler.trackError(error, { context: 'firestore-query', collection: collectionName, options: qOptions });
      throw error;
    }
  },
  
  // Real-time listener (returns unsubscribe)
  onCollectionSnapshot(collectionName, callback, qOptions = {}) {
    initializeFirebase();
    try {
      let q = collection(db, collectionName);
      
      if (qOptions.where) {
        qOptions.where.forEach(({ field, op, value }) => {
          q = query(q, where(field, op, value));
        });
      }
      
      if (qOptions.orderBy) {
        q = query(q, orderBy(qOptions.orderBy.field, qOptions.orderBy.direction || 'desc'));
      }
      
      if (qOptions.limit) {
        q = query(q, limit(qOptions.limit));
      }
      
      return onSnapshot(q, (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        callback(docs, snapshot);
      });
      
    } catch (error) {
      if (ErrorHandler) ErrorHandler.trackError(error, { context: 'firestore-snapshot', collection: collectionName });
      throw error;
    }
  },
  
  // User-specific utilities
  async getUser(uid) {
    return await firestoreUtils.getDoc(Config.appConstants.collections.USERS, uid);
  },
  
  async saveUser(uid, userData) {
    return await firestoreUtils.saveDoc(Config.appConstants.collections.USERS, uid, {
      ...userData,
      updatedAt: serverTimestamp()
    });
  },
  
  // Appointment utilities
  async getUserAppointments(uid, status = null, limit = 10) {
    const qOptions = { where: [{ field: 'userId', op: '==', value: uid }] };
    if (status) qOptions.where.push({ field: 'status', op: '==', value: status });
    qOptions.orderBy = { field: 'date', direction: 'desc' };
    qOptions.limit = limit;
    return await firestoreUtils.queryCollection(Config.appConstants.collections.APPOINTMENTS, qOptions);
  },
  
  async bookAppointment(appointmentData, userId) {
    return await firestoreUtils.addDoc(Config.appConstants.collections.APPOINTMENTS, {
      ...appointmentData,
      userId,
      status: 'pending',
      createdAt: serverTimestamp()
    });
  },
  
  // Vehicle utilities
  async getUserVehicles(uid) {
    return await firestoreUtils.queryCollection(Config.appConstants.collections.VEHICLES, {
      where: [{ field: 'userId', op: '==', value: uid }]
    });
  },
  
  async addVehicle(vehicleData, userId) {
    return await firestoreUtils.addDoc(Config.appConstants.collections.VEHICLES, {
      ...vehicleData,
      userId,
      createdAt: serverTimestamp()
    });
  },
  
  // Batch operations (for multiple writes)
  async batchWrite(operations) {
    await initializeFirebase();
    try {
      const batch = writeBatch(db);
      operations.forEach((op) => {
        if (op.type === 'set') batch.set(doc(db, op.collection, op.id), op.data);
        if (op.type === 'update') batch.update(doc(db, op.collection, op.id), op.data);
        if (op.type === 'delete') batch.delete(doc(db, op.collection, op.id));
      });
      await batch.commit();
      if (Analytics) Analytics.trackEvent('batch_write', { operations: operations.length });
      return true;
    } catch (error) {
      if (ErrorHandler) ErrorHandler.trackError(error, { context: 'firestore-batch' });
      throw error;
    }
  }
};

// === STORAGE UTILITIES (Firebase Storage) ===
export const storageUtils = {
  // Upload file
  async uploadFile(file, path) {
    await initializeFirebase();
    try {
      const storageRef = ref(storage, path);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      if (Analytics) Analytics.trackEvent('file_uploaded', { path });
      return downloadURL;
    } catch (error) {
      if (ErrorHandler) ErrorHandler.trackError(error, { context: 'storage-upload', path });
      throw error;
    }
  },
  
  // Delete file
  async deleteFile(path) {
    await initializeFirebase();
    try {
      const storageRef = ref(storage, path);
      await deleteObject(storageRef);
      if (Analytics) Analytics.trackEvent('file_deleted', { path });
      return true;
    } catch (error) {
      if (ErrorHandler) ErrorHandler.trackError(error, { context: 'storage-delete', path });
      throw error;
    }
  }
};

// === ANALYTICS UTILITIES (Firebase Analytics) ===
export const analyticsUtils = {
  logEvent(eventName, params = {}) {
    initializeFirebase();
    if (analytics) {
      logEvent(analytics, eventName, params);
      if (Analytics) Analytics.trackEvent(eventName, params); // Also to custom analytics
      return true;
    }
    console.warn('Analytics not available');
    return false;
  },
  
  setUserProperty(name, value) {
    initializeFirebase();
    if (analytics && name && value !== undefined) {
      analytics.setUserProperties({ [name]: value });
      if (Analytics) Analytics.setUserProperties({ [name]: value });
    }
  }
};

// === MAIN EXPORTS ===
export default {
  authUtils,
  firestoreUtils,
  storageUtils,
  analyticsUtils,
  initialize: initializeFirebase
};

// Auto-initialize if not in module context (optional)
if (typeof window !== 'undefined' && !window.FirebaseUtils) {
  window.FirebaseUtils = {
    auth: authUtils,
    firestore: firestoreUtils,
    storage: storageUtils,
    analytics: analyticsUtils,
    init: initializeFirebase
  };
  console.log('🔥 Firebase Utils loaded globally');
}
