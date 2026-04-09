const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
    uploadFile, getFiles, getVersions, restoreVersion,
    getSuggestions, downloadVersion, deleteVersion, moveFile,
    createFolder, getFolders, renameFolder, deleteFolder
} = require('../controllers/fileController');
const authMiddleware = require('../middleware/auth');

// Multer in-memory storage for hashing before saving
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// All routes are protected by Firebase Auth
router.use(authMiddleware);

// File routes
router.post('/upload', upload.single('file'), uploadFile);
router.get('/files', getFiles);
router.get('/files/:id/versions', getVersions);
router.post('/files/:id/restore/:versionId', restoreVersion);
router.delete('/files/:id/versions/:versionId', deleteVersion);
router.patch('/files/:id/move', moveFile);
router.get('/files/:id/download/:versionId', downloadVersion);

// Folder routes
router.post('/folders', createFolder);
router.get('/folders', getFolders);
router.patch('/folders/:id', renameFolder);
router.delete('/folders/:id', deleteFolder);

// Suggestions
router.get('/suggestions', getSuggestions);

module.exports = router;
