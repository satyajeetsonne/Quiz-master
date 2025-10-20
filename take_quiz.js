import { auth, db } from "./firebase-config.js";
import { doc, getDoc, setDoc, serverTimestamp, addDoc, collection } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";

let timer;
let timeRemaining;
let quizId;
let currentQuiz;
let userId = null;

document.addEventListener("DOMContentLoaded", async () => {
    const quizContent = document.getElementById("quizContent");
    if (!quizContent) {
        console.error("❌ quizContent element not found");
        return;
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            userId = user.uid;
            console.log(`✅ Logged in user: ${userId}`);
            await loadQuiz();
        } else {
            console.error("❌ No authenticated user. Redirecting to login.");
            window.location.href = "login.html";
        }
    });
});

async function loadQuiz() {
    const urlParams = new URLSearchParams(window.location.search);
    quizId = urlParams.get("quizId");

    if (!quizId) {
        showMessage("No quiz selected!", "error");
        return;
    }

    try {
        const quizRef = doc(db, "quizzes", quizId);
        const quizSnap = await getDoc(quizRef);

        if (!quizSnap.exists()) {
            showMessage("Quiz not found", "error");
            return;
        }

        currentQuiz = {
            id: quizSnap.id,
            ...quizSnap.data()
        };
        
        sessionStorage.setItem('quizStartTime', new Date().toISOString());
        renderQuiz(currentQuiz);
        if (currentQuiz.timeLimit) {
            startTimer(currentQuiz.timeLimit);
        }
    } catch (error) {
        console.error("❌ Error fetching quiz:", error);
        showMessage(`Error: ${error.message}`, "error");
    }
}

function renderQuiz(quiz) {
    const quizHTML = `
        <div class="quiz-header">
            <h1 class="quiz-title">${quiz.title || 'Untitled Quiz'}</h1>
            <p class="quiz-description">${quiz.description || ''}</p>
            ${quiz.timeLimit ? `<div class="timer" id="timer"><i class="fas fa-clock"></i><span>Time Left: ${quiz.timeLimit}:00</span></div>` : ''}
        </div>
        <form id="quizForm" class="quiz-form">
            ${renderQuestions(quiz.questions || [])}
        </form>
        <button type="button" id="submitQuizBtn" class="btn-submit">
            <i class="fas fa-paper-plane"></i> Submit Quiz
        </button>
    `;

    document.getElementById("quizContent").innerHTML = quizHTML;
    
    // Add event listeners
    document.getElementById("submitQuizBtn").addEventListener("click", submitQuiz);
    
    // Add animation to questions as they appear
    const questions = document.querySelectorAll('.question');
    questions.forEach((question, index) => {
        question.style.opacity = "0";
        question.style.transform = "translateY(20px)";
        setTimeout(() => {
            question.style.transition = "all 0.5s ease";
            question.style.opacity = "1";
            question.style.transform = "translateY(0)";
        }, index * 100);
    });
}

function renderQuestions(questions) {
    if (!questions || questions.length === 0) {
        return '<p class="no-questions">No questions available in this quiz.</p>';
    }

    return questions.map((question, index) => `
        <div class="question" data-index="${index}">
            <h3><span class="question-number">${index + 1}</span>. ${question.questionText}</h3>
            ${renderOptions(question.options || [], index, question.type)}
        </div>
    `).join("");
}

function renderOptions(options, questionIndex, questionType) {
    if (questionType === 'fill-blank') {
        return `
            <div class="fill-blank-answer">
                <input type="text" 
                    name="answer-${questionIndex}" 
                    class="answer-input" 
                    placeholder="Type your answer here"
                    autocomplete="off">
            </div>`;
    }

    return options.map((option, index) => `
        <div class="option" data-option="${String.fromCharCode(65 + index)}" onclick="this.querySelector('input').click()">
            <input type="radio" 
                name="answer-${questionIndex}" 
                value="${index}" 
                id="q${questionIndex}o${index}">
            <label for="q${questionIndex}o${index}">
                ${option}
            </label>
        </div>
    `).join("");
}

async function submitQuiz() {
    if (!currentQuiz || !userId) return;

    if (!confirm("Are you sure you want to submit the quiz?")) {
        return;
    }

    try {
        const submitButton = document.getElementById("submitQuizBtn");
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
        
        const answers = collectUserAnswers();
        const score = calculateScore(answers);
        const quizEndTime = new Date();
        const quizStartTime = new Date(sessionStorage.getItem('quizStartTime'));
        const timeTaken = Math.floor((quizEndTime - quizStartTime) / 1000);

        await addDoc(collection(db, "quiz_results"), {
            quizId: currentQuiz.id,
            userId: userId,
            answers: answers,
            score: score,
            totalQuestions: currentQuiz.questions.length,
            timeTaken: timeTaken,
            completedAt: serverTimestamp()
        });

        displayResults({
            score: score,
            total: currentQuiz.questions.length,
            answers: answers,
            questions: currentQuiz.questions,
            timeTaken: timeTaken
        });

        sessionStorage.removeItem('quizStartTime');
        if (timer) clearInterval(timer);

    } catch (error) {
        console.error("Error submitting quiz:", error);
        showMessage("There was an error submitting your quiz. Please try again.", "error");
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Quiz';
    }
}

