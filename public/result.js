import { db } from "./firebase-config.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

const auth = firebase.auth();
const resultsContainer = document.getElementById('results-container');
const backBtn = document.getElementById('back-btn');

backBtn.addEventListener('click', () => {
  window.location.href = "student_das.html"; // Redirect to student dashboard
});

function createResultCard(quizTitle, score, date) {
  return `
    <div class="result-card">
      <h3>${quizTitle}</h3>
      <div class="score">Score: ${score}</div>
      <div class="date">Date: ${date}</div>
    </div>
  `;
}

export async function getResults(userId) {
    try {
        const resultsQuery = query(
            collection(db, 'results'),
            where('userId', '==', userId)
        );
        
        const snapshot = await getDocs(resultsQuery);
        
        // Sort results in memory
        return snapshot.docs
            .map(doc => ({
                id: doc.id,
                ...doc.data()
            }))
            .sort((a, b) => b.timestamp?.toDate() - a.timestamp?.toDate());
    } catch (error) {
        console.error('Error fetching results:', error);
        return [];
    }
}

async function loadStudentResults(studentId) {
  resultsContainer.innerHTML = '';

  const results = await getResults(studentId);

  if (results.length === 0) {
    resultsContainer.innerHTML = '<p>No results found.</p>';
    return;
  }

  results.forEach(data => {
    db.collection('quizzes').doc(data.quizId).get().then(quizDoc => {
      const quizTitle = quizDoc.exists ? quizDoc.data().title : 'Unknown Quiz';
      const score = `${data.score} / ${data.total}`;
      const date = data.timestamp.toDate().toLocaleDateString();

      resultsContainer.innerHTML += createResultCard(quizTitle, score, date);
    });
  });
}

auth.onAuthStateChanged(user => {
  if (user) {
    loadStudentResults(user.uid);
  } else {
    alert("You must be logged in to view results.");
    window.location.href = "login.html";
  }
});
