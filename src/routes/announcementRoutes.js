const express = require('express');
const router = express.Router();
const announcementController = require('../controllers/announcementController');

router.get('/announcements', announcementController.getAnnouncements);
// Public unauthenticated feed (JSON or XML)
router.get('/announcements/feed', announcementController.getAnnouncementsFeed);

module.exports = router;