function calculateScore(answers) {
    let score = 0;
    currentQuiz.questions.forEach((question, index) => {
        if (question.type === 'fill-blank') {
            if (answers[index]?.selectedAnswer?.toLowerCase() === question.correctAnswer.toLowerCase()) {
                score++;
            }
        } else {
            if (answers[index]?.selectedAnswer === question.correctAnswer) {
                score++;
            }
        }
    });
    return score;
}

function collectUserAnswers() {
    return currentQuiz.questions.map((question, index) => {
        if (question.type === 'fill-blank') {
            const input = document.querySelector(`input[name="answer-${index}"]`);
            return { 
                questionIndex: index, 
                selectedAnswer: input ? input.value.trim().toLowerCase() : null 
            };
        } else {
            const selected = document.querySelector(`input[name="answer-${index}"]:checked`);
            return { 
                questionIndex: index, 
                selectedAnswer: selected ? parseInt(selected.value) : null 
            };
        }
    });
}

function startTimer(minutes) {
    timeRemaining = minutes * 60;
    const timerElement = document.getElementById('timer');
    
    updateTimerDisplay(timerElement, timeRemaining);
    
    timer = setInterval(() => {
        timeRemaining--;
        if (timeRemaining <= 0) {
            clearInterval(timer);
            submitQuiz();
            return;
        }
        
        updateTimerDisplay(timerElement, timeRemaining);
        updateTimerColor(timeRemaining, minutes * 60);
        
        // Add warning class when less than 1 minute remains
        if (timeRemaining <= 60) {
            timerElement.style.color = '#dc3545';
            timerElement.style.animation = 'pulse 1s infinite';
        }
    }, 1000);
}

function updateTimerDisplay(element, seconds) {
    const minutesLeft = Math.floor(seconds / 60);
    const secondsLeft = seconds % 60;
    element.querySelector('span').innerHTML = 
        `Time Left: <strong>${minutesLeft}:${secondsLeft.toString().padStart(2, '0')}</strong>`;
}

// Add this function to update timer colors
function updateTimerColor(timeLeft, totalTime) {
    const timer = document.querySelector('.timer');
    const percentage = timeLeft / totalTime;
    
    if (percentage <= 0.25) {
        timer.classList.add('danger');
        timer.classList.remove('warning');
    } else if (percentage <= 0.5) {
        timer.classList.add('warning');
        timer.classList.remove('danger');
    } else {
        timer.classList.remove('warning', 'danger');
    }
}

function displayResults(results) {
    const percentage = Math.round((results.score / results.total) * 100);
    const minutes = Math.floor(results.timeTaken / 60);
    const seconds = results.timeTaken % 60;
    
    let feedback;
    if (percentage >= 80) {
        feedback = "Excellent work! You've mastered this topic! 🎉";
    } else if (percentage >= 60) {
        feedback = "Good job! Keep practicing to improve further. 👍";
    } else {
        feedback = "Keep studying! You'll do better next time. 💪";
    }

    const resultHTML = `
        <div class="result-header">
            <h2>Quiz Results</h2>
            <div class="score-value">${results.score}/${results.total} (${percentage}%)</div>
            <p class="score-message">
                ${feedback}<br>
                Time taken: ${minutes}m ${seconds}s
            </p>
        </div>
        
        <div class="result-details">
            ${results.questions.map((question, index) => {
                const answer = results.answers[index];
                const isCorrect = question.type === 'fill-blank' 
                    ? answer.selectedAnswer === question.correctAnswer.toLowerCase()
                    : answer.selectedAnswer === question.correctAnswer;
                
                return `
                    <div class="question-result ${isCorrect ? 'correct' : 'incorrect'}">
                        <h4>Question ${index + 1}</h4>
                        <p>${question.questionText}</p>
                        <p>Your answer: ${answer.selectedAnswer !== null 
                            ? (question.type === 'fill-blank' 
                                ? answer.selectedAnswer 
                                : question.options[answer.selectedAnswer])
                            : 'No answer'}</p>
                        ${!isCorrect ? `
                            <p>Correct answer: ${question.type === 'fill-blank' 
                                ? question.correctAnswer 
                                : question.options[question.correctAnswer]}</p>
                        ` : ''}
                    </div>
                `;
            }).join('')}
        </div>
        
        <div class="actions" style="margin-top: 2rem; text-align: center;">
            <a href="student_das.html" class="btn-submit">
                <i class="fas fa-home"></i> Return to Dashboard
            </a>
        </div>
    `;

    document.getElementById('quizContent').style.display = 'none';
    const resultElement = document.getElementById('quizResult');
    resultElement.innerHTML = resultHTML;
    resultElement.style.display = 'block';
    
    // Animate results appearing
    resultElement.style.opacity = "0";
    setTimeout(() => {
        resultElement.style.transition = "opacity 0.5s ease";
        resultElement.style.opacity = "1";
    }, 100);
}

async function showMessage(message, type = 'info') {
    const container = document.getElementById('quizContent');
    container.innerHTML = `
        <div class="message ${type}">
            <p>${message}</p>
            <a href="student_das.html" class="btn-submit">
                <i class="fas fa-arrow-left"></i> Back to Dashboard
            </a>
        </div>
    `;
    const userDoc = await getDoc(doc(db, 'users', userId));
    const userData = userDoc.data();
    const dashboardUrl = userData.role === 'teacher' ? 'teacher_dash.html' : 'student_das.html';
    window.location.href = dashboardUrl;
}