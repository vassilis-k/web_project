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
            // Log invitation creation (student initiated). Need student & invited professor names.
            try {
                const ThesisLog = require('./thesisLogModel');
                // Fetch student (owner) and invited professor names
                const [[thesisRow]] = await pool.execute('SELECT student_id FROM thesis WHERE id = ?', [thesisId]);
                let studentName = 'Φοιτητής';
                if (thesisRow && thesisRow.student_id) {
                    const [stuRows] = await pool.execute('SELECT name, surname FROM users WHERE id = ?', [thesisRow.student_id]);
                    if (stuRows.length) studentName = `${stuRows[0].name} ${stuRows[0].surname}`;
                }
                let professorName = `ID:${invitedProfessorId}`;
                const [profRows] = await pool.execute('SELECT name, surname FROM users WHERE id = ?', [invitedProfessorId]);
                if (profRows.length) professorName = `${profRows[0].name} ${profRows[0].surname}`;
                const details = `Ο/Η ${studentName} έστειλε πρόσκληση συμμετοχής στην επιτροπή στον/στην ${professorName}.`;
                await ThesisLog.add(thesisId, thesisRow?.student_id || null, 'INVITATION_SENT', details);
            } catch (logErr) {
                console.error('Failed to log invitation creation:', logErr);
            }
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
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const [result] = await connection.execute(
                'UPDATE committee_invitations SET status = ?, response_date = NOW() WHERE id = ? AND invited_professor_id = ? AND status = "pending"',
                [newStatus, invitationId, professorId]
            );

            if (result.affectedRows === 0) {
                throw new Error('Invitation not found, not pending, or professor not authorized.');
            }

            const [invitationInfo] = await connection.execute('SELECT thesis_id FROM committee_invitations WHERE id = ?', [invitationId]);
            const thesisId = invitationInfo[0].thesis_id;

            // Log the action
            const ThesisLog = require('./thesisLogModel'); // Local require to avoid circular dependency
            const [prof] = await connection.execute('SELECT name, surname FROM users WHERE id = ?', [professorId]);
            const profName = prof.length > 0 ? `${prof[0].name} ${prof[0].surname}` : `ID: ${professorId}`;
            const actionDetail = `Ο/Η ${profName} ${newStatus === 'accepted' ? 'αποδέχθηκε' : 'απέρριψε'} την πρόσκληση συμμετοχής στην επιτροπή.`;
            await ThesisLog.add(thesisId, professorId, `INVITATION_${newStatus.toUpperCase()}`, actionDetail, connection);

            // New Logic: If the invitation is accepted, check if the committee is full
            if (newStatus === 'accepted') {
                const [acceptedCountResult] = await connection.execute(
                    'SELECT COUNT(*) AS accepted_count FROM committee_invitations WHERE thesis_id = ? AND status = "accepted"',
                    [thesisId]
                );
                const acceptedCount = acceptedCountResult[0].accepted_count;

                // If committee is full (2 members + supervisor), activate thesis and finalize committee
                if (acceptedCount >= 2) {
                    // 1. Delete other pending invitations
                    await connection.execute(
                        'DELETE FROM committee_invitations WHERE thesis_id = ? AND status = "pending"',
                        [thesisId]
                    );
                    await ThesisLog.add(thesisId, null, 'AUTO_DELETE_INVITATIONS', 'Οι υπόλοιπες εκκρεμείς προσκλήσεις διαγράφηκαν αυτόματα λόγω συμπλήρωσης της επιτροπής.', connection);

                    // 2. Check thesis status and activate if 'under_assignment'
                    const [thesisStatusResult] = await connection.execute('SELECT status, supervisor_id FROM thesis WHERE id = ?', [thesisId]);
                    if (thesisStatusResult.length > 0 && thesisStatusResult[0].status === 'under_assignment') {
                        const supervisorId = thesisStatusResult[0].supervisor_id;

                        // 2a. Activate the thesis
                        await connection.execute('UPDATE thesis SET status = "active" WHERE id = ?', [thesisId]);
                        await ThesisLog.add(thesisId, null, 'AUTO_ACTIVATE_THESIS', 'Η διπλωματική ενεργοποιήθηκε αυτόματα λόγω συμπλήρωσης της επιτροπής.', connection);

                        // 2b. Get the professors who accepted
                        const [acceptedMembers] = await connection.execute(
                            'SELECT invited_professor_id FROM committee_invitations WHERE thesis_id = ? AND status = "accepted"',
                            [thesisId]
                        );

                        // 2c. Insert supervisor into the committee
                        // Note: committee_members.role currently supports only 'member' per schema.
                        await connection.execute(
                            'INSERT INTO committee_members (thesis_id, professor_id, role) VALUES (?, ?, "member")',
                            [thesisId, supervisorId]
                        );

                        // 2d. Insert members into the committee
                        for (const member of acceptedMembers) {
                            await connection.execute(
                                'INSERT INTO committee_members (thesis_id, professor_id, role) VALUES (?, ?, "member")',
                                [thesisId, member.invited_professor_id]
                            );
                        }
                        await ThesisLog.add(thesisId, null, 'COMMITTEE_FINALIZED', 'Η επιτροπή οριστικοποιήθηκε.', connection);
                    }
                }
            }

            await connection.commit();
            return result.affectedRows > 0;
        } catch (error) {
            await connection.rollback();
            console.error('Error updating invitation status:', error);
            throw error;
        } finally {
            connection.release();
        }
    }
}

module.exports = CommitteeInvitation;