import { GoogleGenerativeAI } from '@google/generative-ai';
import { dbGet, dbRun, dbAll } from '../db.js';

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

// Helper function to try generating content with sequential fallbacks (gemini-2.5-flash, gemini-2.0-flash)
async function generateContentWithFallback(genAI, primaryModelName, prompt, config) {
  const modelsToTry = [primaryModelName, 'gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'];
  const uniqueModels = [...new Set(modelsToTry)];

  let lastError;
  for (const modelName of uniqueModels) {
    try {
      console.log(`[Gemini API] Attempting generation with model: ${modelName}`);
      const model = genAI.getGenerativeModel({ model: modelName, generationConfig: config });
      return await retryWithDelay(async () => {
        try {
          const result = await model.generateContent(prompt);
          return result.response.text();
        } catch (err) {
          const errMsg = err.message || '';
          if (errMsg.includes('RequestsPerDay') || errMsg.includes('free_tier_requests')) {
            err.isDailyQuota = true;
          }
          throw err;
        }
      }, 3, 2000, 1.5);
    } catch (err) {
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

async function fetchFromSemanticScholarDirect(query, apiKey) {
  const cleanQuery = encodeURIComponent(query);
  const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${cleanQuery}&limit=1&fields=paperId,title,citationCount,venue,url,openAccessPdf,externalIds`;
  
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

    const pdfMatch = xmlText.match(/<link[^>]*title="pdf"[^>]*href="([^"]+)"/);
    const pdfUrl = pdfMatch ? pdfMatch[1] : undefined;

    const htmlMatch = xmlText.match(/<link[^>]*type="text\/html"[^>]*href="([^"]+)"/);
    let paperUrl = htmlMatch ? htmlMatch[1] : undefined;
    if (!paperUrl) {
      const idMatch = xmlText.match(/<id>([^<]+)<\/id>/);
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

export async function enrichPaperMetadata(title, searchKeywords, s2ApiKey) {
  // Helper to sanitise arXiv PDF URLs to abstract page URLs to avoid 403 / Rate limit errors
  const sanitiseArxivUrl = (url) => {
    if (url && url.includes('arxiv.org/pdf/')) {
      return url.replace('/pdf/', '/abs/').replace(/\.pdf$/, '').replace(/v\d+$/, '');
    }
    return url;
  };

  // 1. Try Semantic Scholar with exact title
  try {
    const searchResult = await fetchFromSemanticScholar(title, s2ApiKey);
    const paper = searchResult.data?.[0];
    if (paper) {
      const doi = paper.externalIds?.DOI;
      let rawCitations = [];
      let rawReferences = [];
      if (paper.paperId) {
        try {
          console.log(`[Semantic Scholar] Fetching details for paperId: ${paper.paperId}`);
          const details = await fetchSemanticScholarDetails(paper.paperId, s2ApiKey);
          rawCitations = details.citations || [];
          rawReferences = details.references || [];
        } catch (detailErr) {
          console.warn(`[Semantic Scholar] Failed to fetch nested details for ${paper.paperId}:`, detailErr.message);
        }
      }

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

      return {
        citationCount: paper.citationCount ?? undefined,
        venue: paper.venue || undefined,
        pdfUrl: sanitiseArxivUrl(paper.openAccessPdf?.url || undefined),
        paperUrl: doi ? `https://doi.org/${doi}` : paper.url || undefined,
        source: 'semantic-scholar',
        citations: topCitations,
        references: topReferences
      };
    }
  } catch (error) {
    console.warn('Semantic Scholar exact title query failed, trying searchKeywords...', error.message);
  }

  // 2. Try Semantic Scholar with searchKeywords
  if (searchKeywords && searchKeywords !== title) {
    try {
      const searchResult = await fetchFromSemanticScholar(searchKeywords, s2ApiKey);
      const paper = searchResult.data?.[0];
      if (paper) {
        const doi = paper.externalIds?.DOI;
        let rawCitations = [];
        let rawReferences = [];
        if (paper.paperId) {
          try {
            console.log(`[Semantic Scholar] Fetching details for paperId: ${paper.paperId}`);
            const details = await fetchSemanticScholarDetails(paper.paperId, s2ApiKey);
            rawCitations = details.citations || [];
            rawReferences = details.references || [];
          } catch (detailErr) {
            console.warn(`[Semantic Scholar] Failed to fetch nested details for ${paper.paperId}:`, detailErr.message);
          }
        }

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

        return {
          citationCount: paper.citationCount ?? undefined,
          venue: paper.venue || undefined,
          pdfUrl: sanitiseArxivUrl(paper.openAccessPdf?.url || undefined),
          paperUrl: doi ? `https://doi.org/${doi}` : paper.url || undefined,
          source: 'semantic-scholar',
          citations: topCitations,
          references: topReferences
        };
      }
    } catch (error) {
      console.warn('Semantic Scholar keywords query failed, attempting fallbacks...', error.message);
    }
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
      return {
        citationCount: pmcResult?.citationCount ?? undefined,
        venue: pmcResult?.venue ?? (arxivResult ? 'arXiv Preprint' : undefined),
        pdfUrl: sanitiseArxivUrl(arxivResult?.pdfUrl || undefined),
        paperUrl: doiUrl || arxivPaperUrl || undefined,
        source: 'fallback-apis',
        citations: [],
        references: []
      };
    }
  } catch (error) {
    console.error('Fallback APIs (Europe PMC/arXiv) failed:', error);
  }

  // 4. Try CrossRef fallback by exact title
  try {
    const crossRefResult = await fetchFromCrossRef(title);
    if (crossRefResult) {
      return crossRefResult;
    }
  } catch (error) {
    console.error('CrossRef fallback failed:', error);
  }

  // 5. Google Scholar fallback search page
  return {
    paperUrl: `https://scholar.google.com/scholar?q=${encodeURIComponent(title)}`,
    source: 'google-scholar',
    citations: [],
    references: []
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
    model: 'gemini-2.5-flash',
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

  // --- STEP 1: Search and Outline (Cheap model: gemini-1.5-flash) ---
  const outlinePrompt = `You are a world-class academic research advisor and science communicator.
The user's research interest is: "${cleanTopic}".
${exclusionPromptPart}

Identify exactly 5 papers related to this research interest, selecting exactly one paper to fit each of the following 5 categories:
1. 'foundation': One landmark paper (the bedrock paper that defined this concept or established the field).
2. 'crossfield': One somehow related paper but from another field.
3. 'novel': One very recent paper close to the user's research interests.
4. 'surprise': One surprise paper (a landmark paper from another field that might interest the user).
5. 'wildcard': One interesting paper from their field that they might have missed (not a landmark, but interesting).

Format your response as a JSON array containing exactly 5 objects, ordered precisely in the sequence above (foundation, crossfield, novel, surprise, wildcard).`;

  onProgress(10, 'Connecting to Gemini AI and researching paper index...');

  const outlineConfig = {
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
          title: { type: "STRING" },
          nickname: { type: "STRING" },
          authors: { type: "STRING" },
          year: { type: "INTEGER" },
          purpose: { type: "STRING" },
          historicalPlace: { type: "STRING" },
          achievements: { type: "STRING" },
          limitations: { type: "STRING" },
          searchKeywords: { type: "STRING" },
          references: {
            type: "ARRAY",
            items: { type: "STRING" }
          }
        },
        required: [
          "category",
          "title",
          "nickname",
          "authors",
          "year",
          "purpose",
          "historicalPlace",
          "achievements",
          "limitations",
          "searchKeywords",
          "references"
        ]
      }
    }
  };

  const outlineResponse = await generateContentWithFallback(
    genAI,
    'gemini-2.5-flash',
    outlinePrompt,
    outlineConfig
  );

  let papersOutline = JSON.parse(outlineResponse);
  if (!Array.isArray(papersOutline) || papersOutline.length === 0) {
    throw new Error('Invalid JSON structure returned by model');
  }

  // --- STEP 2: Detailed Digest Composition (Better model: gemini-2.5-flash) ---
  onProgress(45, `Found 5 papers. Composing technical details and deep summaries...`);

  const detailsPrompt = `You are a world-class senior scientist and academic researcher. Your explanations in the "Under the Hood" sections must be highly technical, rigorous, and written specifically for fellow researchers and domain experts who are highly knowledgeable in the field. Avoid oversimplifications, generalities, or superficial descriptions; instead, focus on the exact mathematical formulations, algorithmic steps, specific datasets/architectures, empirical conditions, or theoretical proofs that define the paper's core contribution.
We have selected the following 5 papers for a research digest on the interest topic: "${cleanTopic}".

For EACH of the papers listed below, compose a comprehensive, highly technical, and academically rigorous explanation of the core content of this paper, adapting your explanation structure based on the paper's genre, and extracting key technical terms for inline tagging.

Papers:
${papersOutline.map((p, idx) => `
[Paper ${idx + 1}]
Category: ${p.category}
Title: "${p.title}" (${p.year})
Authors: ${p.authors}
Purpose: ${p.purpose}
Achievements: ${p.achievements}
Historical Place: ${p.historicalPlace}
`).join('\n')}

For EACH paper, generate:
1. A conceptual explanation based on the paper's genre:
   - 'methodology': If it introduces a new algorithm, neural network architecture, system, baseline model, or software tool.
   - 'empirical_study': If it presents an experimental trial, benchmark study, clinical trial, or scientific analysis of empirical observations.
   - 'theoretical': If it is a math-heavy paper proving theorems or complexity limits.
   - 'review_survey': If it is a review article surveying a large body of literature.
2. Under "explanation", adapt style accordingly:
   - For methodology/theoretical, specify strategyUsed ('metaphor', 'analogy', or 'contrast') and write a spot-on coreIntuition explanation.
   - For empirical study, explain researchQuestion, studySetup, keyFindings, and interpretation.
   - For review/survey, explain surveyScope, taxonomy, consensusAndTrends, and openChallenges.
3. Identify technical terms, acronyms, prior methods, or baseline models mentioned in your explanations and extract them under "taggedConcepts" (excluding the paper itself).

Format your response as a JSON array containing exactly 5 objects matching the order of the inputs above.`;

  const detailsConfig = {
    responseMimeType: 'application/json',
    responseSchema: {
      type: "ARRAY",
      items: {
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
    }
  };

  const detailsResponse = await generateContentWithFallback(
    genAI,
    'gemini-2.5-flash',
    detailsPrompt,
    detailsConfig
  );

  let detailsArray = JSON.parse(detailsResponse);
  if (!Array.isArray(detailsArray) || detailsArray.length === 0) {
    throw new Error('Invalid JSON structure returned for paper details');
  }

  onProgress(85, 'Assembling final digest and building feed...');

  const enrichedPapers = papersOutline.map((paper, index) => {
    const details = detailsArray[index] || {
      explanation: {
        paperType: 'methodology',
        strategyUsed: 'contrast',
        coreIntuition: 'No detailed intuition generated.',
        deconstructedParts: [],
        synthesis: 'No synthesis available.',
        beforeState: paper.historicalPlace || 'No prior state details.',
        afterState: paper.achievements || 'No achievement details.',
      },
      taggedConcepts: []
    };
    return {
      ...paper,
      explanation: details.explanation,
      taggedConcepts: details.taggedConcepts,
      coreIdea: details.explanation?.coreIntuition || 'No detailed intuition generated.'
    };
  });

  onProgress(100, 'All papers digested successfully! Building feed...');

  // Save to database cache
  try {
    const cacheUser = userId || 1; // Default to user 1 if not provided (e.g., from cron CLI script)
    await dbRun(
      'INSERT OR REPLACE INTO cached_digests (user_id, topic, digest_date, papers_json, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
      [cacheUser, cleanTopic, digestDate, JSON.stringify(enrichedPapers)]
    );
  } catch (dbErr) {
    console.error('Failed to cache generated digest in database:', dbErr);
  }

  return enrichedPapers;
}
