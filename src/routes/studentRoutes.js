const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');

// 1) Προβολή θέματος
router.get('/thesis', studentController.getStudentThesis);

// 2) Επεξεργασία Προφίλ
router.get('/profile', studentController.getStudentProfile);
router.put('/profile', studentController.updateStudentProfile);

// 3) Διαχείριση διπλωματικής εργασίας - Υπό ανάθεση (Προσκλήσεις Επιτροπής)
router.get('/professors-for-invitation', studentController.getAllProfessorsForInvitation); // Ανάκτηση λίστας καθηγητών
router.post('/invite-committee-member', studentController.inviteProfessorToCommittee); // Αποστολή πρόσκλησης
router.delete('/invitations/:invitationId', studentController.cancelCommitteeInvitation); // Ακύρωση πρόσκλησης
router.post('/check-activate-thesis', studentController.checkAndActivateThesis); // Έλεγχος και ενεργοποίηση

module.exports = router;