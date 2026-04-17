const admin = require('firebase-admin');
require('dotenv').config();

// Support both file-based and env-var-based credentials
let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // Production: parse from env var
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
    // Local dev: read from file
    const path = require('path');
    const fs = require('fs');
    const filePath = path.resolve(__dirname, 'firebaseServiceAccount.json');
    if (fs.existsSync(filePath)) {
        serviceAccount = require(filePath);
    }
}

if (serviceAccount) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin SDK Initialized.');
} else {
    console.warn('[FIREBASE WARNING]: No credentials found.');
}

module.exports = admin;
