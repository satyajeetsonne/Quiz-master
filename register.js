import { auth, db } from "./firebase-config.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
    initializeForm();
    setupPasswordToggle();
});

function initializeForm() {
    const registerForm = document.getElementById("register-form");
    const registerBtn = document.getElementById("register-btn");
    const loadingIndicator = document.getElementById("loading");
    const alertBox = document.getElementById("alert");
    const roleSelect = document.querySelector('input[name="role"][value="teacher"]');
    
    if (roleSelect) {
        roleSelect.addEventListener('change', function() {
            if (this.checked) {
                showAlert("Note: Teacher accounts require admin approval before activation.", "info");
            } else {
                hideAlert();
            }
        });
    }

    if (!registerForm) {
        console.error("❌ Register form not found in the DOM");
        return;
    }

    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        // Get form values
        const name = document.getElementById("name").value.trim();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const requestedRole = document.querySelector('input[name="role"]:checked')?.value;

        // Validate form
        if (!validateForm(name, email, password)) {
            return;
        }

        // Show loading state
        registerBtn.disabled = true;
        loadingIndicator.style.display = "block";
        hideAlert();

        try {
            // Create user with Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            console.log("✅ User registered successfully:", user.uid);

            // Set role as student by default, with pending teacher status if requested
            const userData = {
                name,
                email,
                role: "student",
                createdAt: new Date(),
                requestedRole: requestedRole,
                status: requestedRole === "teacher" ? "pending_approval" : "active"
            };

            // Save additional user data to Firestore
            await setDoc(doc(db, "users", user.uid), userData);

            console.log("✅ User data saved to Firestore");

            // Show success message
            let successMessage = "Registration successful!";
            if (requestedRole === "teacher") {
                successMessage += " Your teacher account request is pending admin approval. You'll be notified via email when approved.";
            }
            showAlert(successMessage, "success");

            // Redirect to login page after brief delay
            setTimeout(() => {
                window.location.href = "login.html";
            }, 2500);
        } catch (error) {
            console.error("❌ Error registering user:", error);

            // Show user-friendly error message
            let errorMessage = "Registration failed. Please try again.";

            if (error.code === "auth/email-already-in-use") {
                errorMessage = "This email is already registered. Please use a different email or log in.";
            } else if (error.code === "auth/weak-password") {
                errorMessage = "Password is too weak. Please use at least 6 characters.";
            } else if (error.code === "auth/invalid-email") {
                errorMessage = "Please enter a valid email address.";
            }

            showAlert(errorMessage, "error");

            // Reset form state
            registerBtn.disabled = false;
            loadingIndicator.style.display = "none";
        }
    });
}

function validateForm(name, email, password) {
    if (name.length < 2) {
        return false;
    }

    if (password.length < 6) {
        return false;
    }

    return true;
}

function showAlert(message, type) {
    const alertBox = document.getElementById("alert");
    alertBox.textContent = message;
    alertBox.className = `alert alert-${type}`;
    alertBox.style.display = "block";
}

function hideAlert() {
    const alertBox = document.getElementById("alert");
    alertBox.style.display = "none";
}

function setupPasswordToggle() {
    const passwordInput = document.getElementById("password");
    const passwordToggle = document.getElementById("password-toggle");

    if (passwordToggle && passwordInput) {
        passwordToggle.addEventListener("click", () => {
            if (passwordInput.type === "password") {
                passwordInput.type = "text";
                passwordToggle.textContent = "Hide";
            } else {
                passwordInput.type = "password";
                passwordToggle.textContent = "Show";
            }
        });
    }
}
