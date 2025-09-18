const Thesis = require('../models/thesisModel');
const User = require('../models/userModel');
const CommitteeInvitation = require('../models/committeeInvitationModel');
const ProfessorNote = require('../models/professorNoteModel'); // Replaced ProgressNote
const json2csv = require('json2csv').Parser; // Για εξαγωγή CSV
const db = require('../config/db'); 

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
    const { title, description } = req.body;
    const description_pdf_filename = req.file ? req.file.filename : null;
    const supervisor_id = req.session.userId;

    if (!title || !description) {
        return res.status(400).json({ message: 'Ο τίτλος και η περιγραφή του θέματος είναι υποχρεωτικά.' });
    }

    try {
        const newTopic = await Thesis.createTopic(title, description, description_pdf_filename, supervisor_id);
        res.status(201).json({ message: 'Το θέμα δημιουργήθηκε επιτυχώς!', topic: newTopic });
    } catch (error) {
        console.error('Error in createProfessorTopic:', error);
        res.status(500).json({ message: 'Σφάλμα server κατά τη δημιουργία θέματος.' });
    }
};

exports.updateProfessorTopic = async (req, res) => {
    const { id } = req.params;
    const { title, description } = req.body;
    const description_pdf_filename = req.file ? req.file.filename : req.body.description_pdf_url; // Keep existing if no new file
    const supervisor_id = req.session.userId;

    if (!title || !description) {
        return res.status(400).json({ message: 'Ο τίτλος και η περιγραφή του θέματος είναι υποχρεωτικά.' });
    }

    try {
        const isUpdated = await Thesis.updateTopic(id, supervisor_id, title, description, description_pdf_filename);
        if (isUpdated) {
            res.status(200).json({ message: 'Το θέμα ενημερώθηκε επιτυχώς!' });
        } else {
            res.status(404).json({ message: 'Το θέμα δεν βρέθηκε ή δεν έχετε δικαίωμα επεξεργασίας.' });
        }
    } catch (error) {
        console.error('Error in updateProfessorTopic:', error);
        res.status(500).json({ message: 'Σφάλμα server κατά την ενημέρωση θέματος.' });
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


// 6) Διαχείριση διπλωματικών εργασιών (ενέργειες ανά κατάσταση)
exports.addThesisNote = async (req, res) => {
    const { thesisId } = req.params;
    const { note } = req.body;
    const authorId = req.session.userId;

    if (!note) {
        return res.status(400).json({ message: 'Το πεδίο σημείωσης δεν μπορεί να είναι κενό.' });
    }
    if (note.length > 300) {
        return res.status(400).json({ message: 'Η σημείωση δεν μπορεί να υπερβαίνει τους 300 χαρακτήρες.' });
    }

    try {
        const newNote = await ProgressNote.addNote(thesisId, authorId, note);
        res.status(201).json({ message: 'Η σημείωση προστέθηκε επιτυχώς!', note: newNote });
    } catch (error) {
        console.error('Error adding thesis note:', error);
        res.status(500).json({ message: 'Σφάλμα server κατά την προσθήκη σημείωσης.' });
    }
};

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
    const { grade, grade_details } = req.body;
    const professorId = req.session.userId;

    if (grade === undefined || grade < 0 || grade > 10) {
        return res.status(400).json({ message: 'Ο βαθμός πρέπει να είναι μεταξύ 0 και 10.' });
    }

    try {
        const isSaved = await Thesis.saveCommitteeMemberGrade(thesisId, professorId, grade, grade_details);
        if (isSaved) {
            res.status(200).json({ message: 'Ο βαθμός καταχωρήθηκε επιτυχώς!' });
        } else {
            res.status(400).json({ message: 'Αδυναμία καταχώρισης βαθμού. Βεβαιωθείτε ότι είστε μέλος της επιτροπής και η διπλωματική είναι υπό εξέταση.' });
        }
    } catch (error) {
        console.error('Error saving professor grade:', error);
        res.status(500).json({ message: 'Σφάλμα server κατά την καταχώριση βαθμού.' });
    }
};

exports.generatePresentationAnnouncement = async (req, res) => {
    const { thesisId } = req.params;
    const supervisorId = req.session.userId;

    try {
        const thesis = await Thesis.getSingleThesisFullDetails(thesisId, supervisorId);
        if (!thesis || thesis.supervisor_id !== supervisorId) {
            return res.status(403).json({ message: 'Δεν έχετε δικαίωμα να δημιουργήσετε ανακοίνωση για αυτή τη διπλωματική.' });
        }
        if (thesis.status !== 'under_review' || !thesis.presentation_date || !thesis.presentation_location) {
             return res.status(400).json({ message: 'Η διπλωματική δεν είναι υπό εξέταση ή δεν έχουν συμπληρωθεί στοιχεία παρουσίασης.' });
        }
        res.status(200).json({ message: `Προσομοίωση παραγωγής ανακοίνωσης για διπλωματική "${thesis.title}" την ${thesis.presentation_date} στην ${thesis.presentation_location}.`, announcementUrl: '/some/generated/announcement.pdf' });
    } catch (error) {
        console.error('Error generating announcement:', error);
        res.status(500).json({ message: 'Σφάλμα server κατά την παραγωγή ανακοίνωσης.' });
    }
};

// 5) Προβολή στατιστικών
exports.getProfessorStatistics = async (req, res) => {
    const professorId = req.session.userId;

    try {
        const query = `
            SELECT 
                AVG(DATEDIFF(t.completion_date, t.assignment_date)) AS avg_completion_time_supervisor,
                AVG(cm.grade) AS avg_grade_supervisor,
                COUNT(t.id) AS total_theses_supervisor
            FROM thesis t
            LEFT JOIN committee_members cm ON t.id = cm.thesis_id
            WHERE t.supervisor_id = ? AND t.status = 'completed';

            SELECT 
                AVG(DATEDIFF(t.completion_date, t.assignment_date)) AS avg_completion_time_member,
                AVG(cm.grade) AS avg_grade_member,
                COUNT(DISTINCT t.id) AS total_theses_member
            FROM committee_members cm
            LEFT JOIN thesis t ON cm.thesis_id = t.id
            WHERE cm.professor_id = ? AND t.status = 'completed';
        `;

        const [supervisorStats, memberStats] = await db.query(query, [professorId, professorId]);

        res.status(200).json({
            avg_completion_time_supervisor: supervisorStats[0]?.avg_completion_time_supervisor || 0,
            avg_grade_supervisor: supervisorStats[0]?.avg_grade_supervisor || 0,
            total_theses_supervisor: supervisorStats[0]?.total_theses_supervisor || 0,
            avg_completion_time_member: memberStats[0]?.avg_completion_time_member || 0,
            avg_grade_member: memberStats[0]?.avg_grade_member || 0,
            total_theses_member: memberStats[0]?.total_theses_member || 0,
        });
    } catch (error) {
        console.error('Error fetching professor statistics:', error);
        res.status(500).json({ message: 'Σφάλμα server κατά την ανάκτηση στατιστικών.' });
    }
};

exports.getProfessorTheses = async (req, res) => {
    const { status, role } = req.query;
    const professorId = req.session.userId;

    try {
        const query = `
            SELECT 
                t.id AS thesis_id,
                t.title,
                CONCAT(s.name, ' ', s.surname) AS student_name,
                CONCAT(p.name, ' ', p.surname) AS supervisor_name,
                GROUP_CONCAT(CONCAT(cm_prof.name, ' ', cm_prof.surname) SEPARATOR ', ') AS committee_members,
                COUNT(cm.id) AS committee_count
            FROM thesis t
            LEFT JOIN users s ON t.student_id = s.id
            LEFT JOIN users p ON t.supervisor_id = p.id
            LEFT JOIN committee_members cm ON t.id = cm.thesis_id
            LEFT JOIN users cm_prof ON cm.professor_id = cm_prof.id
            WHERE t.supervisor_id = ?
            GROUP BY t.id
        `;

        const params = [professorId];
        if (status && status !== 'all') params.push(status);

        const theses = await db.query(query, params);

        const formattedTheses = theses.map(thesis => ({
            ...thesis,
            committee_status: thesis.committee_count >= 3 ? 'completed' : 'incomplete',
        }));

        res.status(200).json(formattedTheses);
    } catch (error) {
        console.error('Error fetching professor theses:', error);
        res.status(500).json({ message: 'Σφάλμα server κατά την ανάκτηση διπλωματικών.' });
    }
};

async function fetchProfessorStatistics() {
    try {
        const response = await fetch('/api/professor/statistics');
        if (response.ok) {
            const stats = await response.json();

            // Render Total Theses Chart
            const totalThesesCtx = document.getElementById('totalThesesChart').getContext('2d');
            new Chart(totalThesesCtx, {
                type: 'pie',
                data: {
                    labels: ['Επιβλέπων', 'Μέλος Επιτροπής'],
                    datasets: [{
                        data: [stats.total_theses_supervisor, stats.total_theses_member],
                        backgroundColor: ['#007bff', '#28a745'],
                    }]
                },
                options: {
                    plugins: {
                        legend: { display: true, position: 'bottom' }
                    }
                }
            });

            // Render Average Completion Time Chart
            const avgCompletionTimeCtx = document.getElementById('avgCompletionTimeChart').getContext('2d');
            new Chart(avgCompletionTimeCtx, {
                type: 'pie',
                data: {
                    labels: ['Επιβλέπων', 'Μέλος Επιτροπής'],
                    datasets: [{
                        data: [stats.avg_completion_time_supervisor, stats.avg_completion_time_member],
                        backgroundColor: ['#ffc107', '#17a2b8'],
                    }]
                },
                options: {
                    plugins: {
                        legend: { display: true, position: 'bottom' }
                    }
                }
            });

            // Render Average Grade Chart
            const avgGradeCtx = document.getElementById('avgGradeChart').getContext('2d');
            new Chart(avgGradeCtx, {
                type: 'pie',
                data: {
                    labels: ['Επιβλέπων', 'Μέλος Επιτροπής'],
                    datasets: [{
                        data: [stats.avg_grade_supervisor, stats.avg_grade_member],
                        backgroundColor: ['#6f42c1', '#dc3545'],
                    }]
                },
                options: {
                    plugins: {
                        legend: { display: true, position: 'bottom' }
                    }
                }
            });
        } else {
            console.error('Error fetching statistics:', await response.json());
            alert('Σφάλμα φόρτωσης στατιστικών.');
        }
    } catch (error) {
        console.error('Error fetching statistics:', error);
        alert('Αδυναμία επικοινωνίας με τον server.');
    }
}