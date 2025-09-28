const Thesis = require('../models/thesisModel');

exports.getExaminationReport = async (req, res) => {
    const { thesisId } = req.params;

    try {
        // Ανάκτηση δεδομένων διπλωματικής και βαθμολογιών
        const thesis = await Thesis.getThesisDetailsWithCommittee(thesisId);

        if (!thesis) {
            return res.status(404).json({ message: 'Δεν βρέθηκαν δεδομένα για το πρακτικό εξέτασης.' });
        }

        // Δημιουργία HTML περιεχομένου
        const htmlContent = `
            <html>
            <head>
                <title>Πρακτικό Εξέτασης</title>
            </head>
            <body>
                <h1>Πρακτικό Εξέτασης</h1>
                <h2>Διπλωματική: ${thesis.title}</h2>
                <p>Φοιτητής: ${thesis.student_name} ${thesis.student_surname}</p>
                <p>Επιβλέπων: ${thesis.supervisor_name} ${thesis.supervisor_surname}</p>
                <h3>Βαθμολογίες Τριμελούς Επιτροπής</h3>
                <ul>
                    ${thesis.committee_members
                        .map(
                            (member) =>
                                `<li>${member.name} ${member.surname}: ${member.grade || 'Μη καταχωρημένος βαθμός'}</li>`
                        )
                        .join('')}
                </ul>
                <h3>Τελικός Βαθμός: ${thesis.grade || 'Μη διαθέσιμος'}</h3>
            </body>
            </html>
        `;

        res.status(200).send(htmlContent);
    } catch (error) {
        console.error('Error in getExaminationReport:', error);
        res.status(500).json({ message: 'Σφάλμα server κατά την ανάκτηση του πρακτικού εξέτασης.' });
    }
};

exports.getExaminationReportData = async (req, res) => {
    const { thesisId } = req.params;

    try {
        const thesis = await Thesis.getThesisDetailsWithCommittee(thesisId);

        if (!thesis) {
            return res.status(404).json({ message: 'Δεν βρέθηκαν δεδομένα για το πρακτικό εξέτασης.' });
        }

        // Επιστρέφουμε τα raw δεδομένα ως JSON για να τα παρουσιάσει το separate HTML
        res.status(200).json(thesis);
    } catch (error) {
        console.error('Error in getExaminationReportData:', error);
        res.status(500).json({ message: 'Σφάλμα server κατά την ανάκτηση του πρακτικού εξέτασης.' });
    }
};