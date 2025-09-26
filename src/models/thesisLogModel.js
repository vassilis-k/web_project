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
            // Basic validation / normalization
            if (thesisId === undefined || thesisId === null) {
                throw new Error('ThesisLog.add called without thesisId');
            }
            if (action === undefined || action === null) {
                throw new Error('ThesisLog.add called without action');
            }
            // Details may be optional; fallback to empty string if undefined
            const safeDetails = details === undefined ? '' : details;
            const safeUserId = (userId === undefined) ? null : userId; // allow null (system action)

            await connection.execute(
                'INSERT INTO thesis_log (thesis_id, user_id, action, details) VALUES (?, ?, ?, ?)',
                [thesisId, safeUserId, action, safeDetails]
            );
        } catch (error) {
            console.error('Error adding to thesis log:', error);
            // Do not rethrow; logging failure should not block main flow.
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
