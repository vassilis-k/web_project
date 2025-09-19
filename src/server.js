require('dotenv').config({ path: __dirname + '/config/.env' });
const express = require('express');
const session = require('express-session');
const path = require('path');
const authRoutes = require('./routes/authRoutes');
const professorRoutes = require('./routes/professorRoutes');
const studentRoutes = require('./routes/studentRoutes');
const secretariatRoutes = require('./routes/secretariatRoutes'); // Import secretariat routes
const announcementRoutes = require('./routes/announcementRoutes');
const { isAuthenticated, authorizeRole } = require('./middleware/authMiddleware');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 // 24 ώρες
    }
}));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, '../public')));
// Serve uploaded files (PDFs, drafts, notes)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Auth routes (login/logout, user-info)
app.use('/', authRoutes);

// Professor specific API routes - protected
app.use('/api/professor', isAuthenticated, authorizeRole('professor'), professorRoutes);

// Student specific API routes - protected
app.use('/api/student', isAuthenticated, authorizeRole('student'), studentRoutes);

// Secretariat specific API routes - protected (Νέα γραμμή)
app.use('/api/secretariat', isAuthenticated, authorizeRole('secretariat'), secretariatRoutes);

app.use('/api', announcementRoutes);

// Public route for root, redirects to login
app.get('/', (req, res) => {
    res.redirect('/login.html');
});

// Protected frontend routes (ensure they are served only if authenticated and authorized)
app.get('/professor-dashboard.html', isAuthenticated, authorizeRole('professor'), (req, res) => {
    res.sendFile(path.join(__dirname, '../public/professor-dashboard.html'));
});

app.get('/student-dashboard.html', isAuthenticated, authorizeRole('student'), (req, res) => {
    res.sendFile(path.join(__dirname, '../public/student-dashboard.html'));
});

app.get('/secretariat-dashboard.html', isAuthenticated, authorizeRole('secretariat'), (req, res) => { // Νέα γραμμή
    res.sendFile(path.join(__dirname, '../public/secretariat-dashboard.html'));
});

// Generic dashboard (αν υπάρχει, θα αντικατασταθεί από dashboards ανά ρόλο)
app.get('/dashboard.html', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

// Fallback for unauthenticated access to other paths (except login itself)
app.use((req, res, next) => {
    if (!req.session.userId && !req.path.includes('login') && !req.path.startsWith('/api/') && !req.path.startsWith('/css/') && !req.path.startsWith('/js/')) {
        return res.redirect('/login.html');
    }
    next();
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});