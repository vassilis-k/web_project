const pool = require('../config/db');
const ThesisLog = require('./thesisLogModel');

class Thesis {
    // 1) Προβολή και Δημιουργία θεμάτων προς ανάθεση: Ο Διδάσκων καταχωρεί ένα νέο θέμα
    static async createTopic(title, description, description_pdf_url, supervisor_id) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            const [result] = await connection.execute(
                'INSERT INTO thesis (title, description, description_pdf_url, supervisor_id, status) VALUES (?, ?, ?, ?, ?)',
                [title, description, description_pdf_url, supervisor_id, 'available'] // Default status 'available' as per our updated schema
            );
            const thesisId = result.insertId;
            await ThesisLog.add(thesisId, supervisor_id, 'TOPIC_CREATED', `Το θέμα "${title}" δημιουργήθηκε.`, connection);
            await connection.commit();
            return { id: thesisId, title, description, description_pdf_url, supervisor_id, status: 'available' };
        } catch (error) {
            await connection.rollback();
            console.error('Error creating thesis topic:', error);
            throw error;
        } finally {
            connection.release();
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

    // New method to get theses under temporary assignment for a supervisor
    static async getUnderAssignmentBySupervisor(supervisor_id) {
        try {
            const [rows] = await pool.execute(
                `SELECT
                    t.id, t.title,
                    s.name AS student_name, s.surname AS student_surname
                 FROM thesis t
                 JOIN users s ON t.student_id = s.id
                 WHERE t.supervisor_id = ? AND t.status = 'under_assignment'`,
                [supervisor_id]
            );
            return rows;
        } catch (error) {
            console.error('Error fetching under-assignment theses by supervisor:', error);
            throw error;
        }
    }

    // Ο καθηγητής μπορεί να επεξεργαστεί καθένα από αυτά
    static async updateTopic(id, supervisor_id, title, description, description_pdf_url) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            const [result] = await connection.execute(
                'UPDATE thesis SET title = ?, description = ?, description_pdf_url = ? WHERE id = ? AND supervisor_id = ? AND student_id IS NULL',
                [title, description, description_pdf_url, id, supervisor_id]
            );

            if (result.affectedRows > 0) {
                await ThesisLog.add(id, supervisor_id, 'TOPIC_UPDATED', 'Οι πληροφορίες του θέματος ενημερώθηκαν.', connection);
            }

            await connection.commit();
            return result.affectedRows > 0; // Returns true if updated, false otherwise
        } catch (error) {
            await connection.rollback();
            console.error('Error updating thesis topic:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    // Add other thesis-related methods here as needed for other functionalities
    // e.g., get all theses where professor is supervisor or committee member
     // 3) Προβολή λίστας διπλωματικών (Detailed - clean filtering approach)
    static async getProfessorRelatedThesesDetailed(professor_id, filters = {}) {
        // Base query that gets all theses where professor has any role
        let query = `
            SELECT DISTINCT
                t.id, t.title, t.description, t.description_pdf_url, t.status, t.assignment_date, 
                t.presentation_date, t.repository_url, t.draft_file_url, t.final_grade, t.cancellation_reason,
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
            WHERE (
                t.supervisor_id = ? 
                OR cm.professor_id = ? 
                OR (ci.invited_professor_id = ? AND ci.status = 'accepted')
            )
        `;
        
        const params = [professor_id, professor_id, professor_id];

        // Apply role filter at SQL level
        if (filters.role && filters.role !== 'all') {
            if (filters.role === 'supervisor') {
                query += ` AND t.supervisor_id = ?`;
                params.push(professor_id);
            } else if (filters.role === 'member') {
                query += ` AND t.supervisor_id != ? AND (cm.professor_id = ? OR (ci.invited_professor_id = ? AND ci.status = 'accepted'))`;
                params.push(professor_id, professor_id, professor_id);
            }
        }

        // Apply status filter at SQL level
        if (filters.status && filters.status !== 'all') {
            query += ` AND t.status = ?`;
            params.push(filters.status);
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
                    t.*,
                    s.name AS supervisor_name, s.surname AS supervisor_surname, s.email AS supervisor_email
                FROM thesis t
                JOIN users s ON t.supervisor_id = s.id
                WHERE t.student_id = ? AND t.status != 'cancelled'
                ORDER BY t.assignment_date DESC, t.id DESC
                LIMIT 1`,
                [studentId]
            );
            return rows[0] || null;
        } catch (error) {
            console.error('Error fetching thesis by student ID:', error);
            throw error;
        }
    }

    // Νέα μέθοδος: Ανάθεση διπλωματικής σε φοιτητή (αλλάζει την κατάσταση σε 'under_assignment')
    static async assignThesisToStudent(thesisId, studentId) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            const [result] = await connection.execute(
                'UPDATE thesis SET student_id = ?, status = "under_assignment" WHERE id = ? AND status = "available"',
                [studentId, thesisId]
            );
            if (result.affectedRows > 0) {
                // We don't have supervisorId here, so we pass null for userId. The action is initiated by the student.
                await ThesisLog.add(thesisId, studentId, 'STUDENT_APPLIED', `Ο φοιτητής (ID: ${studentId}) έκανε αίτηση για το θέμα.`, connection);
            }
            await connection.commit();
            return result.affectedRows > 0;
        } catch (error) {
            await connection.rollback();
            console.error('Error assigning thesis to student:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    // Νέα μέθοδος: Ανάκτηση λεπτομερειών διπλωματικής μαζί με μέλη επιτροπής και προσκλήσεις
    static async getThesisDetailsWithCommittee(thesisId) {
        if (!thesisId) return null; // Handle cases where student has no thesis yet
        try {
            const [thesisRows] = await pool.execute(
                `SELECT
                    t.*,
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

    // Νέα μέθοδος: Ενημέρωση λεπτομερειών παρουσίασης
    static async updatePresentationDetails(thesisId, details, professorId) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            const [result] = await connection.execute(
                `UPDATE thesis SET
                    presentation_date = ?,
                    presentation_mode = ?,
                    presentation_location = ?,
                    draft_file_url = ?,
                    extra_material_url = ?,
                    presentation_details_locked = ?
                WHERE id = ? AND status = 'under_review'`,
                [
                    details.presentation_date,
                    details.presentation_mode,
                    details.presentation_location,
                    details.draft_file_url,
                    details.extra_material_url,
                    details.presentation_details_locked,
                    thesisId
                ]
            );
            if (result.affectedRows > 0) {
                await ThesisLog.add(thesisId, professorId, 'PRESENTATION_DETAILS_UPDATED', 'Οι λεπτομέρειες της παρουσίασης ενημερώθηκαν.', connection);
            }
            await connection.commit();
            return result.affectedRows > 0;
        } catch (error) {
            await connection.rollback();
            console.error('Error updating presentation details:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    // Νέα μέθοδος: Ενεργοποίηση διπλωματικής και εκκαθάριση προσκλήσεων
    static async activateThesisAndCleanInvitations(thesisId, supervisorId) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // 1. Ενημέρωση κατάστασης διπλωματικής σε 'active'
            const [updateThesisResult] = await connection.execute(
                'UPDATE thesis SET status = "active" WHERE id = ? AND status = "under_assignment"',
                [thesisId]
            );

            if (updateThesisResult.affectedRows === 0) {
                throw new Error('Could not activate thesis or thesis is not in "under_assignment" status.');
            }

            // 2. Προσθήκη αποδεκτών προσκλήσεων στον πίνακα committee_members
            const [acceptedInvitations] = await connection.execute(
                `SELECT invited_professor_id FROM committee_invitations WHERE thesis_id = ? AND status = 'accepted'`,
                [thesisId]
            );

            for (const invitation of acceptedInvitations) {
                await connection.execute(
                    'INSERT INTO committee_members (thesis_id, professor_id, role) VALUES (?, ?, "member")',
                    [thesisId, invitation.invited_professor_id]
                );
            }

            // 3. Διαγραφή όλων των προσκλήσεων για αυτή τη διπλωματική
            await connection.execute('DELETE FROM committee_invitations WHERE thesis_id = ?', [thesisId]);

            // 4. Log the activation - supervisorId is not available here, so we pass null.
            await ThesisLog.add(thesisId, null, 'ACTIVATED', 'Η διπλωματική ενεργοποιήθηκε και η επιτροπή οριστικοποιήθηκε.', connection);

            await connection.commit();
            return true;
        } catch (error) {
            await connection.rollback();
            console.error('Error activating thesis and cleaning invitations:', error);
            throw error;
        } finally {
            connection.release();
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
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            const [result] = await connection.execute('DELETE FROM committee_invitations WHERE id = ? AND thesis_id = ?', [invitationId, thesisId]);
            if (result.affectedRows > 0) {
                // professorId is not available here, so we pass null.
                await ThesisLog.add(thesisId, null, 'INVITATION_CANCELLED', `Μια πρόσκληση μέλους επιτροπής ακυρώθηκε.`, connection);
            }
            await connection.commit();
            return result.affectedRows > 0;
        } catch (error) {
            await connection.rollback();
            console.error('Error canceling invitation:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    static async getSecretariatThesesWithDetails() {
        try {
            const [theses] = await pool.execute(
                `SELECT
                    t.id, t.title, t.description, t.status, t.assignment_date,
                    s.name AS student_name, s.surname AS student_surname,
                    sup.name AS supervisor_name, sup.surname AS supervisor_surname
                FROM thesis t
                LEFT JOIN users s ON t.student_id = s.id
                JOIN users sup ON t.supervisor_id = sup.id
                WHERE t.status IN ('active', 'under_review')
                ORDER BY t.assignment_date DESC`
            );

            for (const thesis of theses) {
                const [members] = await pool.execute(
                    `SELECT u.name, u.surname
                     FROM committee_members cm
                     JOIN users u ON cm.professor_id = u.id
                     WHERE cm.thesis_id = ?`,
                    [thesis.id]
                );
                // Also add the supervisor to the committee list for display purposes
                const supervisorAsMember = { name: thesis.supervisor_name, surname: thesis.supervisor_surname };
                thesis.committee_members = [supervisorAsMember, ...members];
            }

            return theses;
        } catch (error) {
            console.error('Error fetching secretariat theses with details:', error);
            throw error;
        }
    }

    // Νέα μέθοδος: Καταχώριση ΑΠ από ΓΣ για ανάθεση θέματος
    static async updateGsApprovalProtocol(thesisId, gsProtocol) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            const [result] = await connection.execute(
                'UPDATE thesis SET gs_approval_protocol = ? WHERE id = ? AND status = "active"',
                [gsProtocol, thesisId]
            );
            if (result.affectedRows > 0) {
                // secretariatId is not available here, so we pass null.
                await ThesisLog.add(thesisId, null, 'GS_PROTOCOL_ADDED', `Καταχωρήθηκε ΑΠ ΓΣ (${gsProtocol}) για την ανάθεση.`, connection);
            }
            await connection.commit();
            return result.affectedRows > 0;
        } catch (error) {
            await connection.rollback();
            console.error('Error updating GS approval protocol:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    // Νέα μέθοδος: Ακύρωση διπλωματικής από Γραμματεία
    static async cancelThesisBySecretariat(thesisId, gsNumber, gsYear, cancellationReason) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            const fullCancellationReason = `Ακύρωση με απόφαση Γ.Σ. Αριθμός: ${gsNumber}, Έτος: ${gsYear}. Λόγος: ${cancellationReason}`;
            const [result] = await connection.execute(
                'UPDATE thesis SET status = "cancelled", cancellation_reason = ? WHERE id = ? AND status IN ("active", "under_assignment", "under_review")',
                [fullCancellationReason, thesisId]
            );
            if (result.affectedRows > 0) {
                // secretariatId is not available here, so we pass null.
                await ThesisLog.add(thesisId, null, 'CANCELLED_BY_SECRETARIAT', fullCancellationReason, connection);
            }
            await connection.commit();
            return result.affectedRows > 0;
        } catch (error) {
            await connection.rollback();
            console.error('Error cancelling thesis by secretariat:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    // Νέα μέθοδος: Αλλαγή κατάστασης σε "Περατωμένη" (μόνο αν υπάρχουν βαθμός & σύνδεσμος αποθετηρίου)
    static async markThesisAsCompleted(thesisId) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            const [result] = await connection.execute(
                'UPDATE thesis SET status = "completed" WHERE id = ? AND status = "under_review" AND final_grade IS NOT NULL AND repository_url IS NOT NULL',
                [thesisId]
            );
            if (result.affectedRows > 0) {
                // professorId is not available here, so we pass null.
                await ThesisLog.add(thesisId, null, 'COMPLETED', 'Η διπλωματική σημάνθηκε ως "Περατωμένη".', connection);
            }
            await connection.commit();
            return result.affectedRows > 0;
        } catch (error) {
            await connection.rollback();
            console.error('Error marking thesis as completed:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    // Νέα μέθοδος: Ενημέρωση τελικού βαθμού
    static async updateFinalGrade(thesisId, grade) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            const [result] = await connection.execute(
                'UPDATE thesis SET final_grade = ? WHERE id = ?',
                [grade, thesisId]
            );
            if (result.affectedRows > 0) {
                // professorId is not available here, so we pass null.
                await ThesisLog.add(thesisId, null, 'FINAL_GRADE_SET', `Ο τελικός βαθμός ορίστηκε σε ${grade}.`, connection);
            }
            await connection.commit();
            return result.affectedRows > 0;
        } catch (error) {
            await connection.rollback();
            console.error('Error updating final grade:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    // Νέα μέθοδος: Ενημέρωση repository URL
    static async updateRepositoryUrl(thesisId, url) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            const [result] = await connection.execute(
                'UPDATE thesis SET repository_url = ? WHERE id = ?',
                [url, thesisId]
            );
            if (result.affectedRows > 0) {
                // professorId is not available here, so we pass null.
                await ThesisLog.add(thesisId, null, 'REPO_URL_UPDATED', 'Το URL του αποθετηρίου ενημερώθηκε.', connection);
            }
            await connection.commit();
            return result.affectedRows > 0;
        } catch (error) {
            await connection.rollback();
            console.error('Error updating repository URL:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    // 6) Διαχείριση διπλωματικών - Ενεργή: Αλλαγή κατάστασης σε "Υπό Εξέταση"
    static async setThesisUnderReview(thesisId, supervisorId) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            const [result] = await connection.execute(
                'UPDATE thesis SET status = "under_review" WHERE id = ? AND supervisor_id = ? AND status = "active"',
                [thesisId, supervisorId]
            );
            if (result.affectedRows > 0) {
                await ThesisLog.add(thesisId, supervisorId, 'SET_UNDER_REVIEW', 'Η κατάσταση άλλαξε σε "Υπό Εξέταση".', connection);
            }
            await connection.commit();
            return result.affectedRows > 0;
        } catch (error) {
            await connection.rollback();
            console.error('Error setting thesis under review:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    // 6) Διαχείριση διπλωματικών - Υπό Εξέταση: Καταχώριση ατομικού βαθμού μέλους επιτροπής
    static async saveCommitteeMemberGrade(thesisId, professorId, grade, gradeDetails) {
        // Validate parameters
        if (!thesisId || !professorId || grade === undefined || grade === null || !gradeDetails) {
            throw new Error('Όλα τα πεδία είναι υποχρεωτικά για την καταχώριση βαθμού.');
        }

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            
            // Check if thesis is under review and professor is committee member
            const [thesisCheck] = await connection.execute(
                `SELECT t.status, cm.professor_id 
                 FROM thesis t 
                 LEFT JOIN committee_members cm ON t.id = cm.thesis_id AND cm.professor_id = ?
                 WHERE t.id = ?`,
                [professorId, thesisId]
            );
            
            if (!thesisCheck.length || thesisCheck[0].status !== 'under_review' || !thesisCheck[0].professor_id) {
                throw new Error('Δεν έχετε δικαίωμα καταχώρισης βαθμού για αυτή τη διπλωματική.');
            }
            
            const [result] = await connection.execute(
                'UPDATE committee_members SET grade = ?, grade_details = ? WHERE thesis_id = ? AND professor_id = ?',
                [grade, gradeDetails, thesisId, professorId]
            );
            if (result.affectedRows > 0) {
                const [prof] = await connection.execute('SELECT name, surname FROM users WHERE id = ?', [professorId]);
                const profName = prof.length > 0 ? `${prof[0].name} ${prof[0].surname}` : `ID: ${professorId}`;
                await ThesisLog.add(thesisId, professorId, 'MEMBER_GRADE_SAVED', `Ο/Η ${profName} καταχώρησε βαθμό (${grade}).`, connection);
            }
            await connection.commit();
            return result.affectedRows > 0;
        } catch (error) {
            await connection.rollback();
            console.error('Error saving committee member grade:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    // Added for detailed thesis view to fetch all notes
    static async getThesisNotes(thesisId) {
        try {
            const [rows] = await pool.execute(
                `SELECT pn.id, pn.description as note, pn.created_at, u.name, u.surname, u.role
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
            // Check if professor is supervisor, committee member, or has accepted invitation
            const [accessRows] = await pool.execute(
                `SELECT t.id
                 FROM thesis t
                 LEFT JOIN committee_members cm ON t.id = cm.thesis_id AND cm.professor_id = ?
                 LEFT JOIN committee_invitations ci ON t.id = ci.thesis_id AND ci.invited_professor_id = ? AND ci.status = 'accepted'
                 WHERE t.id = ? AND (t.supervisor_id = ? OR cm.professor_id IS NOT NULL OR ci.id IS NOT NULL)`,
                [professorId, professorId, thesisId, professorId]
            );
            if (!accessRows.length) return null;

            const [thesisRows] = await pool.execute(
                `SELECT
                    t.id, t.title, t.description, t.description_pdf_url, t.status, t.assignment_date, t.presentation_date, t.presentation_location,
                    t.repository_url, t.draft_file_url, t.final_grade, t.cancellation_reason, t.gs_approval_protocol,
                    s.id AS student_id, s.name AS student_name, s.surname AS student_surname, s.email AS student_email,
                    sup.id AS supervisor_id, sup.name AS supervisor_name, sup.surname AS supervisor_surname, sup.email AS supervisor_email
                FROM thesis t
                LEFT JOIN users s ON t.student_id = s.id
                JOIN users sup ON t.supervisor_id = sup.id
                WHERE t.id = ?`,
                [thesisId]
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

            // Committee Invitations (Only supervisor can see all, others see none)
            if (thesis.supervisor_id === professorId) {
                const [invitationRows] = await pool.execute(
                    `SELECT ci.id AS invitation_id, ci.status, u.name, u.surname
                     FROM committee_invitations ci
                     JOIN users u ON ci.invited_professor_id = u.id
                     WHERE ci.thesis_id = ?`,
                    [thesisId]
                );
                thesis.committee_invitations = invitationRows;
            } else {
                thesis.committee_invitations = [];
            }

            // Notes (only visible to author, so fetch only for the requesting professorId)
            const ProfessorNote = require('./professorNoteModel'); // Local require to avoid circular dependency
            thesis.my_notes = await ProfessorNote.findByThesisAndProfessor(thesisId, professorId);

            // Fetch Action Timeline
            thesis.action_log = await ThesisLog.getByThesisId(thesisId);

            return thesis;
        } catch (error) {
            console.error('Error fetching single thesis full details:', error);
            throw error;
        }
    }

    // Νέα μέθοδος: Ανάθεση θέματος σε φοιτητή (για το 'Αρχική ανάθεση θέματος σε φοιτητή')
    static async assignTopicToStudent(thesisId, studentId, supervisorId) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            const [result] = await connection.execute(
                `UPDATE thesis SET student_id = ?, status = 'under_assignment', assignment_date = CURDATE()
                 WHERE id = ? AND supervisor_id = ? AND status = 'available'`,
                [studentId, thesisId, supervisorId]
            );
            if (result.affectedRows > 0) {
                const [student] = await connection.execute('SELECT name, surname FROM users WHERE id = ?', [studentId]);
                const studentName = student.length > 0 ? `${student[0].name} ${student[0].surname}` : `ID: ${studentId}`;
                await ThesisLog.add(thesisId, supervisorId, 'ASSIGNED', `Το θέμα ανατέθηκε προσωρινά στον φοιτητή ${studentName}.`, connection);
            }
            await connection.commit();
            return result.affectedRows > 0;
        } catch (error) {
            await connection.rollback();
            console.error('Error assigning topic to student:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    // Νέα μέθοδος: Αναίρεση ανάθεσης θέματος από φοιτητή (για το 'Αρχική ανάθεση θέματος σε φοιτητή')
    static async unassignTopicFromStudent(thesisId, supervisorId) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // 1. Delete any committee members already assigned
            await connection.execute('DELETE FROM committee_members WHERE thesis_id = ?', [thesisId]);

            // 2. Delete any pending committee invitations
            await connection.execute('DELETE FROM committee_invitations WHERE thesis_id = ?', [thesisId]);

            // 3. Update the thesis itself to make it available again
            const [updateResult] = await connection.execute(
                `UPDATE thesis SET student_id = NULL, status = 'available', assignment_date = NULL
                 WHERE id = ? AND supervisor_id = ? AND status = 'under_assignment'`,
                [thesisId, supervisorId]
            );

            if (updateResult.affectedRows > 0) {
                await ThesisLog.add(thesisId, supervisorId, 'UNASSIGNED', 'Η προσωρινή ανάθεση στον φοιτητή αναιρέθηκε.', connection);
            }

            await connection.commit();
            return updateResult.affectedRows > 0;

        } catch (error) {
            await connection.rollback();
            console.error('Error unassigning topic from student:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    // 6) Διαχείριση διπλωματικών - Ενεργή: Αλλαγή κατάστασης σε "Υπό Εξέταση"
    static async setThesisUnderReview(thesisId, supervisorId) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            const [result] = await connection.execute(
                'UPDATE thesis SET status = "under_review" WHERE id = ? AND supervisor_id = ? AND status = "active"',
                [thesisId, supervisorId]
            );
            if (result.affectedRows > 0) {
                await ThesisLog.add(thesisId, supervisorId, 'SET_UNDER_REVIEW', 'Η κατάσταση άλλαξε σε "Υπό Εξέταση".', connection);
            }
            await connection.commit();
            return result.affectedRows > 0;
        } catch (error) {
            await connection.rollback();
            console.error('Error setting thesis under review:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    // 6) Διαχείριση διπλωματικών - Ενεργή: Ακύρωση ανάθεσης (μετά 2 έτη, με Γ.Σ.)
    static async cancelThesisBySupervisor(thesisId, supervisorId, gsNumber, gsYear) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            const [thesisCheck] = await connection.execute(
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
                const monthsLeft = Math.ceil((assignmentDate - twoYearsAgo) / (30.44 * 24 * 60 * 60 * 1000));
                throw new Error(`Η ακύρωση επιτρέπεται μόνο μετά από 2 χρόνια από την ανάθεση. Απομένουν περίπου ${monthsLeft} μήνες από την ημερομηνία ${assignmentDate.toLocaleDateString('el-GR')}.`);
            }

            const cancellationReason = `Ακύρωση από Επιβλέποντα (Γ.Σ. Αρ: ${gsNumber}, Έτος: ${gsYear})`;
            const [result] = await connection.execute(
                'UPDATE thesis SET status = "cancelled", cancellation_reason = ? WHERE id = ? AND supervisor_id = ?',
                [cancellationReason, thesisId, supervisorId]
            );

            // If cancelled, remove any committee members and pending invitations
            if (result.affectedRows > 0) {
                await connection.execute('DELETE FROM committee_members WHERE thesis_id = ? AND professor_id != ?', [thesisId, supervisorId]); // Keep supervisor entry in committee_members
                await connection.execute('DELETE FROM committee_invitations WHERE thesis_id = ?', [thesisId]);
                await ThesisLog.add(thesisId, supervisorId, 'CANCELLED_BY_SUPERVISOR', cancellationReason, connection);
            }
            await connection.commit();
            return result.affectedRows > 0;
        } catch (error) {
            await connection.rollback();
            console.error('Error cancelling thesis by supervisor:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    // Statistics for professor dashboard
    static async getProfessorStatistics(professorId) {
        try {
            // Total theses count by status for this professor
            const [statusCounts] = await pool.execute(`
                SELECT status, COUNT(*) as count 
                FROM thesis 
                WHERE supervisor_id = ? AND student_id IS NOT NULL
                GROUP BY status
            `, [professorId]);

            // Average completion time for completed theses (in days)
            const [avgTimeResult] = await pool.execute(`
                SELECT AVG(DATEDIFF(
                    CASE 
                        WHEN presentation_date IS NOT NULL THEN presentation_date
                        ELSE CURRENT_DATE 
                    END, 
                    assignment_date
                )) as avg_days
                FROM thesis 
                WHERE supervisor_id = ? AND assignment_date IS NOT NULL AND status IN ('completed', 'under_review')
            `, [professorId]);

            // Average grade for completed theses
            const [avgGradeResult] = await pool.execute(`
                SELECT AVG(CAST(final_grade AS DECIMAL(3,1))) as avg_grade
                FROM thesis 
                WHERE supervisor_id = ? AND final_grade IS NOT NULL AND status = 'completed'
            `, [professorId]);

            // Total count of theses by supervisor
            const [totalResult] = await pool.execute(`
                SELECT COUNT(*) as total
                FROM thesis 
                WHERE supervisor_id = ? AND student_id IS NOT NULL
            `, [professorId]);

            return {
                totalTheses: totalResult[0]?.total || 0,
                statusCounts: statusCounts,
                avgCompletionTime: Math.round(avgTimeResult[0]?.avg_days || 0),
                avgGrade: parseFloat(avgGradeResult[0]?.avg_grade || 0).toFixed(1)
            };
        } catch (error) {
            console.error('Error fetching professor statistics:', error);
            throw error;
        }
    }
}

module.exports = Thesis;