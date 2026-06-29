import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import webpush from 'web-push';
import { dbAll, dbRun } from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env vars
dotenv.config({ path: join(__dirname, '../../.env') });

const TASK = process.env.TASK || 'reminders'; // 'reminders' is the only task left
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

// Helper to get local date string (YYYY-MM-DD)
function getLocalDateString() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  const localDate = new Date(d.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
}

async function runRefresh() {
  console.log(`[Cron] Starting daily job with TASK=${TASK}...`);

  // Configure Web Push if keys are present
  let pushConfigured = false;
  if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      'mailto:support@papertok.local',
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    );
    pushConfigured = true;
    console.log('[Cron] Web Push notifications configured.');
  } else {
    console.warn('[Cron] Warning: Web Push keys not found in env. Notifications will be skipped.');
  }

  try {
    if (TASK === 'reminders') {
      await sendReadingReminders(pushConfigured);
    }

    console.log('[Cron] Daily job finished successfully.');
    process.exit(0);
  } catch (err) {
    console.error('[Cron] Critical error running daily job:', err);
    process.exit(1);
  }
}

async function refreshAllDigests(pushConfigured) {
  console.log('[Cron] Starting: Refreshing all active digests...');
  try {
    // 1. Fetch all unique topics users have active progress in
    const rows = await dbAll('SELECT DISTINCT topic FROM reading_progress');
    const topics = rows.map(r => r.topic).filter(Boolean);

    if (topics.length === 0) {
      console.log('[Cron] No active user topics found in reading_progress. Nothing to pre-generate.');
      process.exit(0);
      return;
    }

    console.log(`[Cron] Found ${topics.length} active topics to refresh:`, topics);

    for (const topic of topics) {
      console.log(`[Cron] Refreshing topic: "${topic}"...`);
      try {
        await generateAndCacheDigest(topic, GEMINI_API_KEY, (progress, statusText) => {
          console.log(`  [Progress ${progress}%] ${statusText}`);
        });
        console.log(`[Cron] Successfully pre-generated and cached: "${topic}"`);
        console.log(`  [Cron] Successfully pre-generated and cached: "${topic}"`);

        // Dispatch notifications if push is configured
        if (pushConfigured) {
          const users = await dbAll('SELECT DISTINCT user_id FROM reading_progress WHERE LOWER(topic) = LOWER(?)', [topic]);
          console.log(`  [Push] Dispatching alerts to ${users.length} users interested in "${topic}"...`);
          console.log(`    [Push] Dispatching "new digest" alerts to ${users.length} users for "${topic}"...`);

          for (const u of users) {
            const subs = await dbAll('SELECT id, subscription_json FROM push_subscriptions WHERE user_id = ?', [u.user_id]);
            for (const s of subs) {
              try {
                const subscription = JSON.parse(s.subscription_json);
                const payload = JSON.stringify({
                  title: 'Landmark Digest Refreshed! 📚',
                  body: `Today's landmark papers on "${topic}" are ready to swipe!`,
                  title: 'Your new papers are here! 📚',
                  body: `Today's digest for "${topic}" is ready to explore.`,
                  url: '/'
                });
                await webpush.sendNotification(subscription, payload, {
                  headers: {
                    'Urgency': 'high'
                  }
                });
                console.log(`    [Push] Sent notification to user ${u.user_id} subscription ${s.id}`);
                console.log(`      [Push] Sent to user ${u.user_id} (sub ${s.id})`);
              } catch (pushErr) {
                if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
                  console.log(`    [Push] Subscription ${s.id} expired or invalid, deleting...`);
                  console.log(`      [Push] Subscription ${s.id} expired, deleting...`);
                  await dbRun('DELETE FROM push_subscriptions WHERE id = ?', [s.id]);
                } else {
                  console.error(`    [Push] Failed to send to subscription ${s.id}:`, pushErr.message);
                  console.error(`      [Push] Failed to send to subscription ${s.id}:`, pushErr.message);
                }
              }
            }
          }
        }
      } catch (err) {
        console.error(`[Cron] Failed to refresh topic "${topic}":`, err.message);
      }
    }
  } catch (err) {
    console.error('[Cron] A critical error occurred during digest refresh:', err);
    throw err; // Re-throw to be caught by the main handler
  }
}

    console.log('[Cron] Overnight digest pre-generation completed successfully.');
    process.exit(0);
async function sendReadingReminders(pushConfigured) {
  if (!pushConfigured) return;

  const today = getLocalDateString();
  console.log(`[Cron] Starting: Sending reading reminders for ${today}...`);

  try {
    const usersToRemind = await dbAll(
      `SELECT user_id FROM user_streaks WHERE last_read_date IS NULL OR last_read_date != ?`,
      [today]
    );

    if (usersToRemind.length > 0) {
      console.log(`  [Reminder] Found ${usersToRemind.length} user(s) to remind.`);
      const payload = JSON.stringify({
        title: 'Your daily papers are waiting! 👋',
        body: "Don't forget to read today to keep your streak alive!",
        url: '/'
      });

      for (const user of usersToRemind) {
        const subs = await dbAll('SELECT id, subscription_json FROM push_subscriptions WHERE user_id = ?', [user.user_id]);
        for (const s of subs) {
          try {
            const subscription = JSON.parse(s.subscription_json);
            await webpush.sendNotification(subscription, payload);
            console.log(`    [Reminder] Sent to user ${user.user_id} (sub ${s.id})`);
          } catch (pushErr) {
            if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
              console.log(`    [Reminder] Subscription ${s.id} expired, deleting...`);
              await dbRun('DELETE FROM push_subscriptions WHERE id = ?', [s.id]);
            } else {
              console.error(`    [Reminder] Failed to send to subscription ${s.id}:`, pushErr.message);
            }
          }
        }
      }
    } else {
      console.log('  [Reminder] No users to remind today. Great engagement!');
    }
  } catch (err) {
    console.error('[Cron] A critical error occurred during reminder sending:', err);
    throw err; // Re-throw to be caught by the main handler
  }
}

// Run the script
runRefresh();
