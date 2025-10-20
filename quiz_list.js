import { auth, db } from "./firebase-config.js";
import { collection, getDocs, doc, getDoc, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";

// Enable offline persistence
enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
        // Multiple tabs open, persistence can only be enabled in one tab at a time.
        console.warn('Multiple tabs open, offline persistence disabled');
    } else if (err.code === 'unimplemented') {
        // The current browser doesn't support persistence
        console.warn('Current browser doesn\'t support offline persistence');
    }
});

// Track online status
let isOnline = navigator.onLine;
window.addEventListener('online', handleConnectionChange);
window.addEventListener('offline', handleConnectionChange);

function handleConnectionChange() {
    isOnline = navigator.onLine;
    const offlineBanner = document.getElementById('offlineBanner');
    if (offlineBanner) {
        offlineBanner.classList.toggle('visible', !isOnline);
    }
    
    if (isOnline) {
        console.log('✅ Back online');
        loadQuizzes(); // Reload quizzes when we're back online
    } else {
        console.log('❌ Connection lost');
    }
}

document.addEventListener("DOMContentLoaded", () => {
    // Initial connection status check
    handleConnectionChange();
    
    // Check authentication first
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            console.log("❌ No authenticated user");
            window.location.href = 'login.html';
            return;
        }

        try {
            // Check if user is a student
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (!userDoc.exists()) {
                console.log("❌ User document not found");
                window.location.href = 'login.html';
                return;
            }

            // Load quizzes for authenticated user
            await loadQuizzes();
        } catch (error) {
            console.error("❌ Error checking user:", error);
            showError("Failed to verify your account. Please try logging in again.");
        }
    });
});

async function loadQuizzes() {
    const quizContainer = document.getElementById("quizContainer");
    const quizStatus = document.getElementById("quizStatus");
    
    if (!quizContainer) {
        console.error("❌ Quiz container not found!");
        return;
    }

    try {
        // Show loading state
        quizContainer.innerHTML = `
            <div class="loading">
                <i class="fas fa-spinner fa-spin"></i>
                Loading quizzes...
            </div>
        `;

        // Check for any in-progress quiz
        const currentQuizId = sessionStorage.getItem('currentQuizId');
        if (currentQuizId && quizStatus) {
            quizStatus.innerHTML = `
                <p>You have an unfinished quiz. Would you like to continue?</p>
                <button onclick="startQuiz('${currentQuizId}')" class="btn btn-primary">
                    Continue Quiz
                </button>
                <button onclick="clearQuizProgress()" class="btn btn-secondary">
                    Start New Quiz
                </button>
            `;
            quizStatus.classList.add('active');
        }

        // Fetch quizzes from Firestore (will work offline if data is cached)
        const querySnapshot = await getDocs(collection(db, "quizzes"));
        
        if (querySnapshot.empty) {
            quizContainer.innerHTML = `
                <div class="no-quizzes">
                    <p>No quizzes available${!isOnline ? ' (offline mode)' : ''}.</p>
                    <p>Please check back later!</p>
                </div>
            `;
            return;
        }

        const quizzes = [];
        querySnapshot.forEach((doc) => {
            quizzes.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // Sort quizzes by creation date (newest first)
        quizzes.sort((a, b) => {
            const dateA = a.createdAt?.toMillis() || 0;
            const dateB = b.createdAt?.toMillis() || 0;
            return dateB - dateA;
        });

        renderQuizzes(quizzes);
    } catch (error) {
        console.error("❌ Error loading quizzes:", error);
        showError(`Failed to load quizzes. ${!isOnline ? 'You are currently offline.' : 'Please try again later.'}`);
    }
}

function renderQuizzes(quizzes) {
    const quizContainer = document.getElementById("quizContainer");
    if (!quizzes || quizzes.length === 0) {
        quizContainer.innerHTML = `
            <div class="no-quizzes">
                <p>No quizzes available at the moment.</p>
            </div>
        `;
        return;
    }

    quizContainer.innerHTML = quizzes.map(quiz => `
        <div class="quiz-card">
            <div class="quiz-card-header">
                <h3 class="quiz-title">${quiz.title}</h3>
            </div>
            <div class="quiz-card-content">
                <p class="quiz-description">${quiz.description}</p>
                <button onclick="startQuiz('${quiz.id}')" class="btn-start-quiz">Start Quiz</button>
            </div>
            <div class="quiz-footer">
                <span>${quiz.questions.length} Questions</span>
                <span>${quiz.timeLimit} Minutes</span>
            </div>
        </div>
    `).join('');
}

function showError(message) {
    const quizContainer = document.getElementById("quizContainer");
    if (quizContainer) {
        quizContainer.innerHTML = `
            <div class="error-message">
                <p>${message}</p>
                <button onclick="retryConnection()" class="btn btn-primary">
                    <i class="fas fa-sync-alt"></i> Try Again
                </button>
            </div>
        `;
    }
}

function showOfflineBanner() {
    const banner = document.getElementById("offlineBanner");
    if (banner) {
        banner.classList.add("visible");
    }
}

function hideOfflineBanner() {
    const banner = document.getElementById("offlineBanner");
    if (banner) {
        banner.classList.remove("visible");
    }
}

// Make functions available globally
window.startQuiz = function(quizId) {
    sessionStorage.setItem('currentQuizId', quizId);
    window.location.href = `take_quiz.html?quizId=${quizId}`;
};

window.clearQuizProgress = function() {
    sessionStorage.removeItem('currentQuizId');
    const quizStatus = document.getElementById("quizStatus");
    if (quizStatus) {
        quizStatus.classList.remove('active');
    }
};

window.retryConnection = function() {
    hideOfflineBanner();
    loadQuizzes();
};
