import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { getFirestore, collection, getDocs, query, where, orderBy, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const studentTableBody = document.getElementById('studentTableBody');
const searchInput = document.getElementById('searchInput');
const sortBySelect = document.getElementById('sortBy');
const statusFilter = document.getElementById('statusFilter');
const exportBtn = document.getElementById('exportBtn');
const bulkFeedbackBtn = document.getElementById('bulkFeedbackBtn');
const emptyState = document.getElementById('emptyState');

let allStudents = [];

// Fetch and display students
async function fetchStudents() {
    try {
        const studentsRef = collection(db, 'students');
        const studentsSnap = await getDocs(studentsRef);
        
        allStudents = studentsSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        renderStudents(allStudents);
    } catch (error) {
        console.error('Error fetching students:', error);
    }
}

// Render students in table
function renderStudents(students) {
    studentTableBody.innerHTML = '';
    
    if (students.length === 0) {
        emptyState.classList.remove('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    
    students.forEach(student => {
        const tr = document.createElement('tr');
        const lastActivity = new Date(student.lastActivity?.toDate() || Date.now());
        const timeAgo = getTimeAgo(lastActivity);
        
        tr.className = 'hover:bg-light-blue transition-colors';
        tr.innerHTML = `
            <td class="p-4 border-b border-border-blue">
                <a href="#" class="text-primary hover:text-text-navy transition-colors font-medium" data-id="${student.id}">
                    ${student.name}
                </a>
            </td>
            <td class="p-4 border-b border-border-blue text-gray-600">${student.email}</td>
            <td class="p-4 border-b border-border-blue text-gray-600">${student.totalQuizzes || 0}</td>
            <td class="p-4 border-b border-border-blue text-gray-600">${student.avgScore ? student.avgScore.toFixed(1) + '%' : 'N/A'}</td>
            <td class="p-4 border-b border-border-blue text-gray-600">${timeAgo}</td>
            <td class="p-4 border-b border-border-blue">
                <span class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
                    student.status === 'active' 
                    ? 'bg-green-50 text-success' 
                    : 'bg-red-50 text-danger'
                }">
                    <span class="w-1.5 h-1.5 rounded-full ${
                        student.status === 'active' 
                        ? 'bg-success' 
                        : 'bg-danger'
                    }"></span>
                    ${student.status || 'inactive'}
                </span>
            </td>
        `;
        
        studentTableBody.appendChild(tr);
    });
    
    // Add click handlers for student names
    document.querySelectorAll('.student-name').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            showStudentDetails(link.dataset.id);
        });
    });
}

// Filter and sort students
function filterAndSortStudents() {
    const searchTerm = searchInput.value.toLowerCase();
    const sortBy = sortBySelect.value;
    const status = statusFilter.value;
    
    let filtered = [...allStudents];
    
    // Apply search filter
    if (searchTerm) {
        filtered = filtered.filter(student => 
            student.name.toLowerCase().includes(searchTerm) ||
            student.email.toLowerCase().includes(searchTerm)
        );
    }
    
    // Apply status filter
    if (status !== 'all') {
        filtered = filtered.filter(student => 
            student.status?.toLowerCase() === status.toLowerCase()
        );
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
        switch(sortBy) {
            case 'score':
                return (b.avgScore || 0) - (a.avgScore || 0);
            case 'quizzes':
                return (b.totalQuizzes || 0) - (a.totalQuizzes || 0);
            case 'lastActivity':
                return new Date(b.lastActivity?.toDate() || 0) - 
                       new Date(a.lastActivity?.toDate() || 0);
            default: // name
                return a.name.localeCompare(b.name);
        }
    });
    
    renderStudents(filtered);
}

// Export to CSV
function exportToCSV() {
    const headers = ['Student Name', 'Email', 'Total Quizzes', 'Average Score', 'Last Activity', 'Status'];
    const rows = allStudents.map(student => [
        student.name,
        student.email,
        student.totalQuizzes || 0,
        student.avgScore ? `${student.avgScore.toFixed(1)}%` : 'N/A',
        new Date(student.lastActivity?.toDate() || Date.now()).toLocaleDateString(),
        student.status || 'Inactive'
    ]);
    
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'students_report.csv';
    link.click();
}

// Utility function to format time ago
function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    const intervals = {
        year: 31536000,
        month: 2592000,
        week: 604800,
        day: 86400,
        hour: 3600,
        minute: 60
    };
    
    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
        const interval = Math.floor(seconds / secondsInUnit);
        if (interval >= 1) {
            return `${interval} ${unit}${interval === 1 ? '' : 's'} ago`;
        }
    }
    
    return 'Just now';
}

// Check user role
async function checkUserRole(userId) {
    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (!userDoc.exists()) return null;
        return userDoc.data().role;
    } catch (error) {
        console.error('Error checking user role:', error);
        return null;
    }
}

// Event listeners
searchInput.addEventListener('input', filterAndSortStudents);
sortBySelect.addEventListener('change', filterAndSortStudents);
statusFilter.addEventListener('change', filterAndSortStudents);
exportBtn.addEventListener('click', exportToCSV);

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Check authentication state
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            // Redirect to login if not authenticated
            window.location.href = 'login.html';
            return;
        }

        // Check user role
        const role = await checkUserRole(user.uid);
        if (role !== 'teacher' && role !== 'admin') {
            // Redirect to appropriate dashboard if not authorized
            window.location.href = role === 'student' ? 'student_das.html' : 'login.html';
            return;
        }

        // If user is authorized (teacher or admin), fetch students
        fetchStudents();
        
        // Update teacher name
        const teacherName = localStorage.getItem('teacherName') || user.displayName || 'SATYA';
        document.getElementById('teacherName').textContent = teacherName;
    });
});

// Handle table header sorting
document.querySelectorAll('.student-table th').forEach(header => {
    header.addEventListener('click', () => {
        const currentSort = header.classList.contains('sort-asc') ? 'desc' : 'asc';
        
        // Remove sorting classes from all headers
        document.querySelectorAll('.student-table th').forEach(h => {
            h.classList.remove('sort-asc', 'sort-desc');
        });
        
        // Add sorting class to clicked header
        header.classList.add(`sort-${currentSort}`);
        
        // Update sort dropdown to match header click
        const headerText = header.textContent.trim().toLowerCase();
        if (headerText.includes('name')) sortBySelect.value = 'name';
        else if (headerText.includes('score')) sortBySelect.value = 'score';
        else if (headerText.includes('quizzes')) sortBySelect.value = 'quizzes';
        else if (headerText.includes('activity')) sortBySelect.value = 'lastActivity';
        
        filterAndSortStudents();
    });
});