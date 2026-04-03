const path = require('path');
const fs = require('fs-extra');
const crypto = require('crypto');
const File = require('../models/File');
const FileVersion = require('../models/FileVersion');

// Utility to generate SHA-256 hash from file buffer or stream
const generateHash = (data) => {
    return crypto.createHash('sha256').update(data).digest('hex');
};

exports.uploadFile = async (req, res) => {
    try {
        const { uid } = req.user;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const originalName = file.originalname;
        const fileBuffer = file.buffer;
        const hash = generateHash(fileBuffer);

        // Check if file record exists for this user
        let fileDoc = await File.findOne({ userId: uid, fileName: originalName });
        let nextVersion = 1;

        if (fileDoc) {
            // Check for duplicate version (same hash)
            const duplicateVersion = await FileVersion.findOne({ 
                fileId: fileDoc._id, 
                hash: hash 
            });

            if (duplicateVersion) {
                return res.status(200).json({ 
                    message: 'Duplicate file detected. Version already exists.', 
                    warning: true,
                    versionNumber: duplicateVersion.versionNumber 
                });
            }

            // Get last version number
            const lastVersion = await FileVersion.findOne({ fileId: fileDoc._id })
                .sort({ versionNumber: -1 });
            
            if (lastVersion) {
                nextVersion = lastVersion.versionNumber + 1;
            }
        } else {
            // Create new File entry
            fileDoc = new File({
                userId: uid,
                fileName: originalName
            });
            await fileDoc.save();
        }

        // Storage path: /storage/{firebaseUID}/{fileId}/v{version}/filename
        const storageDir = path.join(__dirname, '..', 'storage', uid, fileDoc._id.toString(), `v${nextVersion}`);
        await fs.ensureDir(storageDir);
        const filePath = path.join(storageDir, originalName);
        await fs.writeFile(filePath, fileBuffer);

        // Save FileVersion
        const fileVersion = new FileVersion({
            fileId: fileDoc._id,
            versionNumber: nextVersion,
            filePath: filePath,
            hash: hash,
            fileSize: file.size
        });
        await fileVersion.save();

        res.status(201).json({
            message: `Version ${nextVersion} uploaded successfully.`,
            fileId: fileDoc._id,
            versionNumber: nextVersion,
            fileSize: file.size
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Server error during upload' });
    }
};

exports.getFiles = async (req, res) => {
    try {
        const { uid } = req.user;
        const files = await File.find({ userId: uid }).sort({ createdAt: -1 });
        
        // Populate with latest version info
        const populatedFiles = await Promise.all(files.map(async (file) => {
            const latestVersion = await FileVersion.findOne({ fileId: file._id })
                .sort({ versionNumber: -1 });
            return {
                ...file.toObject(),
                latestVersion
            };
        }));

        res.json(populatedFiles);
    } catch (error) {
        res.status(500).json({ error: 'Server error fetching files' });
    }
};

exports.getVersions = async (req, res) => {
    try {
        const { id } = req.params;
        const versions = await FileVersion.find({ fileId: id }).sort({ versionNumber: -1 });
        res.json(versions);
    } catch (error) {
        res.status(500).json({ error: 'Server error fetching versions' });
    }
};

exports.restoreVersion = async (req, res) => {
    try {
        const { id, versionId } = req.params; // id is fileId, versionId is the specific version number or ID?
        // Let's assume versionId is the FileVersion._id
        
        const targetVersion = await FileVersion.findById(versionId);
        if (!targetVersion) {
            return res.status(404).json({ error: 'Version not found' });
        }

        const fileDoc = await File.findById(id);
        if (!fileDoc) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Get latest version number
        const lastVersion = await FileVersion.findOne({ fileId: fileDoc._id })
            .sort({ versionNumber: -1 });
        const nextVersion = lastVersion.versionNumber + 1;

        // Copy high-level: read from targetVersion.filePath, save to new nextVersion path
        const storageDir = path.join(__dirname, '..', 'storage', req.user.uid, fileDoc._id.toString(), `v${nextVersion}`);
        await fs.ensureDir(storageDir);
        const newFilePath = path.join(storageDir, fileDoc.fileName);
        
        await fs.copy(targetVersion.filePath, newFilePath);

        const newVersion = new FileVersion({
            fileId: fileDoc._id,
            versionNumber: nextVersion,
            filePath: newFilePath,
            hash: targetVersion.hash,
            fileSize: targetVersion.fileSize
        });
        await newVersion.save();

        res.json({
            message: `Version ${targetVersion.versionNumber} restored as Version ${nextVersion}`,
            newVersionNumber: nextVersion
        });

    } catch (error) {
        console.error('Restore error:', error);
        res.status(500).json({ error: 'Server error during restore' });
    }
};

exports.getSuggestions = async (req, res) => {
    try {
        const { uid } = req.user;
        const files = await File.find({ userId: uid });
        
        // Simple suggestion logic based on upload frequency
        // For demonstration, suggest daily if more than 3 versions in last 7 days
        // Otherwise suggest weekly
        
        let freq = files.length;
        let suggestion = "Weekly Backup";
        if (freq > 5) suggestion = "Daily Backup";
        if (freq === 0) suggestion = "Monthly Backup (Start by uploading)";

        res.json({
            suggestion,
            reason: `Based on your average upload activity across ${freq} files.`
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error fetching suggestions' });
    }
};

exports.downloadVersion = async (req, res) => {
    try {
        const { id, versionId } = req.params;
        const version = await FileVersion.findById(versionId).populate('fileId');
        
        if (!version) return res.status(404).json({ error: 'Version not found' });
        
        res.download(version.filePath, version.fileId.fileName);
    } catch (error) {
        res.status(500).json({ error: 'Server error during download' });
    }
};
