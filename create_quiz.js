import { db, auth } from "./firebase-config.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

let questionCount = 0;

document.addEventListener("DOMContentLoaded", () => {
    // Check authentication
    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            console.log("No authenticated user - redirecting to login");
            window.location.href = "login.html";
            return;
        }
        console.log("Authenticated user:", user.email);
        
        setupEventListeners();
        addQuestion(); // Add first question automatically
    });
});

function setupEventListeners() {
    const addQuestionBtn = document.getElementById("addQuestionBtn");
    const createQuizBtn = document.getElementById("createQuizBtn");
    
    if (addQuestionBtn) {
        addQuestionBtn.addEventListener("click", addQuestion);
    }
    
    if (createQuizBtn) {
        createQuizBtn.addEventListener("click", handleQuizSubmission);
    }
}

function addQuestion() {
    questionCount++;
    const questionsContainer = document.getElementById("questionsContainer");
    
    if (!questionsContainer) {
        console.error("Questions container not found!");
        return;
    }
    
    const questionDiv = document.createElement("div");
    questionDiv.className = "question-card";
    questionDiv.innerHTML = `
        <div class="question-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <div style="display: flex; align-items: center; gap: 1rem;">
                <span class="question-number" style="background: var(--primary); color: white; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 8px; font-weight: 500;">
                    ${questionCount}
                </span>
                <select class="question-type" onchange="handleQuestionTypeChange(this)" style="padding: 0.75rem 1rem; border: 2px solid var(--border-light); border-radius: 8px; color: var(--dark-blue); font-size: 0.935rem; min-width: 160px;">
                    <option value="multiple-choice">Multiple Choice</option>
                    <option value="true-false">True/False</option>
                </select>
            </div>
            <button type="button" class="btn btn-delete" onclick="removeQuestion(this)">
                <i class="fas fa-trash"></i>
            </button>
        </div>
        <div class="form-group">
            <div class="input-group">
                <span class="input-icon" style="color: var(--primary);">📝</span>
                <input type="text" class="questionText" placeholder="Enter your question">
            </div>
        </div>
        <div class="options-container">
            ${generateOptionsForType('multiple-choice')}
        </div>
    `;
    
    questionsContainer.appendChild(questionDiv);
}

window.handleQuestionTypeChange = function(selectElement) {
    const questionDiv = selectElement.closest('.question-card');
    const optionsContainer = questionDiv.querySelector('.options-container');
    optionsContainer.innerHTML = generateOptionsForType(selectElement.value);
};

function generateOptionsForType(type) {
    switch(type) {
        case 'multiple-choice':
            return `
                <div class="options-list" style="display: grid; gap: 1rem; margin-bottom: 1.5rem;">
                    <div class="form-group" style="margin-bottom: 1rem;">
                        <div class="input-group">
                            <span class="input-icon" style="font-weight: 600; color: var(--primary);">A</span>
                            <input type="text" class="option" placeholder="Option 1">
                        </div>
                    </div>
                    <div class="form-group" style="margin-bottom: 1rem;">
                        <div class="input-group">
                            <span class="input-icon" style="font-weight: 600; color: var(--primary);">B</span>
                            <input type="text" class="option" placeholder="Option 2">
                        </div>
                    </div>
                    <div class="form-group" style="margin-bottom: 1rem;">
                        <div class="input-group">
                            <span class="input-icon" style="font-weight: 600; color: var(--primary);">C</span>
                            <input type="text" class="option" placeholder="Option 3">
                        </div>
                    </div>
                    <div class="form-group" style="margin-bottom: 1rem;">
                        <div class="input-group">
                            <span class="input-icon" style="font-weight: 600; color: var(--primary);">D</span>
                            <input type="text" class="option" placeholder="Option 4">
                        </div>
                    </div>
                </div>
                <div class="form-group">
                    <label>Correct Answer</label>
                    <div class="input-group">
                        <span class="input-icon" style="color: var(--success);">🎯</span>
                        <select class="correctAnswer" style="width: 100%; padding: 0.875rem 1rem 0.875rem 3rem; border: 2px solid var(--border-light); border-radius: 8px; background: white;">
                            <option value="0">Option A is correct</option>
                            <option value="1">Option B is correct</option>
                            <option value="2">Option C is correct</option>
                            <option value="3">Option D is correct</option>
                        </select>
                    </div>
                </div>
            `;
        case 'true-false':
            return `
                <div class="options-list" style="display: flex; gap: 1rem; margin-bottom: 1.5rem;">
                    <label class="true-false-option" style="flex: 1; padding: 1rem; border: 2px solid var(--border-light); border-radius: 8px; background: white; display: flex; align-items: center; gap: 0.75rem; cursor: pointer; transition: all 0.2s ease;">
                        <input type="radio" name="correct-tf-${questionCount}" value="true" id="true-${questionCount}" style="width: auto;">
                        <span style="color: var(--dark-blue); font-weight: 500;">True</span>
                    </label>
                    <label class="true-false-option" style="flex: 1; padding: 1rem; border: 2px solid var(--border-light); border-radius: 8px; background: white; display: flex; align-items: center; gap: 0.75rem; cursor: pointer; transition: all 0.2s ease;">
                        <input type="radio" name="correct-tf-${questionCount}" value="false" id="false-${questionCount}" style="width: auto;">
                        <span style="color: var(--dark-blue); font-weight: 500;">False</span>
                    </label>
                </div>
            `;
        default:
            return '';
    }
}

