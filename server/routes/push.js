import 'dotenv/config';
import express from 'express';
import webpush from 'web-push';
import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { dbGet, dbRun, dbAll } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '../../.env');

const router = express.Router();

// Auto-generate VAPID Keys if they don't exist in .env
let vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY,
};

if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
  console.log('[Push] VAPID Keys not found. Generating new ones...');
  const generated = webpush.generateVAPIDKeys();
  vapidKeys.publicKey = generated.publicKey;
  vapidKeys.privateKey = generated.privateKey;

  // Read existing .env if it exists, or create new
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  // Ensure newline
  if (envContent && !envContent.endsWith('\n')) {
    envContent += '\n';
  }

  // Append new VAPID keys
  if (!envContent.includes('VAPID_PUBLIC_KEY')) {
    envContent += `VAPID_PUBLIC_KEY=${vapidKeys.publicKey}\n`;
  }
  if (!envContent.includes('VAPID_PRIVATE_KEY')) {
    envContent += `VAPID_PRIVATE_KEY=${vapidKeys.privateKey}\n`;
  }

  fs.writeFileSync(envPath, envContent, 'utf8');
  console.log('[Push] VAPID Keys written to .env file.');
  
  // Set them on process.env so Web Push knows them
  process.env.VAPID_PUBLIC_KEY = vapidKeys.publicKey;
  process.env.VAPID_PRIVATE_KEY = vapidKeys.privateKey;
}

// Configure Web Push with our keys and a contact email/URL
webpush.setVapidDetails(
  'mailto:support@papertok.local',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// 1. Expose public VAPID key to the frontend
router.get('/vapid-key', requireAuth, (req, res) => {
  res.json({ publicKey: vapidKeys.publicKey });
});

// 2. Subscribe endpoint
router.post('/subscribe', requireAuth, async (req, res) => {
  const { subscription } = req.body;
  const userId = req.userId;

  if (!subscription) {
    return res.status(400).json({ error: 'Subscription object is required.' });
  }

  try {
    const subscriptionJson = JSON.stringify(subscription);

    // Save user's subscription, ignore if it already exists
    await dbRun(`
      INSERT OR IGNORE INTO push_subscriptions (user_id, subscription_json)
      VALUES (?, ?)
    `, [userId, subscriptionJson]);

    res.status(201).json({ success: true });
  } catch (err) {
    console.error('[Push] Failed to save subscription:', err);
    res.status(500).json({ error: 'Failed to save push subscription.' });
  }
});

// 3. Unsubscribe endpoint (optional, good practice)
router.post('/unsubscribe', requireAuth, async (req, res) => {
  const { subscription } = req.body;
  const userId = req.userId;

  if (!subscription) {
    return res.status(400).json({ error: 'Subscription object is required.' });
  }

  try {
    const subscriptionJson = JSON.stringify(subscription);
    await dbRun(`
      DELETE FROM push_subscriptions
      WHERE user_id = ? AND subscription_json = ?
    `, [userId, subscriptionJson]);

    res.json({ success: true });
  } catch (err) {
    console.error('[Push] Failed to unsubscribe:', err);
    res.status(500).json({ error: 'Failed to unsubscribe.' });
  }
});

// 4. Test notification endpoint
router.post('/test', requireAuth, async (req, res) => {
  const userId = req.userId;

  try {
    const subs = await dbAll('SELECT id, subscription_json FROM push_subscriptions WHERE user_id = ?', [userId]);

    if (subs.length === 0) {
      return res.status(400).json({ error: 'No active push subscriptions found for this user.' });
    }

    const payload = JSON.stringify({
      title: 'Test Alert! 🔔',
      body: 'This is a test push notification from PaperTok. It works!',
      url: '/'
    });

    let successCount = 0;
    for (const s of subs) {
      try {
        const subscription = JSON.parse(s.subscription_json);
        await webpush.sendNotification(subscription, payload, {
          headers: {
            'Urgency': 'high'
          }
        });
        successCount++;
      } catch (pushErr) {
        if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
          await dbRun('DELETE FROM push_subscriptions WHERE id = ?', [s.id]);
        } else {
          console.error(`[Push Test] Failed to send to sub ${s.id}:`, pushErr.message);
        }
      }
    }

    res.json({ success: true, sentCount: successCount });
  } catch (err) {
    console.error('[Push Test] Failed to trigger test notification:', err);
    res.status(500).json({ error: 'Failed to send test push notification.' });
  }
});

export default router;
export { vapidKeys };
