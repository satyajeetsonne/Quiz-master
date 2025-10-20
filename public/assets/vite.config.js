export default {
  server: {
    port: 3000,
    open: true
  },
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        admin: 'admin_dash.html',
        login: 'login.html',
        register: 'register.html',
        setup: 'setup.html',
        studentDash: 'student_das.html',
        teacherDash: 'teacher_dash.html'
      }
    }
  },
  resolve: {
    extensions: ['.js', '.mjs']
  }
}