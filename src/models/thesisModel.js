const pool = require('../config/db');

class Thesis {
    // 1) Προβολή και Δημιουργία θεμάτων προς ανάθεση: Ο Διδάσκων καταχωρεί ένα νέο θέμα
    static async createTopic(title, description, description_pdf_url, supervisor_id) {
        try {
            const [result] = await pool.execute(
                'INSERT INTO thesis (title, description, description_pdf_url, supervisor_id, status) VALUES (?, ?, ?, ?, ?)',
                [title, description, description_pdf_url, supervisor_id, 'available'] // Default status 'available' as per our updated schema
            );
            return { id: result.insertId, title, description, description_pdf_url, supervisor_id, status: 'available' };
        } catch (error) {
            console.error('Error creating thesis topic:', error);
            throw error;
        }
    }

    // Ο Διδάσκων βλέπει τη λίστα των θεμάτων που έχει δημιουργήσει προς ανάθεση
    static async getTopicsBySupervisor(supervisor_id) {
        try {
            const [rows] = await pool.execute(
                'SELECT id, title, description, description_pdf_url, status FROM thesis WHERE supervisor_id = ? AND student_id IS NULL',
                [supervisor_id]
            );
            return rows;
        } catch (error) {
            console.error('Error fetching topics by supervisor:', error);
            throw error;
        }
    }

    // Ο καθηγητής μπορεί να επεξεργαστεί καθένα από αυτά
    static async updateTopic(id, supervisor_id, title, description, description_pdf_url) {
        try {
            const [result] = await pool.execute(
                'UPDATE thesis SET title = ?, description = ?, description_pdf_url = ? WHERE id = ? AND supervisor_id = ? AND student_id IS NULL',
                [title, description, description_pdf_url, id, supervisor_id]
            );
            return result.affectedRows > 0; // Returns true if updated, false otherwise
        } catch (error) {
            console.error('Error updating thesis topic:', error);
            throw error;
        }
    }

    // Add other thesis-related methods here as needed for other functionalities
    // e.g., get all theses where professor is supervisor or committee member
     // 3) Προβολή λίστας διπλωματικών (Detailed - updated to include more details and specific invitation statuses)
    static async getProfessorRelatedThesesDetailed(professor_id, filters = {}) {
        let query = `
            SELECT
                t.id, t.title, t.description, t.description_pdf_url, t.status, t.assignment_date, t.presentation_date, t.repository_url, t.final_grade, t.cancellation_reason,
                s.id AS student_id, s.name AS student_name, s.surname AS student_surname, s.email AS student_email,
                sup.id AS supervisor_id, sup.name AS supervisor_name, sup.surname AS supervisor_surname, sup.email AS supervisor_email,
                GROUP_CONCAT(DISTINCT CONCAT(cm_u.id, ':', cm_u.name, ' ', cm_u.surname, ':', cm.grade, ':', cm.grade_details)) AS committee_members_full,
                GROUP_CONCAT(DISTINCT CONCAT(ci.invited_professor_id, ':', inv_u.name, ' ', inv_u.surname, ':', ci.status)) AS committee_invitations_full
            FROM thesis t
            LEFT JOIN users s ON t.student_id = s.id
            JOIN users sup ON t.supervisor_id = sup.id
            LEFT JOIN committee_members cm ON t.id = cm.thesis_id
            LEFT JOIN users cm_u ON cm.professor_id = cm_u.id
            LEFT JOIN committee_invitations ci ON t.id = ci.thesis_id
            LEFT JOIN users inv_u ON ci.invited_professor_id = inv_u.id
            WHERE t.supervisor_id = ? OR cm.professor_id = ? OR ci.invited_professor_id = ?
        `;
        const params = [professor_id, professor_id, professor_id];

        if (filters.status && filters.status !== 'all') {
            query += ` AND t.status = ?`;
            params.push(filters.status);
        }
        if (filters.role && filters.role !== 'all') {
            if (filters.role === 'supervisor') {
                query += ` AND t.supervisor_id = ?`;
            } else if (filters.role === 'member') {
                query += ` AND cm.professor_id = ? AND t.supervisor_id != ?`;
                params.push(professor_id); // The first `professor_id` is already in WHERE clause for cm.professor_id
            }
        }
        query += ` GROUP BY t.id ORDER BY t.created_at DESC`;

        try {
            const [rows] = await pool.execute(query, params);
            return rows.map(row => {
                // Parse committee members and invitations
                row.committee_members_parsed = [];
                if (row.committee_members_full) {
                    row.committee_members_full.split(',').forEach(member => {
                        const parts = member.split(':');
                        if (parts.length === 4) {
                            row.committee_members_parsed.push({
                                id: parseInt(parts[0]),
                                name: parts[1],
                                grade: parts[2] === 'null' ? null : parseInt(parts[2]),
                                grade_details: parts[3] === 'null' ? null : parts[3]
                            });
                        }
                    });
                }
                row.committee_invitations_parsed = [];
                if (row.committee_invitations_full) {
                    row.committee_invitations_full.split(',').forEach(invite => {
                        const parts = invite.split(':');
                        if (parts.length === 3) {
                            row.committee_invitations_parsed.push({
                                id: parseInt(parts[0]),
                                name: parts[1],
                                status: parts[2]
                            });
                        }
                    });
                }
                return row;
            });
        } catch (error) {
            console.error('Error fetching detailed professor related theses:', error);
            throw error;
        }
    }

