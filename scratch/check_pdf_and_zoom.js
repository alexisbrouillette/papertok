import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const url = process.env.TURSO_DATABASE_URL || 'file:local.db';
const authToken = process.env.TURSO_AUTH_TOKEN || '';

const client = createClient({ url, authToken });

async function check() {
  const result = await client.execute('SELECT topic, papers_json, created_at FROM cached_digests ORDER BY created_at DESC LIMIT 1');
  if (result.rows.length === 0) {
    console.log("No digests found in cache.");
    return;
  }
  const row = result.rows[0];
  console.log(`=== LATEST DIGEST ===`);
  console.log(`Topic: "${row.topic}"`);
  console.log(`Created At: ${row.created_at}`);
  
  const papers = JSON.parse(row.papers_json);
  papers.forEach((p, idx) => {
    console.log(`\nPaper #${idx + 1}: "${p.title}"`);
    console.log(`  Paper URL: ${p.paperUrl || 'none'}`);
    console.log(`  PDF URL: ${p.pdfUrl || 'none'}`);
    console.log(`  Citations: ${p.citationCount || 'none'}`);
    console.log(`  Has zoomData? ${p.zoomData ? 'YES' : 'NO'}`);
    if (p.zoomData) {
      console.log(`    Keys: ${Object.keys(p.zoomData).join(', ')}`);
      if (p.zoomData.rawFormula) console.log(`    Formula: ${p.zoomData.rawFormula.substring(0, 60)}...`);
      if (p.zoomData.verdict) console.log(`    Verdict: ${p.zoomData.verdict.substring(0, 60)}...`);
    }
  });
}

check().catch(console.error);
