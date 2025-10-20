import { auth, db } from "./firebase-config.js";
import { 
    onAuthStateChanged, 
    signOut, 
    EmailAuthProvider,
    reauthenticateWithCredential,
    updatePassword 
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    doc, 
    getDoc, 
    updateDoc 
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
    // Check authentication and admin status
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (!userDoc.exists() || userDoc.data().role !== "admin") {
                console.error("Access denied: Not an admin account");
                window.location.href = "login.html";
                return;
            }
            loadPendingTeacherRequests();
            setupPasswordChangeModal();
            document.getElementById('adminName').textContent = userDoc.data().name || 'Admin';
        } else {
            window.location.href = "login.html";
        }
    });
});

function setupPasswordChangeModal() {
    const modal = document.getElementById('passwordModal');
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    const closeBtn = document.querySelector('.close');
    const passwordChangeForm = document.getElementById('passwordChangeForm');
    const errorDiv = document.getElementById('passwordError');

    // Open modal
    changePasswordBtn.onclick = function() {
        modal.style.display = "block";
        errorDiv.style.display = "none";
        passwordChangeForm.reset();
    }

    // Close modal
    closeBtn.onclick = function() {
        modal.style.display = "none";
    }

    // Close when clicking outside
    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }

    // Handle password change
    passwordChangeForm.onsubmit = async function(e) {
        e.preventDefault();
        errorDiv.style.display = "none";

        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        // Validate passwords
        if (newPassword.length < 6) {
            errorDiv.textContent = "New password must be at least 6 characters long";
            errorDiv.style.display = "block";
            return;
        }

        if (newPassword !== confirmPassword) {
            errorDiv.textContent = "New passwords do not match";
            errorDiv.style.display = "block";
            return;
        }

        try {
            const user = auth.currentUser;
            // Re-authenticate user before password change
            const credential = EmailAuthProvider.credential(user.email, currentPassword);
            await reauthenticateWithCredential(user, credential);
            
            // Update password
            await updatePassword(user, newPassword);
            
            alert("Password changed successfully!");
            modal.style.display = "none";
            passwordChangeForm.reset();
        } catch (error) {
            console.error("Error changing password:", error);
            if (error.code === "auth/wrong-password") {
                errorDiv.textContent = "Current password is incorrect";
            } else {
                errorDiv.textContent = "Failed to change password. Please try again.";
            }
            errorDiv.style.display = "block";
        }
    }
}

async function loadPendingTeacherRequests() {
    const teacherRequestsDiv = document.getElementById("teacherRequests");
    
    try {
        const q = query(
            collection(db, "users"),
            where("status", "==", "pending_approval"),
            where("requestedRole", "==", "teacher")
        );
        
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            teacherRequestsDiv.innerHTML = `
                <div class="no-requests">
                    <p>No pending teacher requests</p>
                </div>
            `;
            return;
        }

        teacherRequestsDiv.innerHTML = "";
        querySnapshot.forEach((doc) => {
            const userData = doc.data();
            teacherRequestsDiv.innerHTML += `
                <div class="teacher-request">
                    <div class="teacher-info">
                        <h3>${userData.name}</h3>
                        <p>${userData.email}</p>
                        <p>Requested: ${userData.createdAt.toDate().toLocaleDateString()}</p>
                    </div>
                    <div class="action-buttons">
                        <button class="btn-approve" onclick="handleApproval('${doc.id}', true)">
                            Approve
                        </button>
                        <button class="btn-reject" onclick="handleApproval('${doc.id}', false)">
                            Reject
                        </button>
                    </div>
                </div>
            `;
        });
    } catch (error) {
        console.error("Error loading teacher requests:", error);
        teacherRequestsDiv.innerHTML = `
            <div class="error-message">
                Failed to load teacher requests. Please try again later.
            </div>
        `;
    }
}

window.handleApproval = async function(userId, isApproved) {
    try {
        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, {
            role: isApproved ? "teacher" : "student",
            status: "active",
            approvedAt: new Date()
        });
        
        // Reload the requests list
        loadPendingTeacherRequests();
    } catch (error) {
        console.error("Error updating teacher status:", error);
        alert("Failed to update teacher status. Please try again.");
    }
};

window.handleSignOut = async function() {
    try {
        await signOut(auth);
        window.location.href = "login.html";
    } catch (error) {
        console.error("Error signing out:", error);
        alert("Failed to sign out. Please try again.");
    }
};