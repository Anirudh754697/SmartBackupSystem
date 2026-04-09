const path = require('path');
const fs = require('fs-extra');
const crypto = require('crypto');
const File = require('../models/File');
const FileVersion = require('../models/FileVersion');
const Folder = require('../models/Folder');

// Utility to generate SHA-256 hash from file buffer
const generateHash = (data) => {
    return crypto.createHash('sha256').update(data).digest('hex');
};

// ───────────────────────── FILE OPERATIONS ─────────────────────────

exports.uploadFile = async (req, res) => {
    try {
        const { uid } = req.user;
        const file = req.file;
        const folderId = req.body.folderId || null;

        if (!file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const originalName = file.originalname;
        const fileBuffer = file.buffer;
        const hash = generateHash(fileBuffer);

        // Check if file record exists for this user (same name + same folder)
        let fileDoc = await File.findOne({ userId: uid, fileName: originalName, folderId: folderId });
        let nextVersion = 1;
        let isDuplicate = false;

        if (fileDoc) {
            // Check for duplicate content (same hash)
            const duplicateVersion = await FileVersion.findOne({ 
                fileId: fileDoc._id, 
                hash: hash 
            });

            // Get last version number
            const lastVersion = await FileVersion.findOne({ fileId: fileDoc._id })
                .sort({ versionNumber: -1 });
            
            if (lastVersion) {
                nextVersion = lastVersion.versionNumber + 1;
            }

            // Flag if duplicate but still save it
            if (duplicateVersion) {
                isDuplicate = true;
            }
        } else {
            // Create new File entry
            fileDoc = new File({
                userId: uid,
                fileName: originalName,
                folderId: folderId
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

        const dupNote = isDuplicate ? ' (Note: identical content detected, saved as new version)' : '';
        res.status(201).json({
            message: `Version ${nextVersion} uploaded successfully.${dupNote}`,
            warning: isDuplicate,
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
        const folderId = req.query.folderId || null;

        const files = await File.find({ userId: uid, folderId: folderId }).sort({ createdAt: -1 });
        
        // Populate with latest version info
        const populatedFiles = await Promise.all(files.map(async (file) => {
            const latestVersion = await FileVersion.findOne({ fileId: file._id })
                .sort({ versionNumber: -1 });
            const versionCount = await FileVersion.countDocuments({ fileId: file._id });
            return {
                ...file.toObject(),
                latestVersion,
                versionCount
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

exports.deleteVersion = async (req, res) => {
    try {
        const { id, versionId } = req.params;
        
        const version = await FileVersion.findById(versionId);
        if (!version) {
            return res.status(404).json({ error: 'Version not found' });
        }

        // Delete the physical file
        try {
            await fs.remove(version.filePath);
            // Also try to clean up the version directory if empty
            const versionDir = path.dirname(version.filePath);
            const remaining = await fs.readdir(versionDir);
            if (remaining.length === 0) {
                await fs.remove(versionDir);
            }
        } catch (fsErr) {
            console.warn('File cleanup warning:', fsErr.message);
        }

        // Delete version from DB
        await FileVersion.findByIdAndDelete(versionId);

        // If no versions left, delete the file record too
        const remainingVersions = await FileVersion.countDocuments({ fileId: id });
        if (remainingVersions === 0) {
            await File.findByIdAndDelete(id);
            return res.json({ message: 'Version and file record deleted (no versions remaining)', fileDeleted: true });
        }

        res.json({ message: 'Version deleted successfully', fileDeleted: false });
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ error: 'Server error during delete' });
    }
};

exports.restoreVersion = async (req, res) => {
    try {
        const { id, versionId } = req.params;
        
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

        // Copy file to new version path
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

exports.moveFile = async (req, res) => {
    try {
        const { id } = req.params;
        const { folderId } = req.body; // null means root
        
        const file = await File.findById(id);
        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        file.folderId = folderId || null;
        await file.save();

        res.json({ message: 'File moved successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Server error moving file' });
    }
};

exports.getSuggestions = async (req, res) => {
    try {
        const { uid } = req.user;
        const files = await File.find({ userId: uid });
        const totalVersions = await FileVersion.countDocuments({ 
            fileId: { $in: files.map(f => f._id) } 
        });

        let suggestion = "Weekly Backup";
        if (totalVersions > 20) suggestion = "Daily Backup";
        else if (totalVersions > 5) suggestion = "Weekly Backup";
        else suggestion = "Monthly Backup";

        res.json({
            suggestion,
            reason: `Based on ${totalVersions} total versions across ${files.length} files.`
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error fetching suggestions' });
    }
};

exports.downloadVersion = async (req, res) => {
    try {
        const { id, versionId } = req.params;
        const version = await FileVersion.findById(versionId);
        const file = await File.findById(id);
        
        if (!version || !file) return res.status(404).json({ error: 'Version not found' });
        
        res.download(version.filePath, file.fileName);
    } catch (error) {
        res.status(500).json({ error: 'Server error during download' });
    }
};

// ───────────────────────── FOLDER OPERATIONS ─────────────────────────

exports.createFolder = async (req, res) => {
    try {
        const { uid } = req.user;
        const { name, parentId } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Folder name is required' });
        }

        const folder = new Folder({
            userId: uid,
            name: name.trim(),
            parentId: parentId || null
        });
        await folder.save();

        res.status(201).json(folder);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ error: 'A folder with this name already exists here' });
        }
        res.status(500).json({ error: 'Server error creating folder' });
    }
};

exports.getFolders = async (req, res) => {
    try {
        const { uid } = req.user;
        const parentId = req.query.parentId || null;

        const folders = await Folder.find({ userId: uid, parentId: parentId }).sort({ name: 1 });
        res.json(folders);
    } catch (error) {
        res.status(500).json({ error: 'Server error fetching folders' });
    }
};

exports.renameFolder = async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;

        const folder = await Folder.findById(id);
        if (!folder) return res.status(404).json({ error: 'Folder not found' });

        folder.name = name.trim();
        await folder.save();

        res.json(folder);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ error: 'A folder with this name already exists here' });
        }
        res.status(500).json({ error: 'Server error renaming folder' });
    }
};

exports.deleteFolder = async (req, res) => {
    try {
        const { id } = req.params;
        const { uid } = req.user;

        // Delete all files in this folder
        const files = await File.find({ folderId: id, userId: uid });
        for (const file of files) {
            const versions = await FileVersion.find({ fileId: file._id });
            for (const v of versions) {
                try { await fs.remove(v.filePath); } catch (e) {}
            }
            await FileVersion.deleteMany({ fileId: file._id });
        }
        await File.deleteMany({ folderId: id, userId: uid });

        // Delete sub-folders recursively
        const subFolders = await Folder.find({ parentId: id, userId: uid });
        for (const sub of subFolders) {
            // Recursive call via direct DB operations
            await deleteSubFolder(sub._id, uid);
        }

        await Folder.findByIdAndDelete(id);
        res.json({ message: 'Folder deleted successfully' });
    } catch (error) {
        console.error('Delete folder error:', error);
        res.status(500).json({ error: 'Server error deleting folder' });
    }
};

// Helper for recursive folder deletion
async function deleteSubFolder(folderId, uid) {
    const files = await File.find({ folderId, userId: uid });
    for (const file of files) {
        const versions = await FileVersion.find({ fileId: file._id });
        for (const v of versions) {
            try { await fs.remove(v.filePath); } catch (e) {}
        }
        await FileVersion.deleteMany({ fileId: file._id });
    }
    await File.deleteMany({ folderId, userId: uid });

    const subFolders = await Folder.find({ parentId: folderId, userId: uid });
    for (const sub of subFolders) {
        await deleteSubFolder(sub._id, uid);
    }
    await Folder.findByIdAndDelete(folderId);
}
