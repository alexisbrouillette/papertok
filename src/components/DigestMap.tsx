import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, X, Sparkles, BookOpen, Globe, Rocket, Shuffle, CheckCircle, RefreshCw, Flame, Settings, LogOut } from 'lucide-react';
import type { FoundationalPaper, ChatMessage } from '../services/gemini';
import { askPaperQuestion, generateFoundationalPapers } from '../services/gemini';
import { PaperCard } from './PaperCard';

/* ─── Types ─────────────────────────────────────────────────── */
type CategoryKey = 'foundation' | 'surprise' | 'crossfield' | 'novel' | 'wildcard';

interface Category {
  key: CategoryKey;
  label: string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
  glow: string;
  textColor: string;
}

interface DigestNode {
  id: string;
  title: string;
  papers: Partial<Record<CategoryKey, FoundationalPaper>>;
  readCategories: CategoryKey[];
}

interface DigestMapProps {
  topic: string;
  papers: FoundationalPaper[];
  s2ApiKey?: string;
  geminiApiKey: string;
  onBack: () => void;
  loadingProgress?: number;
  loadingStatus?: string;
  streak: number;
  onOpenSettings: () => void;
  onSignOut: () => void;
  onStreakUpdated?: (streak: number) => void;
  debugDayOffset: number;
  onAdvanceDay: () => void;
}

/* ─── Category Definitions ───────────────────────────────────── */
const CATEGORIES: Category[] = [
  {
    key: 'foundation',
    label: 'The Foundation',
    subtitle: 'The bedrock paper that defined this concept',
    icon: <BookOpen size={20} />,
    color: 'rgba(109, 40, 217, 0.08)',
    glow: 'rgba(109, 40, 217, 0.15)',
    textColor: '#5b21b6',
  },
  {
    key: 'surprise',
    label: 'The Surprise',
    subtitle: 'Counter-intuitive findings that challenge assumptions',
    icon: <Sparkles size={20} />,
    color: 'rgba(133, 77, 14, 0.08)',
    glow: 'rgba(133, 77, 14, 0.15)',
    textColor: '#854d0e',
  },
  {
    key: 'crossfield',
    label: 'Cross-Field',
    subtitle: 'How this concept bridges into other domains',
    icon: <Globe size={20} />,
    color: 'rgba(13, 148, 136, 0.08)',
    glow: 'rgba(13, 148, 136, 0.15)',
    textColor: '#115e59',
  },
  {
    key: 'novel',
    label: 'Novel Work',
    subtitle: 'The absolute state-of-the-art breakthrough',
    icon: <Rocket size={20} />,
    color: 'rgba(159, 18, 57, 0.08)',
    glow: 'rgba(159, 18, 57, 0.15)',
    textColor: '#9f1239',
  },
  {
    key: 'wildcard',
    label: 'The Wildcard',
    subtitle: 'A surprise gem to keep the feed fresh',
    icon: <Shuffle size={20} />,
    color: 'rgba(37, 99, 235, 0.08)',
    glow: 'rgba(37, 99, 235, 0.15)',
    textColor: '#1e40af',
  },
];

/* ─── Assign papers to categories ───────────────────────────── */
function assignPapersToCategories(papers: FoundationalPaper[]): Partial<Record<CategoryKey, FoundationalPaper>> {
  const result: Partial<Record<CategoryKey, FoundationalPaper>> = {};
  
  // First match using the category property from backend
  papers.forEach((paper) => {
    const cat = paper.category as CategoryKey;
    if (cat && ['foundation', 'surprise', 'crossfield', 'novel', 'wildcard'].includes(cat)) {
      result[cat] = paper;
    }
  });

  // Fallback for any missing categories using index
  const keys: CategoryKey[] = ['foundation', 'surprise', 'crossfield', 'novel', 'wildcard'];
  keys.forEach((key, i) => {
    if (!result[key]) {
      const unassigned = papers.find(p => !Object.values(result).includes(p));
      if (unassigned) {
        result[key] = unassigned;
      } else if (papers[i]) {
        result[key] = papers[i];
      }
    }
  });
  
  return result;
}

/* ─── Build digest nodes from papers ────────────────────────── */
function buildNodes(topic: string, papers: FoundationalPaper[], debugDayOffset: number): DigestNode[] {
  const list: DigestNode[] = [];
  
  // Render completed nodes for previous days
  for (let i = 0; i < debugDayOffset; i++) {
    list.push({
      id: `node-${i}`,
      title: `${topic} (Day ${i + 1})`,
      papers: {},
      readCategories: ['foundation', 'surprise', 'crossfield', 'novel', 'wildcard'],
    });
  }

  // Render current active node
  list.push({
    id: `node-${debugDayOffset}`,
    title: topic,
    papers: assignPapersToCategories(papers),
    readCategories: [],
  });

  return list;
}

/* ─── Progress Ring SVG Component ───────────────────────────── */
const ProgressRing: React.FC<{ total: number; filled: number; size: number; active: boolean }> = ({
  total,
  filled,
  size,
  active,
}) => {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const segGap = 4;
  const segLen = circ / total - segGap;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}
    >
      {Array.from({ length: total }).map((_, i) => {
        const offset = i * (segLen + segGap);
        const isFilled = i < filled;
        return (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={isFilled ? 'var(--color-primary)' : active ? 'var(--border-glass-bright)' : 'var(--border-glass)'}
            strokeWidth={4}
            strokeDasharray={`${segLen} ${circ - segLen}`}
            strokeDashoffset={-offset}
            strokeLinecap="round"
            style={{ transition: 'stroke 0.5s ease' }}
          />
        );
      })}
    </svg>
  );
};

