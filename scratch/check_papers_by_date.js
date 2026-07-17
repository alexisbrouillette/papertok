import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.TURSO_DATABASE_URL || 'file:local.db';
const authToken = process.env.TURSO_AUTH_TOKEN || '';

const client = createClient({ url, authToken });

async function check() {
  const result = await client.execute({
    sql: 'SELECT digest_date, papers_json FROM cached_digests WHERE LOWER(topic) LIKE ? ORDER BY digest_date ASC',
    args: ['%intersection of multimodal%']
  });

  console.log(`Found ${result.rows.length} rows:`);
  result.rows.forEach(row => {
    console.log(`\nDate: ${row.digest_date}`);
    const papers = JSON.parse(row.papers_json);
    papers.forEach((p, idx) => {
      console.log(`  - Paper ${idx + 1}: "${p.title}"`);
    });
  });
}

check().catch(console.error);
