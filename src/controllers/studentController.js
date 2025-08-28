const User = require('../models/userModel');
const Thesis = require('../models/thesisModel');
const CommitteeInvitation = require('../models/committeeInvitationModel');

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
        res.status(200).json(thesis);
    } catch (error) {
        console.error('Error in getStudentThesis:', error);
        res.status(500).json({ message: 'Σφάλμα server κατά την ανάκτηση της διπλωματικής.' });
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