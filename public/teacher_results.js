import { auth, db } from "./firebase-config.js";
import { collection, getDocs, query, where, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";

// DOM Elements
const quizSelect = document.getElementById('quizSelect');
const resultsContainer = document.getElementById('resultsContainer');

// Load quizzes into select dropdown when page loads
document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(user => {
        if (user) {
            loadTeacherQuizzes(user.uid);
        } else {
            window.location.href = 'login.html';
        }
    });
});

// Load quizzes created by the teacher
async function loadTeacherQuizzes(teacherId) {
    try {
        const quizzesQuery = query(
            collection(db, 'quizzes'),
            where('teacherId', '==', teacherId)
        );
        const quizzesSnapshot = await getDocs(quizzesQuery);
        
        quizSelect.innerHTML = '<option value="">Select a Quiz</option>';
        
        quizzesSnapshot.forEach(docSnap => {
            const quiz = docSnap.data();
            const option = document.createElement('option');
            option.value = docSnap.id;
            option.textContent = quiz.title;
            quizSelect.appendChild(option);
        });

        // Listen for quiz selection changes
        quizSelect.addEventListener('change', () => {
            if (quizSelect.value) {
                loadQuizResults(quizSelect.value);
            } else {
                showEmptyState();
            }
        });
    } catch (error) {
        console.error("Error loading quizzes:", error);
        showEmptyState("Error loading quizzes. Please try again.");
    }
}

// Load results for a specific quiz
async function loadQuizResults(quizId) {
    try {
        const resultsQuery = query(
            collection(db, 'quiz_results'),
            where('quizId', '==', quizId)
        );
        const resultsSnapshot = await getDocs(resultsQuery);
        
        if (resultsSnapshot.empty) {
            showEmptyState();
            return;
        }

        resultsContainer.innerHTML = '';
        
        // Process all results
        const resultsPromises = resultsSnapshot.docs.map(async docSnap => {
            const result = docSnap.data();
            const userDocRef = doc(db, 'users', result.userId);
            const userDocSnap = await getDoc(userDocRef);
            const userData = userDocSnap.data();
            return { ...result, studentName: userData?.name || 'Unknown Student' };
        });

        // Wait for all user data to be fetched
        const results = await Promise.all(resultsPromises);
        
        // Sort results by score (highest first)
        results.sort((a, b) => b.score - a.score);
        
        // Display results
        results.forEach(result => {
            const resultElement = createResultElement(result);
            resultsContainer.appendChild(resultElement);
        });
    } catch (error) {
        console.error("Error loading results:", error);
        showEmptyState("Error loading results. Please try again.");
    }
}

// Create HTML element for a single result
function createResultElement(result) {
    const div = document.createElement('div');
    div.className = 'result-item';
    
    // Calculate percentage score
    const scorePercentage = Math.round((result.score / result.totalQuestions) * 100);
    
    // Get initials for avatar
    const initials = result.studentName
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    div.innerHTML = `
        <div class="student-info">
            <div class="student-avatar">${initials}</div>
            <div class="student-name">${result.studentName}</div>
        </div>
        <div class="score-badge">
            ${result.score}/${result.totalQuestions} (${scorePercentage}%)
        </div>
    `;
    
    return div;
}

// Show empty state message
function showEmptyState(message = "🚫 No results found for this quiz.") {
    resultsContainer.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-file-alt"></i>
            <p>${message}</p>
        </div>
    `;
}
