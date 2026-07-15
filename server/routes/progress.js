import express from 'express';
import { dbGet, dbRun, dbAll } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { enqueueDigestGeneration } from '../services/digestQueue.js';

const router = express.Router();

// Helper to get local date string (YYYY-MM-DD)
function getLocalDateString(dayOffset = 0) {
  const d = new Date();
  if (dayOffset !== 0) {
    d.setDate(d.getDate() + dayOffset);
  }
  const offset = d.getTimezoneOffset();
  const localDate = new Date(d.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
}

// Helper to get yesterday's local date string (YYYY-MM-DD)
function getYesterdayDateString(dayOffset = 0) {
  const d = new Date();
  d.setDate(d.getDate() - 1 + dayOffset);
  const offset = d.getTimezoneOffset();
  const localDate = new Date(d.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
}

// 1. Mark a paper/category as read, and update daily streaks
router.post('/read', requireAuth, async (req, res) => {
  const { topic, paperTitle, categoryKey, debugDayOffset } = req.body;
  const userId = req.userId;

  if (!topic || !paperTitle || !categoryKey) {
    return res.status(400).json({ error: 'topic, paperTitle, and categoryKey are required.' });
  }

  try {
    // Insert reading progress (ignore duplicates due to UNIQUE constraint)
    await dbRun(`
      INSERT OR IGNORE INTO reading_progress (user_id, topic, paper_title, category_key)
      VALUES (?, ?, ?, ?)
    `, [userId, topic, paperTitle, categoryKey]);

    // Handle streak update
    let streakRow = await dbGet('SELECT current_streak, last_read_date FROM user_streaks WHERE user_id = ?', [userId]);
    
    if (!streakRow) {
      // Fallback: create streak entry if not exists
      await dbRun('INSERT INTO user_streaks (user_id, current_streak, last_read_date) VALUES (?, 0, "")', [userId]);
      streakRow = { current_streak: 0, last_read_date: '' };
    }

    const dayOffset = Number(debugDayOffset) || 0;
    const today = getLocalDateString(dayOffset);
    const yesterday = getYesterdayDateString(dayOffset);
    let newStreak = streakRow.current_streak;
    let updateNeeded = false;

    if (streakRow.last_read_date === today) {
      // Already read today, streak is preserved but not incremented
    } else if (streakRow.last_read_date === yesterday) {
      // Read yesterday, increment streak
      newStreak += 1;
      updateNeeded = true;
    } else {
      // Streak broken or new user, reset to 1
      newStreak = 1;
      updateNeeded = true;
    }

    if (updateNeeded) {
      await dbRun(`
        UPDATE user_streaks
        SET current_streak = ?, last_read_date = ?
        WHERE user_id = ?
      `, [newStreak, today, userId]);
    }

    res.json({
      success: true,
      streak: {
        currentStreak: newStreak,
        lastReadDate: updateNeeded ? today : streakRow.last_read_date
      }
    });
  } catch (err) {
    console.error('Failed to update reading progress:', err);
    res.status(500).json({ error: 'Failed to record progress.' });
  }
});

// 2. Get read history and streak stats
router.get('/', requireAuth, async (req, res) => {
  const userId = req.userId;

  try {
    const streakRow = await dbGet('SELECT current_streak, last_read_date FROM user_streaks WHERE user_id = ?', [userId]);
    const readPapers = await dbAll('SELECT topic, paper_title, category_key, read_at FROM reading_progress WHERE user_id = ? ORDER BY read_at DESC', [userId]);

    // Check if the streak is broken (i.e. more than 1 day has passed since last read date)
    let currentStreak = streakRow?.current_streak || 0;
    const lastRead = streakRow?.last_read_date;
    
    if (lastRead) {
      const yesterday = getYesterdayDateString();
      if (lastRead < yesterday) {
        // Streak broken, reset in DB
        currentStreak = 0;
        await dbRun('UPDATE user_streaks SET current_streak = 0 WHERE user_id = ?', [userId]);
      }
    }

    res.json({
      streak: {
        currentStreak,
        lastReadDate: lastRead || null
      },
      readPapers
    });
  } catch (err) {
    console.error('Failed to retrieve progress:', err);
    res.status(500).json({ error: 'Failed to retrieve progress details.' });
  }
});

// 3. Enqueue digest generation for a user
router.post('/enqueue', requireAuth, async (req, res) => {
  const { topic } = req.body;
  const userId = req.userId;

  if (!topic) {
    return res.status(400).json({ error: 'topic is required.' });
  }

  try {
    await enqueueDigestGeneration(userId, topic);
    res.json({ success: true, message: 'Digest generation queued.' });
  } catch (err) {
    console.error('Failed to enqueue generation:', err);
    res.status(500).json({ error: 'Failed to enqueue generation.' });
  }
});

export default router;
