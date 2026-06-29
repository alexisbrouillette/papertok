// scripts/test-apis.js
// Node.js v24 has native fetch built-in! So we can use global fetch directly.

const TEST_PAPERS = [
  {
    title: "Maximum entropy modeling of species geographic distributions",
    keywords: "Phillips Maximum entropy modeling of species geographic distributions"
  },
  {
    title: "Attention Is All You Need",
    keywords: "Vaswani Attention Is All You Need"
  }
];

async function testSemanticScholar(query) {
  console.log(`\n--- Testing Semantic Scholar for: "${query}" ---`);
  const cleanQuery = encodeURIComponent(query);
  const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${cleanQuery}&limit=1&fields=title,citationCount,venue,url,openAccessPdf`;
  
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`❌ Semantic Scholar failed with status: ${res.status}`);
      return null;
    }
    const data = await res.json();
    const paper = data.data?.[0];
    if (paper) {
      console.log(`✅ Title: "${paper.title}"`);
      console.log(`✅ Citations: ${paper.citationCount}`);
      console.log(`✅ Venue: ${paper.venue}`);
      console.log(`✅ PDF URL: ${paper.openAccessPdf?.url || 'None'}`);
      console.log(`✅ URL: ${paper.url}`);
      return paper;
    } else {
      console.log(`⚠️ No paper found.`);
    }
  } catch (err) {
    console.error(`❌ Semantic Scholar error:`, err.message);
  }
  return null;
}

async function testEuropePMC(title) {
  console.log(`\n--- Testing Europe PMC for: "${title}" ---`);
  const cleanTitle = encodeURIComponent(title);
  const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=title:"${cleanTitle}"&format=json&resultType=lite`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`❌ Europe PMC failed with status: ${res.status}`);
      return null;
    }
    const data = await res.json();
    const result = data.resultList?.result?.[0];
    if (result) {
      console.log(`✅ Title: "${result.title}"`);
      console.log(`✅ Citations: ${result.citedByCount}`);
      console.log(`✅ Venue: ${result.journalTitle || result.bookOrReportTitle}`);
      console.log(`✅ DOI: ${result.doi || 'None'}`);
      return result;
    } else {
      console.log(`⚠️ No paper found.`);
    }
  } catch (err) {
    console.error(`❌ Europe PMC error:`, err.message);
  }
  return null;
}

async function testArXiv(title) {
  console.log(`\n--- Testing arXiv for: "${title}" ---`);
  const cleanTitle = encodeURIComponent(title);
  const url = `https://export.arxiv.org/api/query?search_query=ti:"${cleanTitle}"&max_results=1`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`❌ arXiv failed with status: ${res.status}`);
      return null;
    }
    const xmlText = await res.text();
    
    // Check if it contains an entry
    if (xmlText.includes('<entry>')) {
      const titleMatch = xmlText.match(/<title>([\s\S]*?)<\/title>/);
      const pdfMatch = xmlText.match(/<link[^>]*href="([^"]*)"[^>]*title="pdf"/);
      console.log(`✅ Title: "${titleMatch ? titleMatch[1].trim() : 'Unknown'}"`);
      console.log(`✅ PDF Link: ${pdfMatch ? pdfMatch[1] : 'None'}`);
      return { found: true };
    } else {
      console.log(`⚠️ No entry found in arXiv XML.`);
    }
  } catch (err) {
    console.error(`❌ arXiv error:`, err.message);
  }
  return null;
}

async function testOpenAlex(id) {
  console.log(`\n--- Testing OpenAlex ID: "${id}" ---`);
  const url = `https://api.openalex.org/works/${id}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`❌ OpenAlex failed with status: ${res.status}`);
      return null;
    }
    const paper = await res.json();
    console.log(`  ✅ Title: "${paper.title}"`);
    console.log(`  ✅ Citations: ${paper.cited_by_count}`);
    console.log(`  ✅ Year: ${paper.publication_year}`);
    console.log(`  ✅ Venue: ${paper.primary_location?.source?.display_name || 'None'}`);
    console.log(`  ✅ DOI: ${paper.doi || 'None'}`);
    return paper;
  } catch (err) {
    console.error(`❌ OpenAlex error:`, err.message);
  }
  return null;
}

async function runAllTests() {
  console.log("Starting Academic APIs Integration Tests...");
  await testOpenAlex("W2801456958");
  console.log("\nTests finished.");
}

runAllTests();
