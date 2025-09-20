Οδηγίες Εκτέλεσης – Σύστημα Υποστήριξης Διπλωματικών Εργασιών  
Μάθημα: Προγραμματισμός και Συστήματα στον Παγκόσμιο Ιστό

## Η ομάδα μας:
- Μπαλάση Δήμητρα (1093440)
- Κακαλής Βασίλειος (1080444)

---
## 1. Προαπαιτούμενα
* Node.js 18+ (προτείνεται LTS· λειτουργεί και με >=14 αλλά νεότερη έκδοση έχει καλύτερη υποστήριξη).  
* MySQL 5.7 ή 8.x  
* npm (περιλαμβάνεται με Node) ή yarn/pnpm αν προτιμάται

## 2. Κλωνοποίηση & Εγκατάσταση Εξαρτήσεων
```bash
git clone <repo-url>
cd web_project
npm install
```


## 3. Δημιουργία Βάσης & Αρχικών Δεδομένων
Εκτέλεσε τα SQL scripts με τη σειρά:
1. `database/db.sql` (δημιουργία schema & πινάκων)
2. `database/db_data.sql` (αρχικά δεδομένα / χρήστες κ.λπ.)

Μπορείς να τα τρέξεις με MySQL Workbench ή CLI:
```bash
mysql -u root -p < database/db.sql
mysql -u root -p < database/db_data.sql
```

## 4. Αρχείο Περιβάλλοντος (.env)
Το έργο φορτώνει μεταβλητές από `src/config/.env` (σύμφωνα με το `server.js` & `db.js`). Δημιούργησε το αρχείο:
```
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=project_web_local
SESSION_SECRET=change_me_secure
NODE_ENV=development
```

## 5. Εκκίνηση Εφαρμογής
Τρέξε τον server από τον φάκελο `src`:
```bash
node src/server.js
```

Μετά την εκκίνηση:  
http://localhost:3000 → θα ανακατευθύνει στη σελίδα ανακοινώσεων.


## 6. Ρόλοι & Δοκιμαστικοί Χρήστες
Το `db_data.sql` περιέχει προκαθορισμένους λογαριασμούς (π.χ. φοιτητής / καθηγητής / γραμματεία) τους οποίους μπορείς να χρησιμοποιήσεις για άμεσο login.


## 7. Δομή Backend (Σύνοψη)
* `src/server.js`: Εκκίνηση Express server, φόρτωση middleware & routes, static αρχεία.
* `src/config/db.js`: Pool σύνδεσης MySQL.
* `src/routes/`: Ορισμοί endpoints ανά ρόλο.
* `src/controllers/`: Επιχειρησιακή λογική ανά domain (auth, professor, student, secretariat, announcements).
* `src/models/`: Πρόσβαση / σύνθεση δεδομένων βάσης (thesis, users, notes, committee, logs).
* `public/`: Στατικά dashboards & assets.
* `uploads/`: Αρχεία (PDF περιγραφής θέματος, drafts, progress notes).


---

## Πανεπιστήμιο Πατρών - Τμήμα Μηχανικών Η/Υ και Πληροφορικής