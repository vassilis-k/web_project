const User = require('../models/userModel');
const Thesis = require('../models/thesisModel');
const CommitteeInvitation = require('../models/committeeInvitationModel');
const multer = require('multer');
const path = require('path');

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
        // Normalize description_pdf_url: DB stores just filename; ensure frontend gets a relative URL path.
        if (thesis.description_pdf_url && !thesis.description_pdf_url.startsWith('/')) {
            thesis.description_pdf_url = `/uploads/thesis_pdfs/${thesis.description_pdf_url}`;
        } else if (thesis.description_pdf_url && thesis.description_pdf_url.startsWith('/topic-')) {
            // legacy case where served root expected; map to uploads path
            thesis.description_pdf_url = `/uploads/thesis_pdfs${thesis.description_pdf_url}`;
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

        // Validation with detailed messaging
        const missing = [];
        if (!presentation_date) missing.push('ημερομηνία & ώρα');
        if (!presentation_mode) missing.push('τρόπος παρουσίασης');
        if (!presentation_location) missing.push('τοποθεσία/link');
        if (!draft_file_url) missing.push('πρόχειρο αρχείο');
        if (missing.length) {
            return res.status(400).json({ message: `Αποτυχία: λείπουν: ${missing.join(', ')}.` });
        }

        try {
            const studentThesis = await Thesis.getThesisByStudentId(studentId);
            if (!studentThesis || studentThesis.id != thesisId) {
                return res.status(403).json({ message: 'Δεν εντοπίστηκε επιλέξιμη διπλωματική για τον φοιτητή.' });
            }
            if (studentThesis.status !== 'under_review') {
                return res.status(400).json({ message: `Η διπλωματική πρέπει να είναι σε κατάσταση "Υπό Εξέταση" (τρέχουσα: ${studentThesis.status}).` });
            }
            if (studentThesis.presentation_details_locked) {
                return res.status(400).json({ message: 'Οι λεπτομέρειες έχουν ήδη κλειδώσει.' });
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

// 7) Πρακτικό Εξέτασης (HTML) – μόνο τελικός βαθμός + ονόματα επιτροπής
exports.getExaminationReport = async (req, res) => {
        const { thesisId } = req.params;
        const studentId = req.session.userId;
        try {
                const thesis = await Thesis.getThesisByStudentId(studentId);
                if (!thesis || String(thesis.id) !== String(thesisId)) {
                        return res.status(403).json({ message: 'Δεν έχετε πρόσβαση σε αυτή τη διπλωματική.' });
                }
                if (thesis.grade === null || thesis.grade === undefined) {
                        return res.status(400).json({ message: 'Το πρακτικό δεν είναι διαθέσιμο πριν τον τελικό βαθμό.' });
                }

                // Φόρτωσε πλήρη στοιχεία (για επιτροπή) – επαναχρησιμοποίηση μεθόδου
                const fullDetails = await Thesis.getThesisDetailsWithCommittee(thesis.id);
                const committeeMembers = (fullDetails.committee_members || []).map(m => `${m.name} ${m.surname}`);
                // Βεβαιώσου ότι ο επιβλέπων υπάρχει πρώτος
                const supervisorFull = `${fullDetails.supervisor_name} ${fullDetails.supervisor_surname}`;
                const uniqueSet = new Set();
                const orderedNames = [supervisorFull, ...committeeMembers].filter(n => {
                        const trimmed = (n || '').trim();
                        if (!trimmed) return false;
                        if (uniqueSet.has(trimmed)) return false;
                        uniqueSet.add(trimmed);
                        return true;
                });

                const escape = (s='') => String(s)
                        .replace(/&/g,'&amp;')
                        .replace(/</g,'&lt;')
                        .replace(/>/g,'&gt;')
                        .replace(/"/g,'&quot;')
                        .replace(/'/g,'&#39;');

                const today = new Date();
                const dateStr = today.toLocaleDateString('el-GR');
                const timeStr = today.toLocaleTimeString('el-GR',{hour:'2-digit',minute:'2-digit'});

                const html = `<!DOCTYPE html>
<html lang="el">
<head>
    <meta charset="UTF-8" />
    <title>Πρακτικό Εξέτασης - ${escape(fullDetails.title)}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height:1.5; margin:40px; }
        h1 { font-size:22px; margin-bottom:8px; }
        h2 { font-size:16px; margin-top:32px; }
        .meta { margin: 0 0 20px 0; font-size:14px; color:#444; }
        .box { border:1px solid #ccc; padding:16px; border-radius:6px; background:#fafafa; }
        .committee { margin:0; padding-left:18px; }
        .committee li { margin-bottom:4px; }
        .footer { margin-top:40px; font-size:12px; color:#666; }
    </style>
    <meta http-equiv="Cache-Control" content="no-store" />
</head>
<body>
    <h1>Πρακτικό Εξέτασης Διπλωματικής Εργασίας</h1>
    <p class="meta">Ημερομηνία δημιουργίας: ${escape(dateStr)} – Ώρα: ${escape(timeStr)}</p>
    <div class="box">
        <p><strong>Τίτλος:</strong> ${escape(fullDetails.title)}</p>
        <p><strong>Φοιτητής:</strong> ${escape(fullDetails.student_name)} ${escape(fullDetails.student_surname)}</p>
        <p><strong>Επιβλέπων:</strong> ${escape(fullDetails.supervisor_name)} ${escape(fullDetails.supervisor_surname)}</p>
        <p><strong>Τελικός Βαθμός:</strong> ${escape(thesis.grade)}/10</p>
    </div>
    <h2>Σύνθεση Τριμελούς Επιτροπής</h2>
    <ul class="committee">
        ${orderedNames.map(n => `<li>${escape(n)}</li>`).join('\n')}
    </ul>
    <h2>Δήλωση</h2>
    <p>Η τριμελής επιτροπή ολοκλήρωσε την αξιολόγηση της παραπάνω διπλωματικής εργασίας και καθόρισε τον τελικό βαθμό όπως αναγράφεται.</p>
    <div class="footer">Παράχθηκε αυτόματα από το Σύστημα Υποστήριξης Διπλωματικών Εργασιών.</div>
</body>
</html>`;

                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                return res.status(200).send(html);
        } catch (error) {
                console.error('Error generating examination report:', error);
                return res.status(500).json({ message: 'Σφάλμα server κατά την παραγωγή πρακτικού.' });
        }
};