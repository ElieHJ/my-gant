// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database"; // <--- AJOUT IMPORTANT

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCGC_TmoNjBPJk-08mK9fMS4ZEuY-ORNT8",
    authDomain: "gantt-projet.firebaseapp.com",
    databaseURL: "https://gantt-projet-default-rtdb.firebaseio.com",
    projectId: "gantt-projet",
    storageBucket: "gantt-projet.firebasestorage.app",
    messagingSenderId: "1099471376136",
    appId: "1:1099471376136:web:9f52ea72966668044a66bd"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Realtime Database and export it
export const db = getDatabase(app); // <--- C'est ça qui permet la connexion