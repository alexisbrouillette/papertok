import React, { useState } from 'react';
import { ProceduralHero } from './ProceduralHero';
import cachedPapers from '../cached_test_papers.json';
import { ArrowLeft, Layers, BookOpen } from 'lucide-react';

interface TestVizProps {
  onBack: () => void;
}

export const TestViz: React.FC<TestVizProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<'all' | 'pipeline' | 'comparison' | 'math' | 'pullquote' | 'stat' | 'timeline'>('all');
  const [selectedPaper, setSelectedPaper] = useState<any | null>(cachedPapers[0] || null);

  const filteredPapers = cachedPapers.filter((paper: any) => {
    const primitive = paper.details?.heroVisualization?.primitive;
    const category = paper.category;
    
    if (activeTab === 'all') return true;
    if (activeTab === 'pipeline') return primitive === 'pipeline' || primitive === 'tree' || primitive === 'spatial_layers';
    if (activeTab === 'comparison') return primitive === 'comparison_delta';
    if (activeTab === 'math') return primitive === 'math_blueprint';
    if (activeTab === 'pullquote') return category === 'law'; // Holmes card
    if (activeTab === 'stat') return primitive === 'stat_odds';
    if (activeTab === 'timeline') return primitive === 'timeline_evolution';
    return true;
  });

  return (
    <div className="test-viz-page">
      <div className="test-viz-layout-wrapper">
        
        {/* HEADER AREA */}
        <header className="test-viz-header">
          <div className="header-meta">
            <button onClick={onBack} className="back-btn-mono">
              <ArrowLeft size={14} /> BACK TO APP
            </button>
            <h1 className="header-title">TESTING PROTOCOL: DYNAMIC FORMAT SWITCHER</h1>
            <p className="header-subtitle">
              PREVENTING SVG FATIGUE BY AUTOMATICALLY CLASSIFYING LANDMARK PAPERS INTO 6 HIGH-IMPACT VISUAL ARCHETYPES
            </p>
          </div>

          {/* TAB FILTERS */}
          <div className="filter-tabs">
            {(['all', 'pipeline', 'comparison', 'math', 'pullquote', 'stat', 'timeline'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`tab-btn-dev ${activeTab === tab ? 'active' : ''}`}
              >
                {tab === 'all' && 'All'}
                {tab === 'pipeline' && '1. Procedural SVGs'}
                {tab === 'comparison' && '2. Box Plots & Barometers'}
                {tab === 'math' && '3. Typographic Math'}
                {tab === 'pullquote' && '4. Editorial Pull-Quotes'}
                {tab === 'stat' && '5. Stat & Odds Callouts'}
                {tab === 'timeline' && '6. Evolution Timelines'}
              </button>
            ))}
          </div>
        </header>

        {/* CONTAINER */}
        <div className="test-viz-grid">
          
          {/* FEED LIST */}
          <div className="test-viz-feed">
            {filteredPapers.map((paper: any) => {
              const viz = paper.details?.heroVisualization;
              return (
                <div 
                  key={paper.id} 
                  className={`test-paper-card ${selectedPaper?.id === paper.id ? 'selected' : ''}`}
                  onClick={() => setSelectedPaper(paper)}
                >
                  {/* Card Header metadata */}
                  <div className="card-top-header">
                    <div className="category-tag">{paper.category}</div>
                    <div className="format-indicator">
                      <Layers size={11} />
                      <span>
                        {paper.category === 'law' ? 'PULL_QUOTE' : viz?.primitive?.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* Rendering wrapper */}
                  <div className="visual-hero-wrapper">
                    <ProceduralHero paper={paper} />
                  </div>

                  {/* Text Details */}
                  <div className="card-body">
                    <h2 className="paper-card-title">{paper.title}</h2>
                    <p className="paper-card-authors">
                      {paper.authors} ({paper.year}) — <span className="venue-span">{paper.venue}</span>
                    </p>
                    <p className="paper-card-purpose">{paper.purpose}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* SIDE INSPECTOR PANEL */}
          <aside className="test-viz-inspector">
            <div className="inspector-panel-inner">
              <div className="inspector-title-row">
                <BookOpen size={16} className="inspector-icon" />
                <h2>SPECIFICATION INSPECTOR</h2>
              </div>

              {selectedPaper ? (
                <div className="inspector-body-content">
                  <div>
                    <h3 className="ins-paper-title">{selectedPaper.title}</h3>
                    <p className="ins-paper-authors">{selectedPaper.authors} ({selectedPaper.year})</p>
                  </div>

                  <div className="ins-section">
                    <span className="ins-section-lbl">Format Selection Rationale</span>
                    <p className="ins-section-desc">
                      {selectedPaper.category === 'psychology' || selectedPaper.category === 'law'
                        ? `Survey/theoretical text study. Forcing an SVG node diagram makes the interface cluttered and unreadable. Falling back to the Editorial Pull-Takeaway format.`
                        : selectedPaper.details?.visualizationReasoning || 'Dynamic structural modeling decision.'}
                    </p>
                  </div>

                  <div className="ins-section">
                    <span className="ins-section-lbl">Core Contribution & Achievements</span>
                    <p className="ins-section-desc">{selectedPaper.achievements}</p>
                  </div>

                  <div className="ins-section">
                    <span className="ins-section-lbl">Critical Limitations</span>
                    <p className="ins-section-desc italic">"{selectedPaper.limitations}"</p>
                  </div>

                  <div className="ins-inventory">
                    <span className="ins-section-lbl">Specification Schema Metadata</span>
                    <pre className="schema-pre">
                      {JSON.stringify(selectedPaper.details?.heroVisualization || {}, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="empty-inspector-state">
                  Select a paper card in the feed to inspect its layout decisions, node parameters, and JSON specs.
                </div>
              )}
            </div>
          </aside>

        </div>
      </div>

      {/* SCOPED VANILLA CSS STYLES */}
      <style>{`
        .test-viz-page {
          min-height: 100vh;
          background-color: var(--bg-darkest);
          color: var(--text-primary);
          font-family: var(--font-sans), system-ui, -apple-system, sans-serif;
          padding: 32px 24px;
        }

        .test-viz-layout-wrapper {
          max-width: 1200px;
          margin: 0 auto;
        }

        .test-viz-header {
          border-bottom: 1px solid var(--border-glass-bright);
          padding-bottom: 24px;
          margin-bottom: 32px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .back-btn-mono {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-family: var(--font-mono);
          font-size: 0.72rem;
          color: var(--text-muted);
          cursor: pointer;
          transition: color 0.15s ease;
          background: none;
          border: none;
          margin-bottom: 8px;
          padding: 0;
        }

        .back-btn-mono:hover {
          color: var(--text-primary);
        }

        .header-title {
          font-family: var(--font-display);
          font-size: 1.8rem;
          font-weight: 800;
          letter-spacing: -0.03em;
          color: var(--text-primary);
        }

        .header-subtitle {
          font-family: var(--font-mono);
          font-size: 0.76rem;
          color: var(--text-muted);
          margin-top: 4px;
          letter-spacing: 0.02em;
          line-height: 1.4;
        }

        .filter-tabs {
          display: flex;
          gap: 10px;
          overflow-x: auto;
          padding-bottom: 4px;
        }

        .tab-btn-dev {
          padding: 8px 16px;
          border-radius: var(--radius-sm);
          font-family: var(--font-mono);
          font-size: 0.72rem;
          font-weight: 600;
          color: var(--text-secondary);
          background: var(--bg-darker);
          border: 1px solid var(--border-glass);
          cursor: pointer;
          transition: all 0.15s ease;
          white-space: nowrap;
        }

        .tab-btn-dev:hover {
          color: var(--text-primary);
          border-color: var(--border-glass-bright);
          background: var(--bg-dark);
        }

        .tab-btn-dev.active {
          color: var(--text-dark);
          background: var(--color-primary);
          border-color: var(--color-primary);
        }

        .test-viz-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 32px;
        }

        @media (min-width: 992px) {
          .test-viz-grid {
            grid-template-columns: 2fr 1fr;
          }
        }

        .test-viz-feed {
          display: flex;
          flex-direction: column;
          gap: 24px;
          align-items: center;
        }

        .test-paper-card {
          background: var(--bg-card);
          border: 1px solid var(--border-glass);
          border-radius: var(--radius-md);
          overflow: hidden;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          cursor: pointer;
          width: 100%;
          max-width: 480px;
        }

        .test-paper-card:hover {
          border-color: var(--border-glass-bright);
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.04);
        }

        .test-paper-card.selected {
          border-color: var(--color-primary);
          box-shadow: 0 0 0 1px var(--color-primary), 0 8px 24px rgba(0, 0, 0, 0.06);
        }

        .card-top-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 20px;
          background: rgba(9, 9, 11, 0.01);
          border-bottom: 1px solid var(--border-glass);
        }

        .category-tag {
          font-family: var(--font-mono);
          font-size: 0.64rem;
          font-weight: 700;
          text-transform: uppercase;
          background: var(--border-glass);
          color: var(--text-secondary);
          padding: 2px 8px;
          border-radius: 4px;
          letter-spacing: 0.05em;
        }

        .format-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
          font-family: var(--font-mono);
          font-size: 0.64rem;
          color: var(--color-primary);
          font-weight: 700;
          letter-spacing: 0.05em;
        }

        .visual-hero-wrapper {
          height: 180px;
          background: #ffffff;
          border-bottom: 1px solid var(--border-glass);
          position: relative;
        }

        .card-body {
          padding: 20px;
        }

        .paper-card-title {
          font-family: var(--font-display);
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--text-primary);
          line-height: 1.3;
        }

        .paper-card-authors {
          font-size: 0.76rem;
          color: var(--text-secondary);
          margin-top: 6px;
          margin-bottom: 12px;
        }

        .venue-span {
          font-style: italic;
          color: var(--text-muted);
        }

        .paper-card-purpose {
          font-size: 0.82rem;
          color: var(--text-secondary);
          line-height: 1.5;
        }

        .test-viz-inspector {
          position: relative;
        }

        .inspector-panel-inner {
          position: sticky;
          top: 32px;
          background: var(--bg-glass);
          border: 1px solid var(--border-glass);
          border-radius: var(--radius-md);
          padding: 24px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.04);
        }

        .inspector-title-row {
          display: flex;
          align-items: center;
          gap: 10px;
          border-bottom: 1px solid var(--border-glass);
          padding-bottom: 12px;
          margin-bottom: 20px;
        }

        .inspector-icon {
          color: var(--color-primary);
        }

        .inspector-title-row h2 {
          font-family: var(--font-mono);
          font-size: 0.76rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          color: var(--text-primary);
        }

        .inspector-body-content {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .ins-paper-title {
          font-family: var(--font-display);
          font-size: 1.05rem;
          font-weight: 700;
          color: var(--text-primary);
          line-height: 1.4;
        }

        .ins-paper-authors {
          font-family: var(--font-mono);
          font-size: 0.68rem;
          color: var(--text-muted);
          margin-top: 4px;
        }

        .ins-section {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .ins-section-lbl {
          font-family: var(--font-mono);
          font-size: 0.64rem;
          font-weight: 700;
          color: var(--color-primary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .ins-section-desc {
          font-size: 0.8rem;
          color: var(--text-secondary);
          line-height: 1.5;
        }

        .schema-pre {
          background: var(--bg-darkest);
          border: 1px solid var(--border-glass);
          border-radius: var(--radius-sm);
          padding: 12px;
          font-family: var(--font-mono);
          font-size: 0.64rem;
          color: var(--text-secondary);
          max-height: 220px;
          overflow-y: auto;
          white-space: pre-wrap;
          line-height: 1.4;
        }

        .empty-inspector-state {
          text-align: center;
          padding: 48px 12px;
          font-family: var(--font-mono);
          font-size: 0.72rem;
          color: var(--text-muted);
          line-height: 1.6;
        }
      `}</style>
    </div>
  );
};
