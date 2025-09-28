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

// Public feed: date range + JSON/XML output
exports.getAnnouncementsFeed = async (req, res) => {
    try {
        let { from, to, format = 'json', limit } = req.query;

        // Basic validation & normalization
        const today = new Date();
        const isoToday = today.toISOString().slice(0, 10);

        // Default range: last 30 days until today if none provided
        if (!to) to = isoToday;
        if (!from) {
            const d = new Date(to);
            d.setDate(d.getDate() - 30);
            from = d.toISOString().slice(0, 10);
        }

        // Simple YYYY-MM-DD regex check
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(from) || !dateRegex.test(to)) {
            return res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD.' });
        }

        if (from > to) {
            return res.status(400).json({ message: 'Parameter "from" must be <= "to".' });
        }

        // Hard safety limit (optional)
        const maxSpanDays = 366; // 1 year window
        const spanMs = new Date(to).getTime() - new Date(from).getTime();
        if (spanMs / (1000 * 60 * 60 * 24) > maxSpanDays) {
            return res.status(400).json({ message: 'Date range too large. Max 366 days.' });
        }

        let sql = `SELECT id, thesis_id, announcement_date, announcement_time, title, announcement_text, created_at
                   FROM thesis_announcements
                   WHERE announcement_date BETWEEN ? AND ?
                   ORDER BY announcement_date DESC, announcement_time DESC`;
        const params = [from, to];

        if (limit) {
            const l = parseInt(limit, 10);
            if (!Number.isNaN(l) && l > 0) {
                sql += ' LIMIT ?';
                params.push(l);
            }
        }

        const [rows] = await db.query(sql, params);

        // Build base feed object
        const feed = {
            meta: {
                generated_at: new Date().toISOString(),
                from,
                to,
                count: rows.length,
                format: format.toLowerCase() === 'xml' ? 'xml' : 'json'
            },
            announcements: rows.map(r => ({
                id: r.id,
                thesis_id: r.thesis_id,
                date: r.announcement_date,
                time: r.announcement_time,
                title: r.title,
                text: r.announcement_text
            }))
        };

        if (format.toLowerCase() === 'xml') {
            // Simple XML serialization (no external deps)
            const escape = (str = '') => String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');

            const xmlItems = feed.announcements.map(a => `    <announcement>
        <id>${a.id}</id>
        <thesis_id>${a.thesis_id}</thesis_id>
        <date>${a.date}</date>
        <time>${a.time}</time>
        <title>${escape(a.title)}</title>
        <text>${escape(a.text)}</text>
    </announcement>`).join('\n');

            const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<announcements_feed generated_at="${feed.meta.generated_at}" from="${from}" to="${to}" count="${feed.meta.count}">\n${xmlItems}\n</announcements_feed>`;
            res.setHeader('Content-Type', 'application/xml; charset=utf-8');
            return res.status(200).send(xml);
        }

        // Default JSON response
        res.status(200).json(feed);
    } catch (error) {
        console.error('Error generating announcements feed:', error);
        res.status(500).json({ message: 'Error generating feed.' });
    }
};
