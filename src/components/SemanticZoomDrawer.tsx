import React, { useState, useEffect } from 'react';
import { ArrowLeft, X, BookOpen, Layers } from 'lucide-react';

export interface DecoderTerm {
  symbol?: string;
  term?: string;
  definition: string;
  deepDive?: string;
  subDefinitions?: {
    term: string;
    definition: string;
  }[];
}

export interface ZoomData {
  // Methodology
  rawFormula?: string;
  translation?: string;
  terms?: DecoderTerm[];
  equationImportance?: string;
  
  // Empirical
  verdict?: string;
  metrics?: {
    category?: string;
    label: string;
    rawValue: string;
    explanation: string;
    cohortContext?: string;
    controlValue?: string;
    significance?: string;
    measurementMethod?: string;
  }[];

  // Theoretical
  promise?: string;
  steps?: {
    stepLabel: string;
    inequalityUsed?: string;
    explanation: string;
    deepDive?: string;
  }[];

  // Review / Survey
  summary?: string;
  subcategories?: {
    name: string;
    approach: string;
    seminalPapers: string[];
  }[];
  gaps?: {
    challenge: string;
    reason: string;
  }[];
}

interface SemanticZoomDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  paperType: 'methodology' | 'empirical_study' | 'theoretical' | 'review_survey';
  title: string;
  data: ZoomData;
}


interface CarouselItem {
  id: string;
  title: string;
  label: string;
  content: string;
  extraLabel?: string | null;
  extraText?: string | null;
  details?: { label: string; value: string }[];
  subDefinitions?: { term: string; definition: string }[];
}

