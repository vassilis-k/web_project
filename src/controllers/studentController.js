const User = require('../models/userModel');
const Thesis = require('../models/thesisModel');
const CommitteeInvitation = require('../models/committeeInvitationModel');
const ProgressNote = require('../models/progressNoteModel');
const multer = require('multer');
const path = require('path');

// Ρύθμιση του Multer για αποθήκευση αρχείων προόδου
const progressNoteStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/progress_notes/');
    },
    filename: (req, file, cb) => {
        // Δημιουργία μοναδικού ονόματος αρχείου για αποφυγή συγκρούσεων
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `thesis_${req.params.thesisId}_${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const uploadProgressNote = multer({
    storage: progressNoteStorage,
    fileFilter: (req, file, cb) => {
        // Αποδοχή μόνο συγκεκριμένων τύπων αρχείων (π.χ. PDF, Word, ZIP)
        const allowedTypes = /pdf|doc|docx|zip|rar/;
        const mimetype = allowedTypes.test(file.mimetype);
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Τύπος αρχείου μη επιτρεπτός. Επιτρέπονται μόνο: PDF, DOC, DOCX, ZIP, RAR.'));
    },
    limits: { fileSize: 10 * 1024 * 1024 } // Όριο μεγέθους αρχείου 10MB
}).single('progress_file'); // Το όνομα του πεδίου στη φόρμα

// Ρύθμιση του Multer για αποθήκευση πρόχειρων κειμένων διπλωματικής
const thesisDraftStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/thesis_drafts/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `thesis_${req.params.thesisId}_draft_${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const uploadThesisDraft = multer({
    storage: thesisDraftStorage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = /pdf|doc|docx|zip|rar/;
        const mimetype = allowedTypes.test(file.mimetype);
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Τύπος αρχείου μη επιτρεπτός για το πρόχειρο κείμενο. Επιτρέπονται: PDF, DOC, DOCX, ZIP, RAR.'));
    },
    limits: { fileSize: 20 * 1024 * 1024 } // Όριο 20MB για το πρόχειρο
}).single('draft_file');


// 1) Προβολή θέματος
exports.getStudentThesis = async (req, res) => {
    try {
        const studentId = req.session.userId;
        const thesis = await Thesis.getThesisDetailsWithCommittee(
            (await Thesis.getThesisByStudentId(studentId))?.id // Παίρνουμε πρώτα το ID της διπλωματικής
        );

        if (!thesis) {
            return res.status(404).json({ message: 'Δεν έχει ανατεθεί διπλωματική εργασία στον φοιτητή.' });
        }
        // Απόκρυψη βαθμών/λεπτομερειών μελών επιτροπής από τον φοιτητή
        if (Array.isArray(thesis.committee_members)) {
            thesis.committee_members = thesis.committee_members.map(m => {
                const { grade, c1_objectives_quality, c2_duration, c3_text_quality, c4_presentation, ...rest } = m;
                return rest; // επιστρέφουμε τα υπόλοιπα πεδία χωρίς βαθμούς/κριτήρια
            });
        }
        res.status(200).json(thesis);
    } catch (error) {
        console.error('Error in getStudentThesis:', error);
        res.status(500).json({ message: 'Σφάλμα server κατά την ανάκτηση της διπλωματικής.' });
    }
};

// 4) Διαχείριση διπλωματικής εργασίας - Ενεργή (Σημειώματα Προόδου)
exports.createProgressNote = (req, res) => {
    uploadProgressNote(req, res, async (err) => {
        if (err) {
            // Handle multer errors (e.g., file type, size limit)
            return res.status(400).json({ message: err.message });
        }

        const { thesisId } = req.params;
        const studentId = req.session.userId;
        const { progress_date, progress_description } = req.body;
        const file_url = req.file ? `/uploads/progress_notes/${req.file.filename}` : null;

        if (!progress_date || !progress_description) {
            return res.status(400).json({ message: 'Η ημερομηνία και η περιγραφή είναι υποχρεωτικά.' });
        }

        try {
            const studentThesis = await Thesis.getThesisByStudentId(studentId);
            if (!studentThesis || studentThesis.id != thesisId || studentThesis.status !== 'active') {
                return res.status(403).json({ message: 'Δεν έχετε δικαίωμα να προσθέσετε πρόοδο σε αυτή τη διπλωματική ή δεν είναι ενεργή.' });
            }

            const noteId = await ProgressNote.create({
                thesis_id: thesisId,
                date: progress_date,
                description: progress_description,
                file_url: file_url,
                author_id: studentId
            });

            res.status(201).json({ message: 'Το σημείωμα προόδου υποβλήθηκε επιτυχώς!', noteId });

        } catch (error) {
            console.error('Error creating progress note:', error);
            res.status(500).json({ message: 'Σφάλμα server κατά την υποβολή του σημειώματος προόδου.' });
        }
    });
};

exports.getProgressNotesForThesis = async (req, res) => {
    const { thesisId } = req.params;
    const studentId = req.session.userId;

    try {
        // Έλεγχος αν ο φοιτητής έχει πρόσβαση σε αυτή τη διπλωματική
        const studentThesis = await Thesis.getThesisByStudentId(studentId);
        if (!studentThesis || studentThesis.id != thesisId) {
            return res.status(403).json({ message: 'Δεν έχετε δικαίωμα προβολής για αυτή τη διπλωματική.' });
        }

        const notes = await ProgressNote.findByThesisId(thesisId);
        res.status(200).json(notes);

    } catch (error) {
        console.error('Error fetching progress notes:', error);
        res.status(500).json({ message: 'Σφάλμα server κατά την ανάκτηση των σημειωμάτων προόδου.' });
    }
};

// 5) Διαχείριση διπλωματικής εργασίας - Υπό Εξέταση (Ορισμός Παρουσίασης)
exports.submitPresentationDetails = (req, res) => {
    uploadThesisDraft(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ message: err.message });
        }

        const { thesisId } = req.params;
        const studentId = req.session.userId;
        const { presentation_date, presentation_mode, presentation_location, extra_material_url } = req.body;
        const draft_file_url = req.file ? `/uploads/thesis_drafts/${req.file.filename}` : null;

        if (!presentation_date || !presentation_mode || !presentation_location || !draft_file_url) {
            return res.status(400).json({ message: 'Όλα τα πεδία (εκτός του έξτρα υλικού) είναι υποχρεωτικά.' });
        }

        try {
            const studentThesis = await Thesis.getThesisByStudentId(studentId);
            if (!studentThesis || studentThesis.id != thesisId || studentThesis.status !== 'under_review' || studentThesis.presentation_details_locked) {
                return res.status(403).json({ message: 'Δεν έχετε δικαίωμα να ορίσετε λεπτομέρειες παρουσίασης για αυτή τη διπλωματική ή είναι ήδη κλειδωμένες.' });
            }

            const details = {
                presentation_date,
                presentation_mode,
                presentation_location,
                draft_file_url,
                extra_material_url: extra_material_url || null,
                presentation_details_locked: true // Κλειδώνουμε τις λεπτομέρειες μετά την υποβολή
            };

            const isUpdated = await Thesis.updatePresentationDetails(thesisId, details);

            if (isUpdated) {
                res.status(200).json({ message: 'Οι λεπτομέρειες της παρουσίασης υποβλήθηκαν και κλειδώθηκαν επιτυχώς!' });
            } else {
                res.status(400).json({ message: 'Αδυναμία ενημέρωσης των λεπτομερειών.' });
            }

        } catch (error) {
            console.error('Error submitting presentation details:', error);
            res.status(500).json({ message: 'Σφάλμα server κατά την υποβολή των λεπτομερειών.' });
        }
    });
};

