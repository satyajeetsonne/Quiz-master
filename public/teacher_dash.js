import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { collection, query, where, orderBy, getDocs, doc, getDoc, deleteDoc, limit } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import { translations } from "./translations.js";

let currentLanguage = localStorage.getItem('preferredLanguage') || 'en';

document.addEventListener("DOMContentLoaded", () => {
    // Initialize language selector
    const languageSelect = document.getElementById('languageSelect');
    languageSelect.value = currentLanguage;
    updatePageContent();

    // Add language change listener
    languageSelect.addEventListener('change', (e) => {
        currentLanguage = e.target.value;
        localStorage.setItem('preferredLanguage', currentLanguage);
        updatePageContent();
    });

    // Check authentication and teacher status
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Check if user is an approved teacher
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (!userDoc.exists() || userDoc.data().role !== "teacher" || userDoc.data().status !== "active") {
                console.error("Access denied: Not an approved teacher account");
                window.location.href = "login.html";
                return;
            }
            
            loadTeacherData(user.uid);
            loadRecentQuizzes(user.uid);
            loadRecentStudentActivity(); // Add this line
            populateQuizFilter(); // Add this line
        } else {
            window.location.href = "login.html";
        }
    });
});

function updatePageContent() {
    // Update all elements with data-translate attribute
    document.querySelectorAll('[data-translate]').forEach(element => {
        const key = element.getAttribute('data-translate');
        if (translations[currentLanguage][key]) {
            element.textContent = translations[currentLanguage][key];
        }
    });

    // Update static elements
    const staticTranslations = {
        '.stat-title': ['totalQuizzes', 'activeStudents', 'avgScore', 'quizzesTaken'],
        '.card-title': ['recentQuizzes', 'recentStudentActivity'],
        'th': ['quizName', 'dateCreated', 'questions', 'timesTaken', 'actions', 'studentName', 'dateTaken', 'score', 'timeTaken', 'status'],
        '.btn-primary': ['createNewQuiz', 'viewAll'],
        '#quizFilter option[value="all"]': ['allQuizzes']
    };

    for (const [selector, keys] of Object.entries(staticTranslations)) {
        document.querySelectorAll(selector).forEach((element, index) => {
            if (keys[index] && translations[currentLanguage][keys[index]]) {
                element.textContent = translations[currentLanguage][keys[index]];
            }
        });
    }

    // Update dynamic content
    updateStatusBadges();
}

function updateStatusBadges() {
    document.querySelectorAll('.badge').forEach(badge => {
        const status = badge.textContent.toLowerCase();
        if (status === 'passed') {
            badge.textContent = translations[currentLanguage].passed;
        } else if (status === 'failed') {
            badge.textContent = translations[currentLanguage].failed;
        } else if (status === 'borderline') {
            badge.textContent = translations[currentLanguage].borderline;
        }
    });
}

