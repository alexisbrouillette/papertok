import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth.js';
import digestRouter from './routes/digest.js';
import progressRouter from './routes/progress.js';
import pushRouter from './routes/push.js';
import { startNotificationScheduler } from './services/notificationScheduler.js';
import { initializeDigestQueue } from './services/digestQueue.js';
import { dbReady } from './db.js'; // Trigger database initialization and import ready promise

import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Serve static assets in production
const distPath = join(__dirname, '../dist');
app.use(express.static(distPath));

app.use(cors({
  origin: '*', // For local dev, allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Routes
app.use('/api/auth', authRouter);
app.use('/api/digest', digestRouter);
app.use('/api/progress', progressRouter);
app.use('/api/push', pushRouter);

// Basic healthcheck
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date() });
});

// Fallback all non-API GET requests to index.html for client-side routing (Vite SPA)
app.get('/*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }
  res.sendFile(join(distPath, 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Internal Server Error.' });
});

app.listen(PORT, async () => {
  console.log(`PaperTok backend server running on http://localhost:${PORT}`);
  await dbReady; // Wait for SQLite schema tables to be fully created
  startNotificationScheduler();
  initializeDigestQueue();
});
