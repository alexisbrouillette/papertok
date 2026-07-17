import 'dotenv/config';
import { createClient } from '@libsql/client';

// Simple helper to search using a free web endpoint, or fallback to Semantic Scholar query
async function testGoogleScholarQuery(query) {
  console.log(`\n--- Testing Search Query: "${query}" ---`);
  
  // Try to search Google Scholar via a clean scraper or Serp API if credentials exist, 
  // or write a mock/direct search resolver using a fetch parsing technique or Semantic Scholar search.
  // Let's test direct search with Semantic Scholar API first to see what metadata it returns.
  const s2ApiKey = process.env.SEMANTIC_SCHOLAR_API_KEY || '';
  const cleanQuery = encodeURIComponent(query);
  const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${cleanQuery}&limit=3&fields=title,authors,year,venue,citationCount,url,openAccessPdf,externalIds`;

  const headers = {};
  if (s2ApiKey) {
    headers['x-api-key'] = s2ApiKey;
  }

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}`);
    }
    const data = await response.json();
    console.log(`Found ${data.total || 0} papers on Semantic Scholar:`);
    
    (data.data || []).forEach((paper, idx) => {
      console.log(`\n[Result #${idx + 1}]`);
      console.log(`Title:    ${paper.title}`);
      console.log(`Authors:  ${(paper.authors || []).map(a => a.name).join(', ')}`);
      console.log(`Year:     ${paper.year}`);
      console.log(`Journal/Venue: ${paper.venue}`);
      console.log(`Citations: ${paper.citationCount}`);
      console.log(`URL:      ${paper.url}`);
      console.log(`DOI:      ${paper.externalIds?.DOI || 'None'}`);
    });
  } catch (err) {
    console.error('Search failed:', err.message);
  }
}

// Test queries targeting our specific categories (Ecology/Image modeling)
async function run() {
  // 1. Foundation: Landmark paper for CNNs in image detection
  await testGoogleScholarQuery('convolutional neural network image classification AlexNet Krizhevsky 2012');
  
  // 2. Crossfield: If we are in ecology doing image modeling, look up remote sensing/medical segmentation
  await testGoogleScholarQuery('remote sensing image classification deep learning random forest');
}

run();
