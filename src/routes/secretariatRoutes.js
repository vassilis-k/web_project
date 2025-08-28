const express = require('express');
const router = express.Router();
const secretariatController = require('../controllers/secretariatController');

// 1) Προβολή ΔΕ
router.get('/theses', secretariatController.getSecretariatTheses);

// 3) Διαχείριση διπλωματικής εργασίας - Ενεργή: Καταχώριση ΑΠ από ΓΣ
router.put('/theses/:thesisId/gs-approval', secretariatController.updateGsApprovalProtocol);

// 3) Διαχείριση διπλωματικής εργασίας - Ενεργή: Ακύρωση διπλωματικής
router.put('/theses/:thesisId/cancel', secretariatController.cancelThesis);

// 3) Διαχείριση διπλωματικής εργασίας - Υπό Εξέταση: Αλλαγή κατάστασης σε «Περατωμένη»
router.put('/theses/:thesisId/complete', secretariatController.completeThesis);

// 2) Εισαγωγή δεδομένων (Placeholder)
router.post('/import-data', secretariatController.importUserData);

module.exports = router;