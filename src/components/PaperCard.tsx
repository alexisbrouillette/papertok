import React, { useState, useEffect } from 'react';
import { BookOpen, ThumbsUp, ThumbsDown, MessageSquare, ExternalLink, Calendar, Users, Award } from 'lucide-react';
import type { FoundationalPaper } from '../services/gemini';
import { enrichPaperMetadata, getCachedMetadata, type EnrichedMetadata } from '../services/literature';

interface InteractiveTextProps {
  text: string;
  concepts: { term: string; definition: string; origin: string }[];
  blockId: string;
  activeTag: { term: string; blockId: string } | null;
  onTagClick: (term: string, blockId: string) => void;
}

const InteractiveText: React.FC<InteractiveTextProps> = ({
  text,
  concepts,
  blockId,
  activeTag,
  onTagClick,
}) => {
  if (!concepts || concepts.length === 0 || !text) {
    return <>{text}</>;
  }

  // Create a regex to match any of the concept terms (case-insensitive)
  const terms = concepts
    .filter(c => c && c.term)
    // eslint-disable-next-line no-useless-escape
    .map(c => c.term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
  
  if (terms.length === 0) {
    return <>{text}</>;
  }

  const regex = new RegExp(`\\b(${terms.join('|')})\\b`, 'gi');

  const parts = text.split(regex);
  if (parts.length === 1) {
    return <>{text}</>;
  }

  // Keep track of terms we have already tagged within this text block
  const renderedTerms = new Set<string>();

  return (
    <>
      {parts.map((part, index) => {
        const matchingConcept = concepts.find(
          c => c && c.term && c.term.toLowerCase() === part.toLowerCase()
        );

        if (matchingConcept) {
          const termLower = matchingConcept.term.toLowerCase();
          if (!renderedTerms.has(termLower)) {
            renderedTerms.add(termLower);
            const isActive = activeTag?.term === matchingConcept.term && activeTag?.blockId === blockId;
            return (
              <button
                key={index}
                className={`concept-inline-tag ${isActive ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onTagClick(matchingConcept.term, blockId);
                }}
                type="button"
              >
                {part}
              </button>
            );
          }
        }

        return part;
      })}
    </>
  );
};

interface PaperCardProps {
  paper: FoundationalPaper;
  s2ApiKey?: string;
  rating: 'like' | 'dislike' | null;
  onLike: () => void;
  onDislike: () => void;
  onOpenChat: (paper: FoundationalPaper, metadata: EnrichedMetadata) => void;
  index: number;
  total: number;
  hideHeader?: boolean;
  children?: React.ReactNode;
  onContentScroll?: (scrollTop: number, isBottom: boolean) => void;
}

export const PaperCard: React.FC<PaperCardProps> = ({
  paper,
  s2ApiKey,
  rating,
  onLike,
  onDislike,
  onOpenChat,
  index,
  total,
  hideHeader = false,
  children,
  onContentScroll
}) => {
  const [metadata, setMetadata] = useState<EnrichedMetadata>({ source: 'google-scholar' });
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(true);
  const [underTheHoodOpen, setUnderTheHoodOpen] = useState(true);
  const [activeTag, setActiveTag] = useState<{ term: string; blockId: string } | null>(null);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  const explanation = React.useMemo(() => {
    return paper.explanation || {
      paperType: 'methodology',
      coreIntuition: paper.coreIdea || '',
      deconstructedParts: [],
      synthesis: paper.achievements || ''
    };
  }, [paper.explanation, paper.coreIdea, paper.achievements]);

  const paperType = explanation.paperType || 'methodology';

  const pipelineSteps = React.useMemo(() => {
    const steps: { id: string; label: string; title: string; content: string }[] = [];

    // Step 1: Core Intuition (Always present)
    if (explanation.coreIntuition || paper.coreIdea) {
      steps.push({
        id: 'coreIntuition',
        label: 'Core Intuition',
        title: 'The fundamental intuition behind the concept',
        content: explanation.coreIntuition || paper.coreIdea
      });
    }

    // Step 2: Purpose & Question
    const purposeText = explanation.researchQuestion || paper.purpose;
    if (purposeText) {
      steps.push({
        id: explanation.researchQuestion ? 'researchQuestion' : 'purpose',
        label: paperType === 'empirical_study' ? 'Research Question' : 'Purpose & Goal',
        title: 'What this work set out to address',
        content: purposeText
      });
    }

    // Step 3: Methodology & Setup
    if (paperType === 'methodology') {
      if (explanation.deconstructedParts && explanation.deconstructedParts.length > 0) {
        explanation.deconstructedParts.forEach((part, idx) => {
          steps.push({
            id: `deconstructed-${idx}`,
            label: 'Methodology Component',
            title: part.title,
            content: part.explanation
          });
        });
      }
    } else if (paperType === 'empirical_study' && explanation.studySetup) {
      steps.push({
        id: 'studySetup',
        label: 'Study Setup',
        title: 'How the experiment/study was designed',
        content: explanation.studySetup
      });
    } else if (paperType === 'theoretical') {
      if (explanation.assumptions) {
        steps.push({
          id: 'assumptions',
          label: 'Assumptions',
          title: 'Boundary conditions & frameworks',
          content: explanation.assumptions
        });
      }
      if (explanation.coreTheorem) {
        steps.push({
          id: 'coreTheorem',
          label: 'Core Theorem',
          title: 'The mathematical statement proved',
          content: explanation.coreTheorem
        });
      }
      if (explanation.proofStrategy) {
        steps.push({
          id: 'proofStrategy',
          label: 'Proof Strategy',
          title: 'The roadmap used to prove the statement',
          content: explanation.proofStrategy
        });
      }
    } else if (paperType === 'review_survey') {
      if (explanation.surveyScope) {
        steps.push({
          id: 'surveyScope',
          label: 'Survey Scope',
          title: 'The research area and themes covered',
          content: explanation.surveyScope
        });
      }
      if (explanation.taxonomy) {
        steps.push({
          id: 'taxonomy',
          label: 'Taxonomy',
          title: 'Categorization of literature',
          content: explanation.taxonomy
        });
      }
    }

    // Step 4: Key Findings & Results
    const resultsText = explanation.keyFindings || explanation.synthesis || explanation.consensusAndTrends || paper.achievements;
    if (resultsText) {
      steps.push({
        id: explanation.keyFindings ? 'keyFindings' : (explanation.synthesis ? 'synthesis' : (explanation.consensusAndTrends ? 'consensusAndTrends' : 'achievements')),
        label: paperType === 'empirical_study' ? 'Key Findings' : 'Achievements & Findings',
        title: 'Main results and discoveries',
        content: resultsText
      });
    }

    // Step 5: Implications & Significance
    const implicationsText = explanation.interpretation || explanation.theoreticalSignificance || explanation.openChallenges || paper.limitations;
    if (implicationsText) {
      steps.push({
        id: explanation.interpretation ? 'interpretation' : (explanation.theoreticalSignificance ? 'theoreticalSignificance' : (explanation.openChallenges ? 'openChallenges' : 'limitations')),
        label: paperType === 'review_survey' ? 'Open Challenges' : 'Significance & Limitations',
        title: 'Future roadmap and impact constraints',
        content: implicationsText
      });
    }

    return steps;
  }, [explanation, paper, paperType]);

  React.useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const handleResizeOrMount = () => {
      const isScrollable = el.scrollHeight > el.clientHeight;
      if (!isScrollable) {
        onContentScroll?.(0, true);
      } else {
        const isBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 15;
        onContentScroll?.(el.scrollTop, isBottom);
      }
    };

    handleResizeOrMount();

    const ro = new ResizeObserver(() => {
      handleResizeOrMount();
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
    };
  }, [paper, onContentScroll]);

  // Map concept terms to the first block ID they appear in (case-insensitive boundary check)
  const conceptToBlockMap = React.useMemo(() => {
    const map = new Map<string, string>(); // term.toLowerCase() -> blockId
    if (!paper.taggedConcepts || paper.taggedConcepts.length === 0) {
      return map;
    }

    const blocks = [
      { id: 'coreIntuition', text: paper.coreIdea },
      { id: 'purpose', text: paper.purpose },
      
      // Methodology
      ...(explanation.deconstructedParts || []).map((part, idx) => ({
        id: `deconstructed-${idx}`,
        text: part.explanation,
      })),
      { id: 'synthesis', text: explanation.synthesis },

      // Empirical Study
      { id: 'researchQuestion', text: explanation.researchQuestion },
      { id: 'studySetup', text: explanation.studySetup },
      { id: 'keyFindings', text: explanation.keyFindings },
      { id: 'interpretation', text: explanation.interpretation },

      // Theoretical
      { id: 'coreTheorem', text: explanation.coreTheorem },
      { id: 'assumptions', text: explanation.assumptions },
      { id: 'proofStrategy', text: explanation.proofStrategy },
      { id: 'theoreticalSignificance', text: explanation.theoreticalSignificance },

      // Review / Survey
      { id: 'surveyScope', text: explanation.surveyScope },
      { id: 'taxonomy', text: explanation.taxonomy },
      { id: 'consensusAndTrends', text: explanation.consensusAndTrends },
      { id: 'openChallenges', text: explanation.openChallenges },

      { id: 'beforeState', text: explanation.beforeState },
      { id: 'afterState', text: explanation.afterState },
      { id: 'achievements', text: paper.achievements },
      { id: 'limitations', text: paper.limitations },
    ];

    for (const concept of paper.taggedConcepts) {
      if (!concept || !concept.term) continue;
      const termLower = concept.term.toLowerCase();
      // eslint-disable-next-line no-useless-escape
      const escapedTerm = concept.term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedTerm}\\b`, 'i');

      for (const block of blocks) {
        if (block.text && regex.test(block.text)) {
          map.set(termLower, block.id);
          break; // Stop scanning further blocks as this is the first occurrence
        }
      }
    }

    return map;
  }, [paper]);

  const getConceptsForBlock = (blockId: string) => {
    if (!paper.taggedConcepts) return [];
    return paper.taggedConcepts.filter(c => {
      if (!c || !c.term) return false;
      return conceptToBlockMap.get(c.term.toLowerCase()) === blockId;
    });
  };

  const handleTagClick = (term: string, blockId: string) => {
    setActiveTag((prev) => {
      if (prev?.term === term && prev?.blockId === blockId) {
        return null;
      }
      return { term, blockId };
    });
  };

  const renderConceptCard = (blockId: string) => {
    if (!activeTag || activeTag.blockId !== blockId) return null;
    const concept = paper.taggedConcepts?.find(c => c && c.term === activeTag.term);
    if (!concept) return null;

    return (
      <div className="concept-detail-card glass-panel anim-slide-up">
        <div className="concept-card-header">
          <h5 className="concept-card-title">Concept: {concept.term}</h5>
          <button
            className="concept-card-close"
            onClick={() => setActiveTag(null)}
            type="button"
          >
            ✕
          </button>
        </div>
        <div className="concept-card-body">
          <div className="concept-section">
            <span className="concept-section-label">What it is</span>
            <p className="concept-section-text">{concept.definition}</p>
          </div>
          {concept.origin && (
            <div className="concept-section">
              <span className="concept-section-label">Where it comes from</span>
              <p className="concept-section-text">
                {concept.origin}{' '}
                {concept.paperUrl && (
                  <a
                    href={concept.paperUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="concept-paper-link"
                  >
                    [Read Paper <ExternalLink size={10} style={{ display: 'inline', marginLeft: '2px' }} />]
                  </a>
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  useEffect(() => {
    let active = true;
    const fetchMetadata = async () => {
      // 1. Check cache synchronously first to render instantly
      const cached = getCachedMetadata(paper.title);
      if (cached) {
        setMetadata(cached);
        setIsLoadingMetadata(false);
        return;
      }

      setIsLoadingMetadata(true);
      try {
        // Stagger API calls by 1200ms per card index on cache misses to avoid burst rate limits
        const delay = index * 1200;
        await new Promise((resolve) => setTimeout(resolve, delay));
        
        if (!active) return;
        
        const enriched = await enrichPaperMetadata(paper.title, paper.searchKeywords, s2ApiKey);
        if (active) {
          setMetadata(enriched);
        }
      } catch (err) {
        console.error('Failed to enrich metadata:', err);
      } finally {
        if (active) {
          setIsLoadingMetadata(false);
        }
      }
    };

    fetchMetadata();
    return () => {
      active = false;
    };
  }, [paper, s2ApiKey, index]);

  const isLiked = rating === 'like';
  const isDisliked = rating === 'dislike';

  return (
    <div className={`paper-card glass-panel anim-slide-up ${isLiked ? 'card-liked' : ''} ${isDisliked ? 'card-disliked' : ''}`}>
      {/* Index Counter */}
      {!hideHeader && (
        <div className="card-badge-header">
          {paperType ? (
            <span className={`paper-type-badge ${paperType}`}>
              {paperType === 'methodology' && '⚙️ Methodology'}
              {paperType === 'empirical_study' && '📊 Empirical'}
              {paperType === 'theoretical' && '📐 Theoretical'}
              {paperType === 'review_survey' && '📚 Survey'}
            </span>
          ) : (
            <span className="paper-type-badge default">📄 Foundational</span>
          )}
          <span className="index-counter">Paper {index + 1} of {total}</span>
        </div>
      )}

      {/* Title Section */}
      {!hideHeader && (
        <div className="card-main-header">
          <h2 className="paper-title">{paper.title}</h2>
          
          <div className="paper-authors-year">
            <div className="meta-item">
              <Users className="meta-icon" />
              <span className="meta-text">{paper.authors}</span>
            </div>
            <div className="meta-item">
              <Calendar className="meta-icon" />
              <span className="meta-text">{paper.year}</span>
            </div>
          </div>
        </div>
      )}

      {/* Scrollable Paper Content */}
      <div
        ref={scrollContainerRef}
        className="card-scroll-content"
        onScroll={(e) => {
          const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
          const isBottom = scrollHeight - scrollTop - clientHeight < 15;
          onContentScroll?.(scrollTop, isBottom);
        }}
      >
        {children}
        {/* Core Intuition / Vulgarized Idea */}
        <div className="summary-block highlight">
          <div className="core-intuition-header">
            <h4 className="block-title">Core Intuition</h4>
            {explanation.strategyUsed && (
              <span className={`strategy-badge ${explanation.strategyUsed}`}>
                {explanation.strategyUsed === 'metaphor' && '🔮 Metaphor'}
                {explanation.strategyUsed === 'analogy' && '💡 Analogy'}
                {explanation.strategyUsed === 'contrast' && '⚖️ Contrast'}
              </span>
            )}
          </div>
          <p className="block-text emphasis">
            <InteractiveText
              text={paper.coreIdea}
              concepts={getConceptsForBlock('coreIntuition')}
              blockId="coreIntuition"
              activeTag={activeTag}
              onTagClick={handleTagClick}
            />
          </p>
          {renderConceptCard('coreIntuition')}
        </div>

        {/* Scientific Purpose */}
        <div className="summary-block">
          <h4 className="block-title">Purpose & Question</h4>
          <p className="block-text">
            <InteractiveText
              text={paper.purpose}
              concepts={getConceptsForBlock('purpose')}
              blockId="purpose"
              activeTag={activeTag}
              onTagClick={handleTagClick}
            />
          </p>
          {renderConceptCard('purpose')}
        </div>

        {/* ── Collapsible "Under the Hood" Accordion ── */}
        {paperType && (
          <div className={`under-the-hood-accordion glass-panel ${underTheHoodOpen ? 'open' : ''}`}>
            <button
              className="under-the-hood-header-btn"
              onClick={() => setUnderTheHoodOpen(!underTheHoodOpen)}
              type="button"
            >
              <span className="under-the-hood-title-wrap">
                <span className="under-the-hood-icon">🔬</span>
                <span className="under-the-hood-title">Under the Hood (Methodology & Details)</span>
              </span>
              <span className="under-the-hood-arrow">{underTheHoodOpen ? '▲' : '▼'}</span>
            </button>

            {underTheHoodOpen && (
              <div className="under-the-hood-content">
                <div className="pipeline-layout">
                  <div className="pipeline-track">
                    <div className="pipeline-track-line" />
                    <div className="pipeline-track-pulse" />
                  </div>

                  <div className="pipeline-steps-list">
                    {pipelineSteps.map((step, sIdx) => {
                      return (
                        <div key={sIdx} className="pipeline-step">
                          <span className="pipeline-step-node">{sIdx + 1}</span>
                          <span className="pipeline-step-label">{step.label}</span>
                          <h5 className="pipeline-step-title" style={{ fontSize: '0.78rem', fontWeight: 700, margin: '2px 0 6px 0', color: 'var(--text-secondary)' }}>{step.title}</h5>
                          <p className="block-text">
                            <InteractiveText
                              text={step.content}
                              concepts={getConceptsForBlock(step.id)}
                              blockId={step.id}
                              activeTag={activeTag}
                              onTagClick={handleTagClick}
                            />
                          </p>
                          {renderConceptCard(step.id)}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Paradigm Shift: Vertical Timeline Block */}
        {explanation.beforeState && explanation.afterState && (
          <div className="summary-block">
            <h4 className="block-title">Paradigm Shift</h4>
            <div className="paradigm-shift-card glass-panel">
              <div className="paradigm-section before-section">
                <div className="paradigm-header">
                  <span className="paradigm-dot red"></span>
                  <span className="paradigm-label">Past Paradigm (Before)</span>
                </div>
                <p className="paradigm-text">
                  <InteractiveText
                    text={paper.explanation.beforeState}
                    concepts={getConceptsForBlock('beforeState')}
                    blockId="beforeState"
                    activeTag={activeTag}
                    onTagClick={handleTagClick}
                  />
                </p>
                {renderConceptCard('beforeState')}
              </div>
              
              <div className="paradigm-divider-line">
                <span className="paradigm-arrow-down">↓</span>
              </div>

              <div className="paradigm-section after-section">
                <div className="paradigm-header">
                  <span className="paradigm-dot green"></span>
                  <span className="paradigm-label">New Paradigm (After)</span>
                </div>
                <p className="paradigm-text">
                  <InteractiveText
                    text={paper.explanation.afterState}
                    concepts={getConceptsForBlock('afterState')}
                    blockId="afterState"
                    activeTag={activeTag}
                    onTagClick={handleTagClick}
                  />
                </p>
                {renderConceptCard('afterState')}
              </div>
            </div>
          </div>
        )}

        {/* Achievements */}
        <div className="summary-block">
          <h4 className="block-title">Key Achievements</h4>
          <p className="block-text">
            <InteractiveText
              text={paper.achievements}
              concepts={getConceptsForBlock('achievements')}
              blockId="achievements"
              activeTag={activeTag}
              onTagClick={handleTagClick}
            />
          </p>
          {renderConceptCard('achievements')}
        </div>

        {/* Limitations */}
        <div className="summary-block">
          <h4 className="block-title">Shortcomings & Gaps</h4>
          <p className="block-text">
            <InteractiveText
              text={paper.limitations}
              concepts={getConceptsForBlock('limitations')}
              blockId="limitations"
              activeTag={activeTag}
              onTagClick={handleTagClick}
            />
          </p>
          {renderConceptCard('limitations')}
        </div>

        {/* Paper Lineage (Built Upon & Influenced) */}
        {!isLoadingMetadata && ((metadata.references && metadata.references.length > 0) || (metadata.citations && metadata.citations.length > 0)) && (
          <div className="summary-block lineage-block">
            <h4 className="block-title">Paper Lineage</h4>
            
            <div className="timeline-layout">
              {/* Timeline Vertical Animated Track */}
              <div className="timeline-track">
                <div className="timeline-track-line" />
                <div className="timeline-track-pulse" />
              </div>

              <div className="timeline-content-list">
                {/* References (Built Upon) Group */}
                {metadata.references && metadata.references.length > 0 && (
                  <div className="timeline-section">
                    <span className="timeline-section-title">🌱 Built Upon (Key References)</span>
                    <div className="timeline-items">
                      {metadata.references.map((ref, rIdx) => (
                        <div key={`ref-${rIdx}`} className="timeline-item ref-item">
                          <span className="timeline-item-dot ref-dot" />
                          <a
                            href={ref.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="timeline-item-link"
                          >
                            <span className="timeline-item-title">{ref.title}</span>
                            <span className="timeline-item-meta">
                              {ref.year && ` (${ref.year})`}
                              {ref.citationCount !== undefined && ref.citationCount > 0 && ` • ⭐ ${ref.citationCount.toLocaleString()} citations`}
                            </span>
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Current Paper Node */}
                <div className="timeline-current-divider">
                  <div className="timeline-current-dot" />
                  <span className="timeline-current-label">Current Paper</span>
                </div>

                {/* Citations (Influenced) Group */}
                {metadata.citations && metadata.citations.length > 0 && (
                  <div className="timeline-section">
                    <span className="timeline-section-title">🔥 Influenced (Top Citations)</span>
                    <div className="timeline-items">
                      {metadata.citations.map((cit, cIdx) => (
                        <div key={`cit-${cIdx}`} className="timeline-item cit-item">
                          <span className="timeline-item-dot cit-dot" />
                          <a
                            href={cit.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="timeline-item-link"
                          >
                            <span className="timeline-item-title">{cit.title}</span>
                            <span className="timeline-item-meta">
                              {cit.year && ` (${cit.year})`}
                              {cit.citationCount !== undefined && cit.citationCount > 0 && ` • ⭐ ${cit.citationCount.toLocaleString()} citations`}
                            </span>
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Metrics Section */}
      <div className="card-metrics-section">
        {isLoadingMetadata ? (
          <div className="metrics-loading shimmer"></div>
        ) : (
          <div className="metrics-grid">
            <div className="metric-badge glass-panel" title="Citations count">
              <Award className="metric-icon citation-color" />
              <span className="metric-label">Citations:</span>
              <span className="metric-value">
                {metadata.citationCount !== undefined
                  ? metadata.citationCount.toLocaleString()
                  : 'N/A'}
              </span>
            </div>
            <div className="metric-badge glass-panel" title="Publication Venue">
              <BookOpen className="metric-icon venue-color" />
              <span className="metric-value-long">{metadata.venue || 'Journal Article'}</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer Controls */}
      <footer className="card-footer">
        <button
          className={`action-circle-btn dislike ${isDisliked ? 'selected' : ''}`}
          onClick={(e) => { e.stopPropagation(); onDislike(); }}
          title="Dislike"
          type="button"
        >
          <ThumbsDown className="action-icon" />
        </button>

        <button
          className="action-pill-btn chat"
          onClick={(e) => { e.stopPropagation(); onOpenChat(paper, metadata); }}
          title="Ask AI Guide"
          type="button"
        >
          <MessageSquare className="action-icon-small" />
          <span>Ask AI</span>
        </button>

        <button
          className="action-pill-btn read"
          onClick={(e) => {
            e.stopPropagation();
            const url = metadata.pdfUrl || metadata.paperUrl || `https://scholar.google.com/scholar?q=${encodeURIComponent(paper.title)}`;
            window.open(url, '_blank', 'noopener,noreferrer');
          }}
          title="Read Paper on Publisher Website"
          type="button"
        >
          <ExternalLink className="action-icon-small" />
          <span>Read Paper</span>
        </button>

        <button
          className={`action-circle-btn like ${isLiked ? 'selected anim-heartbeat' : ''}`}
          onClick={(e) => { e.stopPropagation(); onLike(); }}
          title="Like"
          type="button"
        >
          <ThumbsUp className="action-icon" />
        </button>
      </footer>

      <style>{`
        .paper-card {
          width: 100%;
          max-width: var(--max-width-feed);
          border-radius: var(--radius-lg);
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          transition: transform var(--transition-slow), opacity var(--transition-slow), border-color var(--transition-fast);
          position: relative;
          flex: 1;
          min-height: 0;
        }

        .paper-type-badge {
          font-size: 0.65rem;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 99px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          box-shadow: 0 1px 4px rgba(0,0,0,0.15);
          font-family: var(--font-mono);
        }
        .paper-type-badge.methodology {
          color: var(--color-secondary);
          background: var(--color-accent-glow);
          border: 1px solid rgba(180, 83, 9, 0.25);
        }
        .paper-type-badge.empirical_study {
          color: var(--text-secondary);
          background: rgba(9, 9, 11, 0.05);
          border: 1px solid rgba(9, 9, 11, 0.12);
        }
        .paper-type-badge.theoretical {
          color: var(--color-secondary);
          background: var(--color-secondary-glow);
          border: 1px solid rgba(245, 158, 11, 0.25);
        }
        .paper-type-badge.review_survey {
          color: var(--color-primary);
          background: var(--color-primary-glow);
          border: 1px solid rgba(217, 119, 6, 0.25);
        }

        .summary-block.highlight-study-setup {
          background: rgba(9, 9, 11, 0.03);
          border: 1px solid rgba(9, 9, 11, 0.08);
          padding: 14px;
          border-radius: var(--radius-md);
        }
        .summary-block.highlight-study-setup .block-title {
          color: var(--text-secondary);
        }

        .summary-block.highlight-findings {
          background: rgba(217, 119, 6, 0.03);
          border: 1px solid rgba(217, 119, 6, 0.15);
          padding: 14px;
          border-radius: var(--radius-md);
        }
        .summary-block.highlight-findings .block-title {
          color: var(--color-primary);
        }

        .summary-block.highlight-theorem {
          background: rgba(245, 158, 11, 0.03);
          border: 1px solid rgba(245, 158, 11, 0.15);
          padding: 14px;
          border-radius: var(--radius-md);
        }
        .summary-block.highlight-theorem .block-title {
          color: var(--color-secondary);
        }
        .math-style {
          font-family: var(--font-mono);
          font-style: normal;
          letter-spacing: 0.02em;
        }

        .summary-block.highlight-proof {
          background: rgba(180, 83, 9, 0.03);
          border: 1px solid rgba(180, 83, 9, 0.1);
          padding: 14px;
          border-radius: var(--radius-md);
        }
        .summary-block.highlight-proof .block-title {
          color: var(--color-accent);
        }

        .summary-block.highlight-taxonomy {
          background: rgba(217, 119, 6, 0.03);
          border: 1px solid rgba(217, 119, 6, 0.12);
          padding: 14px;
          border-radius: var(--radius-md);
        }
        .summary-block.highlight-taxonomy .block-title {
          color: var(--color-primary);
        }

        .summary-block.highlight-trends {
          background: rgba(9, 9, 11, 0.015);
          border: 1px solid rgba(9, 9, 11, 0.05);
          padding: 14px;
          border-radius: var(--radius-md);
        }
        .summary-block.highlight-trends .block-title {
          color: var(--text-muted);
        }

        .card-liked {
          border-color: var(--color-primary);
          box-shadow: 0 0 30px var(--color-primary-glow);
        }

        .card-disliked {
          animation: break-apart 0.5s cubic-bezier(0.25, 1, 0.5, 1) forwards;
        }

        .card-badge-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .paper-type-badge.default {
          color: var(--color-primary);
          background: var(--color-primary-glow);
          border: 1px solid rgba(217, 119, 6, 0.25);
        }

        .index-counter {
          font-size: 0.75rem;
          color: var(--text-muted);
          font-weight: 600;
          white-space: nowrap;
          flex-shrink: 0;
          font-family: var(--font-mono);
        }

        .card-main-header {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .paper-title {
          font-size: 1.45rem;
          line-height: 1.3;
          color: var(--text-primary);
          font-weight: 700;
          font-family: var(--font-display);
        }

        .paper-authors-year {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          color: var(--text-secondary);
          font-size: 0.88rem;
          font-family: var(--font-mono);
        }

        .meta-item {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .meta-icon {
          width: 14px;
          height: 14px;
          color: var(--text-muted);
        }

        .meta-text {
          font-weight: 500;
        }

        .card-scroll-content {
          flex-grow: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 8px 24px;
          margin-left: -24px;
          margin-right: -24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-bottom: 8px;
          min-height: 0;
        }

        .card-scroll-content::-webkit-scrollbar {
          width: 5px;
        }

        .card-scroll-content::-webkit-scrollbar-track {
          background: rgba(9, 9, 11, 0.01);
          border-radius: 99px;
        }

        .card-scroll-content::-webkit-scrollbar-thumb {
          background: rgba(27, 73, 49, 0.25);
          border-radius: 99px;
        }

        .card-scroll-content::-webkit-scrollbar-thumb:hover {
          background: rgba(27, 73, 49, 0.45);
        }

        .summary-block.highlight {
          background: rgba(217, 119, 6, 0.03);
          border: 1px solid rgba(217, 119, 6, 0.12);
          padding: 14px;
          border-radius: var(--radius-md);
        }

        .summary-block.highlight .block-title {
          color: var(--color-primary);
          font-weight: 700;
          font-family: var(--font-mono);
        }

        .block-text.emphasis {
          font-size: 0.95rem;
          line-height: 1.6;
          color: var(--text-primary);
          font-weight: 500;
        }

        .summary-block {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .block-title {
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
          font-weight: 600;
          font-family: var(--font-mono);
        }

        .block-text {
          font-size: 0.92rem;
          line-height: 1.5;
          color: var(--text-secondary);
        }

        .card-metrics-section {
          margin-top: auto;
          border-top: 1px solid var(--border-glass);
          padding-top: 16px;
        }

        .metrics-loading {
          height: 36px;
          border-radius: var(--radius-md);
          width: 100%;
        }

        .metrics-grid {
          display: flex;
          gap: 10px;
          flex-wrap: nowrap;
        }

        .metric-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          border-radius: 99px;
          font-size: 0.8rem;
          color: var(--text-secondary);
          font-weight: 500;
          font-family: var(--font-mono);
          min-width: 0;
          flex-shrink: 1;
        }

        .metric-icon {
          width: 14px;
          height: 14px;
        }

        .citation-color {
          color: var(--color-warning);
        }

        .venue-color {
          color: var(--color-primary);
        }

        .metric-label {
          color: var(--text-muted);
        }

        .metric-value {
          font-weight: 700;
          color: var(--text-primary);
        }

        .metric-value-long {
          max-width: 180px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .card-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-top: 8px;
        }

        .action-circle-btn {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          display: flex;
          justify-content: center;
          align-items: center;
          background: rgba(9, 9, 11, 0.03);
          border: 1px solid var(--border-glass);
          color: var(--text-secondary);
          transition: var(--transition-fast);
        }

        .action-circle-btn:hover {
          transform: scale(1.1);
        }

        .action-circle-btn.like:hover, .action-circle-btn.like.selected {
          background: var(--color-success-glow);
          color: var(--color-success);
          border-color: rgba(16, 185, 129, 0.3);
        }

        .action-circle-btn.dislike:hover, .action-circle-btn.dislike.selected {
          background: var(--color-error-glow);
          color: var(--color-error);
          border-color: rgba(244, 63, 94, 0.3);
        }

        .action-pill-btn {
          flex: 1;
          height: 48px;
          border-radius: 99px;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
          font-size: 0.9rem;
          font-weight: 600;
          transition: var(--transition-fast);
          font-family: var(--font-mono);
        }

        .action-pill-btn:hover {
          transform: translateY(-1px);
        }

        .action-pill-btn.chat {
          background: var(--color-secondary-glow);
          border: 1px solid rgba(45, 106, 79, 0.2);
          color: var(--color-secondary);
        }

        .action-pill-btn.chat:hover {
          background: rgba(45, 106, 79, 0.12);
          box-shadow: 0 0 15px rgba(45, 106, 79, 0.1);
        }

        .action-pill-btn.read {
          background: rgba(9, 9, 11, 0.03);
          border: 1px solid var(--border-glass);
          color: var(--text-primary);
        }

        .action-pill-btn.read:hover {
          background: rgba(9, 9, 11, 0.06);
          border-color: var(--border-glass-bright);
        }

        .action-icon {
          width: 20px;
          height: 20px;
        }

        .action-icon-small {
          width: 16px;
          height: 16px;
        }

        .core-intuition-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
        }

        .strategy-badge {
          font-size: 0.68rem;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 99px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
        }

        .strategy-badge.metaphor {
          color: #6d28d9;
          background: rgba(109, 40, 217, 0.08);
          border: 1px solid rgba(109, 40, 217, 0.15);
        }

        .strategy-badge.analogy {
          color: #b45309;
          background: rgba(180, 83, 9, 0.08);
          border: 1px solid rgba(180, 83, 9, 0.15);
        }

        .strategy-badge.contrast {
          color: #0f766e;
          background: rgba(13, 148, 136, 0.08);
          border: 1px solid rgba(13, 148, 136, 0.15);
        }

        .accordion-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .accordion-item {
          border-radius: var(--radius-md);
          border: 1px solid rgba(9, 9, 11, 0.05);
          overflow: hidden;
          transition: background-color var(--transition-fast), border-color var(--transition-fast);
        }

        .accordion-item.open {
          border-color: rgba(45, 106, 79, 0.15);
          background: rgba(45, 106, 79, 0.02);
        }

        .accordion-header-btn {
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 14px;
          background: transparent;
          border: none;
          color: var(--text-primary);
          font-size: 0.88rem;
          font-weight: 600;
          cursor: pointer;
          text-align: left;
        }

        .accordion-arrow {
          font-size: 0.7rem;
          color: var(--text-muted);
          transition: transform var(--transition-fast);
        }

        .accordion-arrow.rotated {
          transform: rotate(180deg);
          color: var(--color-primary);
        }

        .accordion-body-content {
          padding: 0 14px 12px 14px;
          border-top: 1px solid rgba(9, 9, 11, 0.04);
        }

        .highlight-synthesis {
          background: rgba(45, 106, 79, 0.02);
          border: 1px solid rgba(45, 106, 79, 0.1);
          padding: 14px;
          border-radius: var(--radius-md);
        }

        .highlight-synthesis .block-title {
          color: var(--color-primary);
        }

        .synthesis-text {
          font-size: 0.92rem;
          line-height: 1.55;
          color: var(--text-secondary);
        }

        .paradigm-shift-card {
          border: 1px solid var(--border-glass);
          background: rgba(9, 9, 11, 0.01);
          border-radius: var(--radius-md);
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 4px;
        }

        .paradigm-section {
          display: flex;
          flex-direction: column;
          gap: 6px;
          position: relative;
        }

        .paradigm-header {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .paradigm-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          display: inline-block;
        }

        .paradigm-dot.red {
          background: #e11d48;
          box-shadow: 0 1px 4px rgba(225, 29, 72, 0.3);
        }

        .paradigm-dot.green {
          background: #059669;
          box-shadow: 0 1px 4px rgba(5, 150, 105, 0.3);
        }

        .paradigm-label {
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
          font-family: var(--font-mono);
        }

        .paradigm-text {
          font-size: 0.88rem;
          line-height: 1.5;
          color: var(--text-secondary);
          margin: 0;
          padding-left: 16px;
        }

        .paradigm-divider-line {
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          height: 10px;
        }

        .paradigm-divider-line::before {
          content: '';
          position: absolute;
          left: 4px;
          top: -12px;
          bottom: -12px;
          width: 2px;
          background: linear-gradient(to bottom, rgba(225, 29, 72, 0.2), rgba(5, 150, 105, 0.2));
        }

        .paradigm-arrow-down {
          font-size: 0.8rem;
          color: var(--text-muted);
          background: var(--bg-dark);
          padding: 0 6px;
          z-index: 2;
          font-weight: bold;
          position: absolute;
          left: -4px;
        }

        .concept-inline-tag {
          background: var(--color-secondary-glow);
          border: 1px dashed rgba(45, 106, 79, 0.25);
          color: var(--color-secondary);
          padding: 1px 6px;
          border-radius: 4px;
          font-weight: 600;
          font-size: inherit;
          font-family: var(--font-mono);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          transition: all var(--transition-fast);
          margin: 0 2px;
          vertical-align: baseline;
        }

        .concept-inline-tag:hover {
          background: rgba(45, 106, 79, 0.12);
          border-style: solid;
          border-color: var(--color-primary);
          box-shadow: 0 0 8px rgba(45, 106, 79, 0.15);
        }

        .concept-inline-tag.active {
          background: var(--color-primary);
          color: var(--text-dark);
          border-style: solid;
          border-color: var(--color-primary);
          box-shadow: 0 0 12px rgba(27, 73, 49, 0.2);
        }

        .concept-detail-card {
          margin-top: 12px;
          background: var(--bg-darker);
          border: 1px solid rgba(45, 106, 79, 0.2);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
          border-radius: var(--radius-md);
          padding: 16px;
          text-align: left;
        }

        .concept-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          border-bottom: 1px solid rgba(9, 9, 11, 0.08);
          padding-bottom: 8px;
        }

        .concept-card-title {
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--color-primary);
          margin: 0;
        }

        .concept-card-close {
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-size: 0.85rem;
          cursor: pointer;
          padding: 2px 6px;
          transition: color var(--transition-fast);
        }

        .concept-card-close:hover {
          color: var(--color-error);
        }

        .concept-card-body {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .concept-section {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .concept-section-label {
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
          font-family: var(--font-mono);
        }

        .concept-section-text {
          font-size: 0.85rem;
          line-height: 1.45;
          color: var(--text-secondary);
          margin: 0;
        }

        .concept-paper-link {
          color: var(--color-secondary);
          text-decoration: underline;
          margin-left: 6px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 2px;
          transition: var(--transition-fast);
        }

        .concept-paper-link:hover {
          color: var(--color-primary);
          filter: brightness(1.2);
        }

        .lineage-block {
          border-top: 1px dashed var(--border-glass);
          padding-top: 16px;
          margin-top: 12px;
        }

        .timeline-layout {
          position: relative;
          margin-top: 16px;
          padding-left: 20px;
        }

        .timeline-track {
          position: absolute;
          top: 8px;
          bottom: 8px;
          left: 4px;
          width: 2px;
          pointer-events: none;
        }

        .timeline-track-line {
          position: absolute;
          inset: 0;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 1px;
        }

        .timeline-track-pulse {
          display: none;
        }

        @keyframes timelineGlowPulse {
          0% { top: -10%; }
          100% { top: 110%; }
        }

        .timeline-content-list {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .timeline-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .timeline-section-title {
          font-size: 0.72rem;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-family: var(--font-mono);
          margin-left: 4px;
        }

        .timeline-items {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .timeline-item {
          position: relative;
          padding: 6px 8px 6px 12px;
          border-radius: var(--radius-sm);
          transition: background-color var(--transition-fast);
        }

        .timeline-item:hover {
          background: rgba(255, 255, 255, 0.03);
        }

        .timeline-item-dot {
          position: absolute;
          left: -20px; /* Aligns with timeline-track line */
          top: 11px;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: var(--bg-darkest);
          border: 2px solid var(--border-glass-bright);
          transition: all var(--transition-fast);
          z-index: 2;
        }

        .ref-item .timeline-item-dot {
          border-color: #10b981;
          box-shadow: 0 0 6px rgba(16, 185, 129, 0.4);
        }

        .cit-item .timeline-item-dot {
          border-color: #fb923c;
          box-shadow: 0 0 6px rgba(251, 146, 96, 0.4);
        }

        .timeline-item:hover .timeline-item-dot {
          transform: scale(1.25);
          box-shadow: 0 0 10px currentColor;
          background: currentColor;
        }

        .timeline-item-link {
          display: flex;
          flex-direction: column;
          gap: 2px;
          text-decoration: none;
          text-align: left;
        }

        .timeline-item-title {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-secondary);
          line-height: 1.35;
          transition: color var(--transition-fast);
        }

        .timeline-item-link:hover .timeline-item-title {
          color: var(--text-primary);
          text-decoration: underline;
        }

        .timeline-item-meta {
          font-size: 0.72rem;
          color: var(--text-muted);
          font-family: var(--font-mono);
        }

        .timeline-current-divider {
          position: relative;
          padding-left: 12px;
          display: flex;
          align-items: center;
          margin: 4px 0;
        }

        .timeline-current-dot {
          position: absolute;
          left: -21px; /* Align precisely center with track line */
          top: 50%;
          transform: translateY(-50%);
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: var(--bg-darkest);
          border: 3px solid var(--color-primary);
          box-shadow: 0 0 8px var(--color-primary-glow);
          z-index: 3;
        }

        .timeline-current-label {
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-primary);
          font-family: var(--font-mono);
        }

        /* Under the Hood Accordion */
        .under-the-hood-accordion {
          margin-top: 20px;
          border-radius: var(--radius-md);
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--border-glass-bright);
          display: block;
          width: 100%;
          flex-shrink: 0;
          height: auto;
          min-height: min-content;
        }

        .under-the-hood-accordion:hover {
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(255, 255, 255, 0.2);
        }

        .under-the-hood-accordion.open {
          background: rgba(255, 255, 255, 0.03);
          border-color: var(--border-glass-bright);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        }

        .under-the-hood-header-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          background: rgba(255, 255, 255, 0.01);
          border: none;
          cursor: pointer;
          outline: none;
          transition: background var(--transition-fast);
        }

        .under-the-hood-header-btn:hover {
          background: rgba(255, 255, 255, 0.03);
        }

        .under-the-hood-title-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .under-the-hood-icon {
          font-size: 1.1rem;
        }

        .under-the-hood-title {
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--color-primary);
          letter-spacing: 0.02em;
        }

        .under-the-hood-arrow {
          font-size: 0.75rem;
          color: var(--text-muted);
          transition: transform var(--transition-normal);
        }

        .under-the-hood-content {
          padding: 8px 16px 20px 16px;
          border-top: 1px dashed rgba(255, 255, 255, 0.04);
          animation: accordionExpand 0.3s ease both;
        }

        @keyframes accordionExpand {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* Pipeline Steps Layout */
        .under-the-hood-content .pipeline-layout {
          position: relative;
          padding-left: 24px;
          margin-top: 8px;
        }

        .under-the-hood-content .pipeline-track {
          position: absolute;
          top: 10px;
          bottom: 10px;
          left: 8px;
          width: 2px;
          pointer-events: none;
        }

        .under-the-hood-content .pipeline-track-line {
          position: absolute;
          inset: 0;
          background: rgba(255, 255, 255, 0.06);
          border-radius: 1px;
        }

        .under-the-hood-content .pipeline-track-pulse {
          display: none;
        }

        .pipeline-steps-list {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .pipeline-step {
          position: relative;
          text-align: left;
        }

        .pipeline-step-node {
          position: absolute;
          left: -25px; /* Align precisely center with pipeline track line */
          top: 1px;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--bg-darkest);
          border: 1.5px solid var(--color-primary);
          box-shadow: 0 0 6px var(--color-primary-glow);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.65rem;
          font-family: var(--font-mono);
          font-weight: 700;
          color: var(--color-primary);
          z-index: 2;
        }

        .pipeline-step-label {
          display: block;
          font-size: 0.68rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
          font-family: var(--font-mono);
          margin-bottom: 4px;
        }

        @media (max-width: 480px) {
          .card-footer {
            gap: 6px;
          }
          .action-circle-btn {
            width: 40px;
            height: 40px;
            flex-shrink: 0;
          }
          .action-pill-btn {
            height: 40px;
            padding: 0 6px;
            font-size: 0.72rem;
            gap: 4px;
            white-space: nowrap;
          }
          .action-pill-btn span {
            font-size: 0.72rem;
          }
          .metrics-grid {
            gap: 6px;
          }
          .metric-badge {
            padding: 5px 10px;
            font-size: 0.7rem;
            gap: 4px;
          }
          .metric-value-long {
            max-width: 100px;
          }
        }
      `}</style>
    </div>
  );
};
