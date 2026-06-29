import 'dotenv/config';
import webpush from 'web-push';
import { dbAll, dbGet, dbRun } from '../db.js';

// Configure VAPID details if keys exist
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

let pushConfigured = false;
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:support@papertok.local',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
  pushConfigured = true;
}

// Helper to get local date string (YYYY-MM-DD) based on server local time
function getLocalDateString() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  const localDate = new Date(d.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
}

async function sendPushNotification(userId, title, body) {
  const subs = await dbAll('SELECT id, subscription_json FROM push_subscriptions WHERE user_id = ?', [userId]);
  for (const s of subs) {
    try {
      const subscription = JSON.parse(s.subscription_json);
      const payload = JSON.stringify({
        title,
        body,
        url: '/'
      });
      await webpush.sendNotification(subscription, payload, {
        headers: { 'Urgency': 'high' }
      });
      console.log(`[NotificationScheduler] Sent push to user ${userId}, subscription ${s.id}`);
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        console.log(`[NotificationScheduler] Subscription ${s.id} expired, deleting...`);
        await dbRun('DELETE FROM push_subscriptions WHERE id = ?', [s.id]);
      } else {
        console.error(`[NotificationScheduler] Error sending to subscription ${s.id}:`, err.message);
      }
    }
  }
}

export async function checkAndSendNotifications() {
  if (!pushConfigured) {
    console.warn('[NotificationScheduler] Push notifications are not configured (missing VAPID keys). Skipping checks.');
    return;
  }

  console.log('[NotificationScheduler] Running periodic notifications check...');

  try {
    const users = await dbAll('SELECT id, username FROM users');
    const todayStr = getLocalDateString();
    const now = new Date();

    for (const user of users) {
      // 1. Fetch user's streaks and notification logs
      let streakRow = await dbGet('SELECT * FROM user_streaks WHERE user_id = ?', [user.id]);
      if (!streakRow) {
        // Initialize if not exists
        await dbRun('INSERT OR IGNORE INTO user_streaks (user_id) VALUES (?)', [user.id]);
        streakRow = await dbGet('SELECT * FROM user_streaks WHERE user_id = ?', [user.id]);
      }

      // 2. Fetch the most recently read topic to determine progress
      const lastReadTopicRow = await dbGet(`
        SELECT topic, MAX(read_at) as last_read_time 
        FROM reading_progress 
        WHERE user_id = ? 
        GROUP BY topic 
        ORDER BY last_read_time DESC 
        LIMIT 1
      `, [user.id]);

      if (lastReadTopicRow) {
        const topic = lastReadTopicRow.topic;
        const lastReadTime = new Date(lastReadTopicRow.last_read_time + ' UTC'); // Parse correctly

        // Check if user has read all 5 categories for this topic
        const progressCountRow = await dbGet(`
          SELECT COUNT(DISTINCT category_key) as read_count 
          FROM reading_progress 
          WHERE user_id = ? AND topic = ?
        `, [user.id, topic]);

        const isDigestComplete = progressCountRow && progressCountRow.read_count === 5;

        if (isDigestComplete) {
          // Target release: 7:00 AM of the next calendar day after finishing
          const lastReadDateStr = lastReadTopicRow.last_read_time.split(' ')[0]; // YYYY-MM-DD (UTC format from SQLite)
          const currentHour = now.getHours();

          if (todayStr > lastReadDateStr && currentHour >= 7) {
            // Check if we already sent the unlock notification for this digest completion cycle
            const lastAlertSentTime = streakRow.last_unlock_alert_sent_at 
              ? new Date(streakRow.last_unlock_alert_sent_at) 
              : null;

            if (!lastAlertSentTime || lastAlertSentTime < lastReadTime) {
              console.log(`[NotificationScheduler] User ${user.username} finished digest yesterday. Unlocking next at 7:00 AM.`);
              await sendPushNotification(
                user.id,
                'New Papers Available! 📚',
                `Your next set of landmark papers is unlocked. Start swiping!`
              );
              await dbRun(
                'UPDATE user_streaks SET last_unlock_alert_sent_at = CURRENT_TIMESTAMP WHERE user_id = ?',
                [user.id]
              );
            }
          }
        }
      }

      // --- CONDITION 2: DAILY REMINDER (if they haven't read anything today) ---
      const hasReadToday = streakRow.last_read_date === todayStr;
      const currentHour = now.getHours();

      // Only send reminders in the evening (e.g. 7 PM or later, i.e. >= 19:00 local server time)
      if (!hasReadToday && currentHour >= 19) {
        const lastReminderDate = streakRow.last_reminder_sent_date;
        if (lastReminderDate !== todayStr) {
          console.log(`[NotificationScheduler] User ${user.username} hasn't read today. Sending daily reminder.`);
          await sendPushNotification(
            user.id,
            'Daily Reading Reminder ⏳',
            "Don't break your streak! Keep learning with today's landmark papers."
          );
          await dbRun(
            'UPDATE user_streaks SET last_reminder_sent_date = ? WHERE user_id = ?',
            [todayStr, user.id]
          );
        }
      }
    }
  } catch (err) {
    console.error('[NotificationScheduler] Error running notification check:', err);
  }
}

// Start scheduler to run check every 15 minutes
export function startNotificationScheduler() {
  // Run initial check on server startup after a small delay
  setTimeout(() => {
    checkAndSendNotifications();
  }, 10000);

  // Repeat every 15 minutes
  setInterval(() => {
    checkAndSendNotifications();
  }, 15 * 60 * 1000);
}
