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
                        // Exclude any student who already has a thesis in ANY lifecycle state except explicitly cancelled.
                        // This prevents assigning a second thesis to someone who already completed or is progressing through one.
                        const query = `
                                SELECT u.id, u.name, u.surname, u.email
                                FROM users u
                                WHERE u.role = 'student'
                                    AND (CAST(u.id AS CHAR) LIKE ? OR u.name LIKE ? OR u.surname LIKE ? OR u.email LIKE ?)
                                    AND u.id NOT IN (
                                            SELECT t.student_id FROM thesis t
                                            WHERE t.student_id IS NOT NULL AND t.status != 'cancelled'
                                    )`;
            const likeTerm = `%${searchTerm}%`;
            const [rows] = await pool.execute(query, [likeTerm, likeTerm, likeTerm, likeTerm]);
            return rows;
        } catch (error) {
            console.error('Error searching students:', error);
            throw error;
        }
    }

    static async bulkInsertOrUpdate(users) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            let inserted = 0;
            let updated = 0;

            const nz = (v) => (v === undefined ? null : v);
            const sanitizeUser = (u) => ({
                email: u && u.email !== undefined ? u.email : null,
                password: u && u.password !== undefined ? u.password : null,
                name: u && u.name !== undefined ? u.name : null,
                surname: u && u.surname !== undefined ? u.surname : null,
                role: u && u.role !== undefined ? u.role : null,
                department: u && u.department !== undefined ? u.department : null,
                university: u && u.university !== undefined ? u.university : null,
                landline: u && u.landline !== undefined ? u.landline : null,
                mobile: u && u.mobile !== undefined ? u.mobile : null,
                street: u && u.street !== undefined ? u.street : null,
                street_number: u && u.street_number !== undefined ? u.street_number : null,
                city: u && u.city !== undefined ? u.city : null,
                postal_code: u && u.postal_code !== undefined ? u.postal_code : null,
                country: u && u.country !== undefined ? u.country : null,
            });

            for (const raw of users) {
                const user = sanitizeUser(raw);
                if (!user.email || !user.role) {
                    console.warn('Skipping user with missing email or role:', user);
                    continue;
                }

                const [existing] = await connection.execute('SELECT id FROM users WHERE email = ?', [String(user.email)]);

                if (existing.length > 0) {
                    // User exists -> Update
                    const userId = existing[0].id;
                    const { name, surname, role, department, university, landline, mobile, street, street_number, city, postal_code, country } = user;
                    
                    // For safety, we don't update password on existing users via this import.
                    // Password changes should be a separate, deliberate action by the user.
                    await connection.execute(
                        `UPDATE users SET 
                         name = COALESCE(?, name), surname = COALESCE(?, surname), role = COALESCE(?, role), 
                         department = COALESCE(?, department), university = COALESCE(?, university), 
                         landline = COALESCE(?, landline), mobile = COALESCE(?, mobile), street = COALESCE(?, street), 
                         street_number = COALESCE(?, street_number), city = COALESCE(?, city), 
                         postal_code = COALESCE(?, postal_code), country = COALESCE(?, country)
                         WHERE id = ?`,
                        [nz(name), nz(surname), nz(role), nz(department), nz(university), nz(landline), nz(mobile), nz(street), nz(street_number), nz(city), nz(postal_code), nz(country), userId]
                    );
                    updated++;
                } else {
                    // User does not exist -> Insert
                    const { email, password, name, surname, role, department, university, landline, mobile, street, street_number, city, postal_code, country } = user;
                    
                    if (!password) {
                        // Skip inserting new user without password (no log to avoid noise)
                        continue;
                    }

                    await connection.execute(
                        `INSERT INTO users (email, password, name, surname, role, department, university, landline, mobile, street, street_number, city, postal_code, country)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [String(email), String(password), nz(name), nz(surname), String(role), nz(department), nz(university), nz(landline), nz(mobile), nz(street), nz(street_number), nz(city), nz(postal_code), nz(country)]
                    );
                    inserted++;
                }
            }

            await connection.commit();
            return { inserted, updated };
        } catch (error) {
            await connection.rollback();
            console.error('Error in bulkInsertOrUpdate:', error);
            throw error;
        } finally {
            connection.release();
        }
    }
}

module.exports = User;