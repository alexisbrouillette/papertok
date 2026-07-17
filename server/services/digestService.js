import { GoogleGenerativeAI } from '@google/generative-ai';
import { dbGet, dbRun, dbAll } from '../db.js';
import fs from 'fs';
import path from 'path';

// Double-escapes single backslashes in specific LaTeX math keys (rawFormula, symbol, term, inequalityUsed, promise)
function escapeJsonLatexBackslashes(str) {
  return str.replace(/"(rawFormula|symbol|term|inequalityUsed|promise)":\s*"([^"]*)"/g, (match, key, val) => {
    const cleanVal = val.replace(/\\/g, '\\\\').replace(/\\\\\\\\/g, '\\\\');
    return `"${key}": "${cleanVal}"`;
  });
}

// Helper function to retry a function with exponential backoff.
async function retryWithDelay(fn, retries = 5, delay = 5000, factor = 2) {
  try {
    return await fn();
  } catch (err) {
    const errMsg = err.message || '';
    const isRateLimit = errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('Quota') || (err.status === 429);
    const isDailyQuota = errMsg.includes('RequestsPerDay') || errMsg.includes('free_tier_requests') || err.isDailyQuota;

    // If it is a daily requests quota limit (RPD), throw immediately and skip retries
    if (isDailyQuota) {
      err.isDailyQuota = true;
      throw err;
    }
    
    if (retries > 0) {
      // If it is a 429 rate limit (e.g. per minute), wait at least 20 seconds to allow the quota bucket to reset
      const actualDelay = isRateLimit ? Math.max(20000, delay) : delay;
      console.warn(`[Retry] Operation failed. Retrying in ${actualDelay}ms... (${retries} retries left). Error:`, errMsg);
      await new Promise((resolve) => setTimeout(resolve, actualDelay));
      return retryWithDelay(fn, retries - 1, isRateLimit ? actualDelay : (delay * factor), factor);
    }
    throw err;
  }
}

const exhaustedModels = new Set();

// Helper function to try generating content with sequential fallbacks
async function generateContentWithFallback(genAI, primaryModelName, prompt, config) {
  // Fallback order: primary → high-quota models → standard Gemini models
  // Note: Gemma models have only 16K TPM which is too low for paper deconstruction prompts
  const modelsToTry = [primaryModelName, 'gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemma-4-31b-it', 'gemma-4-26b-a4b-it'];
  const filteredModels = [...new Set(modelsToTry)].filter(m => !exhaustedModels.has(m));
  const uniqueModels = filteredModels.length > 0 ? filteredModels : [...new Set(modelsToTry)];

  let lastError;
  for (const modelName of uniqueModels) {
    try {
      console.log(`[Gemini API] Attempting generation with model: ${modelName}`);
      const modelConfig = { ...config };
      // Gemma models don't support responseSchema — strip it and rely on prompt-based JSON
      const isGemma = modelName.includes('gemma');
      if (isGemma) {
        delete modelConfig.responseSchema;
      }
      const model = genAI.getGenerativeModel({ model: modelName, generationConfig: modelConfig });
      return await retryWithDelay(async () => {
        try {
          const result = await model.generateContent(prompt);
          const text = result.response.text();
          // Guard: reject looping/degenerate outputs (>100K chars is almost certainly repeating)
          if (text.length > 100000) {
            throw new Error(`Model ${modelName} returned ${text.length} chars — likely looping. Rejecting.`);
          }
          return text;
        } catch (err) {
          const errMsg = err.message || '';
          if (errMsg.includes('RequestsPerDay') || errMsg.includes('free_tier_requests') || errMsg.includes('Quota exceeded')) {
            err.isDailyQuota = true;
          }
          throw err;
        }
      }, 3, 2000, 1.5);
    } catch (err) {
      if (err.isDailyQuota) {
        console.warn(`[Gemini API] Model ${modelName} has exhausted its daily quota. Skipping it for subsequent calls.`);
        exhaustedModels.add(modelName);
      }
      lastError = err;
      console.warn(`[Gemini API] Model ${modelName} failed. Error: ${err.message}. Trying next model...`);
    }
  }
  throw lastError;
}

// --- LITERATURE METADATA FETCH HELPERS ---

let lastS2RequestTime = 0;
let s2RequestQueue = Promise.resolve();

