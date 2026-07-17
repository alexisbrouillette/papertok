import React, { useState, useEffect } from 'react';
import { ArrowLeft, Layers } from 'lucide-react';
import { type ZoomData } from './SemanticZoomDrawer';

interface SemanticZoomPanelProps {
  paperType: 'methodology' | 'empirical_study' | 'theoretical' | 'review_survey';
  title: string;
  data: ZoomData;
}

export const SemanticZoomPanel: React.FC<SemanticZoomPanelProps> = ({
  paperType,
  title: _title,
  data
}) => {
  // We track the navigation history stack of active symbols/labels being investigated
  const [investigationStack, setInvestigationStack] = useState<string[]>([]);

  // Reset investigation stack when data changes
  useEffect(() => {
    setInvestigationStack([]);
  }, [paperType, data]);

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
      placeholderId: `MATHPLH${idx}`,
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
                {data.translation && (
                  <p className="equation-translation-text">
                    <strong>Translation:</strong> {data.translation}
                  </p>
                )}
              </div>
            )}

            {/* Scientific Significance Context Banner */}
            {!activeSymbol && data.equationImportance && (
              <div className="significance-banner-card anim-slide-up" style={{ marginTop: '14px' }}>
                <span className="significance-badge">🎓 Scientific Significance</span>
                <p className="significance-text">{data.equationImportance}</p>
              </div>
            )}

            {data.terms && data.terms.length > 0 && (
              <div className="zoom-section" style={{ marginTop: '16px' }}>
                <h4 className="zoom-section-title">Tap variables to decode:</h4>
                <div className="equation-variables-grid">
                  {data.terms.map((t, idx) => {
                    const symbolText = t.symbol || t.term;
                    const isActive = activeSymbol === symbolText;
                    const color = PASTEL_PALETTE[idx % PASTEL_PALETTE.length];
                    const btnStyle = isActive
                      ? { background: color.activeBg, color: color.activeText, borderColor: color.activeBg, borderStyle: 'solid' }
                      : { background: color.bg, color: color.text, borderColor: color.border, borderStyle: 'solid' };
                    return (
                      <button
                        key={idx}
                        className={`variable-decode-btn ${isActive ? 'active' : ''}`}
                        onClick={() => symbolText && selectMasterItem(symbolText)}
                        style={btnStyle}
                      >
                        <code 
                          className="var-sym"
                          style={{ background: 'rgba(255, 255, 255, 0.25)', color: 'inherit' }}
                          dangerouslySetInnerHTML={{ __html: translateLatexToHtml(symbolText || '') }}
                        />
                        <span className="var-def" style={{ color: 'inherit' }}>{t.definition}</span>
                      </button>
                    );
                  })}
                </div>
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
                <div className="metrics-interactive-list">
                  {data.metrics.map((metric, idx) => {
                    const isActive = activeSymbol === metric.label;
                    return (
                      <button
                        key={idx}
                        className={`metric-row-btn ${isActive ? 'active' : ''}`}
                        onClick={() => selectMasterItem(metric.label)}
                      >
                        <div className="metric-row-left">
                          <span className="metric-badge-label">{metric.category || 'Performance'}</span>
                          <span className="metric-row-name">{metric.label}</span>
                        </div>
                        <div className="metric-row-right">
                          <span className="metric-row-val">{metric.rawValue}</span>
                          <span className="metric-arrow">➔</span>
                        </div>
                      </button>
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
                <div className="proof-steps-vertical">
                  {data.steps.map((step, idx) => {
                    const isActive = activeSymbol === step.stepLabel;
                    return (
                      <button
                        key={idx}
                        className={`proof-step-row-btn ${isActive ? 'active' : ''}`}
                        onClick={() => selectMasterItem(step.stepLabel)}
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
        <span className="panel-nav-title" style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          {getHeaderTitle()}
        </span>
      </div>

      {/* Master View */}
      {renderMasterView()}

      {/* Detail View */}
      {activeSymbol && (
        <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-glass)', paddingTop: '12px' }}>
          {renderDetailPanel()}
        </div>
      )}
    </div>
  );
};
