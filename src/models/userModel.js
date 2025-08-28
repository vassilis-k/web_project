const pool = require('../config/db');

class User {
    static async findByEmail(email) {
        try {
            const [rows] = await pool.execute('SELECT id, email, password, role, name, surname FROM users WHERE email = ?', [email]);
            return rows[0]; // Returns the user object or undefined
        } catch (error) {
            console.error('Error finding user by email:', error);
            throw error;
        }
    }

    // Νέα μέθοδος: Ανεύρεση χρήστη με ID
    static async findById(id) {
        try {
            const [rows] = await pool.execute('SELECT id, email, role, name, surname, landline, mobile, street, street_number, city, postal_code, country, department, university FROM users WHERE id = ?', [id]);
            return rows[0];
        } catch (error) {
            console.error('Error finding user by ID:', error);
            throw error;
        }
    }

    // Νέα μέθοδος: Ενημέρωση προφίλ φοιτητή
    static async updateStudentProfile(userId, { name, surname, landline, mobile, street, street_number, city, postal_code, country }) {
        try {
            const [result] = await pool.execute(
                `UPDATE users SET
                 name = ?, surname = ?, landline = ?, mobile = ?, street = ?, street_number = ?, city = ?, postal_code = ?, country = ?
                 WHERE id = ? AND role = 'student'`, // Εξασφαλίζουμε ότι μόνο φοιτητές μπορούν να ενημερώσουν
                [name, surname, landline, mobile, street, street_number, city, postal_code, country, userId]
            );
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error updating student profile:', error);
            throw error;
        }
    }

    // Νέα μέθοδος: Ανάκτηση όλων των καθηγητών για προσκλήσεις επιτροπής
    static async getAllProfessors() {
        try {
            const [rows] = await pool.execute('SELECT id, name, surname, email FROM users WHERE role = "professor"');
            return rows;
        } catch (error) {
            console.error('Error fetching all professors:', error);
            throw error;
        }
    }

    static async searchStudents(searchTerm) {
        try {
            const query = `
                SELECT id, name, surname, email
                FROM users
                WHERE role = 'student' AND (
                    name LIKE ? OR surname LIKE ? OR email LIKE ?
                )`;
            const likeTerm = `%${searchTerm}%`;
            const [rows] = await pool.execute(query, [likeTerm, likeTerm, likeTerm]);
            return rows;
        } catch (error) {
            console.error('Error searching students:', error);
            throw error;
        }
    }
}

module.exports = User;