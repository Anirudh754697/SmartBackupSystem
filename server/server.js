const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const connectDB = require('./config/db');
const fileRoutes = require('./routes/fileRoutes');
require('dotenv').config();

const app = express();

// Connect to MongoDB Atlas
connectDB();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Static storage folder for downloads (if needed, but using custom download endpoint)
app.use('/storage', express.static(path.join(__dirname, 'storage')));

// Routes
app.use('/api', fileRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'up' }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
