const bcrypt = require('bcryptjs');

const plainPassword = 'secretariat123'; // The password you want to hash
const saltRounds = 10; // Number of salt rounds

bcrypt.hash(plainPassword, saltRounds, (err, hash) => {
    if (err) {
        console.error('Error hashing password:', err);
        return;
    }
    console.log('Hashed Password:', hash);
});