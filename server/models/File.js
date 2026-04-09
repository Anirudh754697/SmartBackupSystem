const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
    },
    fileName: {
        type: String,
        required: true,
    },
    folderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Folder',
        default: null,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

const File = mongoose.model('File', fileSchema);
module.exports = File;
