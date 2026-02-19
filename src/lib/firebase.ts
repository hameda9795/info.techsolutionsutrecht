// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAQRDcyzRF5H2qxYf_0MBLvsT1-20EpYxM",
    authDomain: "infotech-7d952.firebaseapp.com",
    projectId: "infotech-7d952",
    storageBucket: "infotech-7d952.firebasestorage.app",
    messagingSenderId: "476650305411",
    appId: "1:476650305411:web:2fd706f755b28a8ba068b6",
    measurementId: "G-RPNEHVC6SC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
