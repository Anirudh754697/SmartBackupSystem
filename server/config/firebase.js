const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './config/firebaseServiceAccount.json';
const fullPath = path.resolve(__dirname, '..', serviceAccountPath);

if (fs.existsSync(fullPath)) {
    const serviceAccount = require(fullPath);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin SDK Initialized Successfully.');
} else {
    console.warn(`
[FIREBASE WARNING]: Service account file not found at ${fullPath}.
Auth middleware will fail until this is fixed.
Please place your Firebase Service Account JSON in server/config/firebaseServiceAccount.json
`);
}

module.exports = admin;
