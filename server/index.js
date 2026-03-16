require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://127.0.0.1:3001',
  credentials: true,
}));
app.use(express.json());

app.use('/auth', authRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Serve the frontend static files from the project root
const frontendPath = path.join(__dirname, '..');
app.use(express.static(frontendPath));

// Fallback: serve index page for any non-API route
app.get('*', (_req, res) => {
  res.sendFile(path.join(frontendPath, 'spotify-stats.html'));
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`PrintSound running at http://127.0.0.1:${PORT}`);
});
