// ============================================================
// js/firebase-init.js  — Firebase Setup
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ============================================================
// YOUR FIREBASE CONFIG — already set up!
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyDaqnGh_w4fskz7yZKeff0tk4CRaN2e6tE",
  authDomain: "safesite-fed46.firebaseapp.com",
  projectId: "safesite-fed46",
  storageBucket: "safesite-fed46.firebasestorage.app",
  messagingSenderId: "153126968568",
  appId: "1:153126968568:web:fc711fa673621841c82f0d",
  measurementId: "G-RLY3MC7E3V"
};
// ============================================================

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// Expose globally so login.js and dashboard.js can use them
window._auth = auth;
window._db   = db;
window._fns  = { signInWithEmailAndPassword, signOut, onAuthStateChanged, collection, addDoc, serverTimestamp };

// ---- Route based on auth state ----
const currentPage = window.location.pathname.split('/').pop();

window._fns.onAuthStateChanged(auth, (user) => {
  if (user) {
    // Logged in — redirect to dashboard if on login page
    if (currentPage === 'index.html' || currentPage === '' || currentPage === '/') {
      window.location.href = 'dashboard.html';
    } else {
      // On dashboard — expose user
      if (typeof window.initDashboard === 'function') window.initDashboard(user);
    }
  } else {
    // Logged out — redirect to login if on dashboard
    if (currentPage === 'dashboard.html') {
      window.location.href = 'index.html';
    }
  }
});