async function loadTeacherData(teacherId) {
    try {
        const userDoc = await getDoc(doc(db, "users", teacherId));
        const userData = userDoc.data();
        
        // Update teacher name in profile section
        const teacherNameElement = document.getElementById('teacherName');
        const teacherInitialsElement = document.getElementById('teacherInitials');
        
        if (userData.name) {
            teacherNameElement.textContent = userData.name;
            // Get initials from the name (e.g., "John Doe" -> "JD")
            const initials = userData.name
                .split(' ')
                .map(word => word[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);
            teacherInitialsElement.textContent = initials;
        }
    } catch (error) {
        console.error("Error loading teacher data:", error);
    }
}

async function loadRecentQuizzes(teacherId) {
    try {
        // Only filter by teacherId without ordering
        const quizzesQuery = query(
            collection(db, "quizzes"),
            where("teacherId", "==", teacherId)
        );

        const quizzesSnapshot = await getDocs(quizzesQuery);
        const quizTableBody = document.querySelector(".table-card tbody");
        if (!quizTableBody) return;

        quizTableBody.innerHTML = ""; // Clear existing content

        if (quizzesSnapshot.empty) {
            quizTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="no-quizzes">
                        <p>No quizzes created yet.</p>
                        <a href="create_quiz.html" class="btn btn-primary">Create Your First Quiz</a>
                    </td>
                </tr>
            `;
            return;
        }

        // Sort the results in memory instead
        const sortedQuizzes = quizzesSnapshot.docs
            .map(doc => ({ ...doc.data(), id: doc.id }))
            .sort((a, b) => b.createdAt?.toDate() - a.createdAt?.toDate());

        sortedQuizzes.forEach((quiz) => {
            const row = createQuizRow(quiz, quiz.id);
            quizTableBody.appendChild(row);
        });

        // Update stats
        updateQuizStats(quizzesSnapshot.docs);
    } catch (error) {
        console.error("Error loading quizzes:", error);
        const quizTableBody = document.querySelector(".table-card tbody");
        if (quizTableBody) {
            quizTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="error-message">
                        Error loading quizzes. Please try again later.
                    </td>
                </tr>
            `;
        }
    }
}

function createQuizRow(quiz, quizId) {
    const row = document.createElement("tr");
    
    // Format the date
    const date = quiz.createdAt ? new Date(quiz.createdAt.toDate()).toLocaleDateString() : "N/A";
    
    row.innerHTML = `
        <td>${quiz.title || 'Untitled Quiz'}</td>
        <td>${date}</td>
        <td>${quiz.questions?.length || 0}</td>
        <td>${quiz.timeLimit || 'No'} min</td>
        <td>
            <div class="table-actions">
                <button onclick="deleteQuiz('${quizId}')" class="action-btn delete-btn">Delete</button>
            </div>
        </td>
    `;
    
    return row;
}

async function updateQuizStats(quizDocs) {
    try {
        // Initialize stats
        let totalQuizzes = quizDocs.length;
        let totalStudents = new Set();
        let totalScores = 0;
        let totalAttempts = 0;

        // Collect student results for all quizzes
        for (const quizDoc of quizDocs) {
            const resultsQuery = query(
                collection(db, "quiz_results"),  // Changed from "results" to "quiz_results"
                where("quizId", "==", quizDoc.id)
            );
            const resultsSnap = await getDocs(resultsQuery);
            
            resultsSnap.forEach(result => {
                const resultData = result.data();
                totalStudents.add(resultData.userId);  // Changed from studentId to userId to match the schema
                if (resultData.score !== undefined) {
                    totalScores += resultData.score;
                    totalAttempts++;
                }
            });
        }

        // Calculate averages
        const activeStudents = totalStudents.size;
        const avgScore = totalAttempts > 0 ? Math.round((totalScores / totalAttempts) * 100) : 0;

        // Update UI
        document.querySelector('[data-stat="total-quizzes"] .stat-value').textContent = totalQuizzes;
        document.querySelector('[data-stat="active-students"] .stat-value').textContent = activeStudents;
        document.querySelector('[data-stat="avg-score"] .stat-value').textContent = `${avgScore}%`;
        document.querySelector('[data-stat="quizzes-taken"] .stat-value').textContent = totalAttempts;

    } catch (error) {
        console.error("Error updating quiz stats:", error);
    }
}

window.deleteQuiz = async function(quizId) {
    if (confirm("Are you sure you want to delete this quiz? This action cannot be undone.")) {
        try {
            await deleteDoc(doc(db, "quizzes", quizId));
            // Reload quizzes after deletion
            loadRecentQuizzes(auth.currentUser.uid);
        } catch (error) {
            console.error("Error deleting quiz:", error);
            alert("Failed to delete quiz. Please try again.");
        }
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

async function loadRecentStudentActivity() {
    try {
        // Get recent quiz results, ordered by completion date
        const resultsQuery = query(
            collection(db, "quiz_results"),
            orderBy("completedAt", "desc"),
            limit(10)
        );

        const resultsSnapshot = await getDocs(resultsQuery);
        const activityTableBody = document.querySelector(".table-card:last-child tbody");
        
        if (!activityTableBody) return;
        activityTableBody.innerHTML = "";

        if (resultsSnapshot.empty) {
            activityTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center">
                        No student activity yet
                    </td>
                </tr>
            `;
            return;
        }

        // Process all results
        const resultsPromises = resultsSnapshot.docs.map(async docSnap => {
            const result = docSnap.data();
            
            // Get student info
            const userDoc = await getDoc(doc(db, "users", result.userId));
            const userData = userDoc.data();
            
            // Get quiz info
            const quizDoc = await getDoc(doc(db, "quizzes", result.quizId));
            const quizData = quizDoc.data();
            
            return {
                ...result,
                studentName: userData?.name || "Unknown Student",
                quizTitle: quizData?.title || "Unknown Quiz",
                percentage: (result.score / result.totalQuestions) * 100
            };
        });

        const results = await Promise.all(resultsPromises);
        
        results.forEach(result => {
            const row = document.createElement("tr");
            const status = result.percentage >= 75 ? "Passed" : 
                          result.percentage >= 50 ? "Borderline" : "Failed";
            const statusClass = status === "Passed" ? "badge-success" : 
                              status === "Borderline" ? "badge-warning" : "badge-danger";
            
            row.innerHTML = `
                <td>${result.studentName}</td>
                <td>${result.quizTitle}</td>
                <td>${result.completedAt.toDate().toLocaleDateString()}</td>
                <td>${result.percentage.toFixed(1)}%</td>
                <td>${Math.round(result.timeTaken / 60)} mins</td>
                <td><span class="badge ${statusClass}">${status}</span></td>
            `;
            
            activityTableBody.appendChild(row);
        });

    } catch (error) {
        console.error("Error loading student activity:", error);
        const activityTableBody = document.querySelector(".table-card:last-child tbody");
        if (activityTableBody) {
            activityTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="error-message">
                        Error loading student activity. Please try again later.
                    </td>
                </tr>
            `;
        }
    }
}

// Function to populate quiz filter dropdown
async function populateQuizFilter() {
    const quizFilter = document.getElementById('quizFilter');
    const quizzes = await getAllQuizzes();
    
    // Clear existing options except "All Quizzes"
    while (quizFilter.options.length > 1) {
        quizFilter.remove(1);
    }
    
    // Add quiz options
    quizzes.forEach(quiz => {
        const option = document.createElement('option');
        option.value = quiz.id;
        option.textContent = quiz.title;
        quizFilter.appendChild(option);
    });
}

// Function to filter student activity
function filterStudentActivity(selectedQuizId) {
    const activityTable = document.querySelector('.table-card:last-child tbody');
    if (!activityTable) return;
    
    const rows = activityTable.getElementsByTagName('tr');
    
    for (let row of rows) {
        const quizNameCell = row.cells[1]; // Quiz Name column
        if (selectedQuizId === 'all' || quizNameCell.textContent === getQuizTitleById(selectedQuizId)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    }
}

// Event listener for quiz filter
document.getElementById('quizFilter').addEventListener('change', (e) => {
    filterStudentActivity(e.target.value);
});

// Helper function to get quiz title by ID
function getQuizTitleById(quizId) {
    const quizFilter = document.getElementById('quizFilter');
    const option = quizFilter.querySelector(`option[value="${quizId}"]`);
    return option ? option.textContent : '';
}

// Function to get all quizzes for the current teacher
async function getAllQuizzes() {
    try {
        const teacherId = auth.currentUser.uid;
        const quizzesQuery = query(
            collection(db, "quizzes"),
            where("teacherId", "==", teacherId)
        );
        
        const quizzesSnapshot = await getDocs(quizzesQuery);
        return quizzesSnapshot.docs.map(doc => ({
            id: doc.id,
            title: doc.data().title
        }));
    } catch (error) {
        console.error("Error fetching quizzes:", error);
        return [];
    }
}