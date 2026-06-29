import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { dbGet, dbAll } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { generateAndCacheDigest, enrichPaperMetadata } from '../services/digestService.js';
import { enqueueDigestGeneration } from '../services/digestQueue.js';

const router = express.Router();

// Helper function to retry Gemini API calls on 429 rate limit or transient errors
async function retryWithDelay(fn, retries = 2, delay = 1200) {
  try {
    return await fn();
  } catch (err) {
    if (retries > 0) {
      console.warn(`Gemini API call failed. Retrying in ${delay}ms...`, err);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return retryWithDelay(fn, retries - 1, delay * 1.5);
    }
    throw err;
  }
}

// 1. Generate digest (Supports SSE for real-time progress)
router.get('/generate', requireAuth, async (req, res) => {
  const { topic, bypassCache } = req.query;
  const userId = req.userId;

  if (!topic || topic.trim() === '') {
    return res.status(400).json({ error: 'Topic query parameter is required.' });
  }

  const cleanTopic = topic.trim();

  // Set headers for Server-Sent Events (SSE)
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendProgress = (progress, statusText) => {
    res.write(`data: ${JSON.stringify({ progress, statusText })}\n\n`);
  };

  // 1. Check SQLite Cache First (unless explicitly bypassing)
  if (bypassCache !== 'true') {
    try {
      const cachedRow = await dbGet('SELECT papers_json FROM cached_digests WHERE LOWER(topic) = LOWER(?)', [cleanTopic]);
      if (cachedRow) {
        sendProgress(100, 'Loading cached digest from database...');
        res.write(`data: ${JSON.stringify({ done: true, papers: JSON.parse(cachedRow.papers_json) })}\n\n`);
        res.end();
        return;
      }
    } catch (err) {
      console.error('Failed to query cached digests:', err);
    }
  }

  // 2. Fetch API keys for this user
  let userKeys;
  try {
    userKeys = await dbGet('SELECT gemini_key, s2_key FROM user_keys WHERE user_id = ?', [userId]);
  } catch (err) {
    console.error('Failed to query user keys:', err);
    res.write(`data: ${JSON.stringify({ error: 'Database query failed.' })}\n\n`);
    res.end();
    return;
  }

  const geminiApiKey = (userKeys?.gemini_key && userKeys.gemini_key.trim() !== '')
    ? userKeys.gemini_key.trim()
    : process.env.GEMINI_API_KEY;

  if (!geminiApiKey || geminiApiKey.trim() === '') {
    res.write(`data: ${JSON.stringify({ error: 'Please set your Gemini API Key in Settings first.' })}\n\n`);
    res.end();
    return;
  }

  try {
    // 1. Enqueue task with priority = 1 (urgent priority for new users)
    await enqueueDigestGeneration(userId, cleanTopic, 1);

    // 2. Poll queue task status and stream updates to the client
    let attempts = 0;
    const maxAttempts = 300; // 5 minutes max
    while (attempts < maxAttempts) {
      // Check cache first in case task completed
      const cachedRow = await dbGet('SELECT papers_json FROM cached_digests WHERE LOWER(topic) = LOWER(?)', [cleanTopic]);
      if (cachedRow) {
        sendProgress(100, 'Loading generated papers...');
        res.write(`data: ${JSON.stringify({ done: true, papers: JSON.parse(cachedRow.papers_json) })}\n\n`);
        res.end();
        return;
      }

      // Check queue status
      const queueTask = await dbGet(`
        SELECT status, progress, status_text FROM generation_queue 
        WHERE user_id = ? AND topic = ? 
        ORDER BY id DESC LIMIT 1
      `, [userId, cleanTopic]);

      if (queueTask) {
        if (queueTask.status === 'failed') {
          res.write(`data: ${JSON.stringify({ error: 'Generation task failed in the background queue.' })}\n\n`);
          res.end();
          return;
        }
        sendProgress(queueTask.progress || 0, queueTask.status_text || 'Waiting in queue...');
      }

      await new Promise((resolve) => setTimeout(resolve, 1500));
      attempts++;
    }

    res.write(`data: ${JSON.stringify({ error: 'Generation timed out in queue.' })}\n\n`);
    res.end();
  } catch (err) {
    console.error('Digest generation failed:', err);
    res.write(`data: ${JSON.stringify({ error: err.message || 'Failed to generate digest.' })}\n\n`);
    res.end();
  }
});

// 2. Fetch paper metadata (Semantic Scholar with Europe PMC / arXiv fallbacks)
router.get('/details', requireAuth, async (req, res) => {
  const { title, searchKeywords } = req.query;
  const userId = req.userId;

  if (!title || title.trim() === '') {
    return res.status(400).json({ error: 'Title query parameter is required.' });
  }

  try {
    const userKeys = await dbGet('SELECT s2_key FROM user_keys WHERE user_id = ?', [userId]);
    const s2ApiKey = userKeys?.s2_key || '';

    const metadata = await enrichPaperMetadata(title, searchKeywords, s2ApiKey);
    res.json(metadata);
  } catch (err) {
    console.error(`Failed to enrich metadata for ${title}:`, err);
    res.status(500).json({ error: 'Failed to enrich paper metadata.' });
  }
});

