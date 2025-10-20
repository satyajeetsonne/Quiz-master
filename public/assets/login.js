import { auth, db } from "./firebase-config.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", initializeForm);

function initializeForm() {
    const loginForm = document.getElementById("loginForm");
    const loginBtn = document.querySelector(".btn-login");
    const loadingIndicator = document.getElementById("loading");

    if (!loginForm) {
        console.error("Login form not found!");
        return;
    }

    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        console.log("Login form submitted");

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        if (!validateForm(email, password)) {
            showAlert("Please fill in all fields correctly", "error");
            return;
        }

        try {
            loginBtn.disabled = true;
            if (loadingIndicator) loadingIndicator.style.display = "block";
            hideAlert();

            console.log("Attempting to sign in with:", email);
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            console.log("Sign in successful", userCredential.user.uid);

            const userDocRef = doc(db, "users", userCredential.user.uid);
            const userDoc = await getDoc(userDocRef);

            if (!userDoc.exists()) {
                console.log("User document not found, creating default user document");
                // Create a default user document if it doesn't exist
                await setDoc(userDocRef, {
                    email: userCredential.user.email,
                    name: email.split('@')[0], // Use email prefix as default name
                    role: "student", // Default role
                    status: "active",
                    createdAt: new Date()
                });
                
                console.log("Default user document created");
                window.location.href = "student_das.html";
                return;
            }

            const userData = userDoc.data();
            console.log("User data retrieved:", { role: userData.role, status: userData.status });

            // Handle different user roles
            if (userData.role === "admin") {
                console.log("Admin login successful, redirecting...");
                window.location.href = "admin_dash.html";
            } else if (userData.role === "teacher") {
                if (userData.status === "pending_approval") {
                    showAlert("Your teacher account is pending admin approval. You can continue using student features for now.", "info");
                    setTimeout(() => {
                        window.location.href = "student_das.html";
                    }, 2500);
                } else if (userData.status === "active") {
                    console.log("Teacher login successful, redirecting...");
                    window.location.href = "teacher_dash.html";
                } else {
                    console.log("Teacher account inactive, redirecting to student dashboard...");
                    window.location.href = "student_das.html";
                }
            } else {
                console.log("Student login successful, redirecting...");
                window.location.href = "student_das.html";
            }

        } catch (error) {
            console.error("Login error:", error);
            let errorMessage = "Login failed. Please check your credentials and try again.";
            
            if (error.code === "auth/invalid-email") {
                errorMessage = "Please enter a valid email address.";
            } else if (error.code === "auth/invalid-credential") {
                errorMessage = "Invalid email or password. Please check your credentials.";
            } else if (error.code === "auth/too-many-requests") {
                errorMessage = "Too many failed login attempts. Please try again later.";
            } else if (error.message === "User data not found") {
                errorMessage = "Account setup incomplete. Please try registering again or contact support.";
            }

            showAlert(errorMessage, "error");
        } finally {
            loginBtn.disabled = false;
            if (loadingIndicator) loadingIndicator.style.display = "none";
        }
    });

    // Handle forgot password
    document.getElementById("forgot-password")?.addEventListener("click", (e) => {
        e.preventDefault();
        alert("Password reset functionality coming soon!");
    });
}

function validateForm(email, password) {
    if (!email || !password) {
        return false;
    }
    return true;
}

function showAlert(message, type) {
    const alertBox = document.getElementById("alert");
    if (alertBox) {
        alertBox.textContent = message;
        alertBox.className = `alert alert-${type}`;
        alertBox.style.display = "block";
    }
}

function hideAlert() {
    const alertBox = document.getElementById("alert");
    if (alertBox) {
        alertBox.style.display = "none";
    }
}
