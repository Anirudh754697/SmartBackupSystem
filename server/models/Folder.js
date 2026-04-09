const mongoose = require('mongoose');

const folderSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
    },
    name: {
        type: String,
        required: true,
    },
    parentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Folder',
        default: null,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// Compound index: unique folder name per user within same parent
folderSchema.index({ userId: 1, name: 1, parentId: 1 }, { unique: true });

const Folder = mongoose.model('Folder', folderSchema);
module.exports = Folder;
