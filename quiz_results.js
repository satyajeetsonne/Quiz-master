import { auth, db } from "./firebase-config.js";
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
    initializeResults();
});

async function initializeResults() {
    try {
        const results = await loadResults();
        renderResults(results);
        setupEventListeners();
    } catch (error) {
        console.error('Failed to load results:', error);
        showNoResults();
    }
}

async function loadResults() {
    // Create query to get user's results
    const userResults = query(
        collection(db, 'quiz_results'),
        where('userId', '==', auth.currentUser.uid)
    );
    
    const resultsSnap = await getDocs(userResults);
    const results = resultsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    })).sort((a, b) => b.completedAt?.toDate() - a.completedAt?.toDate());
    
    return results;
}

function renderResults(results) {
    const container = document.getElementById('resultsContainer');
    if (!container) return;

    if (!results.length) {
        showNoResults();
        return;
    }

    container.classList.remove('loading');
    container.innerHTML = results.map((result, index) => `
        <div class="result-item" style="animation: slideIn ${0.2 + index * 0.1}s ease-out forwards">
            <div class="result-info">
                <div>
                    <div class="result-name">${result.quizTitle || 'Untitled Quiz'}</div>
                    <div class="result-meta">
                        <span><i class="far fa-calendar"></i> ${formatDate(result.completedAt)}</span>
                        <span><i class="far fa-clock"></i> ${formatTime(result.timeTaken)}</span>
                    </div>
                </div>
                <div class="result-score ${getScoreClass(result.score / result.totalQuestions * 100)}">
                    ${result.score}/${result.totalQuestions} (${Math.round(result.score / result.totalQuestions * 100)}%)
                </div>
            </div>
        </div>
    `).join('');

    // Add slide-in animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        .result-item {
            opacity: 0;
        }
    `;
    document.head.appendChild(style);
}

function showNoResults() {
    const container = document.getElementById('resultsContainer');
    if (!container) return;

    container.classList.remove('loading');
    container.innerHTML = `
        <div class="no-results">
            <i class="fas fa-clipboard-list" style="font-size: 3rem; color: var(--text-light); margin-bottom: 1rem;"></i>
            <h3>No Quiz Results Yet</h3>
            <p>Take some quizzes to see your results here!</p>
            <a href="quiz_list.html" class="btn btn-primary" style="margin-top: 1rem;">
                <i class="fas fa-play"></i> Start a Quiz
            </a>
        </div>
    `;
}

function getScoreClass(score) {
    if (score >= 80) return 'score-high';
    if (score >= 60) return 'score-medium';
    return 'score-low';
}

function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatTime(seconds) {
    if (!seconds) return 'N/A';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
}

function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    const sortSelect = document.getElementById('sortBy');
    const exportButton = document.getElementById('exportCsv');

    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleSearch, 300));
    }

    if (sortSelect) {
        sortSelect.addEventListener('change', handleSort);
    }

    if (exportButton) {
        exportButton.addEventListener('click', handleExport);
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function handleSearch(event) {
    const searchTerm = event.target.value.toLowerCase();
    const items = document.querySelectorAll('.result-item');
    
    items.forEach(item => {
        const title = item.querySelector('.result-name').textContent.toLowerCase();
        const matches = title.includes(searchTerm);
        item.style.display = matches ? 'block' : 'none';
        
        if (matches) {
            item.style.animation = 'none'; // Reset animation
            item.offsetHeight; // Trigger reflow
            item.style.animation = 'slideIn 0.3s ease-out forwards';
        }
    });
}

function handleSort(event) {
    const container = document.getElementById('resultsContainer');
    const items = Array.from(document.querySelectorAll('.result-item'));
    const sortBy = event.target.value;

    items.sort((a, b) => {
        const aValue = getSortValue(a, sortBy);
        const bValue = getSortValue(b, sortBy);
        
        if (sortBy.includes('-desc')) {
            return bValue - aValue;
        }
        return aValue - bValue;
    });

    // Animate items back in
    items.forEach((item, index) => {
        item.style.animation = 'none';
        item.offsetHeight; // Trigger reflow
        item.style.animation = `slideIn ${0.2 + index * 0.1}s ease-out forwards`;
    });

    container.innerHTML = '';
    items.forEach(item => container.appendChild(item));
}

function getSortValue(element, sortBy) {
    if (sortBy.includes('date')) {
        const dateText = element.querySelector('.result-meta').textContent;
        return new Date(dateText).getTime();
    }
    
    if (sortBy.includes('score')) {
        const scoreText = element.querySelector('.result-score').textContent;
        return parseInt(scoreText);
    }
    
    return 0;
}

function handleExport() {
    const results = Array.from(document.querySelectorAll('.result-item')).map(item => {
        const title = item.querySelector('.result-name').textContent;
        const score = item.querySelector('.result-score').textContent;
        const meta = item.querySelector('.result-meta').textContent;
        return [title, score, meta].join(',');
    });
    
    const csv = ['Quiz Title,Score,Date\n', ...results.map(row => row + '\n')].join('');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `quiz_results_${new Date().toLocaleDateString()}.csv`;
    link.click();
}