// 6) Καταχώριση repository URL από φοιτητή (μετά τον οριστικό τελικό βαθμό)
exports.submitRepositoryUrl = async (req, res) => {
    const { thesisId } = req.params;
    const { repository_url } = req.body || {};
    const studentId = req.session.userId;

    if (!repository_url || typeof repository_url !== 'string' || repository_url.trim() === '') {
        return res.status(400).json({ message: 'Απαιτείται έγκυρο repository URL.' });
    }

    try {
        const studentThesis = await Thesis.getThesisByStudentId(studentId);
        if (!studentThesis || String(studentThesis.id) !== String(thesisId)) {
            return res.status(403).json({ message: 'Δεν έχετε δικαίωμα ενημέρωσης για αυτή τη διπλωματική.' });
        }

        // Επιτρέπεται μόνο όταν υπάρχει τελικός βαθμός (grade) και η διπλωματική είναι υπό εξέταση
        if (studentThesis.status !== 'under_review' || studentThesis.grade === null || studentThesis.grade === undefined) {
            return res.status(400).json({ message: 'Το repository URL μπορεί να καταχωρηθεί μόνο μετά τον οριστικό τελικό βαθμό και όταν η διπλωματική είναι υπό εξέταση.' });
        }

        const ok = await Thesis.updateRepositoryUrl(thesisId, repository_url.trim());
        if (ok) {
            // Δεν ολοκληρώνουμε αυτόματα εδώ: η περάτωση γίνεται από τη Γραμματεία.
            return res.status(200).json({ message: 'Το repository URL καταχωρήθηκε επιτυχώς!' });
        }
        return res.status(400).json({ message: 'Αδυναμία ενημέρωσης repository URL.' });
    } catch (error) {
        console.error('Error submitting repository URL:', error);
        return res.status(500).json({ message: 'Σφάλμα server κατά την καταχώριση repository URL.' });
    }
};


// 2) Επεξεργασία Προφίλ
exports.getStudentProfile = async (req, res) => {
    try {
        const studentId = req.session.userId;
        const user = await User.findById(studentId);
        if (!user || user.role !== 'student') {
            return res.status(404).json({ message: 'Ο φοιτητής δεν βρέθηκε.' });
        }
        // Αφαίρεση ευαίσθητων πληροφοριών
        delete user.password;
        res.status(200).json(user);
    } catch (error) {
        console.error('Error in getStudentProfile:', error);
        res.status(500).json({ message: 'Σφάλμα server κατά την ανάκτηση προφίλ.' });
    }
};