async function fetchFromSemanticScholar(query, apiKey) {
  const resultPromise = s2RequestQueue.then(async () => {
    const now = Date.now();
    const timeSinceLast = now - lastS2RequestTime;
    if (timeSinceLast < 1100) {
      const waitTime = 1100 - timeSinceLast;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    lastS2RequestTime = Date.now();
    return fetchFromSemanticScholarDirect(query, apiKey);
  });

  s2RequestQueue = resultPromise.catch(() => {}).then(() => new Promise(resolve => setTimeout(resolve, 100)));
  return resultPromise;
}

async function fetchFromSemanticScholarByUrl(paperUrl, apiKey) {
  const resultPromise = s2RequestQueue.then(async () => {
    const now = Date.now();
    const timeSinceLast = now - lastS2RequestTime;
    if (timeSinceLast < 1100) {
      const waitTime = 1100 - timeSinceLast;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    lastS2RequestTime = Date.now();
    return fetchFromSemanticScholarByUrlDirect(paperUrl, apiKey);
  });

  s2RequestQueue = resultPromise.catch(() => {}).then(() => new Promise(resolve => setTimeout(resolve, 100)));
  return resultPromise;
}

async function fetchFromSemanticScholarByUrlDirect(paperUrl, apiKey) {
  const url = `https://api.semanticscholar.org/graph/v1/paper/URL:${encodeURIComponent(paperUrl)}?fields=paperId,title,citationCount,venue,url,openAccessPdf,externalIds,authors,year,abstract`;
  
  const headers = {};
  if (apiKey && apiKey.trim() !== '') {
    headers['x-api-key'] = apiKey.trim();
  }

  let attempts = 0;
  const maxAttempts = 3;
  let retryDelay = 2000;

  while (attempts < maxAttempts) {
    try {
      const response = await fetch(url, { headers });
      if (response.status === 429) {
        attempts++;
        if (attempts >= maxAttempts) {
          throw new Error('Semantic Scholar URL response not OK: 429 (exceeded maximum retries)');
        }
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        retryDelay *= 2.5;
        continue;
      }
      if (!response.ok) {
        return null;
      }
      return await response.json();
    } catch (err) {
      if (attempts >= maxAttempts - 1) return null;
      attempts++;
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      retryDelay *= 2.5;
    }
  }
  return null;
}

async function fetchFromSemanticScholarDirect(query, apiKey) {
  const cleanQuery = encodeURIComponent(query);
  const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${cleanQuery}&limit=10&fields=paperId,title,citationCount,venue,url,openAccessPdf,externalIds,authors,year`;
  
  const headers = {};
  if (apiKey && apiKey.trim() !== '') {
    headers['x-api-key'] = apiKey.trim();
  }

  let attempts = 0;
  const maxAttempts = 3;
  let retryDelay = 2000;

  while (attempts < maxAttempts) {
    try {
      const response = await fetch(url, { headers });
      
      if (response.status === 429) {
        attempts++;
        if (attempts >= maxAttempts) {
          throw new Error('Semantic Scholar response not OK: 429 (exceeded maximum retries)');
        }
        console.warn(`[Semantic Scholar Rate Limit] 429. Retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        retryDelay *= 2.5;
        continue;
      }

      if (!response.ok) {
        throw new Error(`Semantic Scholar response not OK: ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      if (attempts >= maxAttempts - 1) {
        throw err;
      }
      attempts++;
      console.warn(`[Semantic Scholar Query Error] ${err.message}. Retrying in ${retryDelay}ms...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      retryDelay *= 2.5;
    }
  }
  throw new Error('Failed to query Semantic Scholar: maximum retries reached.');
}

async function fetchSemanticScholarDetailsDirect(paperId, apiKey) {
  const url = `https://api.semanticscholar.org/graph/v1/paper/${paperId}?fields=citations.title,citations.url,citations.year,citations.citationCount,references.title,references.url,references.year,references.citationCount`;
  
  const headers = {};
  if (apiKey && apiKey.trim() !== '') {
    headers['x-api-key'] = apiKey.trim();
  }

  let attempts = 0;
  const maxAttempts = 3;
  let retryDelay = 2000;

  while (attempts < maxAttempts) {
    try {
      const response = await fetch(url, { headers });
      
      if (response.status === 429) {
        attempts++;
        if (attempts >= maxAttempts) {
          throw new Error('Semantic Scholar response not OK: 429 (exceeded maximum retries)');
        }
        console.warn(`[Semantic Scholar Rate Limit] 429. Retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        retryDelay *= 2.5;
        continue;
      }

      if (!response.ok) {
        throw new Error(`Semantic Scholar response not OK: ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      if (attempts >= maxAttempts - 1) {
        throw err;
      }
      attempts++;
      console.warn(`[Semantic Scholar Query Error] ${err.message}. Retrying in ${retryDelay}ms...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      retryDelay *= 2.5;
    }
  }
  throw new Error('Failed to query Semantic Scholar details: maximum retries reached.');
}

async function fetchSemanticScholarDetails(paperId, apiKey) {
  const resultPromise = s2RequestQueue.then(async () => {
    const now = Date.now();
    const timeSinceLast = now - lastS2RequestTime;
    if (timeSinceLast < 1100) {
      const waitTime = 1100 - timeSinceLast;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    lastS2RequestTime = Date.now();
    return fetchSemanticScholarDetailsDirect(paperId, apiKey);
  });

  s2RequestQueue = resultPromise.catch(() => {}).then(() => new Promise(resolve => setTimeout(resolve, 100)));
  return resultPromise;
}

async function fetchFromEuropePMC(title) {
  try {
    const cleanTitle = encodeURIComponent(title);
    const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=title:"${cleanTitle}"&format=json&resultType=lite`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    const result = data.resultList?.result?.[0];
    if (!result) return null;

    return {
      citationCount: result.citedByCount,
      venue: result.journalTitle || result.bookOrReportTitle,
      paperUrl: result.doi ? `https://doi.org/${result.doi}` : `https://europepmc.org/article/MED/${result.id}`
    };
  } catch (error) {
    console.error('Europe PMC query failed:', error);
    return null;
  }
}

async function fetchFromArXiv(title) {
  try {
    const cleanTitle = encodeURIComponent(title);
    const url = `https://export.arxiv.org/api/query?search_query=ti:"${cleanTitle}"&max_results=1`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const xmlText = await response.text();
    const entryMatch = xmlText.match(/<entry>([\s\S]*?)<\/entry>/);
    if (!entryMatch) return null;
    const entryXml = entryMatch[1];

    const pdfMatch = entryXml.match(/<link[^>]*title="pdf"[^>]*href="([^"]+)"/);
    const pdfUrl = pdfMatch ? pdfMatch[1] : undefined;

    const htmlMatch = entryXml.match(/<link[^>]*type="text\/html"[^>]*href="([^"]+)"/);
    let paperUrl = htmlMatch ? htmlMatch[1] : undefined;
    if (!paperUrl) {
      const idMatch = entryXml.match(/<id>([^<]+)<\/id>/);
      paperUrl = idMatch ? idMatch[1].trim() : undefined;
    }

    return { pdfUrl, paperUrl };
  } catch (error) {
    console.error('arXiv query failed:', error);
    return null;
  }
}

async function fetchFromCrossRef(title) {
  try {
    const cleanTitle = encodeURIComponent(title);
    const url = `https://api.crossref.org/works?query.title=${cleanTitle}&rows=1`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    const item = data.message?.items?.[0];
    if (!item) return null;
    return {
      citationCount: undefined,
      venue: item['container-title']?.[0] || item.publisher || undefined,
      pdfUrl: undefined,
      paperUrl: item.DOI ? `https://doi.org/${item.DOI}` : item.URL || undefined,
      source: 'crossref',
      citations: [],
      references: []
    };
  } catch (error) {
    console.error('CrossRef fallback failed:', error);
    return null;
  }
}
// Helper to compare title similarity to prevent mixing up papers
const isTitleMatch = (t1, t2) => {
  const clean = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').trim().split(/\s+/).filter(Boolean);
  const words1 = clean(t1);
  const words2 = clean(t2);
  if (words1.length === 0 || words2.length === 0) return false;
  
  // Check intersection size
  const set2 = new Set(words2);
  const intersection = words1.filter(w => set2.has(w));
  const similarity = intersection.length / Math.max(words1.length, words2.length);
  return similarity >= 0.85; // Require at least 85% of words to match exactly
};

export async function enrichPaperMetadata(title, searchKeywords, s2ApiKey) {
  // Helper to sanitise arXiv PDF URLs to abstract page URLs to avoid 403 / Rate limit errors
  const sanitiseArxivUrl = (url) => {
    if (url && url.includes('arxiv.org/pdf/')) {
      return url.replace('/pdf/', '/abs/').replace(/\.pdf$/, '').replace(/v\d+$/, '');
    }
    return url;
  };

  const fetchLineageFromSemanticScholar = async (paperTitle) => {
    try {
      const searchResult = await fetchFromSemanticScholar(paperTitle, s2ApiKey);
      const paper = searchResult.data?.[0];
      if (paper && paper.paperId && isTitleMatch(paperTitle, paper.title)) {
        console.log(`[Semantic Scholar] Fetching details for lineage: ${paper.paperId}`);
        const details = await fetchSemanticScholarDetails(paper.paperId, s2ApiKey);
        const rawCitations = details.citations || [];
        const rawReferences = details.references || [];
        
        const topReferences = rawReferences
          .filter(r => r && r.title)
          .sort((a, b) => (b.citationCount || 0) - (a.citationCount || 0))
          .slice(0, 3)
          .map(r => ({
            title: r.title,
            url: r.url || `https://scholar.google.com/scholar?q=${encodeURIComponent(r.title)}`,
            year: r.year || undefined
          }));
          
        const topCitations = rawCitations
          .filter(c => c && c.title)
          .sort((a, b) => (b.citationCount || 0) - (a.citationCount || 0))
          .slice(0, 3)
          .map(c => ({
            title: c.title,
            url: c.url || `https://scholar.google.com/scholar?q=${encodeURIComponent(c.title)}`,
            year: c.year || undefined
          }));
          
        return { citations: topCitations, references: topReferences, s2Paper: paper };
      }
    } catch (err) {
      console.warn(`[Semantic Scholar] Failed to fetch lineage for "${paperTitle}":`, err.message);
    }
    return { citations: [], references: [] };
  };

  const resolveOaPdf = async (s2Paper) => {
    if (!s2Paper) return undefined;
    if (s2Paper.openAccessPdf?.url) return s2Paper.openAccessPdf.url;
    const doi = s2Paper.externalIds?.DOI;
    if (doi) {
      try {
        const response = await fetch(`https://api.unpaywall.org/v2/${encodeURIComponent(doi)}?email=alexis@papertok.com`, { timeout: 4000 });
        if (response.ok) {
          const data = await response.json();
          return data.best_oa_location?.url_for_pdf || data.best_oa_location?.url || undefined;
        }
      } catch (_) {}
    }
    return undefined;
  };

  const { execSync } = await import('child_process');
  const { join } = await import('path');
  const { fileURLToPath } = await import('url');
  const __dirname = join(fileURLToPath(import.meta.url), '..');

  // 1. Try Google Scholar Scraper first
  try {
    const scriptPath = join(__dirname, '../scripts/google_scholar_search.py');
    const stdout = execSync(`python3 "${scriptPath}" "${title.replace(/"/g, '\\"')}"`, { encoding: 'utf8', timeout: 15000 });
    const results = JSON.parse(stdout);
    
    if (Array.isArray(results) && results.length > 0) {
      const topResult = results[0];
      if (topResult.title && topResult.url && isTitleMatch(title, topResult.title)) {
        console.log(`[Google Scholar Scraper] Validated paper link: "${topResult.title}"`);
        const lineage = await fetchLineageFromSemanticScholar(title);
        return {
          citationCount: topResult.citationCount || lineage.s2Paper?.citationCount || undefined,
          venue: topResult.venue || lineage.s2Paper?.venue || undefined,
          pdfUrl: sanitiseArxivUrl(topResult.url) || await resolveOaPdf(lineage.s2Paper),
          paperUrl: topResult.url,
          source: 'google-scholar-scrape',
          citations: lineage.citations,
          references: lineage.references
        };
      }
    }
  } catch (err) {
    console.warn(`[Google Scholar Scraper] Failed to fetch metadata for "${title}":`, err.message);
  }

  // 3. Try Europe PMC & arXiv fallbacks
  try {
    const [pmcResult, arxivResult] = await Promise.all([
      fetchFromEuropePMC(title),
      fetchFromArXiv(title)
    ]);

    if (pmcResult || arxivResult) {
      const doiUrl = pmcResult?.paperUrl; // DOI or PMC URL
      const arxivPaperUrl = arxivResult?.paperUrl; // arXiv Abstract URL
      const lineage = await fetchLineageFromSemanticScholar(title);
      return {
        citationCount: pmcResult?.citationCount ?? lineage.s2Paper?.citationCount ?? undefined,
        venue: pmcResult?.venue ?? (arxivResult ? 'arXiv Preprint' : undefined) ?? lineage.s2Paper?.venue,
        pdfUrl: sanitiseArxivUrl(arxivResult?.pdfUrl || undefined) || await resolveOaPdf(lineage.s2Paper),
        paperUrl: doiUrl || arxivPaperUrl || undefined,
        source: 'fallback-apis',
        citations: lineage.citations,
        references: lineage.references
      };
    }
  } catch (error) {
    console.error('Fallback APIs (Europe PMC/arXiv) failed:', error);
  }

  // 4. Try CrossRef fallback by exact title
  try {
    const crossRefResult = await fetchFromCrossRef(title);
    if (crossRefResult) {
      const lineage = await fetchLineageFromSemanticScholar(title);
      return {
        ...crossRefResult,
        pdfUrl: await resolveOaPdf(lineage.s2Paper),
        citations: lineage.citations,
        references: lineage.references
      };
    }
  } catch (error) {
    console.error('CrossRef fallback failed:', error);
  }

  // 5. Google Scholar fallback search page
  const lineage = await fetchLineageFromSemanticScholar(title);
  return {
    paperUrl: `https://scholar.google.com/scholar?q=${encodeURIComponent(title)}`,
    pdfUrl: await resolveOaPdf(lineage.s2Paper),
    source: 'google-scholar',
    citations: lineage.citations,
    references: lineage.references
  };
}

// --- GEMINI GENERATION HELPERS ---

async function generatePaperDetails(paper, apiKey) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const prompt = `You are a world-class senior scientist and academic researcher. Your explanations in the "Under the Hood" sections must be highly technical, rigorous, and written specifically for fellow researchers and domain experts who are highly knowledgeable in the field. Avoid oversimplifications, generalities, or superficial descriptions; instead, focus on the exact mathematical formulations, algorithmic steps, specific datasets/architectures, empirical conditions, or theoretical proofs that define the paper's core contribution.
We are analyzing the foundational paper: "${paper.title}" (${paper.year}) by ${paper.authors}.
The paper's stated purpose is: "${paper.purpose}"
The paper's achievements: "${paper.achievements}"

Your goal is to generate a comprehensive, highly technical, and academically rigorous explanation of the core content of this paper, adapting your explanation structure based on the paper's genre, and extracting key technical terms for inline tagging.

Perform an internal feedback and critique loop:
1. Detect which of the following genres describes this paper best:
   - 'methodology': If it introduces a new algorithm, neural network architecture, system, baseline model, or software tool (e.g. Transformers, ResNet, MaxEnt, Git).
   - 'empirical_study': If it presents an experimental trial, benchmark study, clinical trial, or scientific analysis of empirical observations testing a hypothesis (e.g. GLP-1 trials, scaling laws study).
   - 'theoretical': If it is a math-heavy paper focused on proving theorems, mathematical bounds, correctness proofs, or complexity limits (e.g. proof of P vs NP variants, convergence bounds).
   - 'review_survey': If it is a review article consolidating, categorizing, and surveying a large body of literature (e.g. survey of deep learning in medicine).
2. Draft explanation styles:
   - For methodology/theory, draft a metaphor, analogy, and simple method contrast. Critique which is best.
   - For empirical study, draft a clear explanation of what is tested and why it matters.
   - For review/survey, draft an explanation of the topic's landscape.
3. Identify every technical term, acronym, prior method, or baseline model mentioned in your explanation fields (e.g., GLM, RNN, LSTM, CNN, SGD, Backpropagation) that a reader might need deeper understanding about. CRITICAL RULE: Do NOT include the paper itself (e.g. its title, main author name, or direct acronym, like 'MaxEnt' if this is the MaxEnt paper) in the concepts list. Only include baseline methods, referenced techniques, and sub-components.
4. Output the finalized details as a structured JSON object adhering to the following schema:
{
  "explanation": {
    "paperType": "The detected genre: 'methodology', 'empirical_study', 'theoretical', or 'review_survey'",
    "strategyUsed": "For methodology/theoretical, specify the chosen strategy: 'metaphor', 'analogy', or 'contrast'. For study/survey, set to null or omit.",
    "coreIntuition": "The spot-on, polished core explanation. Detailed, intellectually satisfying for an expert, yet clear and vivid.",
    "beforeState": "Explain the previous paradigm, scientific belief, or methodological limitation that this paper builds on or contrasts against. What were its flaws/mechanics?",
    "afterState": "Explain what this paper improved, proved, or discovered under the new paradigm.",
    
    // METHODOLOGY fields (populate ONLY if paperType is 'methodology', otherwise set to null or omit):
    "deconstructedParts": [
      {
        "title": "Sub-component Name (e.g. 'Self-Attention Layer' or 'Positional Encoding')",
        "explanation": "Clear explanation of how this part works internally, deconstructing the complexity."
      }
    ],
    "synthesis": "Explain how these sub-components plug and connect together when combined, showing the full workflow of the system.",

    // EMPIRICAL STUDY fields (populate ONLY if paperType is 'empirical_study', otherwise set to null or omit):
    "researchQuestion": "What exact hypothesis or research question the study set out to verify.",
    "studySetup": "How the study was conducted (experimental setup, datasets, control/treatment, sample size, or benchmarks used).",
    "keyFindings": "The key findings, empirical observations, or benchmark results observed (including key statistics/trends).",
    "interpretation": "How the authors interpret these findings and what it means for the wider field.",

    // THEORETICAL fields (populate ONLY if paperType is 'theoretical', otherwise set to null or omit):
    "coreTheorem": "The main theorem, lemma, or mathematical statement proved by the paper.",
    "assumptions": "The mathematical framework, boundary conditions, or assumptions required.",
    "proofStrategy": "The intuitive, high-level strategy/roadmap used to prove the statement.",
    "theoreticalSignificance": "Why this proof or bound is significant and what complexity it resolves.",

    // REVIEW/SURVEY fields (populate ONLY if paperType is 'review_survey', otherwise set to null or omit):
    "surveyScope": "The scope, theme, or research area surveyed by the paper.",
    "taxonomy": "The taxonomy, categorization, or system used to classify the existing methods/literature.",
    "consensusAndTrends": "The major consensus, common patterns, and trends identified across the literature.",
    "openChallenges": "The future roadmap, open questions, and gaps in research identified by the survey."
  },
  "taggedConcepts": [
    {
      "term": "The exact name of a technical term, architecture, acronym, baseline model, or concept mentioned in any of the explanation fields above. Spelling and casing must match how it appears in the text fields exactly.",
      "nickname": "A short, punchy, and intriguing nickname (3 to 6 words maximum) for this concept, e.g. 'Entropy Oracle' or 'Attention Beacons'.",
      "definition": "A clear, intuitive 1-2 sentence explanation of what this technique/concept is and what it does.",
      "origin": "Name of the landmark paper and/or authors and year that originally introduced this concept.",
      "paperUrl": "A Google Scholar search URL for the referenced paper, e.g. 'https://scholar.google.com/scholar?q=Long+Short-Term+Memory+Hochreiter+1997'.",
      "relatedTerms": [
        "Include exactly 3-4 closely related technical terms, sub-components, or mathematical concepts that connect to this term, to build a knowledge graph (e.g. if term is 'Transformer', relatedTerms could be ['Self-Attention', 'Positional Encoding', 'BERT', 'GPT'])."
      ]
    }
  ]
}

Do not wrap response in markdown blocks - return the raw JSON object.`;

  const model = genAI.getGenerativeModel({
    model: 'gemini-3.1-flash-lite',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: "OBJECT",
        properties: {
          explanation: {
            type: "OBJECT",
            properties: {
              paperType: {
                type: "STRING",
                enum: ["methodology", "empirical_study", "theoretical", "review_survey"]
              },
              strategyUsed: {
                type: "STRING",
                enum: ["metaphor", "analogy", "contrast"]
              },
              coreIntuition: { type: "STRING" },
              beforeState: { type: "STRING" },
              afterState: { type: "STRING" },
              deconstructedParts: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    title: { type: "STRING" },
                    explanation: { type: "STRING" }
                  },
                  required: ["title", "explanation"]
                }
              },
              synthesis: { type: "STRING" },
              researchQuestion: { type: "STRING" },
              studySetup: { type: "STRING" },
              keyFindings: { type: "STRING" },
              interpretation: { type: "STRING" },
              coreTheorem: { type: "STRING" },
              assumptions: { type: "STRING" },
              proofStrategy: { type: "STRING" },
              theoreticalSignificance: { type: "STRING" },
              surveyScope: { type: "STRING" },
              taxonomy: { type: "STRING" },
              consensusAndTrends: { type: "STRING" },
              openChallenges: { type: "STRING" }
            },
            required: ["paperType", "coreIntuition", "beforeState", "afterState"]
          },
          taggedConcepts: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                term: { type: "STRING" },
                nickname: { type: "STRING" },
                definition: { type: "STRING" },
                origin: { type: "STRING" },
                paperUrl: { type: "STRING" },
                relatedTerms: {
                  type: "ARRAY",
                  items: { type: "STRING" }
                }
              },
              required: ["term", "nickname", "definition", "origin", "relatedTerms"]
            }
          }
        },
        required: ["explanation", "taggedConcepts"]
      }
    },
  });

  const textResponse = await retryWithDelay(async () => {
    const result = await model.generateContent(prompt);
    return result.response.text();
  });

  return JSON.parse(textResponse);
}

