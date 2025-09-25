const Thesis = require('../models/thesisModel');
const User = require('../models/userModel');
const bcrypt = require('bcryptjs');

// 2) Εισαγωγή δεδομένων: Δίνεται η δυνατότητα εισαγωγής αρχείου JSON που περιλαμβάνει τις προσωπικές πληροφορίες των φοιτητών και διδασκόντων.
exports.importUsers = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'Δεν επιλέχθηκε αρχείο.' });
    }

    try {
        const fileContent = req.file.buffer.toString('utf8');
        const users = JSON.parse(fileContent);

        if (!Array.isArray(users)) {
            return res.status(400).json({ message: 'Το αρχείο JSON πρέπει να περιέχει έναν πίνακα χρηστών.' });
        }

        // Hash passwords before inserting; track how many without password (skipped on insert)
        let skippedMissingPassword = 0;
        const usersToInsert = await Promise.all(users.map(async (user) => {
            if (!user.password) {
                console.warn(`User ${user.email} has no password. Skipping password hashing.`);
                skippedMissingPassword += 1;
                return user;
            }
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(user.password, salt);
            return {
                ...user,
                password: hashedPassword,
            };
        }));

        const result = await User.bulkInsertOrUpdate(usersToInsert);

        const baseMessage = `Η εισαγωγή ολοκληρώθηκε. ${result.inserted} νέοι χρήστες προστέθηκαν, ${result.updated} χρήστες ενημερώθηκαν.`;
        const skipMessage = skippedMissingPassword > 0 ? ` Παραλείφθηκαν ${skippedMissingPassword} εγγραφές χωρίς κωδικό (μόνο για νέους χρήστες).` : '';
        res.status(201).json({ 
            message: baseMessage + skipMessage,
            skippedMissingPassword,
            ...result 
        });

    } catch (error) {
        console.error('Error importing users:', error);
        if (error instanceof SyntaxError) {
            return res.status(400).json({ message: 'Μη έγκυρη μορφή JSON.' });
        }
        // Multer file size error
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ message: 'Το αρχείο είναι πολύ μεγάλο (όριο 2MB).' });
        }
        res.status(500).json({ message: 'Σφάλμα server κατά την εισαγωγή των χρηστών. Ελέγξτε τα πεδία του JSON (null αντί για undefined).' });
    }
};

// 1) Προβολή ΔΕ: Προβάλλονται όλες οι ΔΕ που είναι σε κατάσταση «Ενεργή» και «Υπό Εξέταση».
exports.getThesesForOverview = async (req, res) => {
    try {
        const theses = await Thesis.getSecretariatThesesWithDetails();
        res.status(200).json(theses);
    } catch (error) {
        console.error('Error in getThesesForOverview:', error);
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