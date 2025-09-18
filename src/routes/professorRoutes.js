const express = require('express');
const router = express.Router();
const professorController = require('../controllers/professorController');
const multer = require('multer');

// Multer setup for PDF uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/thesis_pdfs/');
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage: storage });

// 1) Διαχείριση Θεμάτων (Δημιουργία/Προβολή/Επεξεργασία)
router.get('/topics', professorController.getProfessorTopics);
router.post('/topics', upload.single('pdfFile'), professorController.createProfessorTopic);
router.put('/topics/:id', upload.single('pdfFile'), professorController.updateProfessorTopic);

// 2) Αρχική ανάθεση θέματος σε φοιτητή
router.get('/students/search', professorController.searchStudents);
router.get('/theses/under-assignment', professorController.getUnderAssignmentTheses); // New route
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
router.post('/theses/:thesisId/notes', professorController.addProfessorNote); // Προσθήκη σημείωσης
router.put('/theses/:thesisId/set-under-review', professorController.setThesisUnderReview); // Αλλαγή κατάστασης σε υπό εξέταση
router.put('/theses/:thesisId/cancel-by-supervisor', professorController.cancelThesisBySupervisor); // Ακύρωση από επιβλέποντα
router.put('/theses/:thesisId/grade', professorController.saveProfessorGrade); // Καταχώριση βαθμού
router.get('/theses/:thesisId/announcement', professorController.generatePresentationAnnouncement); // Δημιουργία ανακοίνωσης

// 5) Προβολή στατιστικών
router.get('/statistics', professorController.getProfessorStatistics);

module.exports = router;