export const SemanticZoomDrawer: React.FC<SemanticZoomDrawerProps> = ({
  isOpen,
  onClose,
  paperType,
  title,
  data
}) => {
  const getCarouselItems = (): CarouselItem[] => {
    switch (paperType) {
      case 'methodology':
        return (data.terms || []).map((t) => ({
          id: t.symbol || t.term || '',
          title: t.symbol || t.term || '',
          label: 'Level 3: Term Definition',
          content: t.definition,
          extraLabel: t.deepDive ? 'Deep Dive Explanation' : null,
          extraText: t.deepDive,
          subDefinitions: t.subDefinitions
        }));
      case 'empirical_study':
        return (data.metrics || []).map((m) => ({
          id: m.label,
          title: m.label,
          label: 'Level 3: Metric Context',
          content: m.explanation,
          extraText: m.cohortContext ? `Cohort Context: ${m.cohortContext}` : null,
          details: [
            m.controlValue && { label: 'Control / Baseline', value: m.controlValue },
            m.significance && { label: 'Statistical Significance', value: m.significance },
            m.measurementMethod && { label: 'Measurement Method / Device', value: m.measurementMethod }
          ].filter(Boolean) as { label: string; value: string }[]
        }));
      case 'theoretical':
        return (data.steps || []).map((s) => ({
          id: s.stepLabel,
          title: s.stepLabel,
          label: 'Level 3: Proof Details',
          content: s.explanation,
          extraLabel: s.deepDive ? 'Proof Deep Dive' : null,
          extraText: s.deepDive
        }));
      case 'review_survey':
        const subItems = (data.subcategories || []).map((s) => ({
          id: s.name,
          title: s.name,
          label: 'Level 3: Sub-Category Context',
          content: s.approach,
          extraLabel: s.seminalPapers && s.seminalPapers.length > 0 ? 'Seminal Publications' : null,
          extraText: s.seminalPapers?.join(', ')
        }));
        const gapItems = (data.gaps || []).map((g) => ({
          id: g.challenge,
          title: g.challenge,
          label: 'Level 3: Gap Analysis',
          content: g.reason,
          extraLabel: 'Unresolved Roadblock',
          extraText: 'Requires novel algorithmic methods or alternative benchmark parameters.'
        }));
        return [...subItems, ...gapItems];
      default:
        return [];
    }
  };

  // We track the navigation history stack of active symbols/labels being investigated
  const [investigationStack, setInvestigationStack] = useState<string[]>([]);
  const [expandedSubTerm, setExpandedSubTerm] = useState<string | null>(null);

  // Track if a scroll was triggered programmatically (by tapping items) rather than manual swiping
  const isProgrammaticScroll = React.useRef(false);

  // Reset investigation stack and select first item by default when drawer opens or data changes
  useEffect(() => {
    if (!isOpen) {
      setInvestigationStack([]);
    } else {
      const items = getCarouselItems();
      if (items.length > 0) {
        isProgrammaticScroll.current = true;
        setInvestigationStack([items[0].id]);
      } else {
        setInvestigationStack([]);
      }
    }
  }, [isOpen, paperType, data]);

  const carouselRef = React.useRef<HTMLDivElement>(null);

  // Extract active investigated symbol
  const activeSymbol = investigationStack.length > 0 ? investigationStack[investigationStack.length - 1] : null;

  useEffect(() => {
    setExpandedSubTerm(null);
  }, [activeSymbol]);

  // Resets stack to exactly 1 item (Level 3) representing a new root-level investigation
  const selectMasterItem = (symbol: string) => {
    isProgrammaticScroll.current = true;
    setInvestigationStack([symbol]);
  };

  // Appends item to stack (goes to Level 4, Level 5, etc.) for nested investigations
  const selectDetailItem = (symbol: string) => {
    if (investigationStack[investigationStack.length - 1] !== symbol) {
      isProgrammaticScroll.current = true;
      setInvestigationStack((prev) => [...prev, symbol]);
    }
  };

  // Scroll to active card when activeSymbol changes
  useEffect(() => {
    if (activeSymbol && carouselRef.current) {
      if (isProgrammaticScroll.current) {
        const escapedSymbol = activeSymbol.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const activeCard = carouselRef.current.querySelector(`[data-card-id="${escapedSymbol}"]`);
        if (activeCard) {
          activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
        isProgrammaticScroll.current = false;
      }
    }
  }, [activeSymbol]);

  // Register globally accessible window helper to push terms from HTML string to React state
  useEffect(() => {
    (window as any).pushZoomTerm = (symbol: string) => {
      selectMasterItem(symbol);
    };
    return () => {
      delete (window as any).pushZoomTerm;
    };
  }, []);

  const getHeaderTitle = () => {
    if (!activeSymbol) {
      switch (paperType) {
        case 'methodology': return 'Equation Decoder';
        case 'empirical_study': return 'Trend Decoder';
        case 'theoretical': return 'Theorem & Proof Steps';
        case 'review_survey': return 'Taxonomy & Gaps';
      }
    }
    return activeSymbol;
  };

  const getLevelBadge = () => {
    return investigationStack.length === 0 ? 'Level 2' : `Level ${investigationStack.length + 2}`;
  };

  // Comprehensive LaTeX-to-HTML parser for beautiful scientific equation rendering
  const translateLatexToHtml = (latex: string) => {
    if (!latex) return '';
    let res = latex;

    // 1. Math formatting commands
    res = res
      .replace(/\\min_\{([^}]+)\}/g, 'min<sub>$1</sub>')
      .replace(/\\max_\{([^}]+)\}/g, 'max<sub>$1</sub>')
      .replace(/\\min/g, 'min')
      .replace(/\\max/g, 'max')
      .replace(/\\log/g, 'log')
      .replace(/\\quad/g, ' &nbsp; ')
      .replace(/\\qquad/g, ' &nbsp;&nbsp; ')
      .replace(/\\text\{([^}]+)\}/g, '$1')
      .replace(/\\mathbf\{([^}]+)\}/g, '<b>$1</b>')
      .replace(/\\mathrm\{([^}]+)\}/g, '$1')
      .replace(/\\mathsf\{([^}]+)\}/g, '$1')
      .replace(/\\mathcal\{([a-zA-Z])\}/g, '<span style="font-family: cursive;">$1</span>')
      .replace(/\\mathbb\{([a-zA-Z])\}/g, '<span style="font-family: serif; font-weight: bold;">$1</span>');

    // 2. Math operators (do multi-character replacements first)
    res = res
      .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1/$2')
      .replace(/\\left\(/g, '(')
      .replace(/\\right\)/g, ')')
      .replace(/\\left\[/g, '[')
      .replace(/\\right\]/g, ']')
      .replace(/\\left\\\|/g, '|')
      .replace(/\\right\\\|/g, '|')
      .replace(/\\left/g, '')
      .replace(/\\right/g, '')
      .replace(/\\int_\{([^}]+)\}\^\{([^}]+)\}/g, '∫<sub>$1</sub><sup>$2</sup>')
      .replace(/\\int/g, '∫')
      .replace(/\\sum_\{([^}]+)\}\^\{([^}]+)\}/g, '∑<sub>$1</sub><sup>$2</sup>')
      .replace(/\\sum/g, '∑')
      .replace(/\\leq/g, ' ≤ ')
      .replace(/\\le(?![a-zA-Z])/g, ' ≤ ')
      .replace(/\\geq/g, ' ≥ ')
      .replace(/\\ge(?![a-zA-Z])/g, ' ≥ ')
      .replace(/\\approx/g, ' ≈ ')
      .replace(/\\neq/g, ' ≠ ')
      .replace(/\\cdot/g, ' · ')
      .replace(/\\times/g, ' × ')
      .replace(/\\partial/g, '∂')
      .replace(/\\infty/g, '∞')
      .replace(/\\nabla/g, '∇')
      .replace(/\\to(?![a-zA-Z])/g, ' → ')
      .replace(/\\rightarrow/g, ' → ')
      .replace(/\\gets/g, ' ← ')
      .replace(/\\leftarrow/g, ' ← ')
      .replace(/\\sim(?![a-zA-Z])/g, ' ~ ')
      .replace(/\\\|/g, '|');

    // 3. Greek Letters
    const greek: Record<string, string> = {
      alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε',
      zeta: 'ζ', eta: 'η', theta: 'θ', iota: 'ι', kappa: 'κ', lambda: 'λ',
      mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ',
      upsilon: 'υ', phi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
      Omega: 'Ω', Sigma: 'Σ', Delta: 'Δ', Phi: 'Φ', Psi: 'Ψ', Theta: 'Θ'
    };
    Object.keys(greek).forEach((key) => {
      const regex = new RegExp(`\\\\${key}(?![a-zA-Z])`, 'g');
      res = res.replace(regex, greek[key]);
    });

    // 4. Superscript and subscripts
    res = res
      .replace(/\^\{([^}]+)\}/g, '<sup>$1</sup>')
      .replace(/\^([0-9a-zA-Z*+-\/]+)/g, '<sup>$1</sup>')
      .replace(/_\{([^}]+)\}/g, '<sub>$1</sub>')
      .replace(/_([0-9a-zA-Z+-\/])/g, '<sub>$1</sub>');

    // 5. Escapes and remaining backslashes
    res = res
      .replace(/\\\{/g, '{')
      .replace(/\\\}/g, '}')
      .replace(/\\,/g, ' ')
      .replace(/\\;/g, ' ')
      .replace(/\\!/g, '')
      .replace(/\\/g, ''); // strip any leftover backslashes

    return res;
  };

  const formatTextWithInlineMath = (text: string) => {
    if (!text) return '';
    return text.replace(/\$([^$]+)\$/g, (_, math) => {
      return `<code class="inline-math">${translateLatexToHtml(math)}</code>`;
    });
  };

  const DARK_PASTEL_PALETTE = [
    { bg: 'rgba(52, 211, 153, 0.08)', border: 'rgba(52, 211, 153, 0.3)', text: '#34d399', activeBg: '#34d399', activeText: '#000' }, // Mint Green
    { bg: 'rgba(251, 191, 36, 0.08)', border: 'rgba(251, 191, 36, 0.3)', text: '#fbbf24', activeBg: '#fbbf24', activeText: '#000' }, // Warm Gold
    { bg: 'rgba(244, 63, 94, 0.08)', border: 'rgba(244, 63, 94, 0.3)', text: '#f43f5e', activeBg: '#f43f5e', activeText: '#fff' }, // Rose Pink
    { bg: 'rgba(96, 165, 250, 0.08)', border: 'rgba(96, 165, 250, 0.3)', text: '#60a5fa', activeBg: '#60a5fa', activeText: '#000' }, // Sky Blue
    { bg: 'rgba(192, 132, 252, 0.08)', border: 'rgba(192, 132, 252, 0.3)', text: '#c084fc', activeBg: '#c084fc', activeText: '#000' }  // Purple Orchid
  ];

  // LaTeX-to-Unicode formatter with active term highlighting support
  const formatFormula = (latex: string, highlightSymbol: string | null) => {
    if (!latex) return '';

    let html = latex;
    
    // Map terms with stable placeholder IDs based on their original index
    const termsWithIds = (data.terms || []).map((t, idx) => ({
      ...t,
      placeholderId: '【' + '❖'.repeat(idx + 1) + '】',
      colorIdx: idx % DARK_PASTEL_PALETTE.length
    }));

    if (termsWithIds.length > 0) {
      // Sort terms by symbol length descending to replace larger expressions first
      const sortedTerms = [...termsWithIds].sort((a, b) => 
        ((b.symbol || b.term || '').length) - ((a.symbol || a.term || '').length)
      );

      sortedTerms.forEach((t) => {
        const termSymbol = t.symbol || t.term;
        if (termSymbol) {
          const escapedSymbol = termSymbol.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
          const regex = new RegExp(escapedSymbol, 'g');
          html = html.replace(regex, t.placeholderId);
        }
      });
    }

    // Translate standard latex constructs to readable HTML math symbols
    html = translateLatexToHtml(html);

    // Replace placeholders with clickable HTML button tags
    if (termsWithIds.length > 0) {
      termsWithIds.forEach((t) => {
        const termSymbol = t.symbol || t.term;
        if (termSymbol) {
          // Format the display label to look beautiful
          const displayLabel = translateLatexToHtml(termSymbol);
          const color = DARK_PASTEL_PALETTE[t.colorIdx];

          const isActive = highlightSymbol === termSymbol;
          // Generate inline styles matching the term's unique palette color
          const styleStr = isActive 
            ? `background: ${color.activeBg}; color: ${color.activeText} !important; border-color: ${color.activeBg};` 
            : `background: ${color.bg}; color: ${color.text} !important; border-color: ${color.border};`;

          // Escape backslashes for JS string within inline HTML attribute
          const escapedClickSymbol = termSymbol.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
          const buttonHtml = `<button class="math-term-box ${isActive ? 'active' : ''}" style="${styleStr}" onclick="window.pushZoomTerm('${escapedClickSymbol}')">${displayLabel}</button>`;
          html = html.replaceAll(t.placeholderId, buttonHtml);
        }
      });
    }

    return html;
  };

  const handleBack = () => {
    setInvestigationStack((prev) => prev.slice(0, -1));
  };

  // Render detail panel (Level 3) for the active item
  const renderDetailPanel = () => {
    if (!activeSymbol) return null;

    switch (paperType) {
      case 'methodology': {
        const term = data.terms?.find((t) => (t.symbol || t.term) === activeSymbol);
        if (!term) return null;

        // Color-code sub-definition terms within the active term's formula
        const formatDetailFormula = (formula: string, subDefs: { term: string; definition: string }[]) => {
          if (!formula || !subDefs || subDefs.length === 0) return translateLatexToHtml(formula);
          let html = formula;
          const subsWithIds = subDefs.map((s, i) => ({ ...s, pid: '\u27E6' + '\u25C6'.repeat(i + 1) + '\u27E7', ci: i }));
          const sorted = [...subsWithIds].sort((a, b) => b.term.length - a.term.length);
          sorted.forEach((s) => { const esc = s.term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'); html = html.replace(new RegExp(esc, 'g'), s.pid); });
          html = translateLatexToHtml(html);
          subsWithIds.forEach((s) => { const c = DARK_PASTEL_PALETTE[s.ci % DARK_PASTEL_PALETTE.length]; const lbl = translateLatexToHtml(s.term); html = html.replaceAll(s.pid, `<span style="color:${c.text};background:${c.bg};border:1px solid ${c.border};padding:1px 5px;border-radius:4px;font-weight:700;">${lbl}</span>`); });
          return html;
        };

        return (
          <div className="zoom-level3-content anim-slide-in-right">
            <div className="drilldown-header-accent">
              <Layers size={14} className="accent-icon" />
              <span>Level 3: Term Definition</span>
            </div>

            {/* Main active term formula preview — sub-terms color-coded */}
            <div 
              className="detail-term-formula" 
              style={{ margin: '14px 0', padding: '14px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255, 255, 255, 0.05)', textAlign: 'center', fontSize: '1.2rem', fontWeight: 600 }}
              dangerouslySetInnerHTML={{ __html: formatDetailFormula(term.symbol || term.term || '', term.subDefinitions || []) }}
            />

            <p className="level3-text" dangerouslySetInnerHTML={{ __html: formatTextWithInlineMath(term.definition) }} />
            {term.deepDive && (
              <div className="level3-extra-card">
                <span className="extra-label">Deep Dive Explanation</span>
                <p className="extra-text" dangerouslySetInnerHTML={{ __html: formatTextWithInlineMath(term.deepDive) }} />
              </div>
            )}
            
            {/* Direct Variable Decomposition rendering */}
            {term.subDefinitions && term.subDefinitions.length > 0 && (
              <div className="sub-definitions-box" style={{ marginTop: '18px' }}>
                <span className="sub-def-title" style={{ fontSize: '0.86rem', fontWeight: 600, display: 'block', marginBottom: '8px', color: '#a1a1aa' }}>Decomposition Breakdown</span>
                <div className="sub-def-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {term.subDefinitions.map((sub, idx) => {
                    // Check if this sub-term is a complex term we can dive deeper into
                    const isClickable = data.terms?.some(
                      (t) => (t.symbol || t.term) === sub.term
                    );
                    const isExpanded = expandedSubTerm === sub.term;
                    const subTermData = isClickable 
                      ? data.terms?.find((t) => (t.symbol || t.term) === sub.term)
                      : null;

                    const subColor = DARK_PASTEL_PALETTE[idx % DARK_PASTEL_PALETTE.length];

                    return (
                      <div 
                        key={idx} 
                        className={`sub-def-item ${isClickable ? 'clickable' : ''}`}
                        onClick={isClickable ? () => setExpandedSubTerm(isExpanded ? null : sub.term) : undefined}
                        style={{ cursor: isClickable ? 'pointer' : 'default', padding: '8px 10px', background: 'rgba(255, 255, 255, 0.02)', border: isExpanded ? `1px solid ${subColor.border}` : '1px solid rgba(255, 255, 255, 0.04)', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', gap: '0' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                          <span 
                            className="sub-def-badge"
                            style={{ 
                              padding: '2px 6px', 
                              background: subColor.bg, 
                              border: `1px solid ${subColor.border}`,
                              borderRadius: '4px', 
                              fontSize: '0.84rem', 
                              fontWeight: 600,
                              fontFamily: 'var(--font-mono)',
                              display: 'inline-block',
                              flexShrink: 0
                            }}
                            dangerouslySetInnerHTML={{ __html: `<code style="color:${subColor.text}">${translateLatexToHtml(sub.term)}</code>` }}
                          />
                          <span 
                            className="sub-def-desc" 
                            style={{ fontSize: '0.8rem', color: '#e5e7eb', lineHeight: '1.4', flex: 1 }}
                            dangerouslySetInnerHTML={{ __html: formatTextWithInlineMath(sub.definition) }}
                          />
                          {isClickable && (
                            <span className="nested-arrow" style={{ fontSize: '0.74rem', color: subColor.text, flexShrink: 0 }}>
                              {isExpanded ? '▲' : '▼'}
                            </span>
                          )}
                        </div>

                        {/* Inline expanded definitions and deep dives */}
                        {isExpanded && subTermData && (
                          <div className="inline-sub-detail anim-slide-up" style={{ marginTop: '10px', padding: '10px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '4px', border: subColor ? `1px solid ${subColor.border}` : '1px solid rgba(255, 255, 255, 0.08)' }} onClick={(e) => e.stopPropagation()}>
                            <p style={{ fontSize: '0.8rem', color: '#e5e7eb', margin: 0, lineHeight: '1.4' }} dangerouslySetInnerHTML={{ __html: formatTextWithInlineMath(subTermData.definition) }} />
                            {subTermData.deepDive && (
                              <p style={{ fontSize: '0.74rem', color: '#a1a1aa', marginTop: '8px', marginBottom: 0 }} dangerouslySetInnerHTML={{ __html: formatTextWithInlineMath(subTermData.deepDive) }} />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      }
      case 'empirical_study': {
        const metric = data.metrics?.find((m) => m.label === activeSymbol);
        if (!metric) return null;
        return (
          <div className="zoom-level3-content anim-slide-in-right">
            <div className="drilldown-header-accent">
              <Layers size={14} className="accent-icon" />
              <span>Level 3: Metric Context</span>
            </div>
            <p className="level3-text">{metric.explanation}</p>
            {metric.cohortContext && (
              <div className="level3-extra-card">
                <span className="extra-label">Cohort Context</span>
                <p className="extra-text">{metric.cohortContext}</p>
              </div>
            )}
            {metric.controlValue && (
              <div className="level3-extra-card">
                <span className="extra-label">Control / Baseline</span>
                <p className="extra-text">{metric.controlValue}</p>
              </div>
            )}
            {metric.significance && (
              <div className="level3-extra-card">
                <span className="extra-label">Statistical Significance</span>
                <p className="extra-text">{metric.significance}</p>
              </div>
            )}
            {metric.measurementMethod && (
              <div className="level3-extra-card">
                <span className="extra-label">Measurement Method / Device</span>
                <p className="extra-text">{metric.measurementMethod}</p>
              </div>
            )}
          </div>
        );
      }
      case 'theoretical': {
        const step = data.steps?.find((s) => s.stepLabel === activeSymbol);
        if (!step) return null;
        return (
          <div className="zoom-level3-content anim-slide-in-right">
            <div className="drilldown-header-accent">
              <Layers size={14} className="accent-icon" />
              <span>Level 3: Proof Details</span>
            </div>
            <p className="level3-text">{step.explanation}</p>
            {step.deepDive && (
              <div className="level3-extra-card">
                <span className="extra-label">Proof Deep Dive</span>
                <p className="extra-text">{step.deepDive}</p>
              </div>
            )}
          </div>
        );
      }
      case 'review_survey': {
        const sub = data.subcategories?.find((s) => s.name === activeSymbol);
        const gap = data.gaps?.find((g) => g.challenge === activeSymbol);

        if (sub) {
          return (
            <div className="zoom-level3-content anim-slide-in-right">
              <div className="drilldown-header-accent">
                <Layers size={14} className="accent-icon" />
                <span>Level 3: Sub-Category Context</span>
              </div>
              <p className="level3-text">{sub.approach}</p>
              {sub.seminalPapers && sub.seminalPapers.length > 0 && (
                <div className="level3-extra-card">
                  <span className="extra-label">Seminal Publications</span>
                  <p className="extra-text">{sub.seminalPapers.join(', ')}</p>
                </div>
              )}
            </div>
          );
        }

        if (gap) {
          return (
            <div className="zoom-level3-content anim-slide-in-right">
              <div className="drilldown-header-accent">
                <Layers size={14} className="accent-icon" />
                <span>Level 3: Gap Analysis</span>
              </div>
              <p className="level3-text">{gap.reason}</p>
              <div className="level3-extra-card">
                <span className="extra-label">Unresolved Roadblock</span>
                <p className="extra-text">Requires novel algorithmic methods or alternative benchmark parameters.</p>
              </div>
            </div>
          );
        }
        return null;
      }
    }
  };

  // Render the Master overview section
  const renderMasterView = () => {
    switch (paperType) {
      case 'methodology':
        return (
          <div className="zoom-level2-content">
            {data.rawFormula && (
              <div className="formula-display-container">
                <code className="latex-formula" dangerouslySetInnerHTML={{ __html: formatFormula(data.rawFormula, activeSymbol) }} />
              </div>
            )}
            
            {activeSymbol && (
              <div className="inline-term-detail-container" style={{ marginTop: '20px', textAlign: 'left' }}>
                {renderDetailPanel()}
              </div>
            )}
            
            {/* Show translation & significance only when no specific term is active */}
            {!activeSymbol && (
              <>
                {data.translation && (
                  <div className="translation-box anim-slide-up">
                    <span className="translation-lbl">Translation</span>
                    <p className="translation-text">{data.translation}</p>
                  </div>
                )}
                {data.equationImportance && (
                  <div className="translation-box anim-slide-up" style={{ marginTop: '12px', borderLeftColor: 'var(--accent-primary, #6366f1)' }}>
                    <span className="translation-lbl" style={{ color: 'var(--accent-primary, #6366f1)' }}>Scientific Significance</span>
                    <p className="translation-text" style={{ fontStyle: 'normal' }}>{data.equationImportance}</p>
                  </div>
                )}
              </>
            )}
          </div>
        );
      case 'empirical_study':
        return (
          <div className="zoom-level2-content">
            {data.verdict && (
              <div className="verdict-banner">
                <span className="verdict-lbl">Verdict</span>
                <p className="verdict-text">“{data.verdict}”</p>
              </div>
            )}
            {data.metrics && data.metrics.length > 0 && (() => {
              const groups: { [key: string]: typeof data.metrics } = {};
              data.metrics.forEach(m => {
                const catName = m.category || "General Parameters";
                if (!groups[catName]) groups[catName] = [];
                groups[catName].push(m);
              });

              const groupEntries = Object.entries(groups);
              const showHeaders = groupEntries.length > 1;

              return (
                <div className="zoom-section">
                  <h4 className="zoom-section-title">Statistical Metrics (Tap for Context)</h4>
                  <div className="metrics-groups-container">
                    {groupEntries.map(([groupName, items]) => (
                      <div key={groupName} className="metric-group-block" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {showHeaders && <span className="metric-group-header">{groupName}</span>}
                        <div className="metrics-list-vertical" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {items.map((m, idx) => {
                            const isActive = activeSymbol === m.label;
                            return (
                              <div key={idx} className="metric-row-container" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <button
                                  className={`metric-grid-card ${isActive ? 'active' : ''}`}
                                  onClick={() => selectMasterItem(m.label)}
                                  style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left', padding: '12px' }}
                                >
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <span className="metric-card-val" style={{ fontSize: '1rem', fontWeight: 700 }}>{m.rawValue}</span>
                                    <span className="metric-card-lbl" style={{ fontSize: '0.74rem', opacity: 0.8 }}>{m.label}</span>
                                  </div>
                                  <span className="metric-arrow">{isActive ? '▲' : '▼'}</span>
                                </button>
                                {isActive && (
                                  <div className="inline-metric-detail anim-slide-up" style={{ padding: '12px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255, 255, 255, 0.05)', fontSize: '0.82rem', color: '#e5e7eb' }}>
                                    <p style={{ margin: 0, lineHeight: '1.4' }}>{m.explanation}</p>
                                    {m.cohortContext && <p style={{ fontSize: '0.74rem', color: '#a1a1aa', marginTop: '8px', marginBottom: 0 }}><strong>Cohort:</strong> {m.cohortContext}</p>}
                                    {m.controlValue && <p style={{ fontSize: '0.74rem', color: '#a1a1aa', marginTop: '4px', marginBottom: 0 }}><strong>Control/Baseline:</strong> {m.controlValue}</p>}
                                    {m.significance && <p style={{ fontSize: '0.74rem', color: '#a1a1aa', marginTop: '4px', marginBottom: 0 }}><strong>Significance:</strong> {m.significance}</p>}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        );
      case 'theoretical':
        return (
          <div className="zoom-level2-content">
            {data.promise && (
              <div className="promise-banner">
                <span className="promise-lbl">Theoretical Guarantee</span>
                <p className="promise-text">{data.promise}</p>
              </div>
            )}
            {!activeSymbol && data.equationImportance && (
              <div className="translation-box anim-slide-up" style={{ marginTop: '0px', marginBottom: '16px', borderLeftColor: 'var(--accent-primary, #6366f1)' }}>
                <span className="translation-lbl" style={{ color: 'var(--accent-primary, #6366f1)' }}>Scientific Significance</span>
                <p className="translation-text" style={{ fontStyle: 'normal' }}>{data.equationImportance}</p>
              </div>
            )}
            {data.steps && data.steps.length > 0 && (
              <div className="zoom-section">
                <h4 className="zoom-section-title">Logical Steps of the Proof (Tap to Decode)</h4>
                <div className="proof-steps-vertical" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {data.steps.map((s, idx) => {
                    const isActive = activeSymbol === s.stepLabel;
                    return (
                      <div key={idx} className="proof-step-container" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <button
                          className={`proof-step-btn ${isActive ? 'active' : ''}`}
                          onClick={() => selectMasterItem(s.stepLabel)}
                          style={{ width: '100%', textAlign: 'left' }}
                        >
                          <div className="proof-step-num">{idx + 1}</div>
                          <div className="proof-step-body" style={{ flex: 1 }}>
                            <span className="proof-step-lbl">{s.stepLabel}</span>
                            {s.inequalityUsed && <code className="proof-step-math" dangerouslySetInnerHTML={{ __html: formatFormula(s.inequalityUsed, null) }} />}
                          </div>
                          <span className="metric-arrow">{isActive ? '▲' : '▼'}</span>
                        </button>
                        {isActive && (
                          <div className="inline-step-detail anim-slide-up" style={{ padding: '12px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255, 255, 255, 0.05)', fontSize: '0.82rem', color: '#e5e7eb' }}>
                            <p style={{ margin: 0, lineHeight: '1.4' }}>{s.explanation}</p>
                            {s.deepDive && <p style={{ fontSize: '0.74rem', color: '#a1a1aa', marginTop: '8px', marginBottom: 0 }}><strong>Deep Dive:</strong> {s.deepDive}</p>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      case 'review_survey':
        return (
          <div className="zoom-level2-content">
            {data.summary && (
              <div className="summary-banner">
                <p className="summary-banner-text">{data.summary}</p>
              </div>
            )}
            
            {data.subcategories && data.subcategories.length > 0 && (
              <div className="zoom-section">
                <h4 className="zoom-section-title">Sub-Category Explorer</h4>
                <div className="subcategory-list-vertical" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {data.subcategories.map((sub, idx) => {
                    const isActive = activeSymbol === sub.name;
                    return (
                      <button
                        key={idx}
                        className={`subcategory-btn ${isActive ? 'active' : ''}`}
                        onClick={() => selectMasterItem(sub.name)}
                        style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: isActive ? '10px' : '0px', textAlign: 'left', padding: '12px' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                          <span className="subcategory-name" style={{ fontWeight: 600 }}>{sub.name}</span>
                          <span className="subcategory-lbl">{isActive ? '▲' : 'Explore ▼'}</span>
                        </div>
                        {isActive && (
                          <div className="inline-subcategory-detail anim-slide-up" style={{ fontSize: '0.82rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '8px', color: '#e5e7eb' }} onClick={(e) => e.stopPropagation()}>
                            <p style={{ margin: 0, lineHeight: '1.4' }}>{sub.approach}</p>
                            {sub.seminalPapers && sub.seminalPapers.length > 0 && (
                              <div style={{ marginTop: '8px' }}>
                                <strong style={{ fontSize: '0.74rem', color: '#a1a1aa' }}>Seminal Papers:</strong>
                                <ul style={{ margin: '4px 0 0 16px', padding: 0, fontSize: '0.74rem', color: '#a1a1aa' }}>
                                  {sub.seminalPapers.map((paper, pIdx) => (
                                    <li key={pIdx}>{paper}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {data.gaps && data.gaps.length > 0 && (
              <div className="zoom-section" style={{ marginTop: '16px' }}>
                <h4 className="zoom-section-title">Open Challenges & Gaps</h4>
                <div className="gaps-list-vertical" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {data.gaps.map((gap, idx) => {
                    const isActive = activeSymbol === gap.challenge;
                    return (
                      <button
                        key={idx}
                        className={`gap-btn-row ${isActive ? 'active' : ''}`}
                        onClick={() => selectMasterItem(gap.challenge)}
                        style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: isActive ? '10px' : '0px', textAlign: 'left', padding: '12px' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                          <div className="gap-challenge-txt" style={{ fontWeight: 600, fontSize: '0.82rem' }}>⚠️ {gap.challenge}</div>
                          <span className="metric-arrow">{isActive ? '▲' : '▼'}</span>
                        </div>
                        {isActive && (
                          <div className="inline-gap-detail anim-slide-up" style={{ fontSize: '0.82rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '8px', color: '#e5e7eb' }} onClick={(e) => e.stopPropagation()}>
                            <strong style={{ fontSize: '0.74rem', color: '#a1a1aa' }}>Reason / Challenge Root:</strong>
                            <p style={{ margin: '4px 0 0 0', lineHeight: '1.4' }}>{gap.reason}</p>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
    }
  };

  const renderCarousel = () => {
    // When activeSymbol is selected, it is rendered inline right under its corresponding element.
    if (activeSymbol) {
      return null;
    }

    const items = getCarouselItems();
    if (items.length === 0) return null;

    // If we're drilled down deep (Level 4+), show a detail panel with back button instead of the carousel
    if (investigationStack.length > 1) {
      return (
        <div style={{ marginTop: '20px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '16px' }}>
          {renderDetailPanel()}
        </div>
      );
    }

    return (
      <div className="zoom-carousel-container">
        <div className="zoom-carousel-header">
          <span className="zoom-carousel-lbl">💡 Swipe to explore details</span>
          <div className="zoom-carousel-dots">
            {items.map((item, idx) => {
              const isActive = item.id === activeSymbol;
              return (
                <button
                  key={idx}
                  onClick={() => selectMasterItem(item.id)}
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: isActive ? 'var(--color-primary, #1b4931)' : 'var(--border-glass-bright)',
                    padding: 0,
                    transition: 'background 0.2s'
                  }}
                  aria-label={`Go to card ${idx + 1}`}
                />
              );
            })}
          </div>
        </div>

        <div
          ref={carouselRef}
          className="zoom-carousel-scroll-area"
          onScroll={(e) => {
            const container = e.currentTarget;
            const scrollLeft = container.scrollLeft;
            const cardWidth = container.clientWidth + 16; // width (100%) + gap
            const index = Math.round(scrollLeft / cardWidth);
            if (index >= 0 && index < items.length) {
              const matchedItem = items[index];
              if (matchedItem && matchedItem.id !== activeSymbol && investigationStack.length <= 1) {
                setInvestigationStack([matchedItem.id]);
              }
            }
          }}
        >
          {items.map((item) => {
            const isActive = item.id === activeSymbol;
            return (
              <div
                key={item.id}
                data-card-id={item.id}
                className={`zoom-carousel-card ${isActive ? 'active' : ''}`}
              >
                <div className="zoom-carousel-card-badge">
                  <Layers size={12} />
                  <span>{item.label}</span>
                </div>
                <h5 className="zoom-carousel-card-title">{item.title}</h5>
                <p className="zoom-carousel-card-content">{item.content}</p>

                {item.extraText && (
                  <div className="zoom-carousel-card-extra">
                    {item.extraLabel && <span className="zoom-carousel-card-extra-lbl">{item.extraLabel}</span>}
                    <p className="zoom-carousel-card-extra-txt">{item.extraText}</p>
                  </div>
                )}

                {item.details && item.details.length > 0 && (
                  <div className="zoom-carousel-card-details">
                    {item.details.map((d, idx) => (
                      <div key={idx} className="zoom-carousel-card-detail-row">
                        <span className="zoom-carousel-card-detail-lbl">{d.label}:</span>
                        <span className="zoom-carousel-card-detail-val">{d.value}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Direct Variable Decomposition rendering */}
                {item.subDefinitions && item.subDefinitions.length > 0 && (
                  <div className="zoom-carousel-breakdown">
                    <span className="zoom-carousel-breakdown-lbl">Decomposition Breakdown</span>
                    <div className="zoom-carousel-breakdown-list">
                      {item.subDefinitions.map((sub, idx) => {
                        const isClickable = data.terms?.some(
                          (t) => (t.symbol || t.term) === sub.term
                        );
                        const targetIdx = data.terms?.findIndex(
                          (t) => (t.symbol || t.term) === sub.term || (t.symbol || t.term || '').includes(sub.term)
                        );
                        const subColor = DARK_PASTEL_PALETTE[(targetIdx !== undefined && targetIdx !== -1 ? targetIdx : idx) % DARK_PASTEL_PALETTE.length];

                        return (
                          <div 
                            key={idx} 
                            className={`zoom-carousel-breakdown-item ${isClickable ? 'clickable' : ''}`}
                            onClick={isClickable ? () => selectDetailItem(sub.term) : undefined}
                          >
                            <code 
                              className="zoom-carousel-breakdown-term"
                              dangerouslySetInnerHTML={{ __html: translateLatexToHtml(sub.term) }}
                              style={{ 
                                background: subColor.bg, 
                                border: `1px solid ${subColor.border}`,
                                color: subColor.text,
                                padding: '2px 6px',
                                borderRadius: '4px'
                              }}
                            />
                            <span className="zoom-carousel-breakdown-desc">
                              {sub.definition} {isClickable && <span style={{ marginLeft: '4px', color: subColor.text }}>➔</span>}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="semantic-zoom-overlay" onClick={onClose}>
      <div 
        className="semantic-zoom-drawer glass-panel" 
        onClick={(e) => e.stopPropagation()}
        style={{
          transform: isOpen ? 'translateY(0)' : 'translateY(100%)'
        }}
      >
        {/* Drawer Handle for Swipe Intuition */}
        <div className="drawer-handle-bar" />

        {/* Header */}
        <header className="drawer-header">
          <div className="header-left">
            {investigationStack.length > 0 && (
              <button className="drawer-icon-btn back-btn" onClick={handleBack} type="button">
                <ArrowLeft size={20} />
              </button>
            )}
            <div className="drawer-title-group">
              <span className="drawer-badge">{getLevelBadge()}</span>
              <h3 className="drawer-title" dangerouslySetInnerHTML={{ __html: translateLatexToHtml(getHeaderTitle()) }} />
            </div>
          </div>
          <button className="drawer-icon-btn close-btn" onClick={onClose} type="button">
            <X size={20} />
          </button>
        </header>

        {/* Scrollable Content View */}
        <div className="drawer-scroll-body">
          <h4 className="paper-reference-title">
            <BookOpen size={12} className="title-inline-icon" />
            {title}
          </h4>
          
          {/* Master View (always visible, holds equation / metrics list) */}
          {renderMasterView()}

          {/* Detail View Carousel */}
          {renderCarousel()}
        </div>
      </div>
    </div>
  );
};