async function resolvePdfAndTextForPaper(paper, s2ApiKey) {
  const { execSync } = await import('child_process');
  const { join } = await import('path');
  const { fileURLToPath } = await import('url');
  const __dirname = join(fileURLToPath(import.meta.url), '..');
  const scriptPath = join(__dirname, '../scripts/browser_pdf_fetcher.py');

  let candidateUrl = null;
  let doi = null;

  // 1. Try to get direct PDF URL from Semantic Scholar openAccessPdf
  try {
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(paper.title)}&limit=1&fields=paperId,title,openAccessPdf,externalIds`;
    const headers = {};
    if (s2ApiKey && s2ApiKey.trim() !== '') {
      headers['x-api-key'] = s2ApiKey.trim();
    }
    const response = await fetch(url, { headers, timeout: 6000 });
    if (response.ok) {
      const result = await response.json();
      const s2Paper = result.data?.[0];
      if (s2Paper) {
        if (s2Paper.openAccessPdf?.url) {
          candidateUrl = s2Paper.openAccessPdf.url;
        }
        if (s2Paper.externalIds?.DOI) {
          doi = s2Paper.externalIds.DOI;
        }
        if (!candidateUrl && s2Paper.externalIds?.ArXiv) {
          candidateUrl = `https://arxiv.org/pdf/${s2Paper.externalIds.ArXiv}.pdf`;
        }
      }
    }
  } catch (err) {
    console.warn(`[PDF Resolution] Semantic Scholar lookup failed for "${paper.title}":`, err.message);
  }

  // 2. Try Unpaywall if DOI is found and no candidate URL
  if (!candidateUrl && doi) {
    console.log(`[PDF Resolution] Querying Unpaywall for DOI: ${doi}`);
    try {
      const unpaywallUrl = `https://api.unpaywall.org/v2/${encodeURIComponent(doi)}?email=alexis@papertok.com`;
      const upResponse = await fetch(unpaywallUrl, { timeout: 8000 });
      if (upResponse.ok) {
        const upData = await upResponse.json();
        candidateUrl = upData.best_oa_location?.url_for_pdf || upData.best_oa_location?.url || null;
        if (candidateUrl) {
          console.log(`[PDF Resolution] Unpaywall resolved PDF: ${candidateUrl}`);
        }
      }
    } catch (err) {
      console.warn(`[PDF Resolution] Unpaywall lookup failed:`, err.message);
    }
  }

  // 3. Fallback: if paper has a direct PDF url or arxiv url, use it as candidate
  if (!candidateUrl && paper.url) {
    if (paper.url.includes('arxiv.org/abs/')) {
      candidateUrl = paper.url.replace('arxiv.org/abs/', 'arxiv.org/pdf/') + '.pdf';
    } else if (paper.url.toLowerCase().endsWith('.pdf') || paper.url.includes('/pdf/') || paper.url.includes('/bitstream/')) {
      candidateUrl = paper.url;
    }
  }

  // 4. Run browser_pdf_fetcher.py
  let cmd = `python3 "${scriptPath}"`;
  cmd += ` --query "${paper.title.replace(/"/g, '\\"')}"`;
  if (candidateUrl) {
    cmd += ` --url "${candidateUrl.replace(/"/g, '\\"')}"`;
  }

  console.log(`[PDF Fetcher] Launching Playwright fetcher for paper: "${paper.title}"`);
  try {
    const stdout = execSync(cmd, { encoding: 'utf8', timeout: 50000 });
    const result = JSON.parse(stdout);
    if (result.success) {
      console.log(`[PDF Fetcher] Successfully retrieved PDF text content for "${paper.title}"`);
      return {
        pdfUrl: result.pdf_url,
        pdfText: result.text
      };
    } else {
      console.warn(`[PDF Fetcher] Fetcher returned error for "${paper.title}":`, result.error);
    }
  } catch (err) {
    console.error(`[PDF Fetcher] Child process error for "${paper.title}":`, err.message);
  }

  return { pdfUrl: null, pdfText: null };
}

