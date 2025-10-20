import { db, auth } from "./firebase-config.js";
import { doc, getDoc, addDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    initializeQuiz();
});

async function initializeQuiz() {
    const quizId = getQuizIdFromUrl();
    if (!quizId) {
        redirectToQuizList();
        return;
    }

    try {
        const quiz = await loadQuiz(quizId);
        if (!quiz) {
            redirectToQuizList();
            return;
        }

        renderQuiz(quiz);
        if (quiz.timeLimit) {
            startTimer(quiz.timeLimit);
        }
    } catch (error) {
        console.error('Quiz initialization error:', error);
        redirectToQuizList();
    }
}

function getQuizIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}

function redirectToQuizList() {
    window.location.href = 'quiz_list.html';
}

async function loadQuiz(quizId) {
    const quizRef = doc(db, "quizzes", quizId);
    const quizSnap = await getDoc(quizRef);

    if (!quizSnap.exists()) {
        return null;
    }

    return {
        id: quizSnap.id,
        ...quizSnap.data()
    };
}

function renderOptions(options, questionIndex) {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    return options.map((option, index) => `
        <div class="option" data-question="${questionIndex}" data-option="${index}">
            <input type="radio" id="q${questionIndex}o${index}" name="q${questionIndex}" value="${index}">
            <div class="option-prefix">${letters[index]}</div>
            <div class="option-text">${option}</div>
            <div class="option-feedback">
                <i class="fas fa-check"></i>
            </div>
        </div>
    `).join('');
}

function renderQuiz(quiz) {
    const container = document.getElementById('quizContainer');
    if (!container) return;

    document.getElementById('quizTitle').textContent = quiz.title;

    container.innerHTML = quiz.questions.map((question, index) => `
        <div class="question">
            <div class="question-text">${index + 1}. ${question.questionText}</div>
            <div class="options-container">
                ${renderOptions(question.options, index)}
            </div>
        </div>
    `).join('');

    // Add event listeners for option selection
    document.querySelectorAll('.option').forEach(option => {
        option.addEventListener('click', function() {
            const questionIndex = this.dataset.question;
            const optionsContainer = this.parentElement;
            
            // Remove selected class from all options in this question
            optionsContainer.querySelectorAll('.option').forEach(opt => {
                opt.classList.remove('selected');
            });
            
            // Add selected class to clicked option
            this.classList.add('selected');
            
            // Check the radio button
            const radio = this.querySelector('input[type="radio"]');
            if (radio) {
                radio.checked = true;
            }
        });
    });

    // Add event listener to submit button
    const submitButton = document.getElementById('submitQuiz');
    if (submitButton) {
        submitButton.addEventListener('click', () => submitQuiz(quiz));
    }
}

function startTimer(minutes) {
    if (!minutes) return;
    
    let timeLeft = minutes * 60;
    const timerElement = document.getElementById('timer');
    if (!timerElement) return;

    const timer = setInterval(() => {
        const mins = Math.floor(timeLeft / 60);
        const secs = timeLeft % 60;
        timerElement.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;

        if (timeLeft === 0) {
            clearInterval(timer);
            submitQuiz();
        }
        timeLeft--;
    }, 1000);
}

async function submitQuiz(quiz) {
    if (!auth.currentUser) {
        alert('You must be logged in to submit a quiz');
        return;
    }

    const answers = collectAnswers();
    const score = calculateScore(answers, quiz);
    const totalQuestions = quiz.questions.length;
    const percentage = Math.round((score / totalQuestions) * 100);

    // Show correct/incorrect feedback on options
    quiz.questions.forEach((question, index) => {
        const options = document.querySelectorAll(`[data-question="${index}"]`);
        const selectedAnswer = answers[index];
        
        options.forEach((option, optionIndex) => {
            const isSelected = optionIndex === selectedAnswer;
            const isCorrect = optionIndex === question.correctAnswer;
            
            if (isSelected) {
                if (isCorrect) {
                    option.classList.add('correct');
                    option.querySelector('.option-feedback').innerHTML = '<i class="fas fa-check"></i>';
                } else {
                    option.classList.add('incorrect');
                    option.querySelector('.option-feedback').innerHTML = '<i class="fas fa-times"></i>';
                }
            } else if (isCorrect) {
                option.classList.add('correct');
            }
        });
    });

    try {
        // Save the quiz result to Firestore
        await addDoc(collection(db, "quiz_results"), {
            quizId: quiz.id,
            userId: auth.currentUser.uid,
            score: score,
            totalQuestions: totalQuestions,
            percentage: percentage,
            answers: answers,
            completedAt: serverTimestamp()
        });

        displayResult(score, totalQuestions, answers, quiz);
    } catch (error) {
        console.error('Error saving quiz result:', error);
        alert('There was an error submitting your quiz. Please try again.');
    }
}

function collectAnswers() {
    const answers = {};
    document.querySelectorAll('.question').forEach((question, index) => {
        const selected = question.querySelector(`input[name="q${index}"]:checked`);
        answers[index] = selected ? parseInt(selected.value) : null;
    });
    return answers;
}

function calculateScore(answers, quiz) {
    let score = 0;
    quiz.questions.forEach((question, index) => {
        if (answers[index] === question.correctAnswer) {
            score++;
        }
    });
    return score;
}

function displayResult(score, total, answers, quiz) {
    const resultDiv = document.getElementById('quizResult');
    if (!resultDiv) return;

    const percentage = Math.round((score / total) * 100);
    let feedback;
    if (percentage >= 80) {
        feedback = "Excellent work! You've mastered this topic!";
    } else if (percentage >= 60) {
        feedback = "Good job! Keep practicing to improve further.";
    } else {
        feedback = "Keep studying! You'll do better next time.";
    }

    resultDiv.innerHTML = `
        <div class="result-header">Quiz Results</div>
        <div class="result-score">${score}/${total} (${percentage}%)</div>
        <div class="result-feedback">${feedback}</div>
        
        <div class="result-details">
            ${quiz.questions.map((question, index) => `
                <div class="result-item">
                    <div class="result-icon ${answers[index] === question.correctAnswer ? 'result-correct' : 'result-incorrect'}">
                        ${answers[index] === question.correctAnswer ? '✓' : '✗'}
                    </div>
                    <div class="result-content">
                        <div class="question-text">${index + 1}. ${question.questionText}</div>
                        <div>Your answer: ${answers[index] !== null ? question.options[answers[index]] : 'No answer'}</div>
                        ${answers[index] !== question.correctAnswer ? 
                            `<div>Correct answer: ${question.options[question.correctAnswer]}</div>` : 
                            ''}
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    resultDiv.style.display = 'block';
    document.getElementById('quizContainer').style.display = 'none';
    document.getElementById('submitQuiz').style.display = 'none';

    // Scroll to results
    resultDiv.scrollIntoView({ behavior: 'smooth' });
}
