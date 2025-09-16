const pool = require('../config/db');

class ThesisLog {
    /**
     * Adds a new log entry for a thesis.
     * @param {number} thesisId - The ID of the thesis.
     * @param {number|null} userId - The ID of the user performing the action. Can be null for system actions.
     * @param {string} action - A short code for the action (e.g., 'STATUS_CHANGE').
     * @param {string} details - A human-readable description of the action.
     * @param {object} [connection=pool] - Optional database connection for transactions.
     */
    static async add(thesisId, userId, action, details, connection = pool) {
        try {
            await connection.execute(
                'INSERT INTO thesis_log (thesis_id, user_id, action, details) VALUES (?, ?, ?, ?)',
                [thesisId, userId, action, details]
            );
        } catch (error) {
            console.error('Error adding to thesis log:', error);
            // We don't re-throw the error here because a logging failure should not
            // typically cause the main operation to fail.
        }
    }

    /**
     * Retrieves all log entries for a specific thesis.
     * @param {number} thesisId - The ID of the thesis.
     */
    static async getByThesisId(thesisId) {
        try {
            const [rows] = await pool.execute(
                `SELECT tl.id, tl.action, tl.details, tl.timestamp, u.name, u.surname
                 FROM thesis_log tl
                 LEFT JOIN users u ON tl.user_id = u.id
                 WHERE tl.thesis_id = ?
                 ORDER BY tl.timestamp DESC`,
                [thesisId]
            );
            return rows;
        } catch (error) {
            console.error('Error fetching thesis log:', error);
            throw error;
        }
    }
}

module.exports = ThesisLog;
