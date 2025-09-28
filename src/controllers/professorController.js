const Thesis = require('../models/thesisModel');
const User = require('../models/userModel');
const CommitteeInvitation = require('../models/committeeInvitationModel');
const ProfessorNote = require('../models/professorNoteModel'); // Replaced ProgressNote
const json2csv = require('json2csv').Parser; // Για εξαγωγή CSV

// 1) Προβολή και Δημιουργία θεμάτων προς ανάθεση
exports.getProfessorTopics = async (req, res) => {
    try {
        const supervisor_id = req.session.userId;
        const topics = await Thesis.getTopicsBySupervisor(supervisor_id);
        res.status(200).json(topics);
    } catch (error) {
        console.error('Error in getProfessorTopics:', error);
        res.status(500).json({ message: 'Σφάλμα server κατά την ανάκτηση θεμάτων.' });
    }
};

exports.createProfessorTopic = async (req, res) => {
    try {
        if (!req.body) {
            return res.status(400).json({ message: 'Δεν στάλθηκαν δεδομένα φόρμας.' });
        }

        const title = (req.body.title || '').trim();
        const description = (req.body.description || '').trim();
    // Store only if a file uploaded; we keep just the filename in DB for consistency,
    // but frontend will receive a fully qualified relative URL. (Legacy rows may only have filename.)
    const description_pdf_filename = req.file ? req.file.filename : null;
        const supervisor_id = req.session.userId;

        if (!title || !description) {
            return res.status(400).json({ message: 'Ο τίτλος και η περιγραφή του θέματος είναι υποχρεωτικά.' });
        }

        const newTopic = await Thesis.createTopic(title, description, description_pdf_filename, supervisor_id);
        res.status(201).json({ message: 'Το θέμα δημιουργήθηκε επιτυχώς!', topic: newTopic });
    } catch (error) {
        console.error('Error in createProfessorTopic:', error);
        const msg = error.message === 'Μόνο αρχεία PDF επιτρέπονται για την περιγραφή θέματος.' ? error.message : 'Σφάλμα server κατά τη δημιουργία θέματος.';
        res.status(500).json({ message: msg });
    }
};

exports.updateProfessorTopic = async (req, res) => {
    try {
        const { id } = req.params;
        if (!req.body) {
            return res.status(400).json({ message: 'Δεν στάλθηκαν δεδομένα φόρμας.' });
        }
        const title = (req.body.title || '').trim();
        const description = (req.body.description || '').trim();
        // If a new file uploaded use it, else keep previous value passed by client as description_pdf_url
    // Accept either new upload or existing filename (strip any accidental prefixed path coming from client)
    const rawDesc = req.file ? req.file.filename : (req.body.description_pdf_url || null);
    const description_pdf_filename = rawDesc ? rawDesc.split('/').pop() : null;
        const supervisor_id = req.session.userId;

        if (!title || !description) {
            return res.status(400).json({ message: 'Ο τίτλος και η περιγραφή του θέματος είναι υποχρεωτικά.' });
        }

        const isUpdated = await Thesis.updateTopic(id, supervisor_id, title, description, description_pdf_filename);
        if (isUpdated) {
            res.status(200).json({ message: 'Το θέμα ενημερώθηκε επιτυχώς!' });
        } else {
            res.status(404).json({ message: 'Το θέμα δεν βρέθηκε ή δεν έχετε δικαίωμα επεξεργασίας.' });
        }
    } catch (error) {
        console.error('Error in updateProfessorTopic:', error);
        const msg = error.message === 'Μόνο αρχεία PDF επιτρέπονται για την περιγραφή θέματος.' ? error.message : 'Σφάλμα server κατά την ενημέρωση θέματος.';
        res.status(500).json({ message: msg });
    }
};

// 2) Αρχική ανάθεση θέματος σε φοιτητή
exports.searchStudents = async (req, res) => {
    const { term } = req.query;
    try {
        const students = await User.searchStudents(term);
        res.status(200).json(students);
    } catch (error) {
        console.error('Error searching students:', error);
        res.status(500).json({ message: 'Σφάλμα server κατά την αναζήτηση φοιτητών.' });
    }
};

exports.getUnderAssignmentTheses = async (req, res) => {
    try {
        const supervisor_id = req.session.userId;
        const theses = await Thesis.getUnderAssignmentBySupervisor(supervisor_id);
        res.status(200).json(theses);
    } catch (error) {
        console.error('Error in getUnderAssignmentTheses:', error);
        res.status(500).json({ message: 'Σφάλμα server κατά την ανάκτηση θεμάτων υπό ανάθεση.' });
    }
};

