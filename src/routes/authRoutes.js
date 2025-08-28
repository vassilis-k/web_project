const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { isAuthenticated } = require('../middleware/authMiddleware'); // Import isAuthenticated

router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/user-info', isAuthenticated, authController.getUserInfo); // New endpoint, protected

module.exports = router;