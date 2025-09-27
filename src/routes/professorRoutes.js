const express = require('express');
const router = express.Router();
const professorController = require('../controllers/professorController');
const multer = require('multer');
const path = require('path');

// Multer storage for topic description PDFs (store in uploads/thesis_pdfs)
const topicPdfStorage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, path.join(__dirname, '../../uploads/thesis_pdfs'));
	},
	filename: (req, file, cb) => {
		const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
		const ext = path.extname(file.originalname) || '.pdf';
		cb(null, `topic-${uniqueSuffix}${ext}`);
	}
});

const uploadTopicPdf = multer({
	storage: topicPdfStorage,
	limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
	fileFilter: (req, file, cb) => {
		if (file.mimetype !== 'application/pdf') {
			req.fileValidationError = 'Μόνο αρχεία PDF επιτρέπονται για την περιγραφή θέματος.';
			return cb(null, false);
		}
		cb(null, true);
	}
});

function handleMulterErrors(req, res, next) {
	if (req.fileValidationError) {
		return res.status(400).json({ message: req.fileValidationError });
	}
	next();
}

// 1) Διαχείριση Θεμάτων (Δημιουργία/Προβολή/Επεξεργασία)
router.get('/topics', professorController.getProfessorTopics);
router.post('/topics', uploadTopicPdf.single('description_pdf'), handleMulterErrors, professorController.createProfessorTopic);
router.put('/topics/:id', uploadTopicPdf.single('description_pdf'), handleMulterErrors, professorController.updateProfessorTopic);

// 2) Αρχική ανάθεση θέματος σε φοιτητή
router.get('/students/search', professorController.searchStudents);
router.post('/assign-topic', professorController.assignTopic);
router.post('/unassign-topic', professorController.unassignTopic);
// Missing route: list temporarily assigned theses (under assignment) for unassign UI
router.get('/theses/under-assignment', professorController.getUnderAssignmentTheses);

// 3) Προβολή λίστας διπλωματικών (φιλτραρισμένες)
router.get('/theses', professorController.getProfessorThesesList); // Χρησιμοποιεί το getProfessorRelatedThesesDetailed με filters
router.get('/theses/:thesisId', professorController.getSingleThesisDetails); // Λεπτομέρειες για μία διπλωματική
router.get('/theses/export', professorController.exportTheses); // Εξαγωγή

// 4) Προβολή προσκλήσεων συμμετοχής σε τριμελή
router.get('/invitations', professorController.getProfessorInvitations);
router.post('/invitations/:invitationId/accept', professorController.acceptInvitation);
router.post('/invitations/:invitationId/decline', professorController.declineInvitation);

// 6) Διαχείριση διπλωματικών εργασιών (ενέργειες ανά κατάσταση)
// Χρήση της επικυρωμένης υλοποίησης addProfessorNote (παλαιό addThesisNote αφαιρέθηκε)
router.post('/theses/:thesisId/notes', professorController.addProfessorNote); // Προσθήκη σημείωσης
router.put('/theses/:thesisId/set-under-review', professorController.setThesisUnderReview); // Αλλαγή κατάστασης σε υπό εξέταση
router.put('/theses/:thesisId/cancel-by-supervisor', professorController.cancelThesisBySupervisor); // Ακύρωση από επιβλέποντα
router.put('/theses/:thesisId/grade', professorController.saveProfessorGrade); // Καταχώριση βαθμού
router.post('/theses/:thesisId/enable-grading', professorController.enableGrading); // Ενεργοποίηση βαθμολόγησης
router.get('/theses/:thesisId/announcement', professorController.generatePresentationAnnouncement); // Δημιουργία ανακοίνωσης

// 5) Προβολή στατιστικών
router.get('/statistics', professorController.getProfessorStatistics);

module.exports = router;