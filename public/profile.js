import { auth, db } from "./firebase-config.js";
import { 
    onAuthStateChanged, 
    EmailAuthProvider,
    reauthenticateWithCredential,
    updatePassword
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const profileForm = document.getElementById('profileForm');
    const loadingDiv = document.getElementById('loading');
    const alertDiv = document.getElementById('alert');
    const backBtn = document.getElementById('backToDashboard');

    // Check authentication
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = 'login.html';
            return;
        }

        // Load user data
        try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (!userDoc.exists()) {
                showAlert('User profile not found', 'error');
                return;
            }

            const userData = userDoc.data();
            
            // Set form values
            document.getElementById('name').value = userData.name || '';
            document.getElementById('email').value = userData.email || '';
            document.getElementById('userRole').textContent = 
                userData.role.charAt(0).toUpperCase() + userData.role.slice(1);

            // Set up back button navigation
            backBtn.href = userData.role === 'teacher' ? 'teacher_dash.html' : 'student_das.html';
        } catch (error) {
            console.error('Error loading user data:', error);
            showAlert('Failed to load user data', 'error');
        }
    });

    // Handle form submission
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return;

        const name = document.getElementById('name').value.trim();
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        try {
            loadingDiv.style.display = 'block';
            alertDiv.style.display = 'none';

            // Update name in Firestore
            if (name) {
                await updateDoc(doc(db, 'users', user.uid), {
                    name: name
                });
            }

            // Handle password change if provided
            if (newPassword) {
                if (newPassword !== confirmPassword) {
                    throw new Error('New passwords do not match');
                }

                if (!currentPassword) {
                    throw new Error('Current password is required to change password');
                }

                // Re-authenticate user before password change
                const credential = EmailAuthProvider.credential(
                    user.email,
                    currentPassword
                );

                await reauthenticateWithCredential(user, credential);
                await updatePassword(user, newPassword);

                // Clear password fields
                document.getElementById('currentPassword').value = '';
                document.getElementById('newPassword').value = '';
                document.getElementById('confirmPassword').value = '';
            }

            showAlert('Profile updated successfully', 'success');
        } catch (error) {
            console.error('Error updating profile:', error);
            showAlert(error.message || 'Failed to update profile', 'error');
        } finally {
            loadingDiv.style.display = 'none';
        }
    });
});

function showAlert(message, type) {
    const alertDiv = document.getElementById('alert');
    alertDiv.textContent = message;
    alertDiv.className = `alert alert-${type}`;
    alertDiv.style.display = 'block';
}