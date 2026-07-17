import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.TURSO_DATABASE_URL || 'file:local.db';
const authToken = process.env.TURSO_AUTH_TOKEN || '';

const client = createClient({ url, authToken });

async function check() {
  // 1. Get user by username
  const userResult = await client.execute({
    sql: 'SELECT id, username FROM users WHERE username = ?',
    args: ['alexisbrou1@hotmail.fr']
  });

  if (userResult.rows.length === 0) {
    console.log("No user found with email 'alexisbrou1@hotmail.fr'");
    return;
  }

  const user = userResult.rows[0];
  console.log(`Found user: ID=${user.id}, Username=${user.username}`);

  // 2. Fetch cached digests for this user
  const digestsResult = await client.execute({
    sql: 'SELECT topic, digest_date, papers_json FROM cached_digests WHERE user_id = ?',
    args: [user.id]
  });

  console.log(`Found ${digestsResult.rows.length} digests:`);
  for (const row of digestsResult.rows) {
    console.log(`\nTopic: "${row.topic}" on Date: ${row.digest_date}`);
    const papers = JSON.parse(row.papers_json);
    papers.forEach((p, idx) => {
      console.log(`  Paper ${idx + 1}: "${p.title}"`);
      console.log(`    explanation: ${JSON.stringify(p.explanation)}`);
    });
  }
}

check().catch(console.error);
