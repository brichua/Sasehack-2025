import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCSWm2MQJ0csgHl7f4yVUJdi7uFNvq1D-0",
  authDomain: "sasehacks2025.firebaseapp.com",
  databaseURL: "https://sasehacks2025-default-rtdb.firebaseio.com",
  projectId: "sasehacks2025",
  storageBucket: "sasehacks2025.firebasestorage.app",
  messagingSenderId: "534382805810",
  appId: "1:534382805810:web:d45ce79db68b1c6c84cd2b",
  measurementId: "G-SYP6JHTSJV"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
