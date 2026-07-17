import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.TURSO_DATABASE_URL || 'file:local.db';
const authToken = process.env.TURSO_AUTH_TOKEN || '';

const client = createClient({ url, authToken });

async function main() {
  console.log("Clearing all progress and cached data for all users...");
  
  // Clear reading progress
  const progressResult = await client.execute("DELETE FROM reading_progress");
  console.log(`- Cleared ${progressResult.rowsAffected} rows from reading_progress.`);
  
  // Reset streaks
  const streakResult = await client.execute("DELETE FROM user_streaks");
  console.log(`- Cleared streaks.`);
  
  // Clear cached digests
  const cachedResult = await client.execute("DELETE FROM cached_digests");
  console.log(`- Cleared cached digests.`);
  
  // Clear queue
  const queueResult = await client.execute("DELETE FROM generation_queue");
  console.log(`- Cleared queue tasks.`);
  
  console.log("Database reset complete. Ready to start fresh!");
}

main().catch(console.error);