    static async getThesisByStudentId(studentId) {
        try {
            const [rows] = await pool.execute(
                `SELECT
                    t.id, t.title, t.description, t.description_pdf_url, t.status, t.assignment_date, t.presentation_date, t.repository_url,
                    s.name AS supervisor_name, s.surname AS supervisor_surname, s.email AS supervisor_email
                FROM thesis t
                JOIN users s ON t.supervisor_id = s.id
                WHERE t.student_id = ?`,
                [studentId]
            );
            return rows[0]; // Ένας φοιτητής συνήθως έχει μία ενεργή διπλωματική
        } catch (error) {
            console.error('Error fetching thesis by student ID:', error);
            throw error;
        }
    }

    // Νέα μέθοδος: Ανάθεση διπλωματικής σε φοιτητή (αλλάζει την κατάσταση σε 'under_assignment')
    static async assignThesisToStudent(thesisId, studentId) {
        try {
            const [result] = await pool.execute(
                'UPDATE thesis SET student_id = ?, status = "under_assignment" WHERE id = ? AND status = "available"',
                [studentId, thesisId]
            );
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error assigning thesis to student:', error);
            throw error;
        }
    }

    // Νέα μέθοδος: Ανάκτηση λεπτομερειών διπλωματικής μαζί με μέλη επιτροπής και προσκλήσεις
    static async getThesisDetailsWithCommittee(thesisId) {
        if (!thesisId) return null; // Handle cases where student has no thesis yet
        try {
            const [thesisRows] = await pool.execute(
                `SELECT
                    t.id, t.title, t.description, t.description_pdf_url, t.status, t.assignment_date, t.presentation_date, t.repository_url,
                    sup.id AS supervisor_id, sup.name AS supervisor_name, sup.surname AS supervisor_surname, sup.email AS supervisor_email,
                    stu.id AS student_id, stu.name AS student_name, stu.surname AS student_surname, stu.email AS student_email
                FROM thesis t
                JOIN users sup ON t.supervisor_id = sup.id
                LEFT JOIN users stu ON t.student_id = stu.id
                WHERE t.id = ?`,
                [thesisId]
            );

            if (!thesisRows.length) {
                return null;
            }

            const thesis = thesisRows[0];

            const [committeeMembersRows] = await pool.execute(
                `SELECT
                    cm.id, cm.professor_id, u.name, u.surname, u.email, cm.role, cm.grade, cm.grade_details
                FROM committee_members cm
                JOIN users u ON cm.professor_id = u.id
                WHERE cm.thesis_id = ?`,
                [thesisId]
            );
            thesis.committee_members = committeeMembersRows;

            const [committeeInvitationsRows] = await pool.execute(
                `SELECT
                    ci.id, ci.invited_professor_id, u.name, u.surname, u.email, ci.status AS invitation_status
                FROM committee_invitations ci
                JOIN users u ON ci.invited_professor_id = u.id
                WHERE ci.thesis_id = ?`,
                [thesisId]
            );
            thesis.committee_invitations = committeeInvitationsRows;


            return thesis;
        } catch (error) {
            console.error('Error fetching thesis details with committee:', error);
            throw error;
        }
    }