/* ─── Main Component ─────────────────────────────────────────── */
export const DigestMap: React.FC<DigestMapProps> = ({
  topic,
  papers,
  s2ApiKey,
  geminiApiKey,
  onBack,
  loadingProgress = 0,
  loadingStatus = '',
  streak,
  onOpenSettings,
  onSignOut,
  onStreakUpdated,
  debugDayOffset,
  onAdvanceDay
}) => {
  const [nodes, setNodes] = useState<DigestNode[]>([]);
  const [openNodeId, setOpenNodeId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const drawerFullscreen = !!selectedCategory;
  const [particleNodeId, setParticleNodeId] = useState<string | null>(null);
  const [showCompletion, setShowCompletion] = useState(false);
  const [activeScrollIdx, setActiveScrollIdx] = useState(0); // index of paper currently in view
  const drawerRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(520);
  const completionFiredRef = useRef(false); // prevent double-fire
  const [loadingPastNode, setLoadingPastNode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastPaperScrolledToBottom, setLastPaperScrolledToBottom] = useState(false);
  const [sentinelIntersected, setSentinelIntersected] = useState(false);


  // Local progress ratings and AI follow-up chat state
  const [ratings, setRatings] = useState<Record<string, 'like' | 'dislike' | null>>({});
  const [chatPaper, setChatPaper] = useState<FoundationalPaper | null>(null);
  const [chatMetadata, setChatMetadata] = useState<{ citationCount?: number; venue?: string; pdfUrl?: string } | null>(null);
  const [timeLeft, setTimeLeft] = useState('');

  /* ─── SVG path geometry ─────────────────────────────── */
  const svgWidth = 320;
  
  const windowStart = 0;
  const windowEnd = Math.max(8, debugDayOffset + 5);
  const totalNodesToGenerate = windowEnd + 1;

  const nodePositions = Array.from({ length: totalNodesToGenerate }).map((_, index) => {
    const x = 160 + (index === 0 ? 0 : (index % 2 === 1 ? 75 : -75));
    const y = 440 - index * 120;
    return { x, y };
  });

  const minY = nodePositions[windowEnd].y - 80;
  const maxY = nodePositions[windowStart].y + 80;
  const svgHeight = maxY - minY;

  const generatePath = (positions: typeof nodePositions) => {
    if (positions.length < 2) return '';
    
    // If showing the first node, start path at the bottom edge (maxY) and draw straight up to it
    const startY = windowStart === 0 ? maxY : positions[0].y;
    let d = `M ${positions[0].x} ${startY}`;
    
    if (windowStart === 0) {
      d += ` L ${positions[0].x} ${positions[0].y}`;
    }
    
    for (let i = 0; i < positions.length - 1; i++) {
      const p0 = positions[i];
      const p1 = positions[i + 1];
      const cpX0 = p0.x + (i % 2 === 0 ? 85 : -85);
      const cpY0 = p0.y - 60;
      const cpX1 = p1.x + (i % 2 === 0 ? 85 : -85);
      const cpY1 = p1.y + 60;
      d += ` C ${cpX0} ${cpY0}, ${cpX1} ${cpY1}, ${p1.x} ${p1.y}`;
    }
    return d;
  };
  const pathD = generatePath(nodePositions);

  const activeY = nodePositions[debugDayOffset]?.y ?? 440;

  useEffect(() => {
    if (!scrollAreaRef.current) return;
    const updateHeight = () => {
      setContainerHeight(scrollAreaRef.current?.clientHeight || 520);
    };
    updateHeight();
    
    const observer = new ResizeObserver(() => updateHeight());
    observer.observe(scrollAreaRef.current);
    
    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!scrollAreaRef.current || papers.length === 0) return;
    const topPx = activeY - minY;
    const targetScrollTop = topPx - (containerHeight * 2 / 3);
    const isFirstScroll = scrollAreaRef.current.scrollTop === 0;
    scrollAreaRef.current.scrollTo({
      top: Math.max(0, targetScrollTop),
      behavior: isFirstScroll ? 'auto' : 'smooth'
    });
  }, [debugDayOffset, containerHeight, activeY, minY, papers.length]);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const target = new Date(now);
      target.setHours(7, 0, 0, 0);
      
      // If past 7:00 AM today, next digest unlocks 7:00 AM tomorrow
      if (now.getHours() >= 7) {
        target.setDate(target.getDate() + 1);
      }
      
      const diffMs = target.getTime() - now.getTime();
      
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
      
      const pad = (num: number) => String(num).padStart(2, '0');

      setTimeLeft(`${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`);
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, []);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, isChatLoading]);

  const handleLike = (title: string) => {
    console.log('handleLike called for:', title);
    setRatings(prev => ({
      ...prev,
      [title]: prev[title] === 'like' ? null : 'like'
    }));
  };

  const handleDislike = (title: string) => {
    console.log('handleDislike called for:', title);
    setRatings(prev => ({
      ...prev,
      [title]: prev[title] === 'dislike' ? null : 'dislike'
    }));
  };

  const handleOpenChat = (paper: FoundationalPaper, metadata: { citationCount?: number; venue?: string; pdfUrl?: string } | null) => {
    console.log('handleOpenChat called for:', paper.title);
    setChatPaper(paper);
    setChatMetadata(metadata);
    setChatHistory([]);
    setChatInput('');
    setChatError(null);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !chatPaper || isChatLoading) return;

    const userMessageText = chatInput.trim();
    const newUserMsg: ChatMessage = {
      role: 'user',
      parts: [{ text: userMessageText }]
    };

    setChatHistory(prev => [...prev, newUserMsg]);
    setChatInput('');
    setIsChatLoading(true);
    setChatError(null);

    try {
      const responseText = await askPaperQuestion(
        chatPaper,
        {
          citationCount: chatMetadata?.citationCount,
          venue: chatMetadata?.venue,
          pdfUrl: chatMetadata?.pdfUrl
        },
        userMessageText,
        [...chatHistory, newUserMsg],
        geminiApiKey
      );

      setChatHistory(prev => [
        ...prev,
        {
          role: 'model',
          parts: [{ text: responseText }]
        }
      ]);
    } catch (err) {
      console.error(err);
      setChatError('Failed to fetch response. Please verify your Gemini connection or API key.');
    } finally {
      setIsChatLoading(false);
    }
  };

  useEffect(() => {
    if (papers.length > 0) {
      const initialNodes = buildNodes(topic, papers, debugDayOffset);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNodes(initialNodes);

      // Fetch progress and history from backend
      const fetchHistoryAndProgress = async () => {
        try {
          const token = localStorage.getItem('papertok_token');
          
          // 1. Fetch History to populate past nodes' papers
          const historyRes = await fetch(`/api/digest/history?topic=${encodeURIComponent(topic)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          let historyList: { date: string; papers: FoundationalPaper[] }[] = [];
          if (historyRes.ok) {
            const historyData = await historyRes.json();
            historyList = historyData.history || [];
          }

          // 2. Fetch reading progress list
          const progressRes = await fetch('/api/progress', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          let readList = [];
          if (progressRes.ok) {
            const progressData = await progressRes.json();
            readList = progressData.readPapers || [];
          }

          // 3. Map history list and read progress to nodes
          setNodes((prev) => 
            prev.map((node) => {
              const nodeIdx = parseInt(node.id.replace('node-', ''), 10);
              
              // Populate papers if it's a past node and we have cached papers in history (matching by sequence index)
              let nodePapers = node.papers;
              if (nodeIdx < debugDayOffset && historyList[nodeIdx]) {
                nodePapers = assignPapersToCategories(historyList[nodeIdx].papers);
              }

              // Calculate read categories
              if (nodeIdx < debugDayOffset) {
                // Past nodes are complete by definition
                return { ...node, papers: nodePapers };
              }

              const readCategories = (Object.keys(nodePapers) as CategoryKey[]).filter((catKey) => {
                const paper = nodePapers[catKey];
                return paper && readList.some((r: { topic: string; paper_title: string; category_key: string }) => 
                  r.topic.toLowerCase() === topic.toLowerCase() && 
                  r.paper_title.toLowerCase() === paper.title.toLowerCase() && 
                  r.category_key === catKey
                );
              });

              return { ...node, papers: nodePapers, readCategories };
            })
          );
        } catch (err) {
          console.error('Failed to fetch history and progress:', err);
        }
      };

      fetchHistoryAndProgress();
    }
  }, [papers, topic, debugDayOffset]);

  /* Open node drawer */
  const handleNodeClick = async (nodeId: string) => {
    setOpenNodeId(nodeId);
    setSelectedCategory(null);
    completionFiredRef.current = false;
    setLastPaperScrolledToBottom(false);
    setSentinelIntersected(false);
    requestAnimationFrame(() => setDrawerVisible(true));

    const nodeIdx = parseInt(nodeId.replace('node-', ''), 10);
    const targetNode = nodes.find(n => n.id === nodeId);
    
    // If it is a past node (nodeIdx < debugDayOffset) and does not have papers, load them
    if (nodeIdx < debugDayOffset && targetNode && Object.keys(targetNode.papers).length === 0) {
      setLoadingPastNode(true);
      try {
        const generatedPapers = await generateFoundationalPapers(
          topic,
          geminiApiKey,
          undefined, // no progress callback needed since cache is instant
          false,
          nodeIdx
        );
        
        setNodes(prev => prev.map(n => n.id === nodeId ? {
          ...n,
          papers: assignPapersToCategories(generatedPapers)
        } : n));
      } catch (err) {
        console.error('Failed to load past node papers:', err);
      } finally {
        setLoadingPastNode(false);
      }
    }
  };

  /* Close drawer */
  const handleCloseDrawer = () => {
    setDrawerVisible(false);
    setTimeout(() => {
      setOpenNodeId(null);
      setSelectedCategory(null);
    }, 350);
  };

  /* Go back to category deck (no read marking — user navigated back deliberately) */
  const handleBackToDeck = () => {
    setSelectedCategory(null);
    setActiveScrollIdx(0);
  };

  /* Mark a category as read imperatively */
  const markCategoryRead = useCallback((nodeId: string, category: CategoryKey) => {
    const categoryIdx = (['foundation', 'surprise', 'crossfield', 'novel', 'wildcard'] as CategoryKey[]).indexOf(category);
    const paper = papers.find(p => p.category === category) || papers[categoryIdx];
    if (!paper) return;

    setNodes((prev) => {
      const updated = prev.map((n) => {
        if (n.id !== nodeId) return n;
        if (n.readCategories.includes(category)) return n;
        return { ...n, readCategories: [...n.readCategories, category] };
      });
      return updated;
    });

    // Save progress to backend
    const token = localStorage.getItem('papertok_token');
    fetch('/api/progress/read', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        topic: topic,
        paperTitle: paper.title,
        categoryKey: category,
        debugDayOffset: debugDayOffset
      })
    }).then(async (res) => {
      if (!res.ok) {
        console.error('Failed to save reading progress on server.');
        return;
      }
      const data = await res.json();
      if (data.success && data.streak && data.streak.currentStreak !== undefined) {
        onStreakUpdated?.(data.streak.currentStreak);
      }
    }).catch(err => {
      console.error('Network error saving reading progress:', err);
    });

    // Burst animation on the map node
    setParticleNodeId(nodeId);
    setTimeout(() => setParticleNodeId(null), 1200);
  }, [papers, topic, onStreakUpdated, debugDayOffset]);

  /* ── IntersectionObserver approach: snap between papers + read detection ── */
  useEffect(() => {
    if (!selectedCategory || !openNodeId) return;
    if (!drawerRef.current) return;

    const snapContainer = drawerRef.current; // .paper-stack-scroll
    const availableKeys = CATEGORIES.map((c) => c.key).filter(
      (k) => nodes.find((n) => n.id === openNodeId)?.papers[k]
    );

    // Jump to the initially selected paper (instant, no animation flicker)
    const initIdx = availableKeys.indexOf(selectedCategory);
    if (initIdx >= 0) {
      setTimeout(() => {
        const item = snapContainer.querySelector(`[data-paper-key="${selectedCategory}"]`);
        if (item) {
          item.scrollIntoView({ behavior: 'auto', block: 'start' });
        }
      }, 50);
    }

    // ── Active paper tracking via IntersectionObserver ──
    const activeObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const key = entry.target.getAttribute('data-paper-key');
            const idx = availableKeys.indexOf(key as CategoryKey);
            if (idx !== -1) {
              setActiveScrollIdx(idx);
            }
          }
        });
      },
      {
        root: snapContainer,
        rootMargin: '-10% 0px -85% 0px',
        threshold: 0,
      }
    );

    const items = snapContainer.querySelectorAll('.paper-stack-item');
    items.forEach((item) => activeObserver.observe(item));

    // ── Paper read detection via sentinel IntersectionObserver ──
    const readObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const key = entry.target.getAttribute('data-paper-key') as CategoryKey;
          if (entry.isIntersecting) {
            markCategoryRead(openNodeId, key);
          }
          const isLast = key === availableKeys[availableKeys.length - 1];
          if (isLast) {
            setSentinelIntersected(entry.isIntersecting);
          }
        });
      },
      {
        root: snapContainer,
        threshold: 1.0,
        rootMargin: '0px 0px 40px 0px', // trigger slightly before hitting the absolute bottom
      }
    );

    const sentinels = snapContainer.querySelectorAll('.paper-read-sentinel');
    sentinels.forEach((sentinel) => readObserver.observe(sentinel));

    return () => {
      activeObserver.disconnect();
      readObserver.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, openNodeId]);

  // Trigger digest completion when both last paper is fully scrolled and sentinel is visible
  useEffect(() => {
    if (sentinelIntersected && lastPaperScrolledToBottom && !completionFiredRef.current) {
      completionFiredRef.current = true;
      const timer1 = setTimeout(() => {
        setDrawerVisible(false);
        const timer2 = setTimeout(() => {
          setOpenNodeId(null);
          setSelectedCategory(null);
          setShowCompletion(true);
        }, 400);
        return () => clearTimeout(timer2);
      }, 900);
      return () => clearTimeout(timer1);
    }
  }, [sentinelIntersected, lastPaperScrolledToBottom]);

  const openNode = nodes.find((n) => n.id === openNodeId);

  /* Search results across all nodes */
  const searchResults = (() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase().trim();
    const results: { node: DigestNode; paper: FoundationalPaper; category: CategoryKey }[] = [];
    
    nodes.forEach((node) => {
      (Object.keys(node.papers) as CategoryKey[]).forEach((catKey) => {
        const paper = node.papers[catKey];
        if (!paper) return;
        
        const matchTitle = paper.title?.toLowerCase().includes(query);
        const matchNickname = paper.nickname?.toLowerCase().includes(query);
        const matchAuthor = paper.authors?.toLowerCase().includes(query);
        const matchCoreIdea = paper.coreIdea?.toLowerCase().includes(query);
        const matchPurpose = paper.purpose?.toLowerCase().includes(query);
        
        if (matchTitle || matchNickname || matchAuthor || matchCoreIdea || matchPurpose) {
          results.push({ node, paper, category: catKey });
        }
      });
    });
    return results;
  })();

  const handleSearchResultClick = (nodeId: string, category: CategoryKey) => {
    setOpenNodeId(nodeId);
    setSelectedCategory(category);
    const categoryIdx = (['foundation', 'surprise', 'crossfield', 'novel', 'wildcard'] as CategoryKey[]).indexOf(category);
    setActiveScrollIdx(categoryIdx);
    setSearchQuery(''); // clear query
    requestAnimationFrame(() => {
      setDrawerVisible(true);
    });
  };



  /* ─── No JS stars needed — ambient glow is done in CSS ─── */
  const handleDebugAdvanceDay = () => {
    setShowCompletion(false); // Hide completion/timer UI
    onStreakUpdated?.(streak + 1);
    onAdvanceDay();
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as Window & { debugAdvanceDay?: () => void }).debugAdvanceDay = handleDebugAdvanceDay;
    }
    return () => {
      if (typeof window !== 'undefined') {
        const win = window as Window & { debugAdvanceDay?: () => void };
        delete win.debugAdvanceDay;
      }
    };
  }, [handleDebugAdvanceDay]);

  return (
    <div className="digest-map-root">
      {/* ── Top Bar ── */}
      <header className="digest-map-topbar">
        {/* Back Navigation & Instruction */}
        <div className="back-nav-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
          <button className="digest-map-back-btn" onClick={onBack} aria-label="Back" title="Change Focus Topic">
            <ArrowLeft size={18} />
          </button>
          <span className="back-hint-text" style={{ fontSize: '0.62rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-primary)' }}>Change Focus</span>
        </div>

        {/* Centered Search Bar */}
        {papers.length > 0 && (
          <div className="map-search-wrapper" style={{ flex: 1, display: 'flex', justifyContent: 'center', margin: '0 16px' }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
              <input
                type="text"
                placeholder="Search history, concepts, authors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 12px 6px 32px',
                  borderRadius: '16px',
                  fontSize: '0.78rem',
                  border: '1px solid var(--border-glass)',
                  color: 'var(--text-primary)',
                  background: 'rgba(9, 9, 11, 0.25)',
                  outline: 'none',
                }}
              />
              <Sparkles size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-primary)' }} />
            </div>
          </div>
        )}

        {/* Global actions: Progress, Settings, Sign Out */}
        <div className="header-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: 'auto', flexShrink: 0 }}>
          {papers.length > 0 && (
            <div className="digest-map-progress-pill hide-mobile" style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '12px', background: 'rgba(9,9,11,0.04)', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
              {nodes.reduce((sum, n) => sum + n.readCategories.length, 0)}/{nodes.length * 5} read
            </div>
          )}
          <button type="button" className="settings-btn glass-panel" onClick={onOpenSettings} title="Settings" style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '1px solid var(--border-glass)' }}>
            <Settings className="settings-icon" style={{ width: '14px', height: '14px', color: 'var(--text-secondary)' }} />
          </button>
          <button type="button" className="signout-btn glass-panel" onClick={onSignOut} title="Sign Out" style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '1px solid var(--border-glass)' }}>
            <LogOut className="signout-icon" style={{ width: '13px', height: '13px', color: 'var(--text-secondary)' }} />
          </button>
        </div>
      </header>

      {streak > 0 && papers.length > 0 && (
        <div className="map-streak-badge" title="Learning Days">
          <Flame className="map-streak-flame" />
          <div className="map-streak-text">
            <span className="map-streak-val">{streak} Day{streak > 1 ? 's' : ''}</span>
            <span className="map-streak-label">Learning Days</span>
          </div>
        </div>
      )}

      {searchQuery.trim() !== '' && (
        <div 
          className="map-search-results-overlay glass-panel" 
          style={{
            position: 'absolute',
            top: '72px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'calc(100% - 32px)',
            maxWidth: '480px',
            maxHeight: '400px',
            overflowY: 'auto',
            zIndex: 100,
            borderRadius: '16px',
            padding: '12px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            border: '1px solid var(--border-glass)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-primary)' }}>
              Search Results ({searchResults.length})
            </span>
            <button 
              onClick={() => setSearchQuery('')}
              style={{ fontSize: '0.7rem', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              Clear
            </button>
          </div>
          
          {searchResults.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              No matching papers found. Try searching for topics, authors, or concepts.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {searchResults.map(({ node, paper, category }) => {
                const nodeIdx = parseInt(node.id.replace('node-', ''), 10);
                return (
                  <button
                    key={`${node.id}-${paper.title}`}
                    className="search-result-row"
                    onClick={() => handleSearchResultClick(node.id, category)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'start',
                      gap: '4px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.04)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'background 0.2s ease',
                    }}
                  >
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', width: '100%' }}>
                      <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'var(--color-primary-glow)', color: 'var(--color-primary)', textTransform: 'uppercase' }}>
                        Day {nodeIdx + 1}
                      </span>
                      <span style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                        {CATEGORIES.find(c => c.key === category)?.label}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                      {paper.nickname || paper.title}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'flex', gap: '4px' }}>
                      <span>By {paper.authors}</span>
                      <span>•</span>
                      <span>{paper.year}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {papers.length === 0 ? (
        <div className="digest-map-loading">
          <div className="digest-loading-ring">
            <RefreshCw size={28} className="digest-loading-spinner" />
          </div>
          <p className="digest-loading-status">{loadingStatus || 'Connecting to Gemini AI…'}</p>
          <div className="digest-loading-bar-track">
            <div className="digest-loading-bar-fill" style={{ width: `${loadingProgress}%` }} />
          </div>
          <p className="digest-loading-pct">{loadingProgress}%</p>
        </div>
      ) : (
        <div className="digest-map-scroll-area" ref={scrollAreaRef}>

          <div 
            className="map-inner-container"
          style={{
            position: 'relative',
            width: `${svgWidth}px`,
            height: `${svgHeight}px`,
          }}
        >
          <svg
            viewBox={`0 ${minY} ${svgWidth} ${svgHeight}`}
            width={svgWidth}
            height={svgHeight}
            style={{ display: 'block' }}
            aria-hidden="true"
          >
            {/* Path glow */}
            <path d={pathD} fill="none" stroke="var(--color-primary-glow)" strokeWidth={16} strokeLinecap="round" />
            {/* Path core */}
            <path
              d={pathD}
              fill="none"
              stroke="rgba(27, 73, 49, 0.25)"
              strokeWidth={4}
              strokeLinecap="round"
              strokeDasharray="8 6"
            />
            {/* Overlapping animated pulse path */}
            <path
              d={pathD}
              fill="none"
              stroke="var(--color-secondary)"
              strokeWidth={3}
              strokeLinecap="round"
              className="connection-pulse"
            />

            {/* Past completed nodes */}
            {Array.from({ length: debugDayOffset }).map((_, nodeIdx) => {
              if (nodeIdx < windowStart) return null;
              const pos = nodePositions[nodeIdx];
              return (
                <g key={`past-${nodeIdx}`}>
                  <circle cx={pos.x} cy={pos.y} r={22} fill="#10b981" />
                  <circle cx={pos.x} cy={pos.y} r={16} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={1} />
                  <text x={pos.x} y={pos.y + 4} textAnchor="middle" fontSize={12} fill="#fff" fontWeight="bold">
                    ✓
                  </text>
                </g>
              );
            })}

            {/* Future locked nodes (prestige style) */}
            {nodePositions.map((pos, nodeIdx) => {
              if (nodeIdx <= debugDayOffset) return null; // Don't render locked node if active/past
              if (nodeIdx > windowEnd) return null; // Don't render locked node if beyond our window
              return (
                <g key={`locked-${nodeIdx}`}>
                  <circle cx={pos.x} cy={pos.y} r={22} fill="var(--bg-darkest)" stroke="var(--border-glass)" strokeWidth={1.5} />
                  <circle cx={pos.x} cy={pos.y} r={16} fill="none" stroke="rgba(27, 73, 49, 0.15)" strokeWidth={1} strokeDasharray="3 3" />
                  <text x={pos.x} y={pos.y + 4} textAnchor="middle" fontSize={12} fill="var(--text-muted)">
                    🔒
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Digest nodes overlaid on the SVG (absolute positioned via pixels) */}
          <div className="digest-map-nodes-overlay" style={{ position: 'absolute', top: 0, left: 0, width: `${svgWidth}px`, height: `${svgHeight}px`, transform: 'none', pointerEvents: 'none' }}>
            {nodes.map((node, i) => {
              const nodeIndex = i;
              if (nodeIndex >= nodePositions.length) return null;

              const pos = nodePositions[nodeIndex];
              const totalCategories = CATEGORIES.length;
              const filledCount = node.readCategories.length;
              const isNodeComplete = filledCount === totalCategories;
              const isActive = papers.length > 0 && !isNodeComplete;
              const nodeSize = 72;

              // Absolute pixel positioning relative to the container y starting at minY
              const leftPx = pos.x;
              const topPx = pos.y - minY;


              // Extract populated papers from the node to preview on the opposite side
              const paperNames = (Object.keys(node.papers) as CategoryKey[])
                .map((k) => node.papers[k])
                .filter((p): p is FoundationalPaper => !!p);

              // Alternate left/right based on node's center alignment (pos.x = 160)
              const isNodeOnRight = pos.x > 160;
              const cardStyle: React.CSSProperties = {
                position: 'absolute',
                top: `${pos.y - minY}px`,
                left: isNodeOnRight ? '16px' : 'auto',
                right: !isNodeOnRight ? '16px' : 'auto',
                transform: 'translateY(-50%)',
                width: '110px',
                padding: '8px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.04)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                pointerEvents: 'all',
                textAlign: isNodeOnRight ? 'left' : 'right',
                zIndex: 5,
              };

              return (
                <React.Fragment key={node.id}>
                  {paperNames.length > 0 && (
                    <div style={cardStyle} className="glass-panel map-node-papers-card">
                      <div style={{ fontSize: '0.52rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-primary)', marginBottom: '4px' }}>
                        Day {nodeIndex + 1} focus
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {paperNames.map((p) => (
                          <div 
                            key={p.title} 
                            style={{ 
                              fontSize: '0.55rem', 
                              fontWeight: 500, 
                              color: 'var(--text-secondary)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              cursor: 'pointer',
                              transition: 'color 0.2s'
                            }}
                            onClick={() => handleSearchResultClick(node.id, p.category as CategoryKey)}
                            title={p.title}
                          >
                            {p.nickname || p.title}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    className={`digest-node-btn ${isActive ? 'active' : ''} ${isNodeComplete ? 'complete' : ''} ${particleNodeId === node.id ? 'particle-burst' : ''}`}
                    style={{
                      left: `${leftPx}px`,
                      top: `${topPx}px`,
                      width: nodeSize,
                      height: nodeSize,
                      transform: 'translate(-50%, -50%)',
                    }}
                    onClick={() => (isActive || isNodeComplete) && handleNodeClick(node.id)}
                    aria-label={`Open digest: ${node.title}`}
                  >
                    <ProgressRing total={totalCategories} filled={filledCount} size={nodeSize} active={isActive} />
                    <div className="digest-node-inner">
                      {isNodeComplete ? (
                        <CheckCircle size={22} color="#10b981" />
                      ) : (
                        <span className="digest-node-emoji">📚</span>
                      )}
                      <span className="digest-node-count">{filledCount}/{totalCategories}</span>
                    </div>
                    {isActive && <div className="digest-node-pulse" />}
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>
      )}

      {/* ── Fixed Bottom Sleeping Banner ── */}
      {nodes.length > 0 && nodes[nodes.length - 1].readCategories.length === CATEGORIES.length && (
        <div className="digest-completed-sleeping-card glass-panel anim-slide-up">
          <div className="sleeping-content">
            <span className="sleeping-title">All Caught Up!</span>
            <span className="sleeping-timer">⏳ Next digest in {timeLeft || '...'}</span>
          </div>
          <button
            className="debug-fast-forward-btn"
            onClick={handleDebugAdvanceDay}
            title="[Debug] Skip to next day & generate new digest"
          >
            ⏭ Skip Day
          </button>
        </div>
      )}

      {/* ── Slide-Up Drawer ── */}
      {openNode && (
        <div
          className={`digest-drawer-backdrop ${drawerVisible ? 'visible' : ''}`}
          onClick={handleCloseDrawer}
        >
          <div
            className={`digest-drawer ${drawerVisible ? 'open' : ''} ${selectedCategory ? 'paper-mode' : ''} ${drawerFullscreen ? 'fullscreen' : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            {loadingPastNode ? (
              <div className="past-node-loading-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: '16px' }}>
                <RefreshCw size={28} className="digest-loading-spinner" />
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 500 }}>Retrieving archived digest...</p>
              </div>
            ) : selectedCategory ? (
              /* ── Snap-scroll paper view ── */
              <div className="digest-paper-detail">
                {/* Nav bar — sits above the snap container, always visible */}
                <div className="paper-nav-bar">
                  <button
                    className="paper-nav-arrow"
                    onClick={handleBackToDeck}
                    aria-label="Back to categories"
                  >
                    &#8592;
                  </button>
                  <div className="paper-nav-center">
                    {(() => {
                      const availableKeys = CATEGORIES.map((c) => c.key).filter((k) => openNode.papers[k]);
                      const cat = CATEGORIES[activeScrollIdx];
                      return (
                        <>
                          <span
                            className="paper-nav-cat-pill"
                            style={{ background: cat?.color, color: cat?.textColor } as React.CSSProperties}
                          >
                            {cat?.icon} {cat?.label}
                          </span>
                          <div className="paper-nav-dots">
                            {availableKeys.map((k, i) => (
                              <span
                                key={k}
                                className={`paper-nav-dot${i === activeScrollIdx ? ' active' : ''}${
                                  openNode.readCategories.includes(k) ? ' read' : ''
                                }`}
                              />
                            ))}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  <button
                    className="paper-nav-arrow"
                    onClick={handleCloseDrawer}
                    aria-label="Close"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Snap-scroll container: each child = one full page */}
                <div
                  className="paper-stack-scroll"
                  ref={drawerRef}
                >
                  {CATEGORIES.map((cat, idx) => {
                    const paper = openNode.papers[cat.key];
                    if (!paper) return null;
                    const total = CATEGORIES.filter((c) => openNode.papers[c.key]).length;
                    const isLast = idx === total - 1;
                    return (
                      /* data-paper-key = snap target + inner-scroll root */
                      <div key={cat.key} className="paper-stack-item" data-paper-key={cat.key}>
                        <div className="paper-sticky-boundary">
                          {/* Sticky Header Group: Category Banner only */}
                          <div className="paper-stack-header-group">
                            <div
                              className="paper-stack-cat-header"
                              style={{ '--cat-color': cat.color, '--cat-text': cat.textColor } as React.CSSProperties}
                            >
                              <span className="paper-stack-cat-icon">{cat.icon}</span>
                              <div>
                                <p className="paper-stack-cat-label">{cat.label}</p>
                                <p className="paper-stack-cat-sub">{cat.subtitle}</p>
                              </div>
                              {openNode.readCategories.includes(cat.key) && (
                                <CheckCircle size={16} className="paper-stack-cat-check" />
                              )}
                            </div>
                          </div>

                          {/* Paper content */}
                          <PaperCard
                            paper={paper}
                            s2ApiKey={s2ApiKey}
                            rating={ratings[paper.title] || null}
                            onLike={() => handleLike(paper.title)}
                            onDislike={() => handleDislike(paper.title)}
                            onOpenChat={(p, meta) => handleOpenChat(p, meta)}
                            index={idx}
                            total={total}
                            hideHeader={true}
                              onContentScroll={(_, isBottom) => {
                               if (isLast && isBottom) {
                                 setLastPaperScrolledToBottom(true);
                               }
                             }}
                          >
                            <div className="paper-stack-title-header">
                              <div className="card-badge-header">
                                {paper.explanation?.paperType ? (
                                  <span className={`paper-type-badge ${paper.explanation.paperType}`}>
                                    {paper.explanation.paperType === 'methodology' && '⚙️ Methodology'}
                                    {paper.explanation.paperType === 'empirical_study' && '📊 Empirical'}
                                    {paper.explanation.paperType === 'theoretical' && '📐 Theoretical'}
                                    {paper.explanation.paperType === 'review_survey' && '📚 Survey'}
                                  </span>
                                ) : (
                                  <span className="paper-type-badge default">📄 Foundational</span>
                                )}
                                <span className="index-counter">Paper {idx + 1} of {total}</span>
                              </div>
                              
                              <h2 className="paper-title-compact">{paper.title}</h2>
                              
                              <div className="paper-meta-compact">
                                <span className="meta-authors">{paper.authors}</span>
                                <span className="meta-year">{paper.year}</span>
                              </div>
                            </div>
                          </PaperCard>
                        </div>

                        {isLast ? (
                          <div className="paper-stack-end">
                            <span>🎉 You've reached the end of this digest!</span>
                          </div>
                        ) : (
                          <div className="paper-stack-divider">
                            <span>↓ Scroll down to continue</span>
                          </div>
                        )}
                        {/* Sentinel at the bottom of the stack item */}
                        <div className="paper-read-sentinel" data-paper-key={cat.key} />
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* ── Category Deck ── */
              <>
                <div className="digest-drawer-handle" />
                <div className="digest-drawer-header">
                  <button className="digest-drawer-x" onClick={handleCloseDrawer} aria-label="Close">
                    <X size={18} />
                  </button>
                </div>
                <p className="digest-drawer-subtitle">
                  {openNode.readCategories.length} of {CATEGORIES.length} papers read — tap a category to dive in
                </p>

                <div className="digest-category-list">
                  {CATEGORIES.map((cat) => {
                    const paper = openNode.papers[cat.key];
                    const isRead = openNode.readCategories.includes(cat.key);
                    if (!paper) return null;
                    return (
                      <button
                        key={cat.key}
                        className={`digest-cat-card ${isRead ? 'read' : ''}`}
                        style={{
                          '--cat-color': cat.color,
                          '--cat-glow': cat.glow,
                          '--cat-text': cat.textColor,
                        } as React.CSSProperties}
                        onClick={() => setSelectedCategory(cat.key)}
                      >
                        <div className="digest-cat-icon-wrap">
                          {cat.icon}
                        </div>
                        <div className="digest-cat-body">
                          <div className="digest-cat-header-row">
                            <span className="digest-cat-label">{cat.label}</span>
                            {isRead && <CheckCircle size={14} className="digest-cat-check" />}
                          </div>
                          <p className="digest-cat-subtitle">{cat.subtitle}</p>
                          <p className="digest-cat-paper-title">{paper.nickname || paper.title}</p>
                          <p className="digest-cat-paper-meta">{paper.authors} · {paper.year}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Completion Overlay ── */}
      {showCompletion && (
        <div className="completion-overlay">
          {/* Confetti particles */}
          <div className="confetti-field" aria-hidden="true">
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className={`confetti-piece cp-${i}`} />
            ))}
          </div>

          <div className="completion-card">
            {/* Trophy glow */}
            <div className="completion-trophy">
              <span className="completion-trophy-emoji">🏆</span>
              <div className="completion-trophy-ring" />
            </div>

            <h2 className="completion-headline">Digest Complete!</h2>
            <p className="completion-sub">
              You read all 5 papers in today's digest.
              Your knowledge graph just levelled up.
            </p>

            {/* Streak pill */}
            <div className="completion-streak">
              <span>🔥</span>
              <span>{streak} learning days — keep it going!</span>
            </div>

            {/* Divider */}
            <div className="completion-divider" />

            {/* Next landmark teaser */}
            <div className="completion-next">
              <p className="completion-next-label">🔒 Next landmark unlocks in {timeLeft || 'tomorrow'}</p>
              <div className="completion-next-card">
                <div className="completion-next-icon">📡</div>
                <div className="completion-next-body">
                  <p className="completion-next-title">A new digest awaits</p>
                  <p className="completion-next-sub">5 more curated papers, 5 new categories</p>
                </div>
                <div className="completion-next-badge">Tomorrow</div>
              </div>
            </div>

            <button
              className="completion-cta"
              onClick={() => { setShowCompletion(false); }}
            >
              Back to Map
            </button>
          </div>
        </div>
      )}

      {/* ── Chat Overlay ── */}
      {chatPaper && (
        <div className="digest-chat-backdrop" onClick={() => setChatPaper(null)}>
          <div className="digest-chat-modal" onClick={(e) => e.stopPropagation()}>
            <header className="digest-chat-header">
              <div className="digest-chat-header-title">
                <span className="digest-chat-sparkle">💬</span>
                <div>
                  <h3 className="digest-chat-paper-title">{chatPaper.title}</h3>
                  <p className="digest-chat-subtitle">Ask the AI Guide about this paper</p>
                </div>
              </div>
              <button className="digest-chat-close-btn" onClick={() => setChatPaper(null)} aria-label="Close Chat">
                <X size={18} />
              </button>
            </header>

            <div className="digest-chat-messages">
              {chatHistory.length === 0 ? (
                <div className="digest-chat-welcome">
                  <p className="welcome-heading">Ask AI Guide</p>
                  <p className="welcome-sub text-secondary">
                    Get answers about <strong>{chatPaper.title}</strong>'s methods, findings, limitations, or context.
                  </p>
                  <div className="digest-chat-suggestions">
                    <button
                      type="button"
                      onClick={() => setChatInput("What is the main contribution of this paper?")}
                    >
                      💡 What is the main contribution?
                    </button>
                    <button
                      type="button"
                      onClick={() => setChatInput("Can you summarize the methodology used?")}
                    >
                      ⚙️ Summarize the methodology
                    </button>
                    <button
                      type="button"
                      onClick={() => setChatInput("What are the key results and findings?")}
                    >
                      📊 Key findings & results
                    </button>
                  </div>
                </div>
              ) : (
                chatHistory.map((msg, i) => (
                  <div key={i} className={`digest-chat-bubble-container ${msg.role}`}>
                    <div className="digest-chat-bubble">
                      {msg.parts.map((p) => p.text).join('\n')}
                    </div>
                  </div>
                ))
              )}
              {isChatLoading && (
                <div className="digest-chat-bubble-container model">
                  <div className="digest-chat-bubble loading">
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              )}
              {chatError && (
                <div className="digest-chat-error-bar">
                  ⚠️ {chatError}
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <form className="digest-chat-input-form" onSubmit={handleSendMessage}>
              <input
                type="text"
                placeholder="Ask a question about this paper..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={isChatLoading}
              />
              <button type="submit" disabled={isChatLoading || !chatInput.trim()}>
                Send
              </button>
            </form>
          </div>
        </div>
      )}

      <style>{`
        /* ── Root Layout ───────────────────────────────────── */
        .digest-map-root {
          height: 100vh;
          max-height: 100vh;
          background:
            radial-gradient(ellipse 70% 50% at 20% 80%, rgba(27, 73, 49, 0.04) 0%, transparent 70%),
            radial-gradient(ellipse 50% 40% at 80% 20%, rgba(72, 46, 29, 0.03) 0%, transparent 60%),
            url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.025'/%3E%3C/svg%3E"),
            var(--bg-darkest);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          position: relative;
        }

        .digest-node-btn.complete {
          cursor: pointer;
        }

        /* ── Topbar ─────────────────────────────────────────── */
        .digest-map-topbar {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px 20px;
          background: var(--bg-glass);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--border-glass);
          position: sticky;
          top: 0;
          z-index: 20;
        }
        .digest-map-back-btn {
          display: flex; align-items: center; justify-content: center;
          width: 36px; height: 36px; border-radius: 50%;
          background: rgba(9, 9, 11, 0.04);
          border: 1px solid var(--border-glass);
          color: var(--text-secondary);
          transition: var(--transition-fast);
          flex-shrink: 0;
        }
        .digest-map-back-btn:hover {
          background: rgba(9, 9, 11, 0.08);
          color: var(--text-primary);
        }
        .digest-map-topic { flex: 1; min-width: 0; }
        .digest-map-label {
          font-size: 0.68rem; font-weight: 600; letter-spacing: 0.08em;
          text-transform: uppercase; color: var(--color-primary); opacity: 0.8;
          font-family: var(--font-mono);
        }
        .digest-map-title {
          margin: 0; font-size: 1rem; font-weight: 700;
          color: var(--text-primary); white-space: nowrap;
          overflow: hidden; text-overflow: ellipsis;
          font-family: var(--font-display);
        }
        .digest-map-progress-pill {
          flex-shrink: 0;
          font-size: 0.72rem; font-weight: 700;
          padding: 4px 12px; border-radius: 20px;
          background: var(--color-primary-glow);
          border: 1px solid rgba(27, 73, 49, 0.2);
          color: var(--color-primary);
          font-family: var(--font-mono);
        }

        .digest-map-scroll-area {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
          scrollbar-width: none; /* Firefox */
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 32px 20px 80px;
          position: relative;
        }
        .digest-map-scroll-area::-webkit-scrollbar {
          display: none; /* Safari and Chrome */
        }

        /* ── Node Overlay ────────────────────────────────────── */
        .digest-map-nodes-overlay {
          position: absolute;
          top: 32px;
          left: 50%;
          transform: translateX(-50%);
          width: 100%;
          height: 100%;
          pointer-events: none;
        }

        /* ── Digest Node Button ──────────────────────────────── */
        .digest-node-btn {
          position: absolute;
          border-radius: 50%;
          border: none;
          background: rgba(13, 13, 17, 0.95);
          cursor: not-allowed;
          display: flex; align-items: center; justify-content: center;
          pointer-events: all;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .digest-node-btn.active {
          cursor: pointer;
          box-shadow: 0 0 0 3px rgba(27, 73, 49, 0.3), 0 0 24px rgba(27, 73, 49, 0.18);
        }
        .digest-node-btn.active:hover {
          transform: scale(1.1);
          box-shadow: 0 0 0 4px rgba(27, 73, 49, 0.45), 0 0 40px rgba(27, 73, 49, 0.25);
        }
        .digest-node-btn.active:active {
          transform: scale(0.97);
        }
        .digest-node-inner {
          display: flex; flex-direction: column;
          align-items: center; gap: 1px;
          position: relative; z-index: 1;
        }
        .digest-node-emoji { font-size: 20px; line-height: 1; }
        .digest-node-count {
          font-size: 0.6rem; font-weight: 700;
          color: rgba(251, 249, 244, 0.85); letter-spacing: 0.02em;
          font-family: var(--font-mono);
        }

        /* Pulse ring for active unread node */
        .digest-node-pulse {
          position: absolute;
          inset: -6px;
          border-radius: 50%;
          border: 2px solid rgba(27, 73, 49, 0.45);
          animation: nodePulse 2s ease-in-out infinite;
          pointer-events: none;
        }
        @keyframes nodePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0; transform: scale(1.25); }
        }

        /* Particle burst on completion */
        .digest-node-btn.particle-burst {
          animation: particleBurst 0.6s ease-out;
        }
        @keyframes particleBurst {
          0% { box-shadow: 0 0 0 0 rgba(27, 73, 49, 0.8); transform: scale(1); }
          40% { box-shadow: 0 0 0 20px rgba(27, 73, 49, 0); transform: scale(1.15); }
          100% { box-shadow: 0 0 0 0 rgba(27, 73, 49, 0); transform: scale(1); }
        }

        /* ── Drawer Backdrop ─────────────────────────────────── */
        .digest-drawer-backdrop {
          position: fixed; inset: 0; z-index: 50;
          background: rgba(0,0,0,0);
          transition: background 0.35s ease;
          pointer-events: none;
        }
        .digest-drawer-backdrop.visible {
          background: rgba(0,0,0,0.6);
          pointer-events: all;
        }

        /* ── Drawer Panel ────────────────────────────────────── */
        .digest-drawer {
          position: absolute;
          bottom: 0; left: 0; right: 0;
          background: var(--bg-darker);
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.025'/%3E%3C/svg%3E");
          border-top: 1px solid var(--border-glass);
          border-radius: 24px 24px 0 0;
          max-height: 100vh;
          overflow-y: auto;
          transform: translateY(100%);
          transition: transform 0.38s cubic-bezier(0.32, 0.72, 0, 1), height 0.35s cubic-bezier(0.32, 0.72, 0, 1), border-radius 0.35s cubic-bezier(0.32, 0.72, 0, 1);
          padding-bottom: env(safe-area-inset-bottom, 24px);
          box-shadow: 0 -8px 32px rgba(0,0,0,0.12);
        }
        .digest-drawer.open {
          transform: translateY(0);
        }
        .digest-drawer.paper-mode {
          height: 90vh;
          overflow-y: hidden;
          padding-bottom: 0;
        }
        .digest-drawer.paper-mode.fullscreen {
          height: 100vh;
          border-radius: 0;
        }

        /* Handle */
        .digest-drawer-handle {
          width: 40px; height: 4px;
          background: rgba(9, 9, 11, 0.12);
          border-radius: 2px;
          margin: 12px auto 0;
        }

        /* Header */
        .digest-drawer-header {
          display: flex; justify-content: space-between; align-items: flex-start;
          padding: 20px 24px 0;
        }
        .digest-drawer-super {
          margin: 0;
          font-size: 0.68rem; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.1em;
          color: var(--color-primary); opacity: 0.8;
          font-family: var(--font-mono);
        }
        .digest-drawer-title {
          margin: 4px 0 0;
          font-size: 1.35rem; font-weight: 700;
          color: var(--text-primary);
          font-family: var(--font-display);
          line-height: 1.2;
        }
        .digest-drawer-x {
          width: 32px; height: 32px;
          display: flex; align-items: center; justify-content: center;
          border-radius: 50%;
          background: rgba(9, 9, 11, 0.05);
          border: 1px solid var(--border-glass);
          color: var(--text-muted);
          flex-shrink: 0; margin-top: 4px;
          transition: var(--transition-fast);
        }
        .digest-drawer-x:hover { background: rgba(9, 9, 11, 0.1); color: var(--text-primary); }
        .digest-drawer-subtitle {
          margin: 10px 24px 20px;
          font-size: 0.82rem;
          color: var(--text-muted);
          font-family: var(--font-sans);
        }

        /* ── Category List ──────────────────────────────────── */
        .digest-category-list {
          display: flex; flex-direction: column; gap: 10px;
          padding: 0 16px 24px;
        }

        /* ── Category Card ──────────────────────────────────── */
        .digest-cat-card {
          display: flex; align-items: flex-start; gap: 14px;
          padding: 16px;
          border-radius: 16px;
          background: var(--cat-color, rgba(9, 9, 11, 0.04));
          border: 1px solid rgba(9, 9, 11, 0.06);
          text-align: left;
          transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
          cursor: pointer;
          width: 100%;
          position: relative;
          overflow: hidden;
        }
        .digest-cat-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background: var(--cat-color, transparent);
          opacity: 0;
          transition: opacity 0.18s ease;
          border-radius: inherit;
        }
        .digest-cat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px var(--cat-glow, rgba(0,0,0,0.3));
          border-color: rgba(9, 9, 11, 0.14);
        }
        .digest-cat-card:hover::before { opacity: 0.5; }
        .digest-cat-card:active { transform: scale(0.99); }
        .digest-cat-card.read {
          opacity: 0.6;
        }
        .digest-cat-card.read .digest-cat-label { text-decoration: line-through; }

        .digest-cat-icon-wrap {
          width: 40px; height: 40px; flex-shrink: 0;
          border-radius: 12px;
          background: rgba(9, 9, 11, 0.06);
          border: 1px solid rgba(9, 9, 11, 0.08);
          display: flex; align-items: center; justify-content: center;
          color: var(--cat-text, var(--text-secondary));
          position: relative; z-index: 1;
        }
        .digest-cat-body { flex: 1; min-width: 0; position: relative; z-index: 1; }
        .digest-cat-header-row {
          display: flex; align-items: center; gap: 8px; margin-bottom: 3px;
        }
        .digest-cat-label {
          font-size: 0.9rem; font-weight: 700;
          color: var(--cat-text, var(--text-primary));
          font-family: var(--font-display);
        }
        .digest-cat-check { color: var(--color-primary); flex-shrink: 0; }
        .digest-cat-subtitle {
          margin: 0 0 8px;
          font-size: 0.72rem;
          color: var(--text-muted);
          line-height: 1.4;
          font-family: var(--font-sans);
        }
        .digest-cat-paper-title {
          margin: 0;
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .digest-cat-paper-meta {
          margin: 3px 0 0;
          font-size: 0.7rem;
          color: var(--text-muted);
          font-family: var(--font-mono);
        }

        /* ── Paper Detail inside Drawer ─────────────────────── */
        .digest-paper-detail {
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        /* ── Navigation Bar — sticks to top of drawer as it scrolls ── */
        .paper-nav-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 10px 16px;
          border-bottom: 1px solid var(--border-glass);
          background: rgba(251, 249, 244, 0.92);
          backdrop-filter: blur(16px);
          position: sticky;
          top: 0;
          z-index: 20;
          flex-shrink: 0;
        }
        .paper-nav-arrow {
          width: 34px; height: 34px;
          border-radius: 50%;
          border: 1px solid var(--border-glass);
          background: rgba(9, 9, 11, 0.04);
          color: var(--text-secondary);
          font-size: 1rem;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
          transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease;
        }
        .paper-nav-arrow:hover {
          background: rgba(9, 9, 11, 0.1);
          color: var(--text-primary);
          transform: scale(1.08);
        }
        .paper-nav-arrow:active { transform: scale(0.94); }

        .paper-nav-center {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          min-width: 0;
        }
        .paper-nav-cat-pill {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 0.7rem;
          font-weight: 700;
          padding: 3px 10px;
          border-radius: 99px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          white-space: nowrap;
          transition: background 0.3s ease, color 0.3s ease;
          font-family: var(--font-mono);
        }
        .paper-nav-cat-pill svg { width: 12px; height: 12px; }

        /* Progress dot strip */
        .paper-nav-dots {
          display: flex;
          gap: 5px;
          align-items: center;
        }
        .paper-nav-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: rgba(9, 9, 11, 0.12);
          transition: background 0.3s ease, transform 0.3s ease, width 0.3s ease, border-radius 0.3s ease;
          flex-shrink: 0;
        }
        .paper-nav-dot.active {
          background: var(--color-primary);
          transform: scale(1.2);
          width: 14px;
          border-radius: 3px;
        }
        .paper-nav-dot.read { background: #10b981; }
        .paper-nav-dot.read.active { background: #10b981; transform: scale(1.2); width: 14px; border-radius: 3px; }

        /* ── Stacked scroll container ─────────────────────── */
        .paper-stack-scroll {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          overscroll-behavior: contain;
          scroll-snap-type: y proximity;
          scroll-behavior: smooth;
        }

        /* ── Each paper item ──────────────────────────────── */
        .paper-stack-item {
          display: flex;
          flex-direction: column;
          scroll-snap-align: start;
          scroll-snap-stop: always;
          height: 100%;
          min-height: 100%;
          position: relative;
        }

        .paper-sticky-boundary {
          display: flex;
          flex-direction: column;
          width: 100%;
          flex: 1;
          min-height: 0;
        }

        /* Sticky header block for category, title, meta */
        .paper-stack-header-group {
          display: flex;
          flex-direction: column;
        }
        .paper-stack-title-header {
          padding: 14px 20px 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .paper-title-compact {
          margin: 0;
          font-size: 1.15rem;
          font-weight: 700;
          line-height: 1.4;
          color: var(--text-primary);
          font-family: var(--font-display);
        }
        .paper-meta-compact {
          display: flex;
          align-items: center;
          gap: 12px;
          color: var(--text-secondary);
          font-size: 0.78rem;
          font-family: var(--font-mono);
        }
        .meta-authors {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          flex: 1;
        }
        .meta-year {
          flex-shrink: 0;
          color: var(--color-primary);
          background: var(--color-primary-glow);
          border: 1px solid rgba(27, 73, 49, 0.25);
          padding: 1px 6px;
          border-radius: 99px;
          font-weight: 700;
        }
        .paper-stack-item .paper-card {
          background: transparent;
          border: 1px solid transparent;
          box-shadow: none;
          padding: 10px 16px 16px;
          border-radius: var(--radius-lg);
          transition: border-color var(--transition-fast), background var(--transition-fast), box-shadow var(--transition-fast), opacity var(--transition-normal);
        }
        .paper-stack-item .paper-card.card-liked {
          border-color: rgba(27, 73, 49, 0.4);
          background: rgba(27, 73, 49, 0.02);
          box-shadow: 0 4px 20px var(--color-primary-glow);
        }
        .paper-stack-item .paper-card.card-disliked {
          animation: none;
          opacity: 0.45;
          filter: grayscale(0.4);
        }

        /* Category header (double as IO target for dot tracking) */
         .paper-stack-cat-header {
          position: sticky;
          top: 0;
          z-index: 15;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 20px 12px;
          background: linear-gradient(135deg, var(--cat-color, rgba(27, 73, 49, 0.05)), transparent), var(--bg-darker);
          border-bottom: 1px solid var(--border-glass);
        }
        .paper-stack-cat-icon {
          font-size: 22px;
          flex-shrink: 0;
        }
        .paper-stack-cat-label {
          margin: 0;
          font-size: 0.82rem;
          font-weight: 800;
          color: var(--cat-text, var(--text-primary));
          text-transform: uppercase;
          letter-spacing: 0.07em;
          font-family: var(--font-mono);
        }
        .paper-stack-cat-sub {
          margin: 2px 0 0;
          font-size: 0.7rem;
          color: var(--text-muted);
          line-height: 1.4;
          font-family: var(--font-sans);
        }
        .paper-stack-cat-check {
          color: var(--color-primary);
          margin-left: auto;
          flex-shrink: 0;
        }

        /* Invisible sentinel that triggers read detection */
        .paper-read-sentinel {
          height: 1px;
          width: 100%;
          pointer-events: none;
        }

        /* ── Between-paper divider ─────────────────────────── */
        .paper-stack-divider {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 8px 20px;
          gap: 8px;
          color: var(--text-muted);
          font-size: 0.75rem;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          border-top: 1px solid var(--border-glass);
          border-bottom: 1px solid var(--border-glass);
          background: rgba(9, 9, 11, 0.015);
        }
        .paper-stack-divider span {
          animation: nudgeDown 1.8s ease-in-out infinite;
        }
        @keyframes nudgeDown {
          0%, 100% { transform: translateY(0); opacity: 0.5; }
          50%       { transform: translateY(4px); opacity: 1; }
        }

        /* ── End of digest marker ─────────────────────────── */
        .paper-stack-end {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px 20px 24px;
          color: var(--text-muted);
          font-size: 0.85rem;
          font-weight: 600;
          gap: 8px;
        }
        .digest-drawer-close:hover { opacity: 0.75; }

        /* ── Simple paper card (in-stack reading view) ──────── */
        .simple-paper-card {
          margin: 0;
          padding: 24px 20px 28px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          background: var(--bg-darker);
        }
        .simple-paper-title {
          margin: 0;
          font-size: 1.15rem;
          font-weight: 700;
          line-height: 1.4;
          color: var(--text-primary);
          font-family: var(--font-display);
        }
        .simple-paper-meta {
          display: flex;
          align-items: baseline;
          gap: 10px;
          flex-wrap: wrap;
          font-family: var(--font-mono);
        }
        .simple-paper-authors {
          font-size: 0.8rem;
          color: var(--text-secondary);
          font-weight: 500;
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .simple-paper-year {
          font-size: 0.78rem;
          font-weight: 700;
          color: var(--color-primary);
          background: var(--color-primary-glow);
          border: 1px solid rgba(27, 73, 49, 0.25);
          padding: 2px 8px;
          border-radius: 99px;
          flex-shrink: 0;
        }
        .simple-paper-summary {
          margin: 0;
          font-size: 0.95rem;
          line-height: 1.7;
          color: var(--text-secondary);
          padding: 14px 16px;
          background: rgba(9, 9, 11, 0.03);
          border-left: 3px solid var(--color-primary);
          border-radius: 0 8px 8px 0;
          font-family: var(--font-sans);
        }
        .simple-paper-bullets {
          margin: 0;
          padding: 0 0 0 18px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          list-style: none;
        }
        .simple-paper-bullets li {
          font-size: 0.88rem;
          line-height: 1.55;
          color: var(--text-secondary);
          padding-left: 14px;
          position: relative;
        }
        .simple-paper-bullets li::before {
          content: '';
          position: absolute;
          left: 0; top: 8px;
          width: 5px; height: 5px;
          border-radius: 50%;
          background: var(--color-primary);
          opacity: 0.6;
        }



        /* ══════════════════════════════════════════════════════ */
        /* ── Completion Overlay ──────────────────────────────── */
        /* ══════════════════════════════════════════════════════ */

        .completion-overlay {
          position: fixed;
          inset: 0;
          z-index: 100;
          background: rgba(9, 9, 11, 0.95);
          backdrop-filter: blur(16px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          animation: completionFadeIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        @keyframes completionFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        /* ── Main card ─────────────────────────────────────── */
        .completion-card {
          position: relative;
          width: 100%;
          max-width: 380px;
          background: var(--bg-darker);
          border: 1px solid rgba(217, 119, 6, 0.25);
          border-radius: 28px;
          padding: 36px 28px 32px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          box-shadow:
            0 0 0 1px rgba(217, 119, 6, 0.05),
            0 0 60px rgba(217, 119, 6, 0.1),
            0 24px 64px rgba(0,0,0,0.6);
          animation: cardPopIn 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s both;
          overflow: hidden;
        }
        /* subtle top shimmer streak */
        .completion-card::before {
          content: '';
          position: absolute;
          top: 0; left: 10%; right: 10%; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(217, 119, 6, 0.4), transparent);
        }
        @keyframes cardPopIn {
          from { opacity: 0; transform: scale(0.82) translateY(24px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }

        /* ── Trophy ──────────────────────────────────────── */
        .completion-trophy {
          position: relative;
          width: 84px; height: 84px;
          display: flex; align-items: center; justify-content: center;
        }
        .completion-trophy-emoji {
          font-size: 44px;
          line-height: 1;
          position: relative; z-index: 1;
          animation: trophyBounce 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s both;
        }
        @keyframes trophyBounce {
          from { transform: scale(0) rotate(-20deg); opacity: 0; }
          to   { transform: scale(1) rotate(0deg);   opacity: 1; }
        }
        .completion-trophy-ring {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 2px solid rgba(217, 119, 6, 0.3);
          animation: trophyRingPulse 2.4s ease-in-out infinite;
        }
        @keyframes trophyRingPulse {
          0%,100% { transform: scale(1);    opacity: 0.7; }
          50%      { transform: scale(1.18); opacity: 0;   }
        }

        /* ── Text ──────────────────────────────────────── */
        .completion-headline {
          margin: 0;
          font-size: 1.75rem;
          font-weight: 800;
          font-family: var(--font-display);
          background: linear-gradient(135deg, var(--color-secondary), var(--color-primary));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          text-align: center;
          line-height: 1.15;
        }
        .completion-sub {
          margin: 0;
          font-size: 0.9rem;
          color: var(--text-secondary);
          text-align: center;
          line-height: 1.55;
          max-width: 300px;
          font-family: var(--font-sans);
        }

        /* ── Streak pill ──────────────────────────────── */
        .completion-streak {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(217, 119, 6, 0.1);
          border: 1px solid rgba(217, 119, 6, 0.25);
          border-radius: 99px;
          padding: 6px 16px;
          font-size: 0.82rem;
          font-weight: 700;
          color: var(--color-secondary);
          animation: streakSlide 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.5s both;
          font-family: var(--font-mono);
        }
        @keyframes streakSlide {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Divider ──────────────────────────────────── */
        .completion-divider {
          width: 100%;
          height: 1px;
          background: var(--border-glass);
        }

        /* ── Next landmark teaser ─────────────────────── */
        .completion-next {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 10px;
          animation: nextSlide 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.6s both;
        }
        @keyframes nextSlide {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .completion-next-label {
          margin: 0;
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-muted);
          font-family: var(--font-mono);
        }
        .completion-next-card {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px;
          background: rgba(9, 9, 11, 0.03);
          border: 1px solid var(--border-glass);
          border-radius: 14px;
          filter: blur(0px);
          position: relative;
          overflow: hidden;
        }
        /* frosted locked overlay */
        .completion-next-card::after {
          content: '';
          position: absolute;
          inset: 0;
          background: rgba(7,9,14,0.45);
          backdrop-filter: blur(3px);
          border-radius: inherit;
        }
        .completion-next-icon {
          font-size: 26px;
          flex-shrink: 0;
          position: relative; z-index: 1;
          opacity: 0.35;
        }
        .completion-next-body {
          flex: 1;
          min-width: 0;
          position: relative; z-index: 1;
          opacity: 0.4;
        }
        .completion-next-title {
          margin: 0;
          font-size: 0.88rem;
          font-weight: 700;
          color: var(--text-primary);
        }
        .completion-next-sub {
          margin: 3px 0 0;
          font-size: 0.72rem;
          color: var(--text-muted);
        }
        .completion-next-badge {
          position: relative; z-index: 1;
          font-size: 0.68rem;
          font-weight: 800;
          padding: 4px 10px;
          border-radius: 99px;
          background: rgba(100,116,139,0.15);
          border: 1px solid rgba(100,116,139,0.2);
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          flex-shrink: 0;
          font-family: var(--font-mono);
        }

        /* ── CTA button ──────────────────────────────── */
        .completion-cta {
          width: 100%;
          padding: 14px;
          border-radius: 14px;
          background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
          color: var(--text-dark);
          font-size: 0.95rem;
          font-weight: 700;
          font-family: var(--font-display);
          letter-spacing: 0.02em;
          transition: transform 0.18s ease, filter 0.18s ease;
          animation: ctaSlide 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.75s both;
        }
        .completion-cta:hover {
          transform: translateY(-2px);
          filter: brightness(1.12);
        }
        .completion-cta:active { transform: scale(0.98); }
        @keyframes ctaSlide {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ══════════════════════════════════════════════════ */
        /* ── Confetti ─────────────────────────────────────── */
        /* ══════════════════════════════════════════════════ */
        .confetti-field {
          position: fixed;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
          z-index: 99;
        }
        .confetti-piece {
          position: absolute;
          width: 10px;
          height: 10px;
          border-radius: 2px;
          opacity: 0;
          animation: confettiFall 2.4s ease-in forwards;
        }
        @keyframes confettiFall {
          0%   { opacity: 1; transform: translateY(-20px) rotate(0deg) scale(1); }
          80%  { opacity: 1; }
          100% { opacity: 0; transform: translateY(100vh) rotate(720deg) scale(0.6); }
        }

        /* 20 unique pieces: varied colours, positions, delays, widths */
        .cp-0  { left: 5%;  top: 0; background: var(--color-primary); width: 8px;  height: 12px; animation-delay: 0.0s; animation-duration: 2.2s; }
        .cp-1  { left: 10%; top: 0; background: var(--color-secondary); width: 12px; height: 8px;  animation-delay: 0.1s; animation-duration: 2.5s; border-radius: 50%; }
        .cp-2  { left: 18%; top: 0; background: var(--color-accent); width: 10px; height: 10px; animation-delay: 0.05s; animation-duration: 2.1s; }
        .cp-3  { left: 25%; top: 0; background: var(--text-primary); width: 8px;  height: 14px; animation-delay: 0.2s;  animation-duration: 2.6s; }
        .cp-4  { left: 33%; top: 0; background: var(--color-secondary); width: 14px; height: 8px;  animation-delay: 0.0s;  animation-duration: 2.3s; border-radius: 50%; }
        .cp-5  { left: 42%; top: 0; background: var(--text-muted); width: 10px; height: 10px; animation-delay: 0.15s; animation-duration: 2.0s; }
        .cp-6  { left: 50%; top: 0; background: var(--color-accent); width: 8px;  height: 12px; animation-delay: 0.08s; animation-duration: 2.4s; }
        .cp-7  { left: 58%; top: 0; background: var(--color-primary); width: 12px; height: 8px;  animation-delay: 0.25s; animation-duration: 2.7s; border-radius: 50%; }
        .cp-8  { left: 66%; top: 0; background: var(--text-primary); width: 10px; height: 10px; animation-delay: 0.05s; animation-duration: 2.2s; }
        .cp-9  { left: 74%; top: 0; background: var(--color-secondary); width: 8px;  height: 14px; animation-delay: 0.18s; animation-duration: 2.5s; }
        .cp-10 { left: 82%; top: 0; background: var(--color-primary); width: 14px; height: 8px;  animation-delay: 0.0s;  animation-duration: 2.3s; border-radius: 50%; }
        .cp-11 { left: 90%; top: 0; background: var(--text-muted); width: 10px; height: 10px; animation-delay: 0.12s; animation-duration: 2.6s; }
        .cp-12 { left: 96%; top: 0; background: var(--color-accent); width: 8px;  height: 12px; animation-delay: 0.22s; animation-duration: 2.1s; }
        .cp-13 { left: 3%;  top: 0; background: var(--color-secondary); width: 12px; height: 8px;  animation-delay: 0.3s;  animation-duration: 2.8s; border-radius: 50%; }
        .cp-14 { left: 15%; top: 0; background: var(--color-primary); width: 8px;  height: 10px; animation-delay: 0.04s; animation-duration: 2.0s; }
        .cp-15 { left: 38%; top: 0; background: var(--text-primary); width: 10px; height: 8px;  animation-delay: 0.16s; animation-duration: 2.4s; }
        .cp-16 { left: 55%; top: 0; background: var(--color-secondary); width: 12px; height: 12px; animation-delay: 0.07s; animation-duration: 2.2s; border-radius: 50%; }
        .cp-17 { left: 70%; top: 0; background: var(--color-accent); width: 8px;  height: 14px; animation-delay: 0.28s; animation-duration: 2.6s; }
        .cp-18 { left: 85%; top: 0; background: var(--text-muted); width: 14px; height: 8px;  animation-delay: 0.1s;  animation-duration: 2.3s; }
        .cp-19 { left: 47%; top: 0; background: var(--color-primary); width: 10px; height: 10px; animation-delay: 0.35s; animation-duration: 2.5s; border-radius: 50%; }

        /* ══════════════════════════════════════════════════ */
        /* ── AI Chat Overlay ─────────────────────────────── */
        /* ══════════════════════════════════════════════════ */

        .digest-chat-backdrop {
          position: fixed;
          inset: 0;
          z-index: 120;
          background: rgba(18, 17, 15, 0.45);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          animation: chatFadeIn 0.3s ease-out;
        }

        @keyframes chatFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        .digest-chat-modal {
          background: var(--bg-darkest);
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.015'/%3E%3C/svg%3E");
          border: 1px solid var(--border-glass-bright);
          border-radius: var(--radius-xl);
          width: 100%;
          max-width: 520px;
          height: 80vh;
          max-height: 680px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 24px 64px rgba(28, 27, 24, 0.18), 0 0 0 1px rgba(9, 9, 11, 0.02);
          overflow: hidden;
          animation: chatPop 0.38s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }

        @keyframes chatPop {
          from { transform: scale(0.92) translateY(16px); opacity: 0; }
          to   { transform: scale(1) translateY(0); opacity: 1; }
        }

        .digest-chat-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 24px;
          background: var(--bg-darker);
          border-bottom: 1px solid var(--border-glass);
        }

        .digest-chat-header-title {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

        .digest-chat-sparkle {
          font-size: 24px;
          flex-shrink: 0;
          animation: sparkleSpin 3s ease-in-out infinite;
        }

        @keyframes sparkleSpin {
          0%, 100% { transform: scale(1) rotate(0deg); }
          50% { transform: scale(1.1) rotate(10deg); }
        }

        .digest-chat-paper-title {
          margin: 0;
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--color-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-family: var(--font-display);
        }

        .digest-chat-subtitle {
          margin: 2px 0 0;
          font-size: 0.72rem;
          color: var(--text-muted);
          font-family: var(--font-sans);
        }

        .digest-chat-close-btn {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(9, 9, 11, 0.05);
          border: 1px solid var(--border-glass);
          color: var(--text-muted);
          transition: var(--transition-fast);
          flex-shrink: 0;
        }

        .digest-chat-close-btn:hover {
          background: rgba(9, 9, 11, 0.1);
          color: var(--text-primary);
        }

        .digest-chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          background: transparent;
        }

        .digest-chat-welcome {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          margin: auto 0;
          padding: 0 12px;
          animation: welcomeFade 0.4s ease-out;
        }

        @keyframes welcomeFade {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .welcome-heading {
          font-family: var(--font-display);
          font-size: 1.35rem;
          font-weight: 700;
          color: var(--color-primary);
          margin-bottom: 8px;
        }

        .welcome-sub {
          font-size: 0.85rem;
          line-height: 1.5;
          margin-bottom: 24px;
          max-width: 320px;
        }

        .digest-chat-suggestions {
          display: flex;
          flex-direction: column;
          gap: 8px;
          width: 100%;
          max-width: 340px;
        }

        .digest-chat-suggestions button {
          width: 100%;
          text-align: left;
          padding: 10px 14px;
          background: var(--bg-darker);
          border: 1px solid var(--border-glass);
          border-radius: var(--radius-md);
          font-size: 0.8rem;
          font-weight: 500;
          color: var(--text-secondary);
          transition: transform 0.15s ease, background 0.15s ease;
        }

        .digest-chat-suggestions button:hover {
          transform: translateX(4px);
          background: var(--bg-dark);
          color: var(--text-primary);
        }

        .digest-chat-bubble-container {
          display: flex;
          width: 100%;
        }

        .digest-chat-bubble-container.user {
          justify-content: flex-end;
        }

        .digest-chat-bubble-container.model {
          justify-content: flex-start;
        }

        .digest-chat-bubble {
          max-width: 82%;
          padding: 12px 16px;
          font-size: 0.88rem;
          line-height: 1.55;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
          word-break: break-word;
          white-space: pre-wrap;
          font-family: var(--font-sans);
        }

        .digest-chat-bubble-container.user .digest-chat-bubble {
          background: var(--color-primary);
          color: var(--text-dark);
          border-radius: 18px 18px 2px 18px;
        }

        .digest-chat-bubble-container.model .digest-chat-bubble {
          background: var(--bg-darker);
          color: var(--text-primary);
          border-radius: 18px 18px 18px 2px;
          border: 1px solid var(--border-glass);
        }

        /* Typing spinner */
        .digest-chat-bubble.loading {
          padding: 14px 18px;
        }

        .typing-indicator {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .typing-indicator span {
          width: 6px;
          height: 6px;
          background: var(--text-muted);
          border-radius: 50%;
          animation: typingBounce 1.4s infinite ease-in-out both;
        }

        .typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
        .typing-indicator span:nth-child(2) { animation-delay: -0.16s; }

        @keyframes typingBounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }

        .digest-chat-error-bar {
          background: var(--color-error-glow);
          color: var(--color-error);
          border: 1px solid rgba(190, 18, 62, 0.2);
          border-radius: var(--radius-md);
          padding: 10px 14px;
          font-size: 0.82rem;
          font-weight: 500;
          text-align: center;
        }

        /* Input form area */
        .digest-chat-input-form {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 16px 20px;
          background: var(--bg-darker);
          border-top: 1px solid var(--border-glass);
        }

        .digest-chat-input-form input {
          flex: 1;
          height: 44px;
          padding: 0 16px;
          background: var(--bg-darkest);
          border: 1px solid var(--border-glass-bright);
          border-radius: 99px;
          font-size: 0.88rem;
          color: var(--text-primary);
          transition: border-color var(--transition-fast);
        }

        .digest-chat-input-form input:focus {
          border-color: var(--color-primary);
        }

        .digest-chat-input-form button {
          height: 44px;
          padding: 0 20px;
          background: var(--color-primary);
          color: var(--text-dark);
          font-size: 0.88rem;
          font-weight: 600;
          border-radius: 99px;
          transition: filter var(--transition-fast), transform var(--transition-fast);
        }

        .digest-chat-input-form button:hover:not(:disabled) {
          transform: translateY(-1px);
          filter: brightness(1.12);
        }

        .digest-chat-input-form button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Sleeping card styles */
        .digest-completed-sleeping-card {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          width: calc(100% - 32px);
          max-width: 420px;
          padding: 10px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border: 1px solid rgba(27, 73, 49, 0.15);
          background: rgba(251, 249, 244, 0.85);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          box-shadow: 0 8px 32px rgba(27, 73, 49, 0.12);
          border-radius: var(--radius-md);
          animation: sleepingPopIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
          z-index: 999;
          pointer-events: auto;
        }
        .digest-completed-sleeping-card .sleeping-content {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: center;
          gap: 2px;
          text-align: left;
          flex: 1;
          min-width: 0;
        }
        .debug-fast-forward-btn {
          flex-shrink: 0;
          padding: 6px 12px;
          border-radius: 8px;
          border: 1px solid rgba(27, 73, 49, 0.25);
          background: rgba(27, 73, 49, 0.08);
          color: var(--color-primary);
          font-size: 0.78rem;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
          transition: all var(--transition-fast);
        }
        .debug-fast-forward-btn:hover {
          background: rgba(27, 73, 49, 0.16);
          border-color: rgba(27, 73, 49, 0.4);
        }
        .sleeping-timer span {
          font-variant-numeric: tabular-nums;
        }
        @keyframes sleepingPopIn {
          from { opacity: 0; transform: translate(-50%, 20px) scale(0.95); }
          to   { opacity: 1; transform: translate(-50%, 0) scale(1); }
        }
        .sleeping-avatar-container {
          position: relative;
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: var(--bg-darkest);
          border: 1px solid var(--border-glass-bright);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .sleeping-avatar {
          font-size: 26px;
          animation: avatarFloat 4s ease-in-out infinite;
        }
        @keyframes avatarFloat {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-4px) rotate(4deg); }
        }
        .sleeping-pulse {
          position: absolute;
          inset: -4px;
          border-radius: 50%;
          border: 1.5px solid rgba(27, 73, 49, 0.25);
          animation: pulseExpand 2.5s infinite;
          pointer-events: none;
        }
        @keyframes pulseExpand {
          0% { transform: scale(0.95); opacity: 0.8; }
        }
        .debug-advance-btn {
          margin-top: 12px;
          padding: 6px 12px;
          font-size: 0.75rem;
          font-weight: 600;
          background: rgba(9,9,11,0.06);
          border: 1px solid var(--border-glass-bright);
          border-radius: 8px;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s ease;
        }
        .debug-advance-btn:hover {
          background: rgba(9,9,11,0.1);
          color: var(--text-primary);
        }



        /* ── Map Streak Badge ── */
        .map-streak-badge {
          position: absolute;
          top: 90px;
          right: 16px;
          z-index: 10;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 16px;
          border-radius: 20px;
          background: rgba(251, 146, 60, 0.06);
          border: 1px solid rgba(251, 146, 60, 0.2);
          box-shadow: 
            0 8px 32px rgba(0, 0, 0, 0.2),
            inset 0 0 12px rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          animation: badgeFloat 3s ease-in-out infinite;
          cursor: default;
        }
        .map-streak-badge:hover {
          transform: scale(1.05) translateY(-2px);
          border-color: rgba(251, 146, 60, 0.4);
          background: rgba(251, 146, 60, 0.1);
          box-shadow: 
            0 12px 40px rgba(251, 146, 60, 0.12),
            inset 0 0 16px rgba(251, 146, 60, 0.05);
        }
        .map-streak-flame {
          width: 20px;
          height: 20px;
          fill: #f97316;
          filter: drop-shadow(0 0 6px #ea580c);
          animation: flamePulse 1.2s ease-in-out infinite alternate;
        }
        .map-streak-text {
          display: flex;
          flex-direction: column;
          line-height: 1.25;
          text-align: left;
          gap: 2px;
        }
        .map-streak-val {
          font-family: var(--font-display);
          font-size: 0.9rem;
          font-weight: 900;
          color: #f97316;
          letter-spacing: 0.02em;
        }
        .map-streak-label {
          font-family: var(--font-mono);
          font-size: 0.52rem;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        @keyframes badgeFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes flamePulse {
          0% { transform: scale(0.9) brightness(0.95); }
          100% { transform: scale(1.1) brightness(1.2); }
        }

        /* ── Loading View ── */
        .digest-map-loading {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 20px;
          padding: 40px;
        }
        .digest-loading-ring {
          width: 72px; height: 72px;
          border-radius: 50%;
          background: var(--color-primary-glow);
          border: 2px solid rgba(180, 83, 9, 0.3);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 32px rgba(180, 83, 9, 0.15);
        }
        .digest-loading-spinner {
          color: var(--color-primary);
          animation: spin 1.2s linear infinite;
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .digest-loading-status {
          font-size: 0.88rem;
          color: var(--text-secondary);
          text-align: center;
          max-width: 260px;
          line-height: 1.5;
        }
        .digest-loading-bar-track {
          width: 220px; height: 4px;
          background: rgba(9, 9, 11, 0.08);
          border-radius: 2px;
          overflow: hidden;
        }
        .digest-loading-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--color-primary), var(--color-accent));
          border-radius: 2px;
          transition: width 0.4s ease;
        }
        .digest-loading-pct {
          font-size: 0.8rem; font-weight: 700;
          color: var(--text-muted);
        }
      `}</style>
    </div>
  );
}