exports.assignTopic = async (req, res) => {
    const { thesisId, studentId } = req.body;
    const supervisorId = req.session.userId;

    if (!thesisId || !studentId) {
        return res.status(400).json({ message: 'Απαιτείται επιλογή θέματος και φοιτητή.' });
    }

    try {
        const isAssigned = await Thesis.assignTopicToStudent(thesisId, studentId, supervisorId);
        if (isAssigned) {
            res.status(200).json({ message: 'Το θέμα ανατέθηκε επιτυχώς στον φοιτητή!' });
        } else {
            res.status(400).json({ message: 'Αδυναμία ανάθεσης θέματος. Ελέγξτε αν το θέμα είναι διαθέσιμο και αν είστε ο επιβλέπων.' });
        }
    } catch (error) {
        console.error('Error assigning topic:', error);
        res.status(500).json({ message: 'Σφάλμα server κατά την ανάθεση θέματος.' });
    }
};

exports.unassignTopic = async (req, res) => {
    const { thesisId } = req.body;
    const supervisorId = req.session.userId;

    if (!thesisId) {
        return res.status(400).json({ message: 'Απαιτείται επιλογή θέματος για αναίρεση ανάθεσης.' });
    }

    try {
        const isUnassigned = await Thesis.unassignTopicFromStudent(thesisId, supervisorId);
        if (isUnassigned) {
            res.status(200).json({ message: 'Η ανάθεση του θέματος αναιρέθηκε επιτυχώς!' });
        } else {
            res.status(400).json({ message: 'Αδυναμία αναίρεσης ανάθεσης. Ελέγξτε αν το θέμα είναι υπό ανάθεση και αν είστε ο επιβλέπων.' });
        }
    } catch (error) {
        console.error('Error unassigning topic:', error);
        res.status(500).json({ message: 'Σφάλμα server κατά την αναίρεση ανάθεσης.' });
    }
};

// 3) Προβολή λίστας διπλωματικών (φιλτραρισμένες)
exports.getProfessorThesesList = async (req, res) => {
    const { status, role } = req.query;
    const professorId = req.session.userId;
    try {
        const theses = await Thesis.getProfessorRelatedThesesDetailed(professorId, { status, role });
        res.status(200).json(theses);
    } catch (error) {
        console.error('Error in getProfessorThesesList:', error);
        res.status(500).json({ message: 'Σφάλμα server κατά την ανάκτηση διπλωματικών.' });
    }
};

exports.getSingleThesisDetails = async (req, res) => {
    const { thesisId } = req.params;
    const professorId = req.session.userId;

    try {
        const thesisDetails = await Thesis.getSingleThesisFullDetails(thesisId, professorId);
        if (!thesisDetails) {
            return res.status(404).json({ message: 'Η διπλωματική δεν βρέθηκε ή δεν έχετε πρόσβαση.' });
        }
        res.status(200).json(thesisDetails);
    } catch (error) {
        console.error('Error fetching single thesis details:', error);
        res.status(500).json({ message: 'Σφάλμα server κατά την ανάκτηση λεπτομερειών διπλωματικής.' });
    }
};

exports.addProfessorNote = async (req, res) => {
    const { thesisId } = req.params;
    const { note } = req.body;
    const professorId = req.session.userId;

    if (!note || note.trim() === '') {
        return res.status(400).json({ message: 'Η σημείωση δεν μπορεί να είναι κενή.' });
    }
    if (note.length > 300) {
        return res.status(400).json({ message: 'Η σημείωση δεν πρέπει να υπερβαίνει τους 300 χαρακτήρες.' });
    }

    try {
        const noteId = await ProfessorNote.add(thesisId, professorId, note);
        res.status(201).json({ message: 'Η σημείωση προστέθηκε επιτυχώς!', note: { id: noteId, note, created_at: new Date() } });
    } catch (error) {
        console.error('Error adding professor note:', error);
        res.status(500).json({ message: 'Σφάλμα server κατά την προσθήκη της σημείωσης.' });
    }
};

exports.exportTheses = async (req, res) => {
    const { format, status, role } = req.query;
    const professorId = req.session.userId;

    try {
        const theses = await Thesis.getProfessorRelatedThesesDetailed(professorId, { status, role });

        if (format === 'csv') {
            // Align field names with actual properties returned by the model
            const fields = ['id', 'title', 'status', 'student_name', 'student_surname', 'supervisor_name', 'supervisor_surname', 'grade'];
            const json2csvParser = new json2csv({ fields });
            const csv = json2csvParser.parse(theses);
            res.header('Content-Type', 'text/csv');
            res.attachment(`theses_export_${Date.now()}.csv`);
            return res.send(csv);
        } else if (format === 'json') {
            res.header('Content-Type', 'application/json');
            res.attachment(`theses_export_${Date.now()}.json`);
            return res.send(JSON.stringify(theses, null, 2));
        } else {
            return res.status(400).json({ message: 'Μη υποστηριζόμενη μορφή εξαγωγής. Επιλέξτε "csv" ή "json".' });
        }
    } catch (error) {
        console.error('Error exporting theses:', error);
        res.status(500).json({ message: 'Σφάλμα server κατά την εξαγωγή διπλωματικών.' });
    }
};

