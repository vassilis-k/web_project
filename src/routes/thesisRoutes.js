const express = require('express');
const thesisController = require('../controllers/thesisController');
const router = express.Router();

router.get('/:thesisId/examination-report', thesisController.getExaminationReport);

module.exports = router;