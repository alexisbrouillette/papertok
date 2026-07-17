import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.TURSO_DATABASE_URL || 'file:local.db';
const authToken = process.env.TURSO_AUTH_TOKEN || '';

const client = createClient({ url, authToken });

async function check() {
  const result = await client.execute('SELECT topic, digest_date, papers_json FROM cached_digests');
  let missingExplanation = 0;
  let total = 0;
  for (const row of result.rows) {
    total++;
    const papers = JSON.parse(row.papers_json);
    const hasExplanation = papers.every(p => p.explanation && p.explanation.paperType);
    if (!hasExplanation) {
      missingExplanation++;
      console.log(`Topic "${row.topic}" on date ${row.digest_date} is missing explanation/paperType`);
    }
  }
  console.log(`Total: ${total}, Missing explanation: ${missingExplanation}`);
}

check().catch(console.error);