function selectBestPaperFromCandidates(candidates, category) {
  if (!candidates || candidates.length === 0) return null;

  // Normalize year and citationCount fields
  const normalized = candidates.map(c => ({
    ...c,
    citationCount: parseInt(c.citationCount, 10) || 0,
    year: parseInt(c.year, 10) || 0
  }));

  if (category === 'foundation') {
    // Foundational papers must be landmark, highly-cited papers.
    // Sort primarily by citationCount descending.
    const sorted = [...normalized].sort((a, b) => b.citationCount - a.citationCount);
    return sorted[0];
  } else if (category === 'novel') {
    // Novel papers should be recent (e.g., 2020 to 2025) and highly cited.
    const recent = normalized.filter(c => c.year >= 2020 && c.year <= 2025);
    if (recent.length > 0) {
      const sorted = recent.sort((a, b) => b.citationCount - a.citationCount);
      return sorted[0];
    }
    // Fallback if no recent papers found
    const sorted = [...normalized].sort((a, b) => b.citationCount - a.citationCount);
    return sorted[0];
  } else {
    // For other categories, sorting by citationCount descending ensures we pick highly pertinent, high-quality papers
    const sorted = [...normalized].sort((a, b) => b.citationCount - a.citationCount);
    return sorted[0];
  }
}

async function selectBestCandidatesWithGemini(categoryCandidates, cleanTopic, genAI) {
  const activeCategories = [];
  const selectionMap = {};
  
  for (const cat of ['foundation', 'crossfield', 'novel', 'surprise', 'wildcard']) {
    const list = categoryCandidates[cat]?.list || [];
    if (list.length === 0) {
      selectionMap[cat] = null;
    } else if (list.length === 1) {
      selectionMap[cat] = list[0];
    } else {
      activeCategories.push(cat);
    }
  }
  
  if (activeCategories.length === 0) {
    return selectionMap;
  }
  
  const prompt = `You are a world-class academic advisor. A researcher with the following topic/interests is looking for the most interesting, groundbreaking, and relevant papers for their research:
User Topic/Interests: "${cleanTopic}"

For each of the categories listed below, analyze the list of candidate papers found from the web (their titles, authors, venues, citations, and abstracts). Select the SINGLE most interesting, seminal/groundbreaking, and relevant paper that aligns best with the user's research interests.

CRITICAL SELECTION RULES BY CATEGORY:
1. 'foundation': You MUST select a classic, highly-cited landmark or seminal paper that established or defined the field (typically published prior to 2018, with significant citation counts). DO NOT select recent (2024-2026) papers or low-cited reviews/studies for this category under any circumstances if older seminal options are present.
2. 'novel': You MUST select a high-impact, state-of-the-art paper published recently (between 2020 and 2025). Do NOT select older papers here.
3. 'crossfield', 'surprise', 'wildcard': Prioritize groundbreaking, highly-pertinent papers that are conceptually or methodologically useful to the user.

Candidates to choose from:
${activeCategories.map(cat => `
Category: '${cat}'
Candidates for '${cat}':
${categoryCandidates[cat].list.map((c, idx) => `
Candidate #${idx}:
Title: ${c.title}
Authors: ${c.authors}
Year: ${c.year}
Venue: ${c.venue}
Citations: ${c.citationCount}
Abstract: ${c.abstract}
`).join('\n')}
`).join('\n')}

Format your response as a JSON object where the keys are the active categories and the values are the integer indexes (0-indexed) of your selected candidate for each category, exactly matching this schema:
{
  ${activeCategories.map(cat => `"${cat}": integer`).join(',\n  ')}
}`;

  try {
    const responseText = await generateContentWithFallback(
      genAI,
      'gemini-3.1-flash-lite',
      prompt,
      {
        responseMimeType: 'application/json',
        responseSchema: {
          type: "OBJECT",
          properties: activeCategories.reduce((acc, cat) => {
            acc[cat] = { type: "INTEGER" };
            return acc;
          }, {})
        }
      }
    );
    
    const choice = JSON.parse(responseText);
    for (const cat of activeCategories) {
      const idx = choice[cat];
      const list = categoryCandidates[cat].list;
      if (typeof idx === 'number' && idx >= 0 && idx < list.length) {
        selectionMap[cat] = list[idx];
      } else {
        selectionMap[cat] = selectBestPaperFromCandidates(list, cat);
      }
    }
  } catch (err) {
    console.error('[DigestService] Gemini batch selection failed, falling back to programmatic ranking:', err.message);
    for (const cat of activeCategories) {
      selectionMap[cat] = selectBestPaperFromCandidates(categoryCandidates[cat].list, cat);
    }
  }
  
  return selectionMap;
}

/**
 * High-level service function to perform the full digest generation.
 */
export async function generateAndCacheDigest(topic, digestDate, geminiApiKey, onProgress = () => {}, userId = null) {
  const cleanTopic = topic.trim();
  const genAI = new GoogleGenerativeAI(geminiApiKey);

  // Fetch all papers previously suggested to the user (read OR just shown in any past digest)
  let excludedPapersList = [];
  if (userId) {
    // 1. Papers the user has opened/read
    try {
      const readRows = await dbAll('SELECT DISTINCT paper_title FROM reading_progress WHERE user_id = ?', [userId]);
      for (const r of readRows) excludedPapersList.push(r.paper_title);
    } catch (dbErr) {
      console.error('[DigestService] Failed to fetch user read history for exclusion:', dbErr);
    }

    // 2. Papers that appeared in any previously generated digest (even if never opened)
    try {
      const digestRows = await dbAll('SELECT papers_json FROM cached_digests WHERE user_id = ?', [userId]);
      for (const row of digestRows) {
        try {
          const papers = JSON.parse(row.papers_json);
          if (Array.isArray(papers)) {
            for (const p of papers) {
              if (p.title) excludedPapersList.push(p.title);
            }
          }
        } catch (_) {
          // Ignore malformed cache rows
        }
      }
    } catch (dbErr) {
      console.error('[DigestService] Failed to fetch past digests for exclusion:', dbErr);
    }

    // Deduplicate
    excludedPapersList = [...new Set(excludedPapersList)];
  }

  let exclusionPromptPart = '';
  if (excludedPapersList.length > 0) {
    exclusionPromptPart = `
CRITICAL: DO NOT SELECT any of the following papers under any circumstances because the user has already seen them suggested before:
${excludedPapersList.map(title => `- "${title}"`).join('\n')}

Ensure that the 5 landmark papers you select are completely different from this list, even if they are closely related or from the same authors. Use other landmark publications.`;
  }

  // --- STEP 1: Generate Web Search Queries for the 5 Categories ---
  onProgress(10, 'Analyzing research topic and drafting search queries...');

  const queryPrompt = `You are a world-class academic advisor and research planner.
The user's research interest/topic is: "${cleanTopic}".
${exclusionPromptPart}

STEP 1: ANALYZE THE DOMAIN PILLARS
First, mentally deconstruct the user's research topic into its 3 to 4 core theoretical, scientific, or methodological pillars (underlying scientific disciplines, core statistical/mathematical theories, or historical domain challenges). For example:
- If the user is in "multimodal species distribution modeling": The pillars are (1) Ecological niche & habitat theory, (2) Spatial statistics & sampling bias in biological data, (3) Multimodal data fusion & computer vision.
- If the user is in "deep learning for cancer drug discovery": The pillars are (1) Molecular docking & chemical binding theory, (2) Oncology & cancer biology pathways, (3) Representation learning on graph structures.

STEP 2: GENERATE SEARCH QUERIES
Generate exactly 5 highly-targeted search queries to discover real papers on Google Scholar, one for each of the following 5 categories, distributing them across the different pillars to ensure high diversity:

1. 'foundation': A seminal, classic, or foundational landmark paper that originally defined or established one of the historical, theoretical, or mathematical pillars of the user's domain (typically published prior to 2018 or having thousands of citations).
   CRITICAL: The foundation query MUST focus on a non-AI/non-ML pillar of the user's domain (e.g., the core biology, the core statistics, the core physics, or the core chemistry concept, such as "ecological niche theory", "sampling bias in ecological data", "electrocardiogram signal analysis", or "chemical molecular docking scoring functions") and MUST NOT contain modern AI buzzwords (like "transformer", "foundation model", "multimodal", "LLM", "deep learning") which would restrict the search to papers from >2020.
2. 'crossfield': Applications or methods in adjacent/complementary fields that are DIRECTLY useful or relevant to the user's core domain (e.g., if the user is in cardiology, target signal processing or wearable sensor engineering; if the user is in macroecology, target remote sensing or geospatial computer vision; rather than completely disconnected fields).
3. 'novel': High-impact, state-of-the-art papers published recently in the user's specific domain (since 2020/2021) that represent modern breakthroughs.
4. 'surprise': A landmark paper from a different scientific discipline that uses similar mathematical, algorithmic, or structural principles, but remains highly relevant to the user's methodological interests (e.g., mapping a graph neural network model used in social networks to molecular chemistry, or mapping a spatial tracking algorithm used in physics to animal migrations).
5. 'wildcard': A niche, interesting, or lesser-known application or study directly related to one of the user's pillars.

CRITICAL INSTRUCTIONS:
- NO EXPLICIT YEARS: Do NOT include explicit publication year numbers (like "2023", "2024", "2025") inside the generated search queries.
- FOUNDATION PAPER CRITERIA: The "fallbackPaperTitle" for the "foundation" category MUST be an actual, historically verified pioneering or seminal paper in the field. It must not be a recent, low-cited, or obscure preprint.
- YEARS: Do NOT bias search queries or fallbacks to return only papers published in 2025/2026. Prioritize highly cited, pertinent landmark papers. Double-check that the "fallbackYear" for each fallback paper is the actual, historically accurate publication year (not modern placeholders or guesses).

Format your response as a JSON array containing exactly 5 objects, ordered precisely in the sequence above (foundation, crossfield, novel, surprise, wildcard). Each object must match this schema:
{
  "category": "foundation" | "crossfield" | "novel" | "surprise" | "wildcard",
  "searchQuery": "string - the optimal, specific Google Scholar search query",
  "rationale": "string - why this query matches the category and how it connects to the user's topic",
  "fallbackPaperTitle": "string - the exact title of a real, well-known paper matching this category",
  "fallbackAuthors": "string - the actual authors of this real paper",
  "fallbackYear": "integer - the actual publication year",
  "fallbackVenue": "string - the actual publication journal/conference/venue",
  "fallbackAbstract": "string - a brief 2-3 sentence summary of the paper's core contribution"
}`;

  const queryConfig = {
    responseMimeType: 'application/json',
    responseSchema: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          category: {
            type: "STRING",
            enum: ["foundation", "surprise", "crossfield", "novel", "wildcard"]
          },
          searchQuery: { type: "STRING" },
          rationale: { type: "STRING" },
          fallbackPaperTitle: { type: "STRING" },
          fallbackAuthors: { type: "STRING" },
          fallbackYear: { type: "INTEGER" },
          fallbackVenue: { type: "STRING" },
          fallbackAbstract: { type: "STRING" }
        },
        required: [
          "category",
          "searchQuery",
          "rationale",
          "fallbackPaperTitle",
          "fallbackAuthors",
          "fallbackYear",
          "fallbackVenue",
          "fallbackAbstract"
        ]
      }
    }
  };

  const queryResponse = await generateContentWithFallback(
    genAI,
    'gemini-3.1-flash-lite',
    queryPrompt,
    queryConfig
  );

  let searchQueries = JSON.parse(queryResponse);
  if (!Array.isArray(searchQueries) || searchQueries.length === 0) {
    throw new Error('Invalid JSON structure returned by query generation model');
  }

  // --- STEP 2: Execute Searches & Retrieve Real Metadata ---
  onProgress(25, 'Searching the web for matching papers...');

  const { execSync } = await import('child_process');
  const { join } = await import('path');
  const { fileURLToPath } = await import('url');
  const __dirname = join(fileURLToPath(import.meta.url), '..');

  const categoryCandidates = {};
  for (const item of searchQueries) {
    categoryCandidates[item.category] = {
      rationale: item.rationale,
      fallback: {
        category: item.category,
        title: item.fallbackPaperTitle,
        url: `https://scholar.google.com/scholar?q=${encodeURIComponent(item.fallbackPaperTitle)}`,
        authors: item.fallbackAuthors || 'Various Researchers',
        year: item.fallbackYear || new Date().getFullYear() - 2,
        venue: item.fallbackVenue || 'Specialized Scientific Forum',
        citationCount: 0,
        abstract: item.fallbackAbstract || `This paper explores concepts related to ${item.searchQuery}.`,
        rationale: item.rationale
      },
      list: []
    };
  }

  for (const item of searchQueries) {
    console.log(`[DigestService] Running search for category "${item.category}": "${item.searchQuery}"`);
    const candidates = categoryCandidates[item.category].list;

    // 1. Try Google Web Search + Semantic Scholar URL mapping
    try {
      const scriptPath = join(__dirname, '../scripts/google_web_search.py');
      console.log(`[DigestService] Querying Google Web Search for category "${item.category}"...`);
      const stdout = execSync(`python3 "${scriptPath}" "${item.searchQuery.replace(/"/g, '\\"')}"`, { encoding: 'utf8', timeout: 20000 });
      const urls = JSON.parse(stdout);
      
      if (Array.isArray(urls) && urls.length > 0) {
        console.log(`[DigestService] Google Search returned ${urls.length} URLs. Resolving candidates via Semantic Scholar URL lookup...`);
        const s2ApiKey = process.env.SEMANTIC_SCHOLAR_API_KEY || '';
        
        for (const url of urls) {
          try {
            const paperMeta = await fetchFromSemanticScholarByUrl(url, s2ApiKey);
            if (paperMeta && paperMeta.title) {
              candidates.push({
                category: item.category,
                title: paperMeta.title,
                url: paperMeta.url || url,
                authors: (paperMeta.authors || []).map(a => a.name).join(', ') || 'Unknown Authors',
                year: paperMeta.year || new Date().getFullYear() - 1,
                venue: paperMeta.venue || 'Academic Venue',
                citationCount: paperMeta.citationCount || 0,
                abstract: paperMeta.abstract || '',
                rationale: item.rationale
              });
            }
          } catch (err) {
            // Ignore individual URL lookup failures
          }
        }
      }
    } catch (err) {
      console.warn(`[DigestService] Google Web Search failed for query "${item.searchQuery}":`, err.message);
    }

    // 2. Fallback to Semantic Scholar API search for search query if no candidates resolved
    if (candidates.length === 0) {
      console.log(`[DigestService] Falling back to Semantic Scholar search for query: "${item.searchQuery}"`);
      try {
        const s2ApiKey = process.env.SEMANTIC_SCHOLAR_API_KEY || '';
        const searchResult = await fetchFromSemanticScholar(item.searchQuery, s2ApiKey);
        const results = searchResult.data || [];
        
        for (const r of results) {
          candidates.push({
            category: item.category,
            title: r.title,
            url: r.url || `https://scholar.google.com/scholar?q=${encodeURIComponent(r.title)}`,
            authors: (r.authors || []).map(a => a.name).join(', ') || 'Unknown Authors',
            year: r.year || new Date().getFullYear() - 1,
            venue: r.venue || 'Academic Venue',
            citationCount: r.citationCount || 0,
            abstract: r.abstract || '',
            rationale: item.rationale
          });
        }
      } catch (err) {
        console.error(`[DigestService] Semantic Scholar fallback search failed for: "${item.searchQuery}"`, err.message);
      }
    }

    // 3. Fallback: Try searching specifically for the real fallback paper title suggested by Gemini if still empty
    if (candidates.length === 0 && item.fallbackPaperTitle) {
      console.log(`[DigestService] Attempting specific search for fallback paper: "${item.fallbackPaperTitle}"`);
      let fallbackPaper = null;

      try {
        const s2ApiKey = process.env.SEMANTIC_SCHOLAR_API_KEY || '';
        const searchResult = await fetchFromSemanticScholar(item.fallbackPaperTitle, s2ApiKey);
        const topResult = searchResult.data?.[0];
        if (topResult && isTitleMatch(item.fallbackPaperTitle, topResult.title)) {
          fallbackPaper = {
            category: item.category,
            title: topResult.title,
            url: topResult.url || `https://scholar.google.com/scholar?q=${encodeURIComponent(topResult.title)}`,
            authors: (topResult.authors || []).map(a => a.name).join(', ') || item.fallbackAuthors,
            year: topResult.year || item.fallbackYear,
            venue: topResult.venue || item.fallbackVenue,
            citationCount: topResult.citationCount || 0,
            abstract: topResult.abstract || item.fallbackAbstract,
            rationale: item.rationale
          };
          console.log(`[DigestService] Semantic Scholar specific match for fallback: "${fallbackPaper.title}"`);
        }
      } catch (err) {
        console.error(`[DigestService] Semantic Scholar specific fallback search failed:`, err.message);
      }

      if (fallbackPaper) {
        candidates.push(fallbackPaper);
      } else {
        candidates.push(categoryCandidates[item.category].fallback);
      }
    }
  }

  // --- STEP 2.2: Batch select the best candidate per category using Gemini ---
  onProgress(30, 'Ranking and selecting the most interesting papers for you...');
  const selectionMap = await selectBestCandidatesWithGemini(categoryCandidates, cleanTopic, genAI);
  
  let papersOutline = [];
  // --- STEP 2.5: Retrieve and Parse PDFs for Grounding Context ---
  onProgress(35, 'Retrieving and parsing paper PDFs for grounding context...');
  const s2ApiKey = process.env.SEMANTIC_SCHOLAR_API_KEY || '';

  for (const cat of ['foundation', 'crossfield', 'novel', 'surprise', 'wildcard']) {
    const selected = selectionMap[cat];
    const candidatesList = categoryCandidates[cat]?.list || [];
    const fallback = categoryCandidates[cat]?.fallback;

    // Compile a list of candidate papers to try in order
    const candidatesToTry = [];
    if (selected) {
      candidatesToTry.push(selected);
    }
    
    // Add other candidates sorted by citationCount descending
    const otherCandidates = candidatesList
      .filter(c => !selected || c.title !== selected.title)
      .sort((a, b) => (parseInt(b.citationCount) || 0) - (parseInt(a.citationCount) || 0));
      
    candidatesToTry.push(...otherCandidates);
    
    if (fallback && !candidatesToTry.some(c => c.title === fallback.title)) {
      candidatesToTry.push(fallback);
    }

    console.log(`[DigestService] Attempting to ground category "${cat}" by resolving candidate PDFs...`);
    let chosenPaper = null;

    for (let j = 0; j < candidatesToTry.length; j++) {
      const candidate = candidatesToTry[j];
      console.log(`[DigestService] Trying candidate ${j + 1}/${candidatesToTry.length} for "${cat}": "${candidate.title}"`);
      
      try {
        const pdfResult = await resolvePdfAndTextForPaper(candidate, s2ApiKey);
        if (pdfResult.pdfText) {
          chosenPaper = {
            ...candidate,
            pdfUrl: pdfResult.pdfUrl || candidate.url,
            pdfContext: pdfResult.pdfText.slice(0, 80000)
          };
          console.log(`[DigestService] Successfully resolved and grounded PDF for candidate: "${candidate.title}"`);
          break;
        } else {
          console.log(`[DigestService] PDF resolution failed or returned no text for candidate: "${candidate.title}"`);
        }
      } catch (err) {
        console.warn(`[DigestService] PDF resolution error for candidate "${candidate.title}":`, err.message);
      }
    }

    if (!chosenPaper) {
      console.warn(`[DigestService] All candidates failed to resolve a PDF for category "${cat}". Falling back to first choice abstract.`);
      const defaultChoice = selected || fallback;
      chosenPaper = {
        ...defaultChoice,
        pdfUrl: defaultChoice.url,
        pdfContext: null
      };
    }

    papersOutline.push(chosenPaper);
    console.log(`[DigestService] Final selected paper for "${cat}": "${chosenPaper.title}" (${chosenPaper.year})`);
  }

  const enrichedPapers = [];
  
  for (let i = 0; i < papersOutline.length; i++) {
    const p = papersOutline[i];
    const progressStart = 35 + i * 10;
    onProgress(progressStart, `Deconstructing paper ${i + 1}/5: "${p.title}"...`);

    const detailsPrompt = `You are a world-class senior scientist and academic researcher. Your explanations in the "Under the Hood" sections must be highly technical, rigorous, and written specifically for fellow researchers and domain experts who are highly knowledgeable in the field. Avoid oversimplifications, generalities, or superficial descriptions; instead, focus on the exact mathematical formulations, algorithmic steps, specific datasets/architectures, empirical conditions, or theoretical proofs that define the paper's core contribution.

Analyze the following real, validated paper:
Category/Feed Type: ${p.category}
Title: "${p.title}"
Year: ${p.year}
Authors: ${p.authors}
Venue: ${p.venue}
Citations: ${p.citationCount}
Abstract/Context: "${p.abstract}"
PDF Text Context (Grounding Source): "${p.pdfContext || 'Not available - rely on paper abstract and your internal knowledge base.'}"
Rationale: ${p.rationale}

You must classify this paper into one of the following genres:
- 'methodology': If it introduces a new algorithm, neural network architecture, system, baseline model, or software tool.
- 'empirical_study': If it presents an experimental trial, benchmark study, clinical trial, or scientific analysis of empirical observations.
- 'theoretical': If it is a math-heavy paper proving theorems or complexity limits.
- 'review_survey': If it is a review article surveying a large body of literature.

You MUST generate:
1. Under "explanation", adapt style accordingly:
    - For methodology/theoretical, specify strategyUsed ('metaphor', 'analogy', or 'contrast') and write a spot-on coreIntuition explanation. If the genre is 'methodology', provide a comprehensive list of at least 3 distinct, granular sub-components or algorithmic/implementation steps in the 'deconstructedParts' array.
    - For empirical study, explain researchQuestion, studySetup, keyFindings, and interpretation.
    - For review/survey, explain surveyScope, taxonomy, consensusAndTrends, and openChallenges.
2. Generate a structured "zoomData" object to power the interactive Semantic Zoom UI drawer depending on the paper's type:
    - For 'methodology':
      - "rawFormula" (string): The central equation, loss function, or optimization objective function in raw LaTeX format (do NOT wrap in delimiters like $ or $$; e.g. \\min_{G} \\max_{D} V(D, G) = ...).
      - "translation" (string): A simple plain-English translation sentence explaining the equation's goal.
      - "equationImportance" (string): A rigorous 1-2 sentence explanation of *why* this specific equation or optimization objective represents the foundational mathematical core, primary breakthrough, or critical mechanism of the entire paper, and why it is essential to understand it to comprehend the paper's contribution.
      - "terms" (array): Technical terms inside the formula to decode. You MUST extract BOTH compound terms (e.g. \\mathcal{R}(\\rho, \\mathbf{u}, \\alpha) = 0) and the individual, atomic variables/parameters/symbols that comprise them (e.g. \\rho, \\mathbf{u}, \\alpha, \\mathcal{R}, J, J_p, V^*) as separate, independent entries in this array. Ensure that nearly every letter, parameter, and variable present in the raw LaTeX formula is covered by at least one entry in the terms array, so that every symbol in the equation is interactive and clickable for the user. Sort the final terms list by the length of their "symbol" string in descending order.
        - "symbol" (string): The exact LaTeX symbol, variable, operator, or substring in rawFormula (must be exactly matching the formula notation).
        - "definition" (string): Intuitive explanation of what this specific term/operator represents.
        - "deepDive" (string): Detailed mathematical reasoning (why it's configured this way, how it impacts training/gradients).
        - "subDefinitions" (array): A complete parameter and variable decomposition for this term. You MUST define every single sub-variable, subscript, parameter, or component function inside this term. For example, if the term is U(M, \\beta_p), you MUST include sub-definitions for 'U' (unitary operator), 'M' (mixing Hamiltonian), '\\beta_p' (rotation angle parameter for layer p), and 'p' (layer index step), leaving no variable unexplained. If the term is already an atomic variable, you can keep subDefinitions as an empty array [].
          - "term" (string): Simple variable/operator character name.
          - "definition" (string): Direct explanation of this simple variable/parameter.
    - For 'empirical_study':
      - "verdict" (string): A 1-sentence bottom-line summary of the study results. Do NOT include lists of metrics, numbers, or specific data points here.
      - "metrics" (array): Key statistical metrics observed. You MUST extract actual, quantitative, numerical data points (e.g. percentages, odds ratios, p-values, correlation coefficients, fold changes, or cohort sizes) rather than qualitative descriptors. Under no circumstances list these inside the "verdict" string—they must go exclusively as separate objects in this metrics list.
        - "category" (string): The logical category group for this metric (e.g., "Efficacy Outcomes", "Study Parameters", "Safety Profile", etc.).
        - "label" (string): Metric name (e.g. Weight Loss (15mg), p-value (EEDC exposure)).
        - "rawValue" (string): The exact numerical statistical value observed (e.g. "20.9%", "p < 0.001", "1.5-fold", "n = 2539") - do NOT use qualitative statements.
        - "explanation" (string): What this metric indicates.
        - "cohortContext" (string, optional): Cohort context (e.g. demographics, sample size).
        - "controlValue" (string, optional): The baseline, control group, or raw absolute value before optimization/treatment (e.g. "12.4 MJ/m³", "Placebo: 2.1%").
        - "significance" (string, optional): Statistical significance measurements, p-values, confidence intervals, or standard error bounds (e.g. "p < 0.01", "95% CI: [1.2, 3.5]", "± 0.4%").
        - "measurementMethod" (string, optional): The specific measurement apparatus, test method, or protocol used (e.g. "ASTM D638 Tensile Test", "Shimadzu AG-X Universal Tester").
    - For 'theoretical':
      - "promise" (string): The primary theoretical guarantee or bound statement.
      - "equationImportance" (string): A rigorous 1-2 sentence explanation of *why* this specific bound, theorem equation, or mathematical formulation is the pivotal theoretical milestone of the paper.
      - "steps" (array): Logical steps of the mathematical proof:
        - "stepLabel" (string): High-level description of this step's milestone.
        - "inequalityUsed" (string, optional): LaTeX formula representing the bound/limit of this step.
        - "explanation" (string): Mathematical intuition for this proof step.
        - "deepDive" (string, optional): Technical context of this step.
    - For 'review_survey':
      - "summary" (string): Brief summary of the category taxonomy landscape.
      - "subcategories" (array): Key sub-domains or approaches:
        - "name" (string): Subdomain name.
        - "approach" (string): Underling research approach.
        - "seminalPapers" (array of strings): Key seminal publications.
      - "gaps" (array): Identified research gaps/roadblocks:
        - "challenge" (string): Name of the open challenge.
        - "reason" (string): Root cause of the challenge.
3. Identify technical terms, acronyms, prior methods, or baseline models mentioned in your explanations and extract them under "taggedConcepts" (excluding the paper itself).
4. Extract "achievements" (Key achievements and results of the paper, 2-3 sentences) and "limitations" (Shortcomings, gaps, or assumptions, 2-3 sentences).
5. Extract the following root-level metadata fields:
   - "extractedYear" (integer): The actual, historical publication year of this paper.
   - "extractedTitle" (string): The exact, correct, clean title of the paper.
   - "extractedAuthors" (string): The complete list of actual authors of the paper.

CRITICAL ZOOMDATA POPULATION COMPLIANCE:
You MUST unconditionally populate the nested arrays and objects inside "zoomData" matching the paper's type:
- If explanation.paperType is 'methodology': You MUST provide "rawFormula", "translation", and "terms" (each term MUST include "symbol", "definition", and "subDefinitions").
- If explanation.paperType is 'empirical_study': You MUST provide "verdict" and "metrics" (the "metrics" array MUST contain at least 3 key experimental/benchmark statistics, and each metric MUST include "category", "label", "rawValue", and "explanation").
- If explanation.paperType is 'theoretical': You MUST provide "promise" and "steps" (the "steps" array MUST contain at least 2 logical milestones of the proof, and each step MUST include "stepLabel" and "explanation").
- If explanation.paperType is 'review_survey': You MUST provide "summary", "subcategories", and "gaps" (the "subcategories" array MUST list at least 2 primary taxonomies and "gaps" MUST list at least 2 open research challenges).
NEVER leave these arrays empty or omit them from the response for the matching paper type.
CRITICAL: To satisfy the JSON schema constraints, ALL fields in zoomData are structurally required. For any fields inside zoomData that do NOT correspond to the selected paperType (e.g. rawFormula/terms for an empirical_study, or metrics/verdict for a methodology), you MUST return them as empty strings ("") or empty arrays ([]) in the JSON. Do not omit them or set them to null.

Format your response as a single JSON object.`;

    const detailsConfig = {
      responseMimeType: 'application/json',
      responseSchema: {
        type: "OBJECT",
        properties: {
          extractedTitle: { type: "STRING" },
          extractedAuthors: { type: "STRING" },
          extractedYear: { type: "INTEGER" },
          achievements: { type: "STRING" },
          limitations: { type: "STRING" },
          explanation: {
            type: "OBJECT",
            properties: {
              paperType: {
                type: "STRING",
                enum: ["methodology", "empirical_study", "theoretical", "review_survey"]
              },
              strategyUsed: {
                type: "STRING",
                enum: ["metaphor", "analogy", "contrast"]
              },
              coreIntuition: { type: "STRING" },
              beforeState: { type: "STRING" },
              afterState: { type: "STRING" },
              deconstructedParts: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    title: { type: "STRING" },
                    explanation: { type: "STRING" }
                  },
                  required: ["title", "explanation"]
                }
              },
              synthesis: { type: "STRING" },
              researchQuestion: { type: "STRING" },
              studySetup: { type: "STRING" },
              keyFindings: { type: "STRING" },
              interpretation: { type: "STRING" },
              coreTheorem: { type: "STRING" },
              assumptions: { type: "STRING" },
              proofStrategy: { type: "STRING" },
              theoreticalSignificance: { type: "STRING" },
              surveyScope: { type: "STRING" },
              taxonomy: { type: "STRING" },
              consensusAndTrends: { type: "STRING" },
              openChallenges: { type: "STRING" }
            },
            required: ["paperType", "coreIntuition", "beforeState", "afterState"]
          },
          zoomData: {
            type: "OBJECT",
            properties: {
              rawFormula: { type: "STRING" },
              translation: { type: "STRING" },
              equationImportance: { type: "STRING" },
              terms: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    symbol: { type: "STRING" },
                    definition: { type: "STRING" },
                    deepDive: { type: "STRING" },
                    subDefinitions: {
                      type: "ARRAY",
                      items: {
                        type: "OBJECT",
                        properties: {
                          term: { type: "STRING" },
                          definition: { type: "STRING" }
                        },
                        required: ["term", "definition"]
                      }
                    }
                  },
                  required: ["symbol", "definition", "subDefinitions"]
                }
              },
              verdict: { type: "STRING" },
              metrics: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    category: { type: "STRING" },
                    label: { type: "STRING" },
                    rawValue: { type: "STRING" },
                    explanation: { type: "STRING" },
                    cohortContext: { type: "STRING" },
                    controlValue: { type: "STRING" },
                    significance: { type: "STRING" },
                    measurementMethod: { type: "STRING" }
                  },
                  required: ["category", "label", "rawValue", "explanation"]
                }
              },
              promise: { type: "STRING" },
              steps: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    stepLabel: { type: "STRING" },
                    inequalityUsed: { type: "STRING" },
                    explanation: { type: "STRING" },
                    deepDive: { type: "STRING" }
                  },
                  required: ["stepLabel", "explanation"]
                }
              },
              summary: { type: "STRING" },
              subcategories: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    name: { type: "STRING" },
                    approach: { type: "STRING" },
                    seminalPapers: {
                      type: "ARRAY",
                      items: { type: "STRING" }
                    }
                  },
                  required: ["name", "approach"]
                }
              },
              gaps: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    challenge: { type: "STRING" },
                    reason: { type: "STRING" }
                  },
                  required: ["challenge", "reason"]
                }
              }
            },
            required: ["rawFormula", "translation", "terms", "verdict", "metrics", "promise", "steps", "summary", "subcategories", "gaps"]
          },
          taggedConcepts: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                term: { type: "STRING" },
                nickname: { type: "STRING" },
                definition: { type: "STRING" },
                origin: { type: "STRING" },
                paperUrl: { type: "STRING" },
                relatedTerms: {
                  type: "ARRAY",
                  items: { type: "STRING" }
                }
              },
              required: ["term", "nickname", "definition", "origin", "relatedTerms"]
            }
          }
        },
        required: ["explanation", "zoomData", "taggedConcepts", "achievements", "limitations", "extractedTitle", "extractedAuthors", "extractedYear"]
      }
    };

    let details;
    try {
      const detailsResponse = await generateContentWithFallback(
        genAI,
        'gemini-2.5-flash',
        detailsPrompt,
        detailsConfig
      );
      const sanitizedResponse = escapeJsonLatexBackslashes(detailsResponse);
      details = JSON.parse(sanitizedResponse);
    } catch (err) {
      console.error(`Failed to generate details for paper ${i+1}:`, err);
      details = {
        extractedTitle: p.title,
        extractedAuthors: p.authors,
        extractedYear: p.year,
        achievements: 'No key achievements details.',
        limitations: 'No shortcomings details.',
        explanation: {
          paperType: 'methodology',
          strategyUsed: 'contrast',
          coreIntuition: 'No detailed intuition generated.',
          deconstructedParts: [],
          synthesis: 'No synthesis available.',
          beforeState: 'No prior state details.',
          afterState: 'No achievement details.',
        },
        zoomData: {
          rawFormula: '',
          translation: 'No explanation formula translation available.',
          terms: []
        },
        taggedConcepts: []
      };
    }

    enrichedPapers.push({
      ...p,
      title: details.extractedTitle || p.title,
      authors: details.extractedAuthors || p.authors,
      year: details.extractedYear || p.year,
      explanation: details.explanation,
      zoomData: details.zoomData || {
        rawFormula: '',
        translation: 'No explanation formula translation available.',
        terms: []
      },
      taggedConcepts: details.taggedConcepts,
      coreIdea: details.explanation?.coreIntuition || 'No detailed intuition generated.',
      achievements: details.achievements || 'No key achievements details.',
      limitations: details.limitations || 'No shortcomings details.'
    });
  }

  onProgress(100, 'All papers digested successfully! Building feed...');

  // Save to database cache
  try {
    const cacheUser = userId || 1; // Default to user 1 if not provided (e.g., from cron CLI script)
    await dbRun(
      'INSERT OR REPLACE INTO cached_digests (user_id, topic, digest_date, papers_json, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
      [cacheUser, cleanTopic, digestDate, JSON.stringify(enrichedPapers)]
    );

    // Save a developer debug backup to project root
    try {
      const debugDir = path.join(process.cwd(), 'debug_runs');
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
      }
      const safeTopic = cleanTopic.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 50);
      const backupPath = path.join(debugDir, `${digestDate}_${safeTopic}.json`);
      fs.writeFileSync(backupPath, JSON.stringify({
        userId: cacheUser,
        topic: cleanTopic,
        digestDate,
        papers: enrichedPapers
      }, null, 2));
      console.log(`[Developer Debug] Saved digest backup to: ${backupPath}`);
    } catch (fsErr) {
      console.warn('[Developer Debug] Failed to save debug backup file:', fsErr.message);
    }
  } catch (dbErr) {
    console.error('Failed to cache generated digest in database:', dbErr);
  }

  return enrichedPapers;
}
