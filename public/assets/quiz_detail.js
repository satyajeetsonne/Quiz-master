import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
    const quizContent = document.getElementById('quizContent');
    const urlParams = new URLSearchParams(window.location.search);
    const quizId = urlParams.get('id');

    if (!quizId) {
        redirectToQuizList();
        return;
    }

    try {
        const quizDoc = await getDoc(doc(db, "quizzes", quizId));
        
        if (!quizDoc.exists()) {
            redirectToQuizList();
            return;
        }

        const quiz = quizDoc.data();
        renderQuiz(quiz);

    } catch (error) {
        console.error("Error loading quiz:", error);
        redirectToQuizList();
    }
});

function redirectToQuizList() {
    window.location.href = "quiz_list.html";
}

function renderQuiz(quiz) {
    const quizContent = document.getElementById('quizContent');
    quizContent.innerHTML = `
        <h1>${quiz.title}</h1>
        <div class="quiz-info">
            <div class="questions-count">${quiz.questions.length} Questions</div>
            <div class="time-limit">Time Limit: ${quiz.timeLimit} minutes</div>
        </div>
        ${renderQuestions(quiz.questions)}
    `;
}

function renderQuestions(questions) {
    return questions.map((q, index) => `
        <div class="question">
            <h3>${index + 1}. ${q.questionText}</h3>
            ${q.options.map((opt, i) => `<label><input type="radio" name="q${index}" value="${i + 1}"> ${opt}</label><br>`).join("")}
        </div>
    `).join("");
}