const express = require('express');
const router = express.Router();
const multer = require('multer');
const { uploadFile, getFiles, getVersions, restoreVersion, getSuggestions, downloadVersion } = require('../controllers/fileController');
const authMiddleware = require('../middleware/auth');

// Multer in-memory storage for hashing before saving
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// All routes are protected by Firebase Auth
router.use(authMiddleware);

router.post('/upload', upload.single('file'), uploadFile);
router.get('/files', getFiles);
router.get('/files/:id/versions', getVersions);
router.post('/files/:id/restore/:versionId', restoreVersion);
router.get('/suggestions', getSuggestions);
router.get('/files/:id/download/:versionId', downloadVersion);

module.exports = router;
