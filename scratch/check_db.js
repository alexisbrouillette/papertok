import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.TURSO_DATABASE_URL || 'file:local.db';
const authToken = process.env.TURSO_AUTH_TOKEN || '';

const client = createClient({ url, authToken });

async function check() {
  const result = await client.execute('SELECT papers_json FROM cached_digests LIMIT 5');
  for (const row of result.rows) {
    const papers = JSON.parse(row.papers_json);
    console.log("Paper titles:");
    papers.forEach(p => {
      console.log(`- Title: ${p.title}`);
      console.log(`  Explanation keys: ${p.explanation ? Object.keys(p.explanation).join(', ') : 'none'}`);
      console.log(`  explanation.paperType: ${p.explanation?.paperType}`);
    });
  }
}

check().catch(console.error);