exports.updateStudentProfile = async (req, res) => {
    try {
        const studentId = req.session.userId;
        const updatedData = req.body;

        const isUpdated = await User.updateStudentProfile(studentId, updatedData);

        if (isUpdated) {
            // Ενημέρωση του ονόματος/επωνύμου στο session αν άλλαξε, για το welcome message
            const updatedUser = await User.findById(studentId);
            if (updatedUser) {
                req.session.userName = `${updatedUser.name} ${updatedUser.surname}`;
            }
            res.status(200).json({ message: 'Το προφίλ ενημερώθηκε επιτυχώς!' });
        } else {
            res.status(400).json({ message: 'Αδυναμία ενημέρωσης προφίλ ή δεν υπάρχουν αλλαγές.' });
        }
    } catch (error) {
        console.error('Error in updateStudentProfile:', error);
        res.status(500).json({ message: 'Σφάλμα server κατά την ενημέρωση προφίλ.' });
    }
};

// 3) Διαχείριση διπλωματικής εργασίας - Υπό ανάθεση (Επιλογή μελών επιτροπής)
exports.getAllProfessorsForInvitation = async (req, res) => {
    try {
        const professors = await User.getAllProfessors();
        res.status(200).json(professors);
    } catch (error) {
        console.error('Error in getAllProfessorsForInvitation:', error);
        res.status(500).json({ message: 'Σφάλμα server κατά την ανάκτηση καθηγητών.' });
    }
};

exports.inviteProfessorToCommittee = async (req, res) => {
    const { thesisId, professorId } = req.body;
    const studentId = req.session.userId;

    if (!thesisId || !professorId) {
        return res.status(400).json({ message: 'Απαιτείται αναγνωριστικό διπλωματικής και καθηγητή.' });
    }

    try {
        const studentThesis = await Thesis.getThesisByStudentId(studentId);
        if (!studentThesis || studentThesis.id != thesisId || studentThesis.status !== 'under_assignment') {
            return res.status(403).json({ message: 'Δεν έχετε δικαίωμα να προσκαλέσετε καθηγητή σε αυτή τη διπλωματική ή δεν βρίσκεται σε κατάσταση "Υπό ανάθεση".' });
        }

        const invitationId = await CommitteeInvitation.createInvitation(thesisId, professorId);
        res.status(201).json({ message: 'Πρόσκληση στάλθηκε επιτυχώς!', invitationId });

    } catch (error) {
        console.error('Error inviting professor:', error);
        res.status(500).json({ message: error.message || 'Σφάλμα server κατά την αποστολή πρόσκλησης.' });
    }
};

exports.cancelCommitteeInvitation = async (req, res) => {
    const { invitationId } = req.params;
    const studentId = req.session.userId;

    try {
        const invitation = await CommitteeInvitation.getInvitationById(invitationId);
        if (!invitation) {
            return res.status(404).json({ message: 'Η πρόσκληση δεν βρέθηκε.' });
        }

        const studentThesis = await Thesis.getThesisByStudentId(studentId);
        if (!studentThesis || studentThesis.id !== invitation.thesis_id || studentThesis.status !== 'under_assignment') {
            return res.status(403).json({ message: 'Δεν έχετε δικαίωμα να ακυρώσετε αυτή την πρόσκληση.' });
        }

        const isCancelled = await CommitteeInvitation.deleteInvitation(invitationId); // Διαγραφή της πρόσκλησης
        if (isCancelled) {
            res.status(200).json({ message: 'Η πρόσκληση ακυρώθηκε επιτυχώς!' });
        } else {
            res.status(400).json({ message: 'Αδυναμία ακύρωσης πρόσκλησης.' });
        }
    } catch (error) {
        console.error('Error cancelling invitation:', error);
        res.status(500).json({ message: 'Σφάλμα server κατά την ακύρωση πρόσκλησης.' });
    }
};

// Έλεγχος αν δύο καθηγητές έχουν αποδεχθεί και ενεργοποίηση διπλωματικής
exports.checkAndActivateThesis = async (req, res) => {
    const { thesisId } = req.body;
    const studentId = req.session.userId;

    try {
        const studentThesis = await Thesis.getThesisByStudentId(studentId);
        if (!studentThesis || studentThesis.id != thesisId || studentThesis.status !== 'under_assignment') {
            return res.status(403).json({ message: 'Δεν έχετε δικαίωμα να ενεργοποιήσετε αυτή τη διπλωματική.' });
        }

        const isReady = await Thesis.checkIfCommitteeReady(thesisId);

        if (isReady) {
            await Thesis.activateThesisAndCleanInvitations(thesisId);
            res.status(200).json({ message: 'Η διπλωματική εργασία ενεργοποιήθηκε επιτυχώς!' });
        } else {
            res.status(400).json({ message: 'Δεν έχουν αποδεχθεί ακόμα δύο καθηγητές την πρόσκληση στην επιτροπή.' });
        }
    } catch (error) {
        console.error('Error activating thesis:', error);
        res.status(500).json({ message: error.message || 'Σφάλμα server κατά την ενεργοποίηση της διπλωματικής.' });
    }
};