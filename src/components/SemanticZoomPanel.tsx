import React, { useState, useEffect } from 'react';
import { ArrowLeft, Layers } from 'lucide-react';
import { type ZoomData } from './SemanticZoomDrawer';

interface SemanticZoomPanelProps {
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

export const SemanticZoomPanel: React.FC<SemanticZoomPanelProps> = ({
  paperType,
  title: _title,
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

  // Reset investigation stack and select first item by default when data changes
  useEffect(() => {
    const items = getCarouselItems();
    if (items.length > 0) {
      isProgrammaticScroll.current = true;
      setInvestigationStack([items[0].id]);
    } else {
      setInvestigationStack([]);
    }
  }, [paperType, data]);

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

  // Register globally accessible window helper to push terms from HTML string to React state
  useEffect(() => {
    (window as any).pushZoomTerm = (symbol: string) => {
      selectMasterItem(symbol);
    };
    return () => {
      delete (window as any).pushZoomTerm;
    };
  }, []);

  const carouselRef = React.useRef<HTMLDivElement>(null);

  // Scroll to active card when activeSymbol changes
  useEffect(() => {
    if (activeSymbol && carouselRef.current) {
      if (isProgrammaticScroll.current) {
        // Escape special characters in CSS selector
        const escapedSymbol = activeSymbol.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const activeCard = carouselRef.current.querySelector(`[data-card-id="${escapedSymbol}"]`);
        if (activeCard) {
          activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
        isProgrammaticScroll.current = false;
      }
    }
  }, [activeSymbol]);

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

  // Curated editorial pastel colors corresponding to variables/terms
  const PASTEL_PALETTE = [
    { bg: 'rgba(27, 73, 49, 0.06)', border: 'rgba(27, 73, 49, 0.25)', text: '#1b4931', activeBg: '#1b4931', activeText: '#fff' }, // Sage Forest
    { bg: 'rgba(133, 77, 14, 0.06)', border: 'rgba(133, 77, 14, 0.25)', text: '#854d0e', activeBg: '#854d0e', activeText: '#fff' }, // Antique Gold
    { bg: 'rgba(72, 46, 29, 0.06)', border: 'rgba(72, 46, 29, 0.25)', text: '#482e1d', activeBg: '#482e1d', activeText: '#fff' }, // Rich Walnut
    { bg: 'rgba(159, 18, 57, 0.05)', border: 'rgba(159, 18, 57, 0.22)', text: '#9f1239', activeBg: '#9f1239', activeText: '#fff' }, // Dusty Rose
    { bg: 'rgba(30, 64, 175, 0.05)', border: 'rgba(30, 64, 175, 0.22)', text: '#1e40af', activeBg: '#1e40af', activeText: '#fff' }  // Slate Blue
  ];

  // LaTeX-to-Unicode formatter with active term highlighting support
  const formatFormula = (latex: string, highlightSymbol: string | null) => {
    if (!latex) return '';

    let html = latex;
    
    // Map terms with stable placeholder IDs based on their original index
    const termsWithIds = (data.terms || []).map((t, idx) => ({
      ...t,
      placeholderId: '【' + '❖'.repeat(idx + 1) + '】',
      colorIdx: idx % PASTEL_PALETTE.length
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
          const color = PASTEL_PALETTE[t.colorIdx];

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
          subsWithIds.forEach((s) => { const c = PASTEL_PALETTE[s.ci % PASTEL_PALETTE.length]; const lbl = translateLatexToHtml(s.term); html = html.replaceAll(s.pid, `<span style="color:${c.text};background:${c.bg};border:1px solid ${c.border};padding:1px 5px;border-radius:4px;font-weight:700;">${lbl}</span>`); });
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
              style={{ margin: '14px 0', padding: '14px', background: 'var(--bg-darker)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)', textAlign: 'center', fontSize: '1.2rem', fontWeight: 600 }}
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
                <span className="sub-def-title" style={{ fontSize: '0.86rem', fontWeight: 600, display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Decomposition Breakdown</span>
                <div className="sub-def-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {term.subDefinitions.map((sub, idx) => {
                    const isClickable = data.terms?.some(
                      (t) => (t.symbol || t.term) === sub.term
                    );
                    const isExpanded = expandedSubTerm === sub.term;
                    const subTermData = isClickable 
                      ? data.terms?.find((t) => (t.symbol || t.term) === sub.term)
                      : null;

                    const subColor = PASTEL_PALETTE[idx % PASTEL_PALETTE.length];

                    return (
                      <div 
                        key={idx} 
                        className={`sub-def-item ${isClickable ? 'clickable' : ''}`}
                        onClick={isClickable ? () => setExpandedSubTerm(isExpanded ? null : sub.term) : undefined}
                        style={{ cursor: isClickable ? 'pointer' : 'default', padding: '8px 10px', background: 'rgba(9, 9, 11, 0.02)', border: isExpanded ? `1px solid ${subColor.border}` : '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', gap: '0' }}
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
                            style={{ fontSize: '0.8rem', color: 'var(--text-primary)', lineHeight: '1.4', flex: 1 }}
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
                          <div className="inline-sub-detail anim-slide-up" style={{ marginTop: '10px', padding: '10px', background: 'var(--bg-darker)', borderRadius: '4px', border: subColor ? `1px solid ${subColor.border}` : '1px solid var(--border-glass-bright)' }} onClick={(e) => e.stopPropagation()}>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-primary)', margin: 0, lineHeight: '1.4' }} dangerouslySetInnerHTML={{ __html: formatTextWithInlineMath(subTermData.definition) }} />
                            {subTermData.deepDive && (
                              <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '8px', marginBottom: 0 }} dangerouslySetInnerHTML={{ __html: formatTextWithInlineMath(subTermData.deepDive) }} />
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

  const renderMasterView = () => {
    switch (paperType) {
      case 'methodology':
        return (
          <div className="zoom-level2-content">
            {data.rawFormula && (
              <div className="equation-math-card">
                <div
                  className="equation-latex-render"
                  dangerouslySetInnerHTML={{ __html: formatFormula(data.rawFormula, activeSymbol) }}
                />
                {data.translation && !activeSymbol && (
                  <p className="equation-translation-text">
                    <strong>Translation:</strong> {data.translation}
                  </p>
                )}
              </div>
            )}

            {activeSymbol && (
              <div className="inline-term-detail-container" style={{ marginTop: '16px' }}>
                {renderDetailPanel()}
              </div>
            )}

            {/* Scientific Significance Context Banner */}
            {!activeSymbol && data.equationImportance && (
              <div className="significance-banner-card anim-slide-up" style={{ marginTop: '14px' }}>
                <span className="significance-badge">🎓 Scientific Significance</span>
                <p className="significance-text">{data.equationImportance}</p>
              </div>
            )}


          </div>
        );
      case 'empirical_study':
        return (
          <div className="zoom-level2-content">
            {data.verdict && (
              <div className="verdict-banner">
                <p className="verdict-text">
                  <strong>Verdict:</strong> “{data.verdict}”
                </p>
              </div>
            )}

            {data.metrics && data.metrics.length > 0 && (
              <div className="zoom-section" style={{ marginTop: '16px' }}>
                <h4 className="zoom-section-title">Key Statistical Metrics (Tap for Context)</h4>
                <div className="metrics-interactive-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {data.metrics.map((metric, idx) => {
                    const isActive = activeSymbol === metric.label;
                    return (
                      <div key={idx} className="metric-row-container" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <button
                          className={`metric-row-btn ${isActive ? 'active' : ''}`}
                          onClick={() => selectMasterItem(metric.label)}
                          style={{ width: '100%' }}
                        >
                          <div className="metric-row-left">
                            <span className="metric-badge-label">{metric.category || 'Performance'}</span>
                            <span className="metric-row-name">{metric.label}</span>
                          </div>
                          <div className="metric-row-right">
                            <span className="metric-row-val">{metric.rawValue}</span>
                            <span className="metric-arrow">{isActive ? '▲' : '▼'}</span>
                          </div>
                        </button>
                        {isActive && (
                          <div className="inline-metric-detail anim-slide-up" style={{ padding: '12px', background: 'var(--bg-darker)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass-bright)' }}>
                            <p style={{ fontSize: '0.82rem', color: 'var(--text-primary)', margin: 0, lineHeight: '1.4' }}>{metric.explanation}</p>
                            {metric.cohortContext && <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '8px', marginBottom: 0 }}><strong>Cohort:</strong> {metric.cohortContext}</p>}
                            {metric.controlValue && <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px', marginBottom: 0 }}><strong>Control/Baseline:</strong> {metric.controlValue}</p>}
                            {metric.significance && <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px', marginBottom: 0 }}><strong>Significance:</strong> {metric.significance}</p>}
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
      case 'theoretical':
        return (
          <div className="zoom-level2-content">
            {data.promise && (
              <div className="theorem-card">
                <div 
                  className="theorem-text-formatted"
                  dangerouslySetInnerHTML={{ __html: translateLatexToHtml(data.promise) }}
                />
              </div>
            )}

            {/* Scientific Significance Context Banner */}
            {!activeSymbol && data.equationImportance && (
              <div className="significance-banner-card anim-slide-up" style={{ marginTop: '14px' }}>
                <span className="significance-badge">🎓 Theoretical Significance</span>
                <p className="significance-text">{data.equationImportance}</p>
              </div>
            )}

            {data.steps && data.steps.length > 0 && (
              <div className="zoom-section" style={{ marginTop: '16px' }}>
                <h4 className="zoom-section-title">Proof Pipeline (Tap steps to expand)</h4>
                <div className="proof-steps-vertical" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {data.steps.map((step, idx) => {
                    const isActive = activeSymbol === step.stepLabel;
                    return (
                      <div key={idx} className="proof-step-container" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <button
                          className={`proof-step-row-btn ${isActive ? 'active' : ''}`}
                          onClick={() => selectMasterItem(step.stepLabel)}
                          style={{ width: '100%' }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'start', gap: '4px', flex: 1 }}>
                            <span className="proof-step-tag">Step {idx + 1}: {step.stepLabel}</span>
                            {step.inequalityUsed && (
                              <code 
                                className="proof-step-ineq"
                                dangerouslySetInnerHTML={{ __html: translateLatexToHtml(step.inequalityUsed) }}
                              />
                            )}
                          </div>
                          <span className="metric-arrow">{isActive ? '▲' : '▼'}</span>
                        </button>
                        {isActive && (
                          <div className="inline-step-detail anim-slide-up" style={{ padding: '12px', background: 'var(--bg-darker)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass-bright)' }}>
                            <p style={{ fontSize: '0.82rem', color: 'var(--text-primary)', margin: 0, lineHeight: '1.4' }}>{step.explanation}</p>
                            {step.deepDive && <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '8px', marginBottom: 0 }}><strong>Deep Dive:</strong> {step.deepDive}</p>}
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
                          <div className="inline-subcategory-detail anim-slide-up" style={{ fontSize: '0.82rem', borderTop: '1px solid var(--border-glass-bright)', paddingTop: '8px', color: 'var(--text-primary)' }} onClick={(e) => e.stopPropagation()}>
                            <p style={{ margin: 0, lineHeight: '1.4' }}>{sub.approach}</p>
                            {sub.seminalPapers && sub.seminalPapers.length > 0 && (
                              <div style={{ marginTop: '8px' }}>
                                <strong style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Seminal Papers:</strong>
                                <ul style={{ margin: '4px 0 0 16px', padding: 0, fontSize: '0.74rem', color: 'var(--text-muted)' }}>
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
                          <div className="inline-gap-detail anim-slide-up" style={{ fontSize: '0.82rem', borderTop: '1px solid var(--border-glass-bright)', paddingTop: '8px', color: 'var(--text-primary)' }} onClick={(e) => e.stopPropagation()}>
                            <strong style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Reason / Challenge Root:</strong>
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
        <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-glass)', paddingTop: '12px' }}>
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
                        const subColor = PASTEL_PALETTE[(targetIdx !== undefined && targetIdx !== -1 ? targetIdx : idx) % PASTEL_PALETTE.length];

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

  return (
    <div className="semantic-zoom-panel-inner">
      {/* Navigation Sub-header (only visible when in drilldown) */}
      <div className="panel-navigation-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--border-glass)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {investigationStack.length > 0 && (
            <button className="panel-nav-back-btn" onClick={handleBack} type="button" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(9, 9, 11, 0.04)', border: '1px solid var(--border-glass)', borderRadius: '4px', padding: '4px 8px', fontSize: '0.74rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <ArrowLeft size={12} style={{ marginRight: '4px' }} /> Back
            </button>
          )}
          <span className="panel-badge-lbl" style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', background: 'var(--color-primary-glow)', padding: '2px 6px', borderRadius: '4px' }}>
            {getLevelBadge()}
          </span>
        </div>
        <span 
          className="panel-nav-title" 
          style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-secondary)' }}
          dangerouslySetInnerHTML={{ __html: translateLatexToHtml(getHeaderTitle()) }}
        />
      </div>

      {/* Master View */}
      {renderMasterView()}

      {/* Detail View Carousel */}
      {renderCarousel()}
    </div>
  );
};
