export type PaperType = 'methodology' | 'empirical_study' | 'theoretical' | 'review_survey';

export interface DeconstructedPart {
  title: string;
  explanation: string;
}

export interface DetailedExplanation {
  paperType: PaperType;
  strategyUsed?: 'metaphor' | 'analogy' | 'contrast';
  coreIntuition: string;
  beforeState: string;
  afterState: string;

  // Methodology-specific fields
  deconstructedParts?: DeconstructedPart[];
  synthesis?: string;

  // Empirical study-specific fields
  researchQuestion?: string;
  studySetup?: string;
  keyFindings?: string;
  interpretation?: string;

  // Theoretical-specific fields
  coreTheorem?: string;
  assumptions?: string;
  proofStrategy?: string;
  theoreticalSignificance?: string;

  // Review/Survey-specific fields
  surveyScope?: string;
  taxonomy?: string;
  consensusAndTrends?: string;
  openChallenges?: string;
}

export interface TaggedConcept {
  term: string;
  nickname?: string;
  definition: string;
  origin: string;
  paperUrl?: string;
  relatedTerms?: string[];
}

export interface FoundationalPaper {
  category?: string;
  title: string;
  nickname?: string;
  authors: string;
  year: number;
  citationCount?: number;
  purpose: string;
  historicalPlace: string;
  coreIdea: string;
  achievements: string;
  limitations: string;
  explanation: DetailedExplanation;
  taggedConcepts?: TaggedConcept[];
  searchKeywords: string;
  references?: string[];
  zoomData?: any;
}

export interface ChatMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

/**
 * Calls the backend `/api/digest/generate` route and parses the SSE stream to notify onProgress.
 */
export async function generateFoundationalPapers(
  interest: string,
  _apiKey: string,
  onProgress?: (progress: number, statusText: string) => void,
  bypassCache = false,
  debugDayOffset = 0
): Promise<FoundationalPaper[]> {
  const token = localStorage.getItem('papertok_token');
  const url = `/api/digest/generate?topic=${encodeURIComponent(interest)}${bypassCache ? '&bypassCache=true' : ''}&debugDayOffset=${debugDayOffset}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ error: 'Generation request failed.' }));
    throw new Error(errData.error || 'Failed to generate foundational papers.');
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Streaming not supported by browser.');
  }

  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let papers: FoundationalPaper[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep last unfinished chunk in buffer

    for (const line of lines) {
      if (line.trim().startsWith('data: ')) {
        const jsonStr = line.replace(/^data:\s*/, '').trim();
        if (!jsonStr) continue;

        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed.error) {
            throw new Error(parsed.error);
          }
          if (parsed.done) {
            papers = parsed.papers;
          } else if (parsed.progress !== undefined) {
            onProgress?.(parsed.progress, parsed.statusText);
          }
        } catch (err) {
          console.error('Failed to parse SSE line:', jsonStr, err);
          const errMsg = err instanceof Error ? err.message : String(err);
          if (errMsg) {
            throw new Error(errMsg, { cause: err });
          }
        }
      }
    }
  }

  if (papers.length === 0) {
    throw new Error('No papers were returned by the generation server.');
  }

  return papers;
}

/**
 * Sends a chat message to the backend `/api/digest/question` route.
 */
export async function askPaperQuestion(
  paper: FoundationalPaper,
  extraMetadata: { citationCount?: number; venue?: string; pdfUrl?: string },
  question: string,
  history: ChatMessage[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _apiKey: string
): Promise<string> {
  const token = localStorage.getItem('papertok_token');
  const response = await fetch('/api/digest/question', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ paper, extraMetadata, question, history })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to chat with Gemini.');
  }
  return data.text;
}
