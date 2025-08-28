const pool = require('../config/db');

class CommitteeInvitation {
    static async createInvitation(thesisId, invitedProfessorId) {
        try {
            // Έλεγχος αν η πρόσκληση υπάρχει ήδη ή αν ο καθηγητής είναι ο επιβλέπων
            const [existing] = await pool.execute(
                `SELECT ci.id FROM committee_invitations ci WHERE ci.thesis_id = ? AND ci.invited_professor_id = ?
                 UNION ALL
                 SELECT t.id FROM thesis t WHERE t.id = ? AND t.supervisor_id = ?`,
                [thesisId, invitedProfessorId, thesisId, invitedProfessorId]
            );

            if (existing.length > 0) {
                throw new Error('Invitation already exists for this professor or professor is the supervisor.');
            }

            const [result] = await pool.execute(
                'INSERT INTO committee_invitations (thesis_id, invited_professor_id, status) VALUES (?, ?, "pending")',
                [thesisId, invitedProfessorId]
            );
            return result.insertId;
        } catch (error) {
            console.error('Error creating committee invitation:', error);
            throw error;
        }
    }

    static async getInvitationById(invitationId) {
        try {
            const [rows] = await pool.execute('SELECT * FROM committee_invitations WHERE id = ?', [invitationId]);
            return rows[0];
        } catch (error) {
            console.error('Error fetching invitation by ID:', error);
            throw error;
        }
    }

    static async deleteInvitation(invitationId) {
        try {
            const [result] = await pool.execute('DELETE FROM committee_invitations WHERE id = ?', [invitationId]);
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error deleting invitation:', error);
            throw error;
        }
    }
// Νέα μέθοδος: Ανάκτηση προσκλήσεων για συγκεκριμένο καθηγητή
    static async getInvitationsByProfessorId(professorId) {
        try {
            const [rows] = await pool.execute(
                `SELECT
                    ci.id AS invitation_id, ci.thesis_id, ci.status, ci.created_at,
                    t.title AS thesis_title, t.description AS thesis_description,
                    s.name AS student_name, s.surname AS student_surname,
                    sup.name AS supervisor_name, sup.surname AS supervisor_surname
                FROM committee_invitations ci
                JOIN thesis t ON ci.thesis_id = t.id
                LEFT JOIN users s ON t.student_id = s.id
                LEFT JOIN users sup ON t.supervisor_id = sup.id
                WHERE ci.invited_professor_id = ? AND ci.status = 'pending'`, // Μόνο ενεργές/pending
                [professorId]
            );
            return rows;
        } catch (error) {
            console.error('Error fetching invitations by professor ID:', error);
            throw error;
        }
    }

    // Νέα μέθοδος: Ενημέρωση κατάστασης πρόσκλησης
    static async updateInvitationStatus(invitationId, newStatus, professorId) {
        try {
            await pool.query('START TRANSACTION');

            const [result] = await pool.execute(
                'UPDATE committee_invitations SET status = ?, response_date = NOW() WHERE id = ? AND invited_professor_id = ?',
                [newStatus, invitationId, professorId]
            );

            if (result.affectedRows === 0) {
                throw new Error('Invitation not found or professor not authorized.');
            }

            // If invitation is accepted, add professor to committee_members
            if (newStatus === 'accepted') {
                const [invitationInfo] = await pool.execute('SELECT thesis_id FROM committee_invitations WHERE id = ?', [invitationId]);
                if (invitationInfo.length > 0) {
                    const thesisId = invitationInfo[0].thesis_id;
                    await pool.execute(
                        'INSERT INTO committee_members (thesis_id, professor_id, role) VALUES (?, ?, "member")',
                        [thesisId, professorId]
                    );

                    // Check if 2 members have accepted and if so, activate thesis
                    const [acceptedCount] = await pool.execute(
                        `SELECT COUNT(*) AS count FROM committee_invitations WHERE thesis_id = ? AND status = 'accepted'`,
                        [thesisId]
                    );
                    if (acceptedCount[0].count >= 2) {
                        // Activate thesis and clean up other invitations for this thesis
                        const [thesisActivationResult] = await pool.execute(
                            `UPDATE thesis SET status = 'active' WHERE id = ? AND status = 'under_assignment'`,
                            [thesisId]
                        );
                        if (thesisActivationResult.affectedRows > 0) {
                            // Delete all pending/declined invitations for this thesis
                            await pool.execute('DELETE FROM committee_invitations WHERE thesis_id = ? AND status != "accepted"', [thesisId]);
                            // Also ensure only 2 members are added, and if more accepted, the first 2 are selected and others are removed.
                            // This part of logic could be more complex depending on strictness.
                            // For simplicity, we assume the frontend ensures no more than 2 are invited to accept.
                        }
                    }
                }
            }

            await pool.query('COMMIT');
            return result.affectedRows > 0;
        } catch (error) {
            await pool.query('ROLLBACK');
            console.error('Error updating invitation status:', error);
            throw error;
        }
    }
}

module.exports = CommitteeInvitation;