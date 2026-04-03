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
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

const File = mongoose.model('File', fileSchema);
module.exports = File;
