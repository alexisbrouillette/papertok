import { GoogleGenerativeAI } from '@google/generative-ai';
import { dbGet, dbRun, dbAll } from '../db.js';

// Helper function to retry a function with exponential backoff.
async function retryWithDelay(fn, retries = 5, delay = 5000, factor = 2) {
  try {
    return await fn();
  } catch (err) {
    if (retries > 0) {
      console.warn(`[Retry] Operation failed. Retrying in ${delay}ms... (${retries} retries left). Error:`, err.message);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return retryWithDelay(fn, retries - 1, delay * factor);
    }
    throw err;
  }
}

// --- LITERATURE METADATA FETCH HELPERS ---

async function fetchFromSemanticScholar(query, apiKey) {
  const cleanQuery = encodeURIComponent(query);
  const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${cleanQuery}&limit=1&fields=title,citationCount,venue,url,openAccessPdf`;
  
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

export async function enrichPaperMetadata(title, searchKeywords, s2ApiKey) {
  try {
    const searchResult = await fetchFromSemanticScholar(searchKeywords || title, s2ApiKey);
    const paper = searchResult.data?.[0];
    
    if (paper) {
      return {
        citationCount: paper.citationCount ?? undefined,
        venue: paper.venue || undefined,
        pdfUrl: paper.openAccessPdf?.url || undefined,
        paperUrl: paper.url || undefined,
        source: 'semantic-scholar'
      };
    }
  } catch (error) {
    console.warn('Semantic Scholar query failed, attempting fallbacks...', error.message);
  }

  try {
    const [pmcResult, arxivResult] = await Promise.all([
      fetchFromEuropePMC(title),
      fetchFromArXiv(title)
    ]);

    if (pmcResult || arxivResult) {
      return {
        citationCount: pmcResult?.citationCount ?? undefined,
        venue: pmcResult?.venue ?? (arxivResult ? 'arXiv Preprint' : undefined),
        pdfUrl: arxivResult?.pdfUrl ?? undefined,
        paperUrl: arxivResult?.paperUrl ?? pmcResult?.paperUrl ?? undefined,
        source: 'fallback-apis'
      };
    }
  } catch (error) {
    console.error('Fallback APIs failed:', error);
  }

  return {
    paperUrl: `https://scholar.google.com/scholar?q=${encodeURIComponent(title)}`,
    source: 'google-scholar'
  };
}

// --- GEMINI GENERATION HELPERS ---

async function generatePaperDetails(paper, apiKey) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const prompt = `You are a world-class expert researcher and science communicator.
We are analyzing the foundational paper: "${paper.title}" (${paper.year}) by ${paper.authors}.
The paper's stated purpose is: "${paper.purpose}"
The paper's achievements: "${paper.achievements}"

Your goal is to generate a comprehensive, highly-polished conceptual explanation of the core content of this paper, adapting your explanation structure based on the paper's genre, and extracting key technical terms for inline tagging.

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

  // Fetch papers the user has already read
  let excludedPapersList = [];
  if (userId) {
    try {
      const rows = await dbAll('SELECT DISTINCT paper_title FROM reading_progress WHERE user_id = ?', [userId]);
      excludedPapersList = rows.map(r => r.paper_title);
    } catch (dbErr) {
      console.error('[DigestService] Failed to fetch user read history for exclusion:', dbErr);
    }
  }

  let exclusionPromptPart = '';
  if (excludedPapersList.length > 0) {
    exclusionPromptPart = `
CRITICAL: DO NOT SELECT any of the following papers under any circumstances because the user has already read/seen them in their history:
${excludedPapersList.map(title => `- "${title}"`).join('\n')}

Ensure that the 5 landmark papers you select are completely different from this list, even if they are closely related or from the same authors. Use other landmark publications.`;
  }

  const prompt = `You are a world-class academic research advisor and science communicator.
The user's research interest is: "${cleanTopic}".
${exclusionPromptPart}

Identify exactly 5 crucial, landmark papers in this specific field, selecting exactly one paper to fit each of the following 5 categories:
1. 'foundation': The bedrock paper that defined this concept or established the field.
2. 'surprise': A landmark paper with counter-intuitive findings, surprising results, or that challenged prevailing assumptions.
3. 'crossfield': A paper showing how this concept or method bridges into other domains or combines ideas from different fields.
4. 'novel': A highly significant recent breakthrough, modern state-of-the-art work, or recent development.
5. 'wildcard': An unusual, unexpected, or hidden gem paper that is interesting and relevant to keep the digest fresh.

Format your response as a JSON array containing exactly 5 objects, ordered precisely in the sequence above (foundation, surprise, crossfield, novel, wildcard). Do not wrap it in markdown block - just return the raw JSON.`;

  onProgress(5, 'Connecting to Gemini AI and searching academic index...');

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
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
    },
  });

  const textResponse = await retryWithDelay(async () => {
    const result = await model.generateContent(prompt);
    return result.response.text();
  });

  let papersOutline = JSON.parse(textResponse);
  if (!Array.isArray(papersOutline) || papersOutline.length === 0) {
    throw new Error('Invalid JSON structure returned by model');
  }

  onProgress(15, `Found ${papersOutline.length} foundational papers. Digesting technical concepts...`);

  const enrichedPapers = [];
  for (let i = 0; i < papersOutline.length; i++) {
    const paper = papersOutline[i];
    const displayIndex = i + 1;
    const progressVal = Math.round(15 + (i / papersOutline.length) * 80);
    
    onProgress(
      progressVal,
      `Digesting paper ${displayIndex} of ${papersOutline.length}: "${paper.title}"...`
    );

    try {
      const details = await generatePaperDetails(paper, geminiApiKey);
      enrichedPapers.push({
        ...paper,
        explanation: details.explanation,
        taggedConcepts: details.taggedConcepts,
        coreIdea: details.explanation.coreIntuition,
      });
    } catch (err) {
      console.warn(`Failed to generate details for ${paper.title}, using fallback...`, err);
      enrichedPapers.push({
        ...paper,
        explanation: {
          paperType: 'methodology',
          strategyUsed: 'contrast',
          coreIdea: paper.coreIdea || 'No detailed intuition generated.',
          deconstructedParts: [],
          synthesis: 'No synthesis available.',
          beforeState: paper.historicalPlace || 'No prior state details.',
          afterState: paper.achievements || 'No achievement details.',
        },
        taggedConcepts: [],
      });
    }
  }

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
