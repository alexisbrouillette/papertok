import 'dotenv/config';
import { dbGet, dbRun, dbAll } from '../db.js';
import { generateAndCacheDigest } from './digestService.js';

let isProcessing = false;

// Helper function to sleep
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Enqueue a digest pre-generation task.
 */
export async function enqueueDigestGeneration(userId, topic, priority = 0, digestDate = null) {
  try {
    const cleanTopic = topic.trim();
    
    // Resolve target digest date (default tomorrow if not provided)
    let targetDate = digestDate;
    if (!targetDate) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      targetDate = tomorrow.toISOString().split('T')[0];
    }

    // Insert or update priority if already pending
    await dbRun(`
      INSERT INTO generation_queue (user_id, topic, digest_date, status, priority, progress, status_text)
      VALUES (?, ?, ?, 'pending', ?, 0, 'Queued')
      ON CONFLICT(user_id, topic, digest_date, status) DO UPDATE SET priority = max(priority, excluded.priority)
    `, [userId, cleanTopic, targetDate, priority]);

    console.log(`[DigestQueue] Enqueued generation task for user ${userId}, topic "${cleanTopic}" (priority: ${priority})`);
    
    // Start processing if not already running
    triggerQueueRunner();
  } catch (err) {
    console.error('[DigestQueue] Failed to enqueue task:', err);
  }
}

/**
 * Trigger processing loop.
 */
export function triggerQueueRunner() {
  if (isProcessing) return;
  isProcessing = true;
  processQueue();
}

async function processQueue() {
  try {
    // 1. Fetch the oldest pending task, prioritising high priority tasks first
    const task = await dbGet(`
      SELECT * FROM generation_queue 
      WHERE status = 'pending' 
      ORDER BY priority DESC, id ASC 
      LIMIT 1
    `);

    if (!task) {
      console.log('[DigestQueue] No pending tasks in queue. Stopping runner.');
      isProcessing = false;
      return;
    }

    console.log(`[DigestQueue] Processing task ${task.id} (priority: ${task.priority}): user ${task.user_id}, topic "${task.topic}"`);
    
    // 2. Mark as processing
    await dbRun('UPDATE generation_queue SET status = \'processing\' WHERE id = ?', [task.id]);

    // 3. Fetch user's API key (fall back to env)
    const userKeys = await dbGet('SELECT gemini_key FROM user_keys WHERE user_id = ?', [task.user_id]);
    const geminiApiKey = (userKeys?.gemini_key && userKeys.gemini_key.trim() !== '')
      ? userKeys.gemini_key.trim()
      : process.env.GEMINI_API_KEY;

    if (!geminiApiKey) {
      throw new Error('No Gemini API key available for user or system.');
    }

    const digestDate = task.digest_date;

    // 4. Generate the digest (this caches it automatically inside sqlite database)
    await generateAndCacheDigest(task.topic, digestDate, geminiApiKey, async (progress, statusText) => {
      console.log(`  [DigestQueue Task ${task.id} - ${progress}%] ${statusText}`);
      try {
        await dbRun(
          'UPDATE generation_queue SET progress = ?, status_text = ? WHERE id = ?',
          [progress, statusText, task.id]
        );
      } catch (err) {
        console.error('[DigestQueue] Failed to update task progress:', err);
      }
    }, task.user_id);

    // 5. Mark as completed
    await dbRun('UPDATE generation_queue SET status = \'completed\' WHERE id = ?', [task.id]);
    console.log(`[DigestQueue] Task ${task.id} completed successfully for topic "${task.topic}".`);

  } catch (err) {
    console.error('[DigestQueue] Error processing task:', err);
    // Mark as failed instead of looping infinitely
    try {
      await dbRun('UPDATE generation_queue SET status = \'failed\' WHERE status = \'processing\'');
    } catch (dbErr) {
      console.error('[DigestQueue] Failed to mark task as failed:', dbErr);
    }
  }

  // 6. Gemini API protection delay: Sleep for 60 seconds unless a high priority task is waiting next!
  let sleepTime = 60000;
  try {
    const nextTask = await dbGet(`
      SELECT id, priority FROM generation_queue 
      WHERE status = 'pending' 
      ORDER BY priority DESC, id ASC 
      LIMIT 1
    `);
    if (nextTask && nextTask.priority > 0) {
      sleepTime = 2000; // Skip long delay for urgent user requests
      console.log(`[DigestQueue] High-priority task ${nextTask.id} is waiting next. Setting short wake-up delay of 2 seconds.`);
    }
  } catch (err) {
    console.error('[DigestQueue] Failed to check next task priority:', err);
  }

  console.log(`[DigestQueue] Rate-limit guard: Sleeping for ${sleepTime / 1000} seconds before next task...`);
  await sleep(sleepTime);

  // Continue to next task
  processQueue();
}

/**
 * Cleanup any tasks stuck in 'processing' status on server startup and resume queue runner.
 */
export async function initializeDigestQueue() {
  try {
    // Reset stuck tasks back to pending
    const resetRes = await dbRun('UPDATE generation_queue SET status = \'pending\' WHERE status = \'processing\'');
    if (resetRes.changes > 0) {
      console.log(`[DigestQueue] Reset ${resetRes.changes} stuck tasks back to pending.`);
    }

    // Check if there are tasks to run on startup
    triggerQueueRunner();
  } catch (err) {
    console.error('[DigestQueue] Failed to initialize queue:', err);
  }
}
