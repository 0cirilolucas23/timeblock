import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";


const firebaseConfig = {
  apiKey: "AIzaSyDRr4_rINQHDjQ3kdYyV_I2DIRw9k4Xs5w",
  authDomain: "timeblock-app-2ae6f.firebaseapp.com",
  projectId: "timeblock-app-2ae6f",
  storageBucket: "timeblock-app-2ae6f.firebasestorage.app",
  messagingSenderId: "706243876720",
  appId: "1:706243876720:web:fcc7c49403e7bb6924a1b5",
  measurementId: "G-BVSZ7P2XP7"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);