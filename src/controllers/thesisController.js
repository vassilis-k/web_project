const Thesis = require('../models/thesisModel');

exports.getExaminationReport = async (req, res) => {
    const { thesisId } = req.params;

    try {
        // Ανάκτηση δεδομένων διπλωματικής και βαθμολογιών
        const thesis = await Thesis.getThesisDetailsWithCommittee(thesisId);

        if (!thesis) {
            return res.status(404).json({ message: 'Δεν βρέθηκαν δεδομένα για το πρακτικό εξέτασης.' });
        }


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