const db = require('../config/db');

const ProfessorNote = {
    // Add a new note for a professor on a specific thesis
    add: async (thesisId, professorId, note) => {
        const connection = await db.getConnection();
        try {
            const [result] = await connection.execute(
                'INSERT INTO professor_notes (thesis_id, professor_id, note) VALUES (?, ?, ?)',
                [thesisId, professorId, note]
            );
            return result.insertId;
        } finally {
            connection.release();
        }
    },

    // Find all notes for a specific thesis written by a specific professor
    findByThesisAndProfessor: async (thesisId, professorId) => {
        const connection = await db.getConnection();
        try {
            const [rows] = await connection.execute(
                'SELECT id, note, created_at FROM professor_notes WHERE thesis_id = ? AND professor_id = ? ORDER BY created_at DESC',
                [thesisId, professorId]
            );
            return rows;
        } finally {
            connection.release();
        }
    }
};

module.exports = ProfessorNote;
