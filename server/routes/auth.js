import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { dbGet, dbRun } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-super-secret-key';

// 1. User Registration
router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password || username.trim() === '' || password.trim() === '') {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    const existing = await dbGet('SELECT id FROM users WHERE username = ?', [username.trim()]);
    if (existing) {
      return res.status(400).json({ error: 'Username is already taken.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    const result = await dbRun('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username.trim(), hash]);
    const userId = result.lastID;

    // Create user streak entry
    await dbRun('INSERT INTO user_streaks (user_id) VALUES (?)', [userId]);

    const token = jwt.sign({ userId, username: username.trim() }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, username: username.trim() });
  } catch (err) {
    console.error('Registration failed:', err);
    res.status(500).json({ error: 'Failed to create user account. Please try again.' });
  }
});

// 2. User Login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    const user = await dbGet('SELECT * FROM users WHERE username = ?', [username.trim()]);
    if (!user) {
      return res.status(400).json({ error: 'Invalid username or password.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(400).json({ error: 'Invalid username or password.' });
    }

    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, username: user.username });
  } catch (err) {
    console.error('Login failed:', err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// 3. Save User API Keys
router.post('/keys', requireAuth, async (req, res) => {
  const { geminiKey, s2Key } = req.body;
  const userId = req.userId;

  if (!geminiKey || geminiKey.trim() === '') {
    return res.status(400).json({ error: 'Gemini API Key is required.' });
  }

  // Validate the key on the server
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(geminiKey.trim());
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
      generationConfig: { maxOutputTokens: 5 }
    });
    if (!result.response.text()) {
      throw new Error('Key validation failed.');
    }
  } catch (err) {
    console.error('API key validation failed on server:', err.message);
    return res.status(400).json({ error: 'Invalid Gemini API Key. Could not authenticate.' });
  }

  try {
    await dbRun(
      'INSERT OR REPLACE INTO user_keys (user_id, gemini_key, s2_key) VALUES (?, ?, ?)',
      [userId, geminiKey.trim(), s2Key || '']
    );
    res.json({ success: true, message: 'API keys saved successfully.' });
  } catch (err) {
    console.error('Failed to save API keys:', err);
    res.status(500).json({ error: 'Failed to save API keys.' });
  }
});

// 4. Get User API Keys
router.get('/keys', requireAuth, async (req, res) => {
  const userId = req.userId;

  try {
    const keys = await dbGet('SELECT gemini_key, s2_key FROM user_keys WHERE user_id = ?', [userId]);
    res.json({
      geminiKey: keys?.gemini_key || '',
      s2Key: keys?.s2_key || '',
      hasSystemKey: !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '')
    });
  } catch (err) {
    console.error('Failed to retrieve API keys:', err);
    res.status(500).json({ error: 'Failed to retrieve API keys.' });
  }
});

export default router;
