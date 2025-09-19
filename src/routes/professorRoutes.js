const express = require('express');
const router = express.Router();
const professorController = require('../controllers/professorController');

// 1) Διαχείριση Θεμάτων (Δημιουργία/Προβολή/Επεξεργασία)
router.get('/topics', professorController.getProfessorTopics);
router.post('/topics', professorController.createProfessorTopic);
router.put('/topics/:id', professorController.updateProfessorTopic);

// 2) Αρχική ανάθεση θέματος σε φοιτητή
router.get('/students/search', professorController.searchStudents);
router.post('/assign-topic', professorController.assignTopic);
router.post('/unassign-topic', professorController.unassignTopic);

// 3) Προβολή λίστας διπλωματικών (φιλτραρισμένες)
router.get('/theses', professorController.getProfessorThesesList); // Χρησιμοποιεί το getProfessorRelatedThesesDetailed με filters
router.get('/theses/:thesisId', professorController.getSingleThesisDetails); // Λεπτομέρειες για μία διπλωματική
router.get('/theses/export', professorController.exportTheses); // Εξαγωγή

// 4) Προβολή προσκλήσεων συμμετοχής σε τριμελή
router.get('/invitations', professorController.getProfessorInvitations);
router.post('/invitations/:invitationId/accept', professorController.acceptInvitation);
router.post('/invitations/:invitationId/decline', professorController.declineInvitation);

// 6) Διαχείριση διπλωματικών εργασιών (ενέργειες ανά κατάσταση)
router.post('/theses/:thesisId/notes', professorController.addThesisNote); // Προσθήκη σημείωσης
router.put('/theses/:thesisId/set-under-review', professorController.setThesisUnderReview); // Αλλαγή κατάστασης σε υπό εξέταση
router.put('/theses/:thesisId/cancel-by-supervisor', professorController.cancelThesisBySupervisor); // Ακύρωση από επιβλέποντα
router.put('/theses/:thesisId/grade', professorController.saveProfessorGrade); // Καταχώριση βαθμού
router.get('/theses/:thesisId/announcement', professorController.generatePresentationAnnouncement); // Δημιουργία ανακοίνωσης

// 5) Προβολή στατιστικών
router.get('/statistics', professorController.getProfessorStatistics);

module.exports = router;