window.removeQuestion = function(button) {
    const questionDiv = button.closest('.question-card');
    if (questionDiv && questionDiv.parentElement) {
        questionDiv.parentElement.removeChild(questionDiv);
    }
};

async function handleQuizSubmission() {
    try {
        const user = auth.currentUser;
        if (!user) {
            alert("You must be logged in to create a quiz!");
            return;
        }

        const quizTitle = document.getElementById("quizTitle").value.trim();
        const timeLimit = parseInt(document.getElementById("timeLimit").value);
        const subject = document.getElementById("quizSubject").value.trim();
        const questions = [];
        
        if (!quizTitle) {
            alert("Please enter a quiz title!");
            return;
        }

        if (!timeLimit || timeLimit < 1 || timeLimit > 180) {
            alert("Please enter a valid time limit between 1 and 180 minutes!");
            return;
        }

        if (!subject) {
            alert("Please enter a subject name!");
            return;
        }

        document.querySelectorAll(".question-card").forEach((questionDiv, index) => {
            const questionType = questionDiv.querySelector(".question-type").value;
            const questionText = questionDiv.querySelector(".questionText").value.trim();
            let options = [];
            let correctAnswer;

            switch(questionType) {
                case 'multiple-choice':
                    options = Array.from(questionDiv.querySelectorAll(".option"))
                        .map(input => input.value.trim());
                    correctAnswer = parseInt(questionDiv.querySelector(".correctAnswer").value);
                    
                    if (!questionText || options.some(opt => !opt)) {
                        throw new Error(`Please fill in all fields for question ${index + 1}`);
                    }
                    break;

                case 'true-false':
                    options = ['True', 'False'];
                    const selectedAnswer = questionDiv.querySelector('input[type="radio"]:checked');
                    if (!selectedAnswer) {
                        throw new Error(`Please select the correct answer for question ${index + 1}`);
                    }
                    correctAnswer = selectedAnswer.value === 'true' ? 0 : 1;
                    break;
            }

            questions.push({
                questionText,
                questionType,
                options,
                correctAnswer
            });
        });

        if (questions.length === 0) {
            alert("Please add at least one question!");
            return;
        }

        const quizData = {
            title: quizTitle,
            subject: subject,
            timeLimit: timeLimit,
            questions: questions,
            createdAt: serverTimestamp(),
            teacherId: user.uid,
            createdBy: user.email,
            active: true
        };

        const quizRef = collection(db, "quizzes");
        await addDoc(quizRef, quizData);
        
        alert("Quiz created successfully!");
        window.location.href = "teacher_dash.html";
        
    } catch (error) {
        console.error("Error creating quiz:", error);
        alert(error.message || "Failed to create quiz. Please try again.");
    }
}