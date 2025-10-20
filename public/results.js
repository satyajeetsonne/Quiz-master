import { auth, db } from "./firebase-config.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const loadingElement = document.getElementById('loading');
    const resultsContainer = document.getElementById('results-container');
    
    document.getElementById('back-btn').addEventListener('click', () => {
        window.location.href = 'student_das.html';
    });

    auth.onAuthStateChanged(async (user) => {
        if (user) {
            try {
                loadingElement.style.display = 'block';
                resultsContainer.style.display = 'none';
                await loadResults(user.uid);
            } finally {
                loadingElement.style.display = 'none';
                resultsContainer.style.display = 'grid';
            }
        } else {
            window.location.href = 'login.html';
        }
    });
});

async function loadResults(userId) {
    try {
        const resultsRef = collection(db, 'quiz_results');
        const q = query(resultsRef, where('userId', '==', userId));
        const querySnapshot = await getDocs(q);
        
        const results = querySnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => b.completedAt.toDate() - a.completedAt.toDate());

        const resultsContainer = document.getElementById('results-container');
        resultsContainer.innerHTML = results.length ? '' : '<p class="no-results">No quiz results found</p>';

        results.forEach(result => {
            const scorePercent = (result.score / result.totalQuestions) * 100;
            const resultCard = `
                <div class="result-card">
                    <h3>${result.quizTitle}</h3>
                    <div class="result-info">
                        <div class="result-stat">
                            <i class="fas fa-chart-pie"></i>
                            <span class="score-badge ${getScoreClass(scorePercent)}">
                                Score: ${scorePercent.toFixed(1)}%
                            </span>
                        </div>
                        <div class="result-stat">
                            <i class="fas fa-check-circle"></i>
                            <span>Questions: ${result.score}/${result.totalQuestions}</span>
                        </div>
                        <div class="result-stat">
                            <i class="fas fa-calendar"></i>
                            <span>${result.completedAt.toDate().toLocaleDateString()}</span>
                        </div>
                        <div class="result-stat">
                            <i class="fas fa-clock"></i>
                            <span>${Math.round(result.timeTaken / 60)} minutes</span>
                        </div>
                    </div>
                </div>
            `;
            resultsContainer.innerHTML += resultCard;
        });
    } catch (error) {
        console.error('Error loading results:', error);
        resultsContainer.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-circle"></i>
                Failed to load results. Please try again later.
            </div>
        `;
    }
}

function getScoreClass(score) {
    if (score >= 70) return 'score-high';
    if (score >= 50) return 'score-medium';
    return 'score-low';
}
