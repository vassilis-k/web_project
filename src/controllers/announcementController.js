const db = require('../config/db');

exports.getAnnouncements = async (req, res) => {
    try {
        const { page = 1, limit = 2, date } = req.query;
        const offset = (page - 1) * limit;

        let query = `SELECT * FROM thesis_announcements`;
        const params = [];

        if (date) {
            query += ` WHERE announcement_date = ?`;
            params.push(date);
        }

        query += ` ORDER BY announcement_date DESC, announcement_time DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const [rows] = await db.query(query, params);

        const [[{ total }]] = await db.query(
            `SELECT COUNT(*) AS total FROM thesis_announcements ${date ? 'WHERE announcement_date = ?' : ''}`,
            date ? [date] : []
        );

        res.status(200).json({
            announcements: rows,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit),
        });
    } catch (error) {
        console.error('Error fetching announcements:', error);
        res.status(500).json({ message: 'Error fetching announcements.' });
    }
};

function toggleDatePicker() {
    const datePickerContainer = document.getElementById('datePickerContainer');
    datePickerContainer.style.display = datePickerContainer.style.display === 'none' ? 'block' : 'none';
}