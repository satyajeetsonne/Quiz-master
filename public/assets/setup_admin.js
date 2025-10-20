import { auth, db } from "./firebase-config.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

// Admin credentials
const ADMIN_EMAIL = "admin@quizplatform.com";
const ADMIN_PASSWORD = "Admin@123456"; // More secure password
const ADMIN_NAME = "System Administrator";

async function setupAdminUser() {
    try {
        // Create admin user in Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
        const user = userCredential.user;

        // Create admin document in Firestore
        await setDoc(doc(db, "users", user.uid), {
            name: ADMIN_NAME,
            email: ADMIN_EMAIL,
            role: "admin",
            status: "active",
            createdAt: new Date()
        });

        console.log("✅ Admin user created successfully!");
        console.log("Email:", ADMIN_EMAIL);
        console.log("Please change the password after first login");
    } catch (error) {
        console.error("❌ Error creating admin user:", error);
        if (error.code === "auth/email-already-in-use") {
            console.log("An admin account already exists with this email.");
        }
    }
}

// Run the setup
setupAdminUser();