    // Νέα μέθοδος: Ενεργοποίηση διπλωματικής και εκκαθάριση προσκλήσεων
    static async activateThesisAndCleanInvitations(thesisId) {
        try {
            await pool.query('START TRANSACTION');

            // 1. Ενημέρωση κατάστασης διπλωματικής σε 'active'
            const [updateThesisResult] = await pool.execute(
                'UPDATE thesis SET status = "active" WHERE id = ? AND status = "under_assignment"',
                [thesisId]
            );

            if (updateThesisResult.affectedRows === 0) {
                throw new Error('Could not activate thesis or thesis is not in "under_assignment" status.');
            }

            // 2. Προσθήκη αποδεκτών προσκλήσεων στον πίνακα committee_members
            const [acceptedInvitations] = await pool.execute(
                `SELECT invited_professor_id FROM committee_invitations WHERE thesis_id = ? AND status = 'accepted'`,
                [thesisId]
            );

            for (const invitation of acceptedInvitations) {
                await pool.execute(
                    'INSERT INTO committee_members (thesis_id, professor_id, role) VALUES (?, ?, "member")',
                    [thesisId, invitation.invited_professor_id]
                );
            }

            // 3. Διαγραφή όλων των προσκλήσεων για αυτή τη διπλωματική
            await pool.execute('DELETE FROM committee_invitations WHERE thesis_id = ?', [thesisId]);

            await pool.query('COMMIT');
            return true;
        } catch (error) {
            await pool.query('ROLLBACK');
            console.error('Error activating thesis and cleaning invitations:', error);
            throw error;
        }
    }

    // Νέα μέθοδος: Έλεγχος αν δύο καθηγητές έχουν αποδεχθεί προσκλήσεις
    static async checkIfCommitteeReady(thesisId) {
        try {
            const [rows] = await pool.execute(
                `SELECT COUNT(*) AS accepted_count
                 FROM committee_invitations
                 WHERE thesis_id = ? AND status = 'accepted'`,
                [thesisId]
            );
            return rows[0].accepted_count >= 2;
        } catch (error) {
            console.error('Error checking if committee is ready:', error);
            throw error;
        }
    }

    // Νέα μέθοδος: Ακύρωση συγκεκριμένης πρόσκλησης
    static async cancelInvitation(invitationId, thesisId) {
        try {
            const [result] = await pool.execute('DELETE FROM committee_invitations WHERE id = ? AND thesis_id = ?', [invitationId, thesisId]);
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error canceling invitation:', error);
            throw error;
        }
    }

    static async getSecretariatTheses() {
        try {
            const [rows] = await pool.execute(
                `SELECT
                    t.id, t.title, t.description, t.status, t.assignment_date, t.gs_approval_protocol,
                    t.presentation_date, t.final_grade, t.repository_url, t.cancellation_reason,
                    s.id AS student_id, s.name AS student_name, s.surname AS student_surname, s.email AS student_email,
                    sup.id AS supervisor_id, sup.name AS supervisor_name, sup.surname AS supervisor_surname, sup.email AS supervisor_email
                FROM thesis t
                LEFT JOIN users s ON t.student_id = s.id
                JOIN users sup ON t.supervisor_id = sup.id
                WHERE t.status IN ('active', 'under_review')`
            );
            return rows;
        } catch (error) {
            console.error('Error fetching theses for secretariat:', error);
            throw error;
        }
    }

    // Νέα μέθοδος: Καταχώριση ΑΠ από ΓΣ για ανάθεση θέματος
    static async updateGsApprovalProtocol(thesisId, gsProtocol) {
        try {
            const [result] = await pool.execute(
                'UPDATE thesis SET gs_approval_protocol = ? WHERE id = ? AND status = "active"',
                [gsProtocol, thesisId]
            );
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error updating GS approval protocol:', error);
            throw error;
        }
    }

    // Νέα μέθοδος: Ακύρωση διπλωματικής από Γραμματεία
    static async cancelThesisBySecretariat(thesisId, gsNumber, gsYear, cancellationReason) {
        try {
            const fullCancellationReason = `Ακύρωση με απόφαση Γ.Σ. Αριθμός: ${gsNumber}, Έτος: ${gsYear}. Λόγος: ${cancellationReason}`;
            const [result] = await pool.execute(
                'UPDATE thesis SET status = "cancelled", cancellation_reason = ? WHERE id = ? AND status IN ("active", "under_assignment", "under_review")',
                [fullCancellationReason, thesisId]
            );
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error cancelling thesis by secretariat:', error);
            throw error;
        }
    }

    // Νέα μέθοδος: Αλλαγή κατάστασης σε "Περατωμένη" (μόνο αν υπάρχουν βαθμός & σύνδεσμος αποθετηρίου)
    static async markThesisAsCompleted(thesisId) {
        try {
            const [result] = await pool.execute(
                'UPDATE thesis SET status = "completed" WHERE id = ? AND status = "under_review" AND final_grade IS NOT NULL AND repository_url IS NOT NULL',
                [thesisId]
            );
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error marking thesis as completed:', error);
            throw error;
        }
    }

