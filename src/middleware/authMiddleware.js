exports.isAuthenticated = (req, res, next) => {
    if (req.session && req.session.userId) {
        // User is logged in, proceed to the next middleware/route handler
        next();
    } else {
        // User is not logged in, redirect to login page
        // For API calls, send a 401 Unauthorized status
        if (req.originalUrl.startsWith('/api')) { // Example for API routes
            return res.status(401).json({ message: 'Δεν έχετε εξουσιοδότηση. Παρακαλώ συνδεθείτε.' });
        }
        res.redirect('/login.html');
    }
};

// Example for role-based authorization (optional, for later stages)
exports.authorizeRole = (requiredRole) => {
    return (req, res, next) => {
        if (req.session && req.session.userRole === requiredRole) {
            next();
        } else {
            res.status(403).json({ message: 'Δεν έχετε επαρκή δικαιώματα.' });
        }
    };
};