// 3. Sends follow-up chats to Gemini using the paper context
router.post('/question', requireAuth, async (req, res) => {
  const { paper, extraMetadata, question, history } = req.body;
  const userId = req.userId;

  if (!paper || !question) {
    return res.status(400).json({ error: 'Paper details and question are required.' });
  }

  try {
    const userKeys = await dbGet('SELECT gemini_key FROM user_keys WHERE user_id = ?', [userId]);
    const geminiApiKey = (userKeys?.gemini_key && userKeys.gemini_key.trim() !== '')
      ? userKeys.gemini_key.trim()
      : process.env.GEMINI_API_KEY;

    if (!geminiApiKey || geminiApiKey.trim() === '') {
      return res.status(400).json({ error: 'Please set your Gemini API Key in Settings first.' });
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const apiHistory = (history || []).map(h => ({
      role: h.role,
      parts: h.parts
    }));

    const deconstructedStr = paper.explanation?.deconstructedParts
      ? paper.explanation.deconstructedParts.map(p => `  * ${p.title}: ${p.explanation}`).join('\n')
      : 'N/A';

    const conceptsStr = paper.taggedConcepts
      ? paper.taggedConcepts.map(c => `  * Concept: "${c.term}"\n    Definition: ${c.definition}\n    Origin: ${c.origin}`).join('\n')
      : 'N/A';

    const explanation = paper.explanation;
    const typeSpecificStr = explanation
      ? explanation.paperType === 'empirical_study'
        ? `- Research Question: ${explanation.researchQuestion || 'N/A'}
- Study Setup / Methodology: ${explanation.studySetup || 'N/A'}
- Key Findings / Results: ${explanation.keyFindings || 'N/A'}
- Interpretation / Implications: ${explanation.interpretation || 'N/A'}`
        : explanation.paperType === 'theoretical'
        ? `- Core Theorem / Statement: ${explanation.coreTheorem || 'N/A'}
- Assumptions & Framework: ${explanation.assumptions || 'N/A'}
- Proof Strategy & Intuition: ${explanation.proofStrategy || 'N/A'}
- Theoretical Significance: ${explanation.theoreticalSignificance || 'N/A'}`
        : explanation.paperType === 'review_survey'
        ? `- Survey Scope & Theme: ${explanation.surveyScope || 'N/A'}
- Taxonomy & Classifications: ${explanation.taxonomy || 'N/A'}
- Consensus & Trends: ${explanation.consensusAndTrends || 'N/A'}
- Future Challenges & Roadmap: ${explanation.openChallenges || 'N/A'}`
        : `- Deconstructed Sub-components:
${deconstructedStr}
- How It Plugs Together (Synthesis): ${explanation.synthesis || 'N/A'}`
      : `- Deconstructed Sub-components:
${deconstructedStr}`;

    const systemInstruction = `You are an expert academic advisor helping a researcher understand a foundational paper.
Here is the context of the paper we are discussing:
- Title: "${paper.title}"
- Authors: ${paper.authors}
- Year: ${paper.year}
- Publication Venue: ${extraMetadata?.venue || 'Unknown / Journal'}
- Citations (Semantic Scholar): ${extraMetadata?.citationCount !== undefined ? extraMetadata.citationCount.toLocaleString() : 'N/A'}
- Paper Type/Genre: ${explanation?.paperType || 'methodology'}
- AI Summary of Purpose: ${paper.purpose}
- AI Summary of Historical Place: ${paper.historicalPlace}
- AI Summary of Core Idea: ${paper.coreIdea}
- Selected Explanation Strategy: ${explanation?.strategyUsed || 'N/A'}
${typeSpecificStr}
- Before State (Prior Paradigm/Limitation): ${explanation?.beforeState || 'N/A'}
- After State (Improvements/New Paradigm): ${explanation?.afterState || 'N/A'}
- Key Technical Concepts & Referenced Methods:
${conceptsStr}
- AI Summary of Achievements: ${paper.achievements}
- AI Summary of Limitations: ${paper.limitations}
 
Use this context to answer any follow-up questions from the user. Be concise, academically rigorous, yet accessible. Answer the user's question directly. If you need to make reasonable academic inferences, do so but state them clearly. If the question is completely unrelated to this paper or its surrounding academic context, politely remind the user and steer them back.`;

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: systemInstruction,
    });

    const responseText = await retryWithDelay(async () => {
      const chat = model.startChat({ history: apiHistory });
      const result = await chat.sendMessage(question);
      return result.response.text();
    });

    res.json({ text: responseText });
  } catch (err) {
    console.error('Follow-up chat failed:', err);
    res.status(500).json({ error: 'Failed to chat with Gemini.' });
  }
});

export default router;
