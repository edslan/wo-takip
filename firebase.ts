
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD2WDVeacOmFX5ZNli0UTUkSC4iLON1DFM",
  authDomain: "wdwdwd-32b6b.firebaseapp.com",
  projectId: "wdwdwd-32b6b",
  storageBucket: "wdwdwd-32b6b.firebasestorage.app",
  messagingSenderId: "539347771484",
  appId: "1:539347771484:web:26fe4a70d54f42c0a20699",
  measurementId: "G-ENM50J0R2P"
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);