    // Νέα μέθοδος: Ενημέρωση τελικού βαθμού
    static async updateFinalGrade(thesisId, grade) {
        try {
            const [result] = await pool.execute(
                'UPDATE thesis SET final_grade = ? WHERE id = ?',
                [grade, thesisId]
            );
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error updating final grade:', error);
            throw error;
        }
    }

    // Νέα μέθοδος: Ενημέρωση repository URL
    static async updateRepositoryUrl(thesisId, url) {
        try {
            const [result] = await pool.execute(
                'UPDATE thesis SET repository_url = ? WHERE id = ?',
                [url, thesisId]
            );
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error updating repository URL:', error);
            throw error;
        }
    }

    // 6) Διαχείριση διπλωματικών - Ενεργή: Αλλαγή κατάστασης σε "Υπό Εξέταση"
    static async setThesisUnderReview(thesisId, supervisorId) {
        try {
            const [result] = await pool.execute(
                'UPDATE thesis SET status = "under_review" WHERE id = ? AND supervisor_id = ? AND status = "active"',
                [thesisId, supervisorId]
            );
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error setting thesis under review:', error);
            throw error;
        }
    }

    // 6) Διαχείριση διπλωματικών - Ενεργή: Ακύρωση ανάθεσης (μετά 2 έτη, με Γ.Σ.)
    static async cancelThesisBySupervisor(thesisId, supervisorId, gsNumber, gsYear) {
        try {
            const [thesisCheck] = await pool.execute(
                `SELECT assignment_date FROM thesis WHERE id = ? AND supervisor_id = ? AND status IN ('active', 'under_assignment', 'under_review')`,
                [thesisId, supervisorId]
            );

            if (!thesisCheck.length) {
                throw new Error('Thesis not found or not managed by this supervisor.');
            }

            const assignmentDate = new Date(thesisCheck[0].assignment_date);
            const twoYearsAgo = new Date();
            twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

            if (assignmentDate > twoYearsAgo) {
                throw new Error('Thesis cannot be cancelled by supervisor before 2 years from assignment date.');
            }

            const cancellationReason = `Ακύρωση από Επιβλέποντα (Γ.Σ. Αρ: ${gsNumber}, Έτος: ${gsYear})`;
            const [result] = await pool.execute(
                'UPDATE thesis SET status = "cancelled", cancellation_reason = ? WHERE id = ? AND supervisor_id = ?',
                [cancellationReason, thesisId, supervisorId]
            );

            // If cancelled, remove any committee members and pending invitations
            if (result.affectedRows > 0) {
                await pool.execute('DELETE FROM committee_members WHERE thesis_id = ? AND professor_id != ?', [thesisId, supervisorId]); // Keep supervisor entry in committee_members
                await pool.execute('DELETE FROM committee_invitations WHERE thesis_id = ?', [thesisId]);
            }
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error cancelling thesis by supervisor:', error);
            throw error;
        }
    }

    // 6) Διαχείριση διπλωματικών - Υπό Εξέταση: Καταχώριση ατομικού βαθμού μέλους επιτροπής
    static async saveCommitteeMemberGrade(thesisId, professorId, grade, gradeDetails) {
        try {
            const [result] = await pool.execute(
                'UPDATE committee_members SET grade = ?, grade_details = ? WHERE thesis_id = ? AND professor_id = ?',
                [grade, gradeDetails, thesisId, professorId]
            );
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error saving committee member grade:', error);
            throw error;
        }
    }

    // 5) Προβολή στατιστικών
    static async getProfessorStatistics(professorId) {
        try {
            const [statsRows] = await pool.execute(
                `SELECT
                    SUM(CASE WHEN t.supervisor_id = ? THEN 1 ELSE 0 END) AS total_supervised,
                    SUM(CASE WHEN cm.professor_id = ? AND t.supervisor_id != ? THEN 1 ELSE 0 END) AS total_committee_member,
                    AVG(CASE WHEN t.supervisor_id = ? AND t.status = 'completed' THEN DATEDIFF(t.presentation_date, t.assignment_date) ELSE NULL END) AS avg_time_supervised,
                    AVG(CASE WHEN cm.professor_id = ? AND t.supervisor_id != ? AND t.status = 'completed' THEN DATEDIFF(t.presentation_date, t.assignment_date) ELSE NULL END) AS avg_time_committee_member,
                    AVG(CASE WHEN t.supervisor_id = ? AND t.status = 'completed' THEN t.final_grade ELSE NULL END) AS avg_grade_supervised,
                    AVG(CASE WHEN cm.professor_id = ? AND t.supervisor_id != ? AND t.status = 'completed' THEN cm.grade ELSE NULL END) AS avg_grade_committee_member
                FROM thesis t
                LEFT JOIN committee_members cm ON t.id = cm.thesis_id
                WHERE t.supervisor_id = ? OR cm.professor_id = ?`,
                [
                    professorId, professorId, professorId, // total counts
                    professorId, professorId, professorId, // avg time
                    professorId, professorId, professorId, // avg grade
                    professorId, professorId // WHERE clause
                ]
            );
            return statsRows[0];
        } catch (error) {
            console.error('Error fetching professor statistics:', error);
            throw error;
        }
    }

