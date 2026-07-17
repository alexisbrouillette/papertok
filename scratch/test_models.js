import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.TURSO_DATABASE_URL || 'file:local.db';
const authToken = process.env.TURSO_AUTH_TOKEN || '';

const client = createClient({ url, authToken });

async function check() {
  const result = await client.execute('SELECT topic, digest_date, length(papers_json) as len FROM cached_digests ORDER BY topic, digest_date');
  console.log("Cached digests in DB:");
  result.rows.forEach(row => {
    console.log(`- Topic: "${row.topic}" | Date: ${row.digest_date} | Length: ${row.len}`);
  });
}

check().catch(console.error);
