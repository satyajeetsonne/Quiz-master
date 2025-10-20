import { getFirestore, collection, addDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { app } from "./firebase-config.js"; // Import Firebase config

const db = getFirestore(app);
const auth = getAuth(app);

// Function to add a quiz
async function addQuiz(title, questions) {
  try {
    const user = auth.currentUser;
    if (!user) {
      alert("You must be logged in to add a quiz!");
      return;
    }

    // Check if user is a teacher
    const quizRef = await addDoc(collection(db, "quizzes"), {
      title,
      questions,
      createdBy: user.uid,
    });

    console.log("Quiz added with ID:", quizRef.id);
    alert("Quiz added successfully!");
  } catch (error) {
    console.error("Error adding quiz:", error);
  }
}

// Example: Call function with sample data
const sampleQuestions = [
  { question: "What is 2+2?", options: ["1", "2", "3", "4"], correctAnswer: "4" },
  { question: "What is 3+5?", options: ["5", "6", "7", "8"], correctAnswer: "8" }
];

// Example function call
addQuiz("Math Test", sampleQuestions);
