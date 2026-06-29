export interface EnrichedMetadata {
  citationCount?: number;
  venue?: string;
  pdfUrl?: string;
  paperUrl?: string;
  source: 'semantic-scholar' | 'fallback-apis' | 'google-scholar';
}

const METADATA_CACHE_KEY = 'papertok_metadata_cache';

/**
 * Retrieves cached metadata from localStorage.
 */
export function getCachedMetadata(title: string): EnrichedMetadata | null {
  if (typeof window === 'undefined') return null;
  try {
    const cacheStr = localStorage.getItem(METADATA_CACHE_KEY);
    if (!cacheStr) return null;
    const cache = JSON.parse(cacheStr);
    return cache[title.toLowerCase()] || null;
  } catch (err) {
    console.error('Failed to parse metadata cache:', err);
    return null;
  }
}

/**
 * Saves metadata to localStorage cache.
 */
export function setCachedMetadata(title: string, metadata: EnrichedMetadata) {
  if (typeof window === 'undefined') return;
  try {
    const cacheStr = localStorage.getItem(METADATA_CACHE_KEY) || '{}';
    const cache = JSON.parse(cacheStr);
    cache[title.toLowerCase()] = metadata;
    localStorage.setItem(METADATA_CACHE_KEY, JSON.stringify(cache));
  } catch (err) {
    console.error('Failed to write metadata cache:', err);
  }
}

// Keep track of active, in-flight promises to deduplicate concurrent requests for the same paper
const inFlightRequests = new Map<string, Promise<EnrichedMetadata>>();

/**
 * Enriches paper metadata by calling the backend /api/digest/details endpoint.
 */
export async function enrichPaperMetadata(
  title: string,
  searchKeywords: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _s2ApiKey?: string
): Promise<EnrichedMetadata> {
  const cacheKey = title.toLowerCase();

  // 1. Check persistent cache first
  const cached = getCachedMetadata(title);
  if (cached) {
    return cached;
  }

  // 2. Check if there is already an in-flight request for this paper
  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey)!;
  }

  // 3. Create the fetch promise calling backend details route
  const fetchPromise = (async (): Promise<EnrichedMetadata> => {
    const token = localStorage.getItem('papertok_token');
    const url = `/api/digest/details?title=${encodeURIComponent(title)}&searchKeywords=${encodeURIComponent(searchKeywords || '')}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || 'Failed to fetch paper details from server.');
    }

    const enriched = await response.json();
    setCachedMetadata(title, enriched);
    return enriched;
  })();

  // Store the promise so concurrent calls reuse it
  inFlightRequests.set(cacheKey, fetchPromise);

  try {
    return await fetchPromise;
  } finally {
    // Clean up the in-flight request map once resolved/rejected
    inFlightRequests.delete(cacheKey);
  }
}
