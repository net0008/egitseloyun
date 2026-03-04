// assets/js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, onValue, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

 const firebaseConfig = {
    apiKey: "AIzaSyC7Jz1nPK7qv8Qtx5tJdmeFU7os-AuVNKE",
    authDomain: "egitseloyun-c606b.firebaseapp.com",
    projectId: "egitseloyun-c606b",
    storageBucket: "egitseloyun-c606b.firebasestorage.app",
    messagingSenderId: "484081280507",
    appId: "1:484081280507:web:ae0b9a8a5e55eb6aec175e",
    measurementId: "G-WGJF8F1FWG"
  };


const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db, ref, set, onValue, update };