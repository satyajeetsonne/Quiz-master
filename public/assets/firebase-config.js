import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

export const firebaseConfig = {
    apiKey: "AIzaSyDFfr-w6PzZEEKbhWQSHCpb9-amGPj6Vu0",
    authDomain: "quiz-master-67e34.firebaseapp.com",
    projectId: "quiz-master-67e34",
    storageBucket: "quiz-master-67e34.appspot.com",
    messagingSenderId: "795037749317",
    appId: "1:795037749317:web:d67d6e6e235c055dbfd32c"
};

// Initialize Firebase once
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };