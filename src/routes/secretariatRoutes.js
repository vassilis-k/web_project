const express = require('express');
const router = express.Router();
const secretariatController = require('../controllers/secretariatController');
const multer = require('multer');

// Use memory storage for multer to handle the file as a buffer
const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 2 * 1024 * 1024 } // 2MB limit to prevent large in-memory uploads
});

// 1) Προβολή ΔΕ
router.get('/theses-overview', secretariatController.getThesesForOverview);

// 2) Εισαγωγή δεδομένων
router.post('/import-users', upload.single('jsonFile'), secretariatController.importUsers);

// 3) Διαχείριση διπλωματικής εργασίας - Ενεργή: Καταχώριση ΑΠ από ΓΣ
router.put('/theses/:thesisId/gs-approval', secretariatController.updateGsApprovalProtocol);

// 3) Διαχείριση διπλωματικής εργασίας - Ενεργή: Ακύρωση διπλωματικής
router.put('/theses/:thesisId/cancel', secretariatController.cancelThesis);

// 3) Διαχείριση διπλωματικής εργασίας - Υπό Εξέταση: Αλλαγή κατάστασης σε «Περατωμένη»
router.put('/theses/:thesisId/complete', secretariatController.completeThesis);

module.exports = router;