    // Added for detailed thesis view to fetch all notes
    static async getThesisNotes(thesisId) {
        try {
            const [rows] = await pool.execute(
                `SELECT pn.id, pn.note, pn.created_at, u.name, u.surname, u.role
                 FROM progress_notes pn
                 JOIN users u ON pn.author_id = u.id
                 WHERE pn.thesis_id = ? ORDER BY pn.created_at DESC`,
                [thesisId]
            );
            return rows;
        } catch (error) {
            console.error('Error fetching thesis notes:', error);
            throw error;
        }
    }

    // New: Get a single thesis with full details (for modal view)
    static async getSingleThesisFullDetails(thesisId, professorId) {
        try {
            const [thesisRows] = await pool.execute(
                `SELECT
                    t.id, t.title, t.description, t.description_pdf_url, t.status, t.assignment_date, t.presentation_date, t.presentation_location,
                    t.repository_url, t.final_grade, t.cancellation_reason, t.gs_approval_protocol,
                    s.id AS student_id, s.name AS student_name, s.surname AS student_surname, s.email AS student_email,
                    sup.id AS supervisor_id, sup.name AS supervisor_name, sup.surname AS supervisor_surname, sup.email AS supervisor_email
                FROM thesis t
                LEFT JOIN users s ON t.student_id = s.id
                JOIN users sup ON t.supervisor_id = sup.id
                WHERE t.id = ? AND (t.supervisor_id = ? OR EXISTS(SELECT 1 FROM committee_members cm WHERE cm.thesis_id = t.id AND cm.professor_id = ?))`,
                [thesisId, professorId, professorId]
            );

            if (!thesisRows.length) return null;
            const thesis = thesisRows[0];

            // Committee Members
            const [cmRows] = await pool.execute(
                `SELECT cm.professor_id, u.name, u.surname, u.email, cm.grade, cm.grade_details
                 FROM committee_members cm
                 JOIN users u ON cm.professor_id = u.id
                 WHERE cm.thesis_id = ?`,
                [thesisId]
            );
            thesis.committee_members = cmRows;

            // Committee Invitations
            const [ciRows] = await pool.execute(
                `SELECT ci.invited_professor_id, u.name, u.surname, u.email, ci.status
                 FROM committee_invitations ci
                 JOIN users u ON ci.invited_professor_id = u.id
                 WHERE ci.thesis_id = ?`,
                [thesisId]
            );
            thesis.committee_invitations = ciRows;

            // Notes (only visible to author, so filter on frontend or fetch only for professorId)
            // For now, let's fetch all and filter on frontend for display
            thesis.all_notes = await this.getThesisNotes(thesisId);


            return thesis;
        } catch (error) {
            console.error('Error fetching single thesis full details:', error);
            throw error;
        }
    }

    // Νέα μέθοδος: Ανάθεση θέματος σε φοιτητή (για το 'Αρχική ανάθεση θέματος σε φοιτητή')
    static async assignTopicToStudent(thesisId, studentId, supervisorId) {
        try {
            const [result] = await pool.execute(
                `UPDATE thesis SET student_id = ?, status = 'under_assignment', assignment_date = CURDATE()
                 WHERE id = ? AND supervisor_id = ? AND status = 'available'`,
                [studentId, thesisId, supervisorId]
            );
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error assigning topic to student:', error);
            throw error;
        }
    }

    // Νέα μέθοδος: Αναίρεση ανάθεσης θέματος από φοιτητή (για το 'Αρχική ανάθεση θέματος σε φοιτητή')
    static async unassignTopicFromStudent(thesisId, supervisorId) {
        try {
            const [result] = await pool.execute(
                `UPDATE thesis SET student_id = NULL, status = 'available', assignment_date = NULL
                 WHERE id = ? AND supervisor_id = ? AND status = 'under_assignment'`,
                [thesisId, supervisorId]
            );
            // Delete pending invitations if any when unassigning
            if (result.affectedRows > 0) {
                 await pool.execute('DELETE FROM committee_invitations WHERE thesis_id = ?', [thesisId]);
            }
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error unassigning topic from student:', error);
            throw error;
        }
    }
}

module.exports = Thesis;