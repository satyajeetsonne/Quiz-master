// // Handle login
// async function loginUser() {
//   if (!validateForm()) return;

//   try {
//       loginBtn.disabled = true;
//       const response = await mockAuthAPI('/login', {
//           email: emailInput.value,
//           password: passwordInput.value
//       });

//       if (response.success) {
//           // Store authentication state
//           localStorage.setItem('quizAuth', JSON.stringify({
//               email: emailInput.value,
//               loggedIn: true
//           }));
          
//           showMessage('Login successful! Redirecting...', 'success');
//           setTimeout(() => {
//               window.location.href = 'student_das.html';
//           }, 2000);
//       }
//   } catch (error) {
//       showMessage(error.message || 'Login failed', 'error');
//   } finally {
//       loginBtn.disabled = false;
//   }
// }