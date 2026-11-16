
import { initializeApp, getApps, getApp } from "firebase/app";

import { getAuth } from "firebase/auth";

import { getFirestore } from "firebase/firestore";

import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "YOUR_EXISTING_API_KEY",
  authDomain: "patel-digital-studio.firebaseapp.com",
  databaseURL: "https://patel-digital-studio-default-rtdb.firebaseio.com",
  projectId: "patel-digital-studio",
  storageBucket: "patel-digital-studio.firebasestorage.app",
  messagingSenderId: "329824828116",
  appId: "1:329824828116:web:fa451ed90e2cc9416d9941",
  measurementId: "G-4HSWHQMSY7"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Firebase Authentication
export const auth = getAuth(app);

// Cloud Firestore
export const db = getFirestore(app);

// Firebase Realtime Database
export const rtdb = getDatabase(app);

// Main Firebase App
export { app };
