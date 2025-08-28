const bcrypt = require('bcryptjs');
const User = require('../models/userModel');

exports.login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Παρακαλώ συμπληρώστε όλα τα πεδία.' });
    }

    try {
        const user = await User.findByEmail(email);

        if (!user) {
            return res.status(401).json({ message: 'Λάθος email ή κωδικός.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ message: 'Λάθος email ή κωδικός.' });
        }

        // Successful login
        req.session.userId = user.id;
        req.session.userRole = user.role;
        req.session.userName = `${user.name} ${user.surname}`;

        // Determine redirect path based on user role
        let redirectTo;
        switch (user.role) {
            case 'professor':
                redirectTo = '/professor-dashboard.html';
                break;
            case 'student':
                redirectTo = '/student-dashboard.html';
                break;
            case 'secretariat':
                redirectTo = '/secretariat-dashboard.html'; // Νέα γραμμή
                break;
            default:
                redirectTo = '/dashboard.html';
        }

        res.status(200).json({ message: 'Σύνδεση επιτυχής!', redirectTo });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Σφάλμα server κατά τη σύνδεση.' });
    }
};

exports.logout = (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Error destroying session:', err);
            return res.status(500).json({ message: 'Αδυναμία αποσύνδεσης.' });
        }
        res.clearCookie('connect.sid'); // Clear session cookie
        res.status(200).json({ message: 'Αποσύνδεση επιτυχής!', redirectTo: '/login.html' });
    });
};

exports.getUserInfo = (req, res) => {
    if (req.session && req.session.userId) {
        res.json({ userId: req.session.userId, userRole: req.session.userRole, userName: req.session.userName });
    } else {
        res.status(401).json({ message: 'Δεν είστε συνδεδεμένος.' });
    }
};