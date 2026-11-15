
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBjuCR-PRTnEy6ZwTzziBfPPoUX8CW0Jlc",
  authDomain: "patel-digital-studio.firebaseapp.com",
  databaseURL: "https://patel-digital-studio-default-rtdb.firebaseio.com",
  projectId: "patel-digital-studio",
  storageBucket: "patel-digital-studio.firebasestorage.app",
  messagingSenderId: "329824828116",
  appId: "1:329824828116:web:fa451ed90e2cc9416d9941",
  measurementId: "G-4HSWHQMSY7"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
        