// 4) Προβολή προσκλήσεων συμμετοχής σε τριμελή
exports.getProfessorInvitations = async (req, res) => {
    const professorId = req.session.userId;
    try {
        const invitations = await CommitteeInvitation.getInvitationsByProfessorId(professorId);
        res.status(200).json(invitations);
    } catch (error) {
        console.error('Error fetching professor invitations:', error);
        res.status(500).json({ message: 'Σφάλμα server κατά την ανάκτηση προσκλήσεων.' });
    }
};

exports.acceptInvitation = async (req, res) => {
    const { invitationId } = req.params;
    const professorId = req.session.userId;
    try {
        const isAccepted = await CommitteeInvitation.updateInvitationStatus(invitationId, 'accepted', professorId);
        if (isAccepted) {
            res.status(200).json({ message: 'Η πρόσκληση έγινε αποδεκτή!' });
        } else {
            res.status(400).json({ message: 'Αδυναμία αποδοχής πρόσκλησης.' });
        }
    } catch (error) {
        console.error('Error accepting invitation:', error);
        res.status(500).json({ message: error.message || 'Σφάλμα server κατά την αποδοχή πρόσκλησης.' });
    }
};

exports.declineInvitation = async (req, res) => {
    const { invitationId } = req.params;
    const professorId = req.session.userId;
    try {
        const isDeclined = await CommitteeInvitation.updateInvitationStatus(invitationId, 'declined', professorId);
        if (isDeclined) {
            res.status(200).json({ message: 'Η πρόσκληση απορρίφθηκε.' });
        } else {
            res.status(400).json({ message: 'Αδυναμία απόρριψης πρόσκλησης.' });
        }
    } catch (error) {
        console.error('Error declining invitation:', error);
        res.status(500).json({ message: error.message || 'Σφάλμα server κατά την απόρριψη πρόσκλησης.' });
    }
};


// Η παλαιά συνάρτηση addThesisNote αφαιρέθηκε. Χρησιμοποιήστε την addProfessorNote.

exports.setThesisUnderReview = async (req, res) => {
    const { thesisId } = req.params;
    const supervisorId = req.session.userId;

    try {
        const isUpdated = await Thesis.setThesisUnderReview(thesisId, supervisorId);
        if (isUpdated) {
            res.status(200).json({ message: 'Η διπλωματική μεταφέρθηκε σε κατάσταση "Υπό Εξέταση"!' });
        } else {
            res.status(400).json({ message: 'Αδυναμία αλλαγής κατάστασης. Βεβαιωθείτε ότι είστε ο επιβλέπων και η διπλωματική είναι ενεργή.' });
        }
    } catch (error) {
        console.error('Error setting thesis under review:', error);
        if (error && error.message === 'GS_PROTOCOL_REQUIRED') {
            return res.status(400).json({ message: 'Απαιτείται πρώτα καταχώριση Αριθμού Πρωτοκόλλου Γ.Σ. από τη Γραμματεία πριν η διπλωματική μεταβεί σε "Υπό Εξέταση".' });
        }
        res.status(500).json({ message: 'Σφάλμα server κατά την αλλαγή κατάστασης.' });
    }
};

exports.cancelThesisBySupervisor = async (req, res) => {
    const { thesisId } = req.params;
    const { gs_number, gs_year } = req.body;
    const supervisorId = req.session.userId;

    if (!gs_number || !gs_year) {
        return res.status(400).json({ message: 'Απαιτείται αριθμός Γ.Σ. και έτος Γ.Σ. για την ακύρωση.' });
    }

    try {
        const isCancelled = await Thesis.cancelThesisBySupervisor(thesisId, supervisorId, gs_number, gs_year);
        if (isCancelled) {
            res.status(200).json({ message: 'Η διπλωματική ακυρώθηκε επιτυχώς!' });
        } else {
            res.status(400).json({ message: 'Αδυναμία ακύρωσης. Βεβαιωθείτε ότι είστε ο επιβλέπων και έχουν περάσει 2 χρόνια από την ανάθεση.' });
        }
    } catch (error) {
        console.error('Error cancelling thesis by supervisor:', error);
        res.status(500).json({ message: error.message || 'Σφάλμα server κατά την ακύρωση της διπλωματικής.' });
    }
};

