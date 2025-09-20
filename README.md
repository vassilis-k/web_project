Οδηγίες Εκτέλεσης για την εργασία στο Μάθημα Προγραμματισμός και Συστήματα στον Παγκόσμιο Ιστό 
- Σύστημα Υποστήριξης Διπλωματικών Εργασιών -

-- Μπαλάση Δήμητρα, 1093440
-- Κακαλής Βασίλης, 1080444


# Προαπαιτούμενα #
- Node.js (έκδοση 14 ή νεότερη)
- MySQL (έκδοση 5.7 ή νεότερη)
- npm (ή yarn) για τη διαχείριση εξαρτήσεων

# Ρύθμιση Περιβάλλοντος #
Στο αρχείο /config/.env προσθέστε τις κατάλληλες μεταβλητές:
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=project_web_local
SESSION_SECRET=your_secret_key
NODE_ENV=development

# Εκτέλεση #
Αρχικά πρέπει τα αρχεία /database/db.sql και /database/db_data.sql να εκτελεστούν σε ένα mySQL περιβάλλον της επιλογής σας (η ομάδα μας χρησιμοποίησε mySQL Workbench). Έπειτα, εκτελέστε τις παρακάτω εντολές στο Terminal:
- cd .../src/config
- node db.js
- cd .../src
- node node server.js
Στη συνέχεια ακολουθείτε το link http://localhost:3000.


## Πανεπιστήμιο Πατρών - Τμήμα Μηχανικών Η/Υ και Πληροφορικής