const pool = require('../config/db');

class ProgressNote {
    static async addNote(thesisId, authorId, noteText) {
        try {
            const [result] = await pool.execute(
                'INSERT INTO progress_notes (thesis_id, author_id, note) VALUES (?, ?, ?)',
                [thesisId, authorId, noteText]
            );
            return { id: result.insertId, thesis_id: thesisId, author_id: authorId, note: noteText };
        } catch (error) {
            console.error('Error adding progress note:', error);
            throw error;
        }
    }

    static async getNotesByThesisIdAndAuthor(thesisId, authorId) {
        try {
            const [rows] = await pool.execute(
                'SELECT id, note, created_at FROM progress_notes WHERE thesis_id = ? AND author_id = ? ORDER BY created_at DESC',
                [thesisId, authorId]
            );
            return rows;
        } catch (error) {
            console.error('Error fetching progress notes:', error);
            throw error;
        }
    }
}

module.exports = ProgressNote;