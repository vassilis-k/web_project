const pool = require('../config/db');

class ProgressNote {
    // New method used by studentController.createProgressNote
    static async create({ thesis_id, date, description, file_url, author_id }) {
        try {
            const [result] = await pool.execute(
                `INSERT INTO progress_notes (thesis_id, author_id, description, date, file_url)
                 VALUES (?, ?, ?, ?, ?)`,
                [thesis_id, author_id, description, date, file_url || null]
            );
            return result.insertId;
        } catch (error) {
            console.error('Error creating progress note:', error);
            throw error;
        }
    }

    // New method used by studentController.getProgressNotesForThesis
    static async findByThesisId(thesisId) {
        try {
            const [rows] = await pool.execute(
                'SELECT id, description, file_url, date, created_at FROM progress_notes WHERE thesis_id = ? ORDER BY created_at DESC',
                [thesisId]
            );
            return rows;
        } catch (error) {
            console.error('Error fetching progress notes by thesis:', error);
            throw error;
        }
    }
}

module.exports = ProgressNote;