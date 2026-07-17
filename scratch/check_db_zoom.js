import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function main() {
  const result = await client.execute('SELECT * FROM generation_queue ORDER BY id DESC');
  console.log(`Found ${result.rows.length} queue tasks.`);
  for (const row of result.rows) {
    console.log(`Task ID: ${row.id}, User ID: ${row.user_id}, Topic: "${row.topic}", Status: ${row.status}, Progress: ${row.progress}% (${row.status_text})`);
  }
  process.exit(0);
}

main().catch(console.error);
