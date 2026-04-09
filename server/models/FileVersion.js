const mongoose = require('mongoose');

const fileVersionSchema = new mongoose.Schema({
    fileId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'File',
        required: true,
    },
    versionNumber: {
        type: Number,
        required: true,
    },
    filePath: {
        type: String,
        required: true,
    },
    hash: {
        type: String,
        required: true,
    },
    fileSize: {
        type: Number,
        required: true,
    },
    uploadedAt: {
        type: Date,
        default: Date.now,
    },
});

const FileVersion = mongoose.model('FileVersion', fileVersionSchema);
module.exports = FileVersion;