exports.saveProfessorGrade = async (req, res) => {
    const { thesisId } = req.params;
    const { c1, c2, c3, c4 } = req.body || {};
    const professorId = req.session.userId;

    // Check for required parameters
    if (!thesisId) {
        return res.status(400).json({ message: 'Το ID της διπλωματικής είναι απαιτούμενο.' });
    }
    if (!professorId) {
        return res.status(400).json({ message: 'Το ID του καθηγητή είναι απαιτούμενο.' });
    }

    const fields = { c1, c2, c3, c4 };
    for (const [k, v] of Object.entries(fields)) {
        if (v === undefined || v === null || v === '' || isNaN(parseFloat(v))) {
            return res.status(400).json({ message: `Το πεδίο ${k} είναι υποχρεωτικό και πρέπει να είναι αριθμός.` });
        }
        const n = parseFloat(v);
        if (n < 0 || n > 10) {
            return res.status(400).json({ message: `Το πεδίο ${k} πρέπει να είναι μεταξύ 0 και 10.` });
        }
    }

    try {
        const isSaved = await Thesis.saveCommitteeMemberGrade(thesisId, professorId, { c1, c2, c3, c4 });
        if (isSaved) {
            res.status(200).json({ message: 'Η βαθμολόγηση καταχωρήθηκε επιτυχώς!' });
        } else {
            res.status(400).json({ message: 'Αδυναμία καταχώρισης βαθμολόγησης. Βεβαιωθείτε ότι είστε μέλος της επιτροπής και η διπλωματική είναι υπό εξέταση.' });
        }
    } catch (error) {
        console.error('Error saving professor grade:', error);
        const msg = error.message || 'Σφάλμα server κατά την καταχώριση βαθμολόγησης.';
        if (msg.includes('έχετε δικαίωμα') || msg.includes('δικαίωμα')) {
            return res.status(403).json({ message: msg });
        }
        if (msg.includes('ήδη καταχωρήσει βαθμό') || msg.includes('ήδη καταχωρήσει')) {
            return res.status(409).json({ message: msg });
        }
        res.status(500).json({ message: msg });
    }
};

// Publish or update presentation announcement (standard implementation)
exports.publishThesisAnnouncement = async (req, res) => {
    const { thesisId } = req.params;
    const supervisorId = req.session.userId;
    try {
        const result = await Thesis.publishAnnouncement(thesisId, supervisorId);
        const baseMsg = result.created
            ? 'Η ανακοίνωση παρουσιάσης δημιουργήθηκε επιτυχώς!'
            : 'Η ανακοίνωση παρουσίασης ενημερώθηκε επιτυχώς!';
        return res.status(200).json({
            message: baseMsg,
            created: result.created,
            updated: result.updated,
            announcement: result.announcement
        });
    } catch (error) {
        const msg = error.message || 'Σφάλμα κατά τη δημοσίευση ανακοίνωσης.';
        if (msg.includes('δεν βρέθηκε')) {
            return res.status(404).json({ message: msg });
        }
        if (msg.includes('Δεν έχετε δικαίωμα')) {
            return res.status(403).json({ message: msg });
        }
        if (msg.includes('Υπό Εξέταση') || msg.includes('Λείπουν στοιχεία')) {
            return res.status(400).json({ message: msg });
        }
        console.error('Error publishing announcement:', error);
        return res.status(500).json({ message: 'Σφάλμα server κατά τη δημοσίευση ανακοίνωσης.' });
    }
};

// 5) Προβολή στατιστικών
exports.getProfessorStatistics = async (req, res) => {
    const professorId = req.session.userId;
    try {
        const stats = await Thesis.getProfessorStatistics(professorId);
        res.status(200).json(stats);
    } catch (error) {
        console.error('Error fetching professor statistics:', error);
        res.status(500).json({ message: 'Σφάλμα server κατά την ανάκτηση στατιστικών.' });
    }
};

// Enable grading (Option A: one-way enable)
exports.enableGrading = async (req, res) => {
    const { thesisId } = req.params;
    const supervisorId = req.session.userId;
    try {
        const enabled = await Thesis.enableGrading(thesisId, supervisorId);
        if (enabled) {
            return res.status(200).json({ message: 'Η καταχώριση βαθμών ενεργοποιήθηκε επιτυχώς!' });
        }
        return res.status(400).json({ message: 'Αδυναμία ενεργοποίησης. Βεβαιωθείτε ότι είστε ο επιβλέπων, η διπλωματική είναι υπό εξέταση και δεν έχει ήδη ενεργοποιηθεί.' });
    } catch (error) {
        console.error('Error enabling grading:', error);
        if (error.message && error.message.includes('πριν ανέβει το κείμενο')) {
            return res.status(400).json({ message: error.message });
        }
        if (error.message && error.message.includes('δεν βρέθηκε')) {
            return res.status(404).json({ message: error.message });
        }
        res.status(500).json({ message: 'Σφάλμα server κατά την ενεργοποίηση καταχώρισης βαθμών.' });
    }
};