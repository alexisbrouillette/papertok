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


export const SemanticZoomDrawer: React.FC<SemanticZoomDrawerProps> = ({
  isOpen,
  onClose,
  paperType,
  title,
  data
}) => {
  // We track the navigation history stack of active symbols/labels being investigated
  const [investigationStack, setInvestigationStack] = useState<string[]>([]);

  // Reset investigation stack when drawer opens or data changes
  useEffect(() => {
    if (!isOpen) {
      setInvestigationStack([]);
    }
  }, [isOpen, paperType, data]);

  // Extract active investigated symbol
  const activeSymbol = investigationStack.length > 0 ? investigationStack[investigationStack.length - 1] : null;

  // Resets stack to exactly 1 item (Level 3) representing a new root-level investigation
  const selectMasterItem = (symbol: string) => {
    setInvestigationStack([symbol]);
  };

  // Appends item to stack (goes to Level 4, Level 5, etc.) for nested investigations
  const selectDetailItem = (symbol: string) => {
    if (investigationStack[investigationStack.length - 1] !== symbol) {
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
      .replace(/\\int_\{([^}]+)\}\^\{([^}]+)\}/g, '∫<sub>$1</sub><sup>$2</sup>')
      .replace(/\\int/g, '∫')
      .replace(/\\sum_\{([^}]+)\}\^\{([^}]+)\}/g, '∑<sub>$1</sub><sup>$2</sup>')
      .replace(/\\sum/g, '∑')
      .replace(/\\leq/g, ' ≤ ')
      .replace(/\\le/g, ' ≤ ')
      .replace(/\\geq/g, ' ≥ ')
      .replace(/\\ge/g, ' ≥ ')
      .replace(/\\approx/g, ' ≈ ')
      .replace(/\\neq/g, ' ≠ ')
      .replace(/\\cdot/g, ' · ')
      .replace(/\\times/g, ' × ')
      .replace(/\\partial/g, '∂')
      .replace(/\\infty/g, '∞')
      .replace(/\\nabla/g, '∇')
      .replace(/\\to/g, ' → ')
      .replace(/\\rightarrow/g, ' → ')
      .replace(/\\gets/g, ' ← ')
      .replace(/\\leftarrow/g, ' ← ')
      .replace(/\\sim/g, ' ~ ')
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

  // LaTeX-to-Unicode formatter with active term highlighting support
  const formatFormula = (latex: string, highlightSymbol: string | null) => {
    if (!latex) return '';

    let html = latex;
    
    // Map terms with stable placeholder IDs based on their original index
    const termsWithIds = (data.terms || []).map((t, idx) => ({
      ...t,
      placeholderId: `MATHPLH${idx}`
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

          const isActive = highlightSymbol === termSymbol;
          // Escape backslashes for JS string within inline HTML attribute
          const escapedClickSymbol = termSymbol.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
          const buttonHtml = `<button class="math-term-box ${isActive ? 'active' : ''}" onclick="window.pushZoomTerm('${escapedClickSymbol}')">${displayLabel}</button>`;
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
        return (
          <div className="zoom-level3-content anim-slide-in-right">
            <div className="drilldown-header-accent">
              <Layers size={14} className="accent-icon" />
              <span>Level 3: Term Definition</span>
            </div>
            <p className="level3-text">{term.definition}</p>
            {term.deepDive && (
              <div className="level3-extra-card">
                <span className="extra-label">Deep Dive Explanation</span>
                <p className="extra-text">{term.deepDive}</p>
              </div>
            )}
            
            {/* Direct Variable Decomposition rendering */}
            {term.subDefinitions && term.subDefinitions.length > 0 && (
              <div className="sub-definitions-box">
                <span className="sub-def-title">Decomposition Breakdown</span>
                <div className="sub-def-list">
                  {term.subDefinitions.map((sub, idx) => {
                    // Check if this sub-term is a complex term we can dive deeper into
                    const isClickable = data.terms?.some(
                      (t) => (t.symbol || t.term) === sub.term
                    );
                    return (
                      <div 
                        key={idx} 
                        className={`sub-def-item ${isClickable ? 'clickable' : ''}`}
                        onClick={isClickable ? () => selectDetailItem(sub.term) : undefined}
                      >
                        <code 
                          className="sub-def-badge"
                          dangerouslySetInnerHTML={{ __html: translateLatexToHtml(sub.term) }}
                        />
                        <span className="sub-def-desc">
                          {sub.definition} {isClickable && <span className="nested-arrow">➔</span>}
                        </span>
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
                      <div key={groupName} className="metric-group-block">
                        {showHeaders && <span className="metric-group-header">{groupName}</span>}
                        <div className="metrics-interactive-grid">
                          {items.map((m, idx) => {
                            const isActive = activeSymbol === m.label;
                            return (
                              <button
                                key={idx}
                                className={`metric-grid-card ${isActive ? 'active' : ''}`}
                                onClick={() => selectMasterItem(m.label)}
                              >
                                <span className="metric-card-val">{m.rawValue}</span>
                                <span className="metric-card-lbl">{m.label}</span>
                              </button>
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
                <div className="proof-steps-vertical">
                  {data.steps.map((s, idx) => {
                    const isActive = activeSymbol === s.stepLabel;
                    return (
                      <button
                        key={idx}
                        className={`proof-step-btn ${isActive ? 'active' : ''}`}
                        onClick={() => selectMasterItem(s.stepLabel)}
                      >
                        <div className="proof-step-num">{idx + 1}</div>
                        <div className="proof-step-body">
                          <span className="proof-step-lbl">{s.stepLabel}</span>
                          {s.inequalityUsed && <code className="proof-step-math" dangerouslySetInnerHTML={{ __html: formatFormula(s.inequalityUsed, null) }} />}
                        </div>
                        <span className="metric-arrow">➔</span>
                      </button>
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
                <div className="subcategory-grid">
                  {data.subcategories.map((sub, idx) => {
                    const isActive = activeSymbol === sub.name;
                    return (
                      <button
                        key={idx}
                        className={`subcategory-btn ${isActive ? 'active' : ''}`}
                        onClick={() => selectMasterItem(sub.name)}
                      >
                        <span className="subcategory-name">{sub.name}</span>
                        <span className="subcategory-lbl">Explore ➔</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {data.gaps && data.gaps.length > 0 && (
              <div className="zoom-section" style={{ marginTop: '16px' }}>
                <h4 className="zoom-section-title">Open Challenges & Gaps</h4>
                <div className="gaps-list">
                  {data.gaps.map((gap, idx) => {
                    const isActive = activeSymbol === gap.challenge;
                    return (
                      <button
                        key={idx}
                        className={`gap-btn-row ${isActive ? 'active' : ''}`}
                        onClick={() => selectMasterItem(gap.challenge)}
                      >
                        <div className="gap-challenge-txt">⚠️ {gap.challenge}</div>
                        <span className="metric-arrow">➔</span>
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
              <h3 className="drawer-title">{getHeaderTitle()}</h3>
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

          {/* Detail View (conditionally visible below Master view) */}
          {activeSymbol && (
            <div style={{ marginTop: '20px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '16px' }}>
              {renderDetailPanel()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
