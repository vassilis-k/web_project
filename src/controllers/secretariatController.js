const Thesis = require('../models/thesisModel');
const User = require('../models/userModel'); // Για μελλοντική εισαγωγή χρηστών

// 1) Προβολή ΔΕ: Προβάλλονται όλες οι ΔΕ που είναι σε κατάσταση «Ενεργή» και «Υπό Εξέταση».
exports.getSecretariatTheses = async (req, res) => {
    try {
        const theses = await Thesis.getSecretariatTheses();
        res.status(200).json(theses);
    } catch (error) {
        console.error('Error in getSecretariatTheses:', error);
        res.status(500).json({ message: 'Σφάλμα server κατά την ανάκτηση διπλωματικών.' });
    }
};

// 3) Διαχείριση διπλωματικής εργασίας - Ενεργή: Η γραμματεία καταχωρεί τον ΑΠ από τη ΓΣ
exports.updateGsApprovalProtocol = async (req, res) => {
    const { thesisId } = req.params; //thesisId
    const { gs_protocol } = req.body;

    if (!gs_protocol) {
        return res.status(400).json({ message: 'Απαιτείται ο Αριθμός Πρωτοκόλλου Γ.Σ.' });
    }

    try {
        const isUpdated = await Thesis.updateGsApprovalProtocol(thesisId, gs_protocol);
        if (isUpdated) {
            res.status(200).json({ message: 'Ο ΑΠ της Γ.Σ. καταχωρήθηκε επιτυχώς!' });
        } else {
            res.status(404).json({ message: 'Η διπλωματική δεν βρέθηκε ή δεν είναι σε κατάσταση "Ενεργή".' });
        }
    } catch (error) {
        console.error('Error in updateGsApprovalProtocol:', error);
        res.status(500).json({ message: 'Σφάλμα server κατά την καταχώριση του ΑΠ.' });
    }
};

// 3) Διαχείριση διπλωματικής εργασίας - Ενεργή: Η γραμματεία μπορεί να ακυρώσει την ανάθεση θέματος.
exports.cancelThesis = async (req, res) => {
    const { thesisId } = req.params;
    const { gs_number, gs_year, reason } = req.body;

    if (!gs_number || !gs_year || !reason) {
        return res.status(400).json({ message: 'Απαιτείται αριθμός Γ.Σ., έτος Γ.Σ. και λόγος ακύρωσης.' });
    }

    try {
        const isCancelled = await Thesis.cancelThesisBySecretariat(thesisId, gs_number, gs_year, reason);
        if (isCancelled) {
            res.status(200).json({ message: 'Η διπλωματική ακυρώθηκε επιτυχώς!' });
        } else {
            res.status(404).json({ message: 'Η διπλωματική δεν βρέθηκε ή δεν μπορεί να ακυρωθεί στην τρέχουσα κατάσταση.' });
        }
    } catch (error) {
        console.error('Error in cancelThesis:', error);
        res.status(500).json({ message: 'Σφάλμα server κατά την ακύρωση της διπλωματικής.' });
    }
};

// 3) Διαχείριση διπλωματικής εργασίας - Υπό Εξέταση: η γραμματεία μπορεί να αλλάξει την κατάσταση της ΔΕ σε «Περατωμένη».
exports.completeThesis = async (req, res) => {
    const { thesisId } = req.params;

    try {
        const isCompleted = await Thesis.markThesisAsCompleted(thesisId);
        if (isCompleted) {
            res.status(200).json({ message: 'Η διπλωματική ολοκληρώθηκε επιτυχώς!' });
        } else {
            // Αυτό μπορεί να συμβεί αν δεν έχουν καταχωρηθεί βαθμός ή repository URL
            res.status(400).json({ message: 'Αδυναμία ολοκλήρωσης: Βεβαιωθείτε ότι έχουν καταχωρηθεί ο τελικός βαθμός και ο σύνδεσμος αποθετηρίου.' });
        }
    } catch (error) {
        console.error('Error in completeThesis:', error);
        res.status(500).json({ message: 'Σφάλμα server κατά την ολοκλήρωση της διπλωματικής.' });
    }
};

// 2) Εισαγωγή δεδομένων: placeholder για αργότερα
exports.importUserData = async (req, res) => {
    // Η λογική για την εισαγωγή JSON θα έρθει εδώ
    // Θα περιλαμβάνει διάβασμα αρχείου JSON, επικύρωση και εισαγωγή χρηστών στη βάση.
    res.status(501).json({ message: 'Η λειτουργία εισαγωγής δεδομένων δεν έχει υλοποιηθεί ακόμα.' });
};