import React from 'react';

// Polymorphic Canvas Spec Interface
interface VisualNode {
  id: string;
  label: string;
  subtext?: string;
  highlight?: boolean;
}

interface VisualEdge {
  from: string;
  to: string;
  label?: string;
}

interface UnifiedVisualizationSpec {
  primitive: 'pipeline' | 'tree' | 'comparison_delta' | 'spatial_layers' | 'math_blueprint' | 'stat_odds' | 'timeline_evolution' | 'pull_quote';
  title: string;
  canvas: {
    gridType: 'technical_dots' | 'blueprint_grid';
    badge: string;
  };
  nodes: VisualNode[];
  edges?: VisualEdge[];
  deltaCallout?: {
    metric: string;
    comparisonText: string;
  };
  equation?: string;
  statCallout?: {
    metric: string;
    label: string;
    text: string;
  };
  timeline?: {
    pastEra: string;
    pastConcept: string;
    breakthroughEra: string;
    breakthroughConcept: string;
  };
}

interface ProceduralHeroProps {
  paper: {
    title: string;
    coreIdea?: string;
    year?: number;
    explanation?: {
      paperType?: 'methodology' | 'empirical_study' | 'theoretical' | 'review_survey';
      deconstructedParts?: Array<{ title: string; explanation: string }>;
      teaserCoreIntuition?: string;
      teaserWhyRead?: string;
    };
    heroVisualization?: UnifiedVisualizationSpec | any;
    category?: string;
  };
  catTextColor?: string;
  catColor?: string;
  expanded?: boolean;
}

interface Theme {
  name: string;
  bgFill: string;
  primaryStroke: string;
  secondaryStroke: string;
  textColor: string;
  highlightText: string;
  gridColor: string;
  glowColor: string;
}

// 10 Journal-Grade Pastel Light Themes matching the Alabaster/Creme App style
const THEMES: Theme[] = [
  { name: 'Soft Mint', bgFill: '#f4fbf7', primaryStroke: '#1b4931', secondaryStroke: '#2d6a4f', textColor: '#1b4931', highlightText: '#ffffff', gridColor: 'rgba(27, 73, 49, 0.05)', glowColor: '27, 73, 49' },
  { name: 'Soft Sage', bgFill: '#f7fee7', primaryStroke: '#3f6212', secondaryStroke: '#4d7c0f', textColor: '#3f6212', highlightText: '#ffffff', gridColor: 'rgba(63, 98, 18, 0.05)', glowColor: '63, 98, 18' },
  { name: 'Soft Sky', bgFill: '#f0f9ff', primaryStroke: '#0369a1', secondaryStroke: '#0284c7', textColor: '#0369a1', highlightText: '#ffffff', gridColor: 'rgba(3, 105, 161, 0.05)', glowColor: '3, 105, 161' },
  { name: 'Soft Amber', bgFill: '#fffbeb', primaryStroke: '#b45309', secondaryStroke: '#d97706', textColor: '#b45309', highlightText: '#ffffff', gridColor: 'rgba(180, 83, 9, 0.05)', glowColor: '180, 83, 9' },
  { name: 'Warm Walnut', bgFill: '#faf7f2', primaryStroke: '#482e1d', secondaryStroke: '#5c3a21', textColor: '#482e1d', highlightText: '#ffffff', gridColor: 'rgba(72, 46, 29, 0.05)', glowColor: '72, 46, 29' },
  { name: 'Soft Lavender', bgFill: '#faf5ff', primaryStroke: '#6b21a8', secondaryStroke: '#7e22ce', textColor: '#6b21a8', highlightText: '#ffffff', gridColor: 'rgba(107, 33, 168, 0.05)', glowColor: '107, 33, 168' },
  { name: 'Soft Teal', bgFill: '#f0fdfa', primaryStroke: '#0f766e', secondaryStroke: '#0d9488', textColor: '#0f766e', highlightText: '#ffffff', gridColor: 'rgba(15, 118, 110, 0.05)', glowColor: '15, 118, 110' },
  { name: 'Soft Rose', bgFill: '#fff1f2', primaryStroke: '#be123c', secondaryStroke: '#db2777', textColor: '#be123c', highlightText: '#ffffff', gridColor: 'rgba(190, 18, 60, 0.05)', glowColor: '190, 18, 60' },
  { name: 'Soft Denim', bgFill: '#f8fafc', primaryStroke: '#1e3a8a', secondaryStroke: '#2563eb', textColor: '#1e3a8a', highlightText: '#ffffff', gridColor: 'rgba(30, 58, 138, 0.05)', glowColor: '30, 58, 138' },
  { name: 'Soft Olive', bgFill: '#fefce8', primaryStroke: '#854d0e', secondaryStroke: '#a16207', textColor: '#854d0e', highlightText: '#ffffff', gridColor: 'rgba(133, 77, 14, 0.05)', glowColor: '133, 77, 14' }
];

// Simple deterministic hash generator
const getHash = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
};

// ---------------------------------------------------------------------------
// TEXT FITTING
// ---------------------------------------------------------------------------
interface FitResult {
  lines: string[];
  fontSize: number;
}

const wrapAtWidth = (label: string, maxCharsPerLine: number, maxLines: number): string[] => {
  const words = label.split(/[\s_\-/]+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, maxLines);
};

const fitLabel = (label: string, boxWidthPx: number, boxHeightPx: number): FitResult => {
  const sizes = [11.5, 10.5, 9.5, 8.5];
  const maxLines = boxHeightPx >= 36 ? 2 : 1;

  for (const fontSize of sizes) {
    const charWidth = fontSize * 0.48; // Proportional font width factor
    const maxCharsPerLine = Math.max(4, Math.floor((boxWidthPx - 6) / charWidth));
    const lines = wrapAtWidth(label, maxCharsPerLine, maxLines);
    const words = label.split(/[\s_\-/]+/).filter(Boolean);
    const longestWord = Math.max(...words.map(w => w.length));
    if (longestWord <= maxCharsPerLine && lines.length <= maxLines) {
      return { lines, fontSize };
    }
  }

  const fontSize = sizes[sizes.length - 1];
  const charWidth = fontSize * 0.48;
  const maxCharsPerLine = Math.max(4, Math.floor((boxWidthPx - 6) / charWidth));
  const lines = wrapAtWidth(label, maxCharsPerLine, maxLines);
  if (lines.length > 0) {
    const last = lines[lines.length - 1];
    if (last.length >= maxCharsPerLine) {
      lines[lines.length - 1] = last.slice(0, Math.max(3, maxCharsPerLine - 1)) + '…';
    }
  }
  return { lines, fontSize };
};

export const ProceduralHero: React.FC<ProceduralHeroProps> = ({ paper, catTextColor, catColor, expanded = false }) => {
  const title = paper.title || 'Scientific Discovery';
  const type = paper.explanation?.paperType || 'methodology';
  const hash = getHash(title);
  const uid = `hero-${hash}`;

  const theme = THEMES[hash % THEMES.length];
  const primaryStroke = theme.primaryStroke;
  const secondaryStroke = theme.secondaryStroke;
  const gridColor = theme.gridColor;
  const bgFill = theme.bgFill;
  
  const width = 440;
  const height = 180;

  // --- LEGACY CONVERTER & ADAPTER ---
  const getUnifiedSpec = (): UnifiedVisualizationSpec => {
    const rawViz = paper.heroVisualization;

    if (rawViz && rawViz.primitive) {
      return rawViz as UnifiedVisualizationSpec;
    }

    // Default Fallback
    return {
      primitive: 'pipeline',
      title: 'Workflow Execution Protocol',
      canvas: { gridType: 'technical_dots', badge: 'Synthesis Workflow' },
      nodes: [
        { id: 'p_1', label: 'Input Data', subtext: 'Raw dataset', highlight: false },
        { id: 'p_2', label: 'Proposed Pipeline', subtext: 'Novel process', highlight: true },
        { id: 'p_3', label: 'Outcome Metrics', subtext: 'Result output', highlight: false }
      ],
      edges: [
        { 'from': 'p_1', 'to': 'p_2' },
        { 'from': 'p_2', 'to': 'p_3' }
      ]
    };
  };

  const spec = getUnifiedSpec();

  // --- COLLAPSED BILLBOARD PREVIEW RENDERING (For card feed) ---
  if (!expanded) {
    let badgeText = 'EDITORIAL DISCOVERY';
    let headlineText = '';
    let bodyText = '';
    
    if (spec.primitive === 'stat_odds' && spec.statCallout) {
      badgeText = `⚡ ${spec.statCallout.label || 'STATISTIC FOCUS'}`;
      headlineText = spec.statCallout.metric;
      bodyText = spec.statCallout.text;
    } else if (spec.primitive === 'comparison_delta' && spec.deltaCallout) {
      badgeText = `⚡ SOTA PERFORMANCE DELTA`;
      headlineText = spec.deltaCallout.metric;
      bodyText = spec.deltaCallout.comparisonText;
    } else if (spec.primitive === 'math_blueprint') {
      badgeText = `📐 THEORETICAL GUARANTEE`;
      headlineText = spec.equation ? spec.equation
        .replace(/\\mathbf\{([^}]+)\}/g, '$1')
        .replace(/\\mathbb\{([^}]+)\}/g, '$1')
        .replace(/\\in/g, '∈')
        .replace(/\\mathbb\{R\}/g, 'ℝ')
        .replace(/\\cdot/g, '·')
        .replace(/\\{/g, '')
        .replace(/\\}/g, '')
        .replace(/\\/g, '') 
        : '‖f(x) - f*(x)‖ ≤ ε';
      bodyText = paper.explanation?.teaserWhyRead || paper.explanation?.teaserCoreIntuition || "Proves foundational mathematical error bounds.";
    } else {
      badgeText = `💬 EDITORIAL FOCUS // ${type.toUpperCase()}`;
      headlineText = paper.explanation?.teaserCoreIntuition ? `"${paper.explanation.teaserCoreIntuition}"` : `"${paper.title}"`;
      bodyText = paper.explanation?.teaserWhyRead || "Foundational insights and research breakthroughs.";
    }

    const brandColor = catTextColor || primaryStroke;
    const finalGridColor = catTextColor || gridColor;

    return (
      <div 
        className="hero-format-card billboard-preview-card" 
        style={{ 
          background: 'transparent', 
          position: 'relative',
          padding: '16px 0',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          gap: '8px',
          width: '100%',
          minHeight: '130px',
          borderRadius: '0',
          border: 'none'
        }}
      >
        {spec.canvas.gridType && (
          <div 
            className="card-grid-watermark" 
            style={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              right: 0, 
              bottom: 0, 
              pointerEvents: 'none', 
              opacity: 0.18,
              backgroundImage: spec.canvas.gridType === 'blueprint_grid'
                ? `linear-gradient(${finalGridColor} 1px, transparent 1px), linear-gradient(90deg, ${finalGridColor} 1px, transparent 1px)`
                : `radial-gradient(${finalGridColor} 1px, transparent 1px)`,
              backgroundSize: spec.canvas.gridType === 'blueprint_grid' ? '12px 12px' : '14px 14px'
            }}
          />
        )}
        <span 
          style={{ 
            fontSize: '0.62rem', 
            fontWeight: 'bold', 
            fontFamily: 'var(--font-mono)', 
            color: brandColor, 
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            opacity: 0.8
          }}
        >
          {badgeText}
        </span>
        <h1 
          style={{ 
            fontSize: headlineText.length > 50 ? '0.98rem' : headlineText.length > 25 ? '1.2rem' : '1.75rem', 
            fontWeight: 800, 
            fontFamily: 'var(--font-sans)', 
            color: brandColor, 
            margin: '4px 0', 
            lineHeight: 1.25,
            letterSpacing: '-0.02em'
          }}
        >
          {headlineText}
        </h1>
        <p 
          style={{ 
            fontSize: '0.82rem', 
            fontFamily: 'var(--font-serif)', 
            fontStyle: 'italic', 
            color: catTextColor ? `${catTextColor}d8` : '#4a4840', 
            lineHeight: 1.45, 
            margin: 0
          }}
        >
          {bodyText}
        </p>
      </div>
    );
  }

  const renderBackgroundGrid = (gridType: 'technical_dots' | 'blueprint_grid') => {
    if (gridType === 'blueprint_grid') {
      return (
        <pattern id={`${uid}-blueprint-grid`} width="12" height="12" patternUnits="userSpaceOnUse">
          <path d="M 12 0 L 0 0 0 12" fill="none" stroke={gridColor} strokeWidth="0.8" strokeDasharray="2 2" />
        </pattern>
      );
    }
    return (
      <pattern id={`${uid}-technical-dots`} width="14" height="14" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="0.8" fill={gridColor} />
      </pattern>
    );
  };

  const activePatternId = spec.canvas.gridType === 'blueprint_grid' ? `${uid}-blueprint-grid` : `${uid}-technical-dots`;

  // --- Overlay grid inside HTML formats ---
  const renderBackgroundGridCSS = () => (
    <div 
      className="card-grid-watermark" 
      style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0, 
        pointerEvents: 'none', 
        opacity: 0.35,
        backgroundImage: spec.canvas.gridType === 'blueprint_grid'
          ? `linear-gradient(${gridColor} 1px, transparent 1px), linear-gradient(90deg, ${gridColor} 1px, transparent 1px)`
          : `radial-gradient(${gridColor} 1px, transparent 1px)`,
        backgroundSize: spec.canvas.gridType === 'blueprint_grid' ? '12px 12px' : '14px 14px'
      }}
    />
  );

  // --- LaTeX math parser helper to display beautiful equations ---
  const formatEquationToHtml = (eq: string) => {
    let html = eq;
    
    const replacements: Record<string, string> = {
      '\\triangleq': ' ≜ ',
      '\\not\\equiv': ' ≢ ',
      '\\mathbb{E}': '𝔼',
      '\\mathcal{L}': 'ℒ',
      '\\mathcal{M}': 'ℳ',
      '\\quad': ' &nbsp;&nbsp; ',
      '\\\\': '<br/>',
      '\\mid': ' | ',
      '\\epsilon': 'ε',
      '\\Psi': 'Ψ',
      '\\Phi': 'Φ',
      '\\gamma': 'γ',
      '\\omega': 'ω',
      '\\phi': 'φ',
      '\\cdot': '·',
      '\\ge': ' ≥ ',
      '\\le': ' ≤ ',
      '\\approx': ' ≈ ',
    };

    Object.entries(replacements).forEach(([key, val]) => {
      html = html.replaceAll(key, val);
    });

    html = html.replace(/\\text\{([^}]+)\}/g, '$1');
    html = html.replace(/_\{([^}]+)\}/g, '<sub>$1</sub>');
    html = html.replace(/\^\{([^}]+)\}/g, '<sup>$1</sup>');

    const fracRegex = /\\frac\{([^}]+)\}\{([^}]+)\}/g;
    html = html.replace(fracRegex, '<span class="math-frac"><span class="math-num">$1</span><span class="math-den">$2</span></span>');
    html = html.replace(/\{([^}]+)\}/g, '$1');

    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  };

  // Abbreviation utility to map long text to compact, high-fidelity terms in SVG flowcharts
  const abbreviateLabel = (lbl: string): string => {
    const mapping: Record<string, string> = {
      'Source Sequence Embeddings': 'Src Embed',
      'Encoder Multi-Head Self-Attention': 'Enc Attn',
      'Encoder Position-wise FFN': 'Enc FFN',
      'Target Sequence Embeddings': 'Tgt Embed',
      'Decoder Masked Self-Attention': 'Dec Attn',
      'Encoder-Decoder Cross-Attention': 'Cross Attn',
      'Decoder Position-wise FFN': 'Dec FFN',
      'Output Vocabulary Logits': 'Out Logits',
      'MSA & Template Featurization': 'Featurize',
      'Evoformer Blocks': 'Evoformer',
      'Structure Module': 'Structure',
      'Predicted Protein Structure': '3D Fold',
    };
    return mapping[lbl] || lbl;
  };

  // --- Render multiline tspan labels, fitted to the actual box size ---
  const renderNodeText = (label: string, x: number, y: number, isHighlight: boolean, boxW: number, boxH: number) => {
    const cleanLabel = abbreviateLabel(label);
    const { lines, fontSize } = fitLabel(cleanLabel, boxW, boxH);
    const textColor = isHighlight ? theme.highlightText : theme.primaryStroke; // Contrast ink for readable text
    const lineHeight = fontSize + 1.5;

    if (lines.length === 1) {
      return (
        <text x={x} y={y + fontSize * 0.35} textAnchor="middle" fontSize={fontSize} fontFamily="var(--font-sans)" fontWeight="bold" fill={textColor}>
          {lines[0]}
        </text>
      );
    }
    const startDy = -((lines.length - 1) * lineHeight) / 2 + fontSize * 0.35;
    return (
      <text x={x} y={y} textAnchor="middle" fontSize={fontSize} fontFamily="var(--font-sans)" fontWeight="bold" fill={textColor}>
        {lines.map((line, i) => (
          <tspan key={i} x={x} dy={i === 0 ? startDy : lineHeight}>{line}</tspan>
        ))}
      </text>
    );
  };

  // Shared definitions for premium vectors, gradients, and filters
  const renderDefs = () => (
    <defs>
      {renderBackgroundGrid(spec.canvas.gridType)}
      
      {/* Soft ambient drop shadow filter using the theme's custom glow color */}
      <filter id={`${uid}-glow`} x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2.5" stdDeviation="5.5" floodColor={`rgb(${theme.glowColor})`} floodOpacity="0.22" />
      </filter>

      {/* Premium vector linear gradient for key/highlight nodes */}
      <linearGradient id={`${uid}-grad-highlight`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={primaryStroke} />
        <stop offset="100%" stopColor={secondaryStroke} />
      </linearGradient>

      {/* Subtly tinted premium base gradient for standard nodes */}
      <linearGradient id={`${uid}-grad-node`} x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="100%" stopColor="#faf9f7" />
      </linearGradient>

      <marker id={`${uid}-arrow`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill={primaryStroke} />
      </marker>
    </defs>
  );

  // --- 1. PIPELINE CANVAS RENDERING ---
  const renderPipelineCanvas = () => {
    const nodes = spec.nodes;
    const edges = spec.edges || [];
    const count = nodes.length;
    const boxW = count >= 5 ? 78 : 98;
    const boxH = 38;

    const marginX = boxW / 2 + 12;
    const railTop = 50;
    const railBottom = height - 44;
    const nodeCoords = nodes.map((node, i) => {
      const t = count > 1 ? i / (count - 1) : 0.5;
      const x = marginX + t * (width - 2 * marginX);
      const y = i % 2 === 0 ? railTop : railBottom;
      return { ...node, x, y };
    });

    return (
      <>
        {/* Connection Paths & Animated Flow Markers */}
        <g fill="none">
          {edges.map((edge, idx) => {
            const fromNode = nodeCoords.find(n => n.id === edge.from);
            const toNode = nodeCoords.find(n => n.id === edge.to);
            if (!fromNode || !toNode) return null;

            const midX = (fromNode.x + toNode.x) / 2;
            const midY = (fromNode.y + toNode.y) / 2;
            const curveBias = fromNode.y === toNode.y ? 0 : 18;
            const pathD = `M ${fromNode.x} ${fromNode.y} Q ${midX} ${midY + curveBias} ${toNode.x} ${toNode.y}`;

            return (
              <g key={idx}>
                {/* Thin connection wire */}
                <path
                  id={`${uid}-pipeline-edge-${idx}`}
                  d={pathD}
                  stroke={primaryStroke}
                  strokeWidth="1.2"
                  opacity="0.32"
                  strokeDasharray="4 3"
                />
                
                {/* Flowing micro-animation dot */}
                <circle r="2.5" fill={primaryStroke} opacity="0.85" filter={`url(#${uid}-glow)`}>
                  <animateMotion dur="2.2s" repeatCount="indefinite">
                    <mpath href={`#${uid}-pipeline-edge-${idx}`} />
                  </animateMotion>
                </circle>
              </g>
            );
          })}
        </g>

        {/* Nodes rendering */}
        {nodeCoords.map((node, i) => {
          const w = node.highlight ? boxW + 4 : boxW;
          const h = node.highlight ? boxH + 4 : boxH;
          const isHighlight = !!node.highlight;
          
          let shapeType = 'segmented';
          if (i === 0) shapeType = 'diamond';
          else if (i === count - 1) shapeType = 'target';
          else if (isHighlight) shapeType = 'delta';

          const strokeWidth = isHighlight ? 1.8 : 1.2;
          const glowFilter = isHighlight ? `url(#${uid}-glow)` : 'none';
          const fillUrl = isHighlight ? `url(#${uid}-grad-highlight)` : `url(#${uid}-grad-node)`;

          const badgeText = `${(i + 1).toString().padStart(2, '0')} // ${isHighlight ? 'KEY_NODE' : 'STAGE'}`;
          const badgeY = node.y - h / 2 - 5;

          return (
            <g key={node.id}>
              {/* Technical Node Labels */}
              <text x={node.x} y={badgeY} textAnchor="middle" fontSize="6.5" fontFamily="var(--font-mono)" fill={theme.textColor} opacity="0.65" fontWeight="bold" letterSpacing="0.5">
                {badgeText}
              </text>

              {/* Diamond Node */}
              {shapeType === 'diamond' && (
                <polygon
                  points={`${node.x},${node.y - h/2 - 2} ${node.x + w/2 + 2},${node.y} ${node.x},${node.y + h/2 + 2} ${node.x - w/2 - 2},${node.y}`}
                  fill={fillUrl}
                  stroke={primaryStroke}
                  strokeWidth={strokeWidth}
                  style={{ filter: glowFilter }}
                />
              )}

              {/* Standard Segmented Node with CAD tech markings */}
              {shapeType === 'segmented' && (
                <g style={{ filter: glowFilter }}>
                  <rect
                    x={node.x - w / 2}
                    y={node.y - h / 2}
                    width={w}
                    height={h}
                    rx="5"
                    fill={fillUrl}
                    stroke={primaryStroke}
                    strokeWidth={strokeWidth}
                  />
                  {/* Subtle inner double outline border for precision tech aesthetic */}
                  <rect
                    x={node.x - w / 2 + 2}
                    y={node.y - h / 2 + 2}
                    width={w - 4}
                    height={h - 4}
                    rx="3"
                    fill="none"
                    stroke={isHighlight ? '#ffffff' : primaryStroke}
                    strokeWidth="0.4"
                    opacity="0.18"
                  />
                  <line x1={node.x - w/2 + 4} y1={node.y - h/2 + 4} x2={node.x - w/2 + 4} y2={node.y + h/2 - 4} stroke={isHighlight ? '#ffffff' : primaryStroke} strokeWidth="0.8" strokeDasharray="1 1" opacity="0.4" />
                  <line x1={node.x + w/2 - 4} y1={node.y - h/2 + 4} x2={node.x + w/2 - 4} y2={node.y + h/2 - 4} stroke={isHighlight ? '#ffffff' : primaryStroke} strokeWidth="0.8" strokeDasharray="1 1" opacity="0.4" />
                </g>
              )}

              {/* Target / Output Node */}
              {shapeType === 'target' && (
                <g style={{ filter: glowFilter }}>
                  <rect
                    x={node.x - w / 2}
                    y={node.y - h / 2}
                    width={w}
                    height={h}
                    rx="10"
                    fill={fillUrl}
                    stroke={primaryStroke}
                    strokeWidth={strokeWidth}
                  />
                  <rect
                    x={node.x - w / 2 + 3}
                    y={node.y - h / 2 + 3}
                    width={w - 6}
                    height={h - 6}
                    rx="7"
                    fill="none"
                    stroke={isHighlight ? '#ffffff' : primaryStroke}
                    strokeWidth="0.8"
                    strokeDasharray="3 2"
                    opacity="0.4"
                  />
                </g>
              )}

              {/* Delta shape (Triangle) */}
              {shapeType === 'delta' && (
                <polygon
                  points={`${node.x},${node.y - h/2 - 2} ${node.x + w/2 + 4},${node.y + h/2 + 2} ${node.x - w/2 - 4},${node.y + h/2 + 2}`}
                  fill={fillUrl}
                  stroke={primaryStroke}
                  strokeWidth={strokeWidth}
                  style={{ filter: glowFilter }}
                />
              )}

              {renderNodeText(node.label, node.x, node.y, isHighlight, w - 8, h - 8)}
            </g>
          );
        })}
      </>
    );
  };

  // --- 2. TREE CANVAS RENDERING ---
  const renderTreeCanvas = () => {
    const nodes = spec.nodes;
    const leafNodes = nodes.filter(n => !n.highlight);
    const rootNode = nodes.find(n => n.highlight) || nodes[0];

    const rx = width / 2;
    const ry = 36;
    const leafW = 88;
    const leafH = 36;
    const rootW = 108;
    const rootH = 42;

    const leavesCoords = leafNodes.map((node, i) => {
      const spacing = leafNodes.length > 1 ? (width - 110) / (leafNodes.length - 1) : 0;
      const x = leafNodes.length > 1 ? 55 + i * spacing : rx;
      return { ...node, x, y: 136 };
    });

    return (
      <>
        {/* Animated Tree Branches */}
        <g fill="none">
          {leavesCoords.map((leaf, idx) => {
            const pathD = `M ${rx} ${ry + rootH / 2} C ${rx} ${ry + rootH / 2 + 30}, ${leaf.x} ${leaf.y - leafH / 2 - 30}, ${leaf.x} ${leaf.y - leafH / 2}`;
            return (
              <g key={idx}>
                <path
                  id={`${uid}-tree-edge-${idx}`}
                  d={pathD}
                  stroke={primaryStroke}
                  strokeWidth="1.2"
                  opacity="0.32"
                  strokeDasharray="4 3"
                />
                
                {/* Floating branch flow dot */}
                <circle r="2.2" fill={primaryStroke} opacity="0.8" filter={`url(#${uid}-glow)`}>
                  <animateMotion dur="2.6s" repeatCount="indefinite">
                    <mpath href={`#${uid}-tree-edge-${idx}`} />
                  </animateMotion>
                </circle>
              </g>
            );
          })}
        </g>

        {/* Root Node */}
        <g>
          <rect
            x={rx - rootW / 2}
            y={ry - rootH / 2}
            width={rootW}
            height={rootH}
            rx="8"
            fill={`url(#${uid}-grad-highlight)`}
            stroke={primaryStroke}
            strokeWidth="1.8"
            style={{ filter: `url(#${uid}-glow)` }}
          />
          {renderNodeText(rootNode.label, rx, ry, true, rootW, rootH)}
        </g>

        {/* Leaf Nodes */}
        {leavesCoords.map((leaf) => (
          <g key={leaf.id}>
            <rect
              x={leaf.x - leafW / 2}
              y={leaf.y - leafH / 2}
              width={leafW}
              height={leafH}
              rx="6"
              fill={`url(#${uid}-grad-node)`}
              stroke={primaryStroke}
              strokeWidth="1.2"
            />
            {/* Subtle inner double border decoration */}
            <rect
              x={leaf.x - leafW / 2 + 2}
              y={leaf.y - leafH / 2 + 2}
              width={leafW - 4}
              height={leafH - 4}
              rx="4"
              fill="none"
              stroke={primaryStroke}
              strokeWidth="0.4"
              opacity="0.15"
            />
            {renderNodeText(leaf.label, leaf.x, leaf.y, false, leafW, leafH)}
          </g>
        ))}
      </>
    );
  };

  // --- 4. LAYERED CANVAS RENDERING (Spatial Levels Nested Funnel) ---
  const renderLayeredCanvas = () => {
    const nodes = spec.nodes.slice(0, 3);
    const count = nodes.length;
    const marginX = 28;
    const stratW = width - marginX * 2 - 26;
    const gapY = 8;
    const stratH = (height - 32 - gapY * (count - 1)) / count;

    const layerCoords = nodes.map((layer, idx) => {
      const y = idx * (stratH + gapY);
      const w = stratW * (1 - idx * 0.18);
      const x = (stratW - w) / 2;
      return { ...layer, x, y, w };
    });

    return (
      <g transform={`translate(${marginX}, 14)`}>
        {/* Draw Funnel wireframe connectors */}
        <g stroke={primaryStroke} strokeWidth="1.2" strokeDasharray="3 3" opacity="0.32" fill="none">
          {layerCoords.slice(0, -1).map((current, idx) => {
            const next = layerCoords[idx + 1];
            return (
              <g key={`lines-${idx}`}>
                <line x1={current.x} y1={current.y + stratH} x2={next.x} y2={next.y} />
                <line x1={current.x + current.w} y1={current.y + stratH} x2={next.x + next.w} y2={next.y} />
              </g>
            );
          })}
        </g>

        {/* Nested Scales/Layers */}
        {layerCoords.map((layer, idx) => {
          const isHighlight = layer.highlight;
          const fillUrl = isHighlight ? `url(#${uid}-grad-highlight)` : `url(#${uid}-grad-node)`;
          const strokeWidth = isHighlight ? 1.8 : 1.2;

          return (
            <g key={layer.id}>
              {/* Monospace Level Identifier */}
              <text 
                x={layer.x - 8} 
                y={layer.y + stratH / 2 + 2.5} 
                textAnchor="end" 
                fontSize="6.5" 
                fontFamily="var(--font-mono)" 
                fill={theme.textColor} 
                opacity="0.65"
                fontWeight="bold"
                letterSpacing="0.5"
              >
                {`LVL 0${idx + 1}`}
              </text>

              <rect
                x={layer.x}
                y={layer.y}
                width={layer.w}
                height={stratH}
                rx="6"
                fill={fillUrl}
                stroke={primaryStroke}
                strokeWidth={strokeWidth}
                style={{ filter: isHighlight ? `url(#${uid}-glow)` : 'none' }}
              />

              <g transform={`translate(${layer.x + layer.w / 2}, ${layer.y + stratH / 2})`}>
                {renderNodeText(layer.label, 0, 0, !!isHighlight, layer.w - 16, stratH)}
              </g>

              {/* Glowing highlight anchor arrow */}
              {isHighlight && (
                <g transform={`translate(${layer.x + layer.w + 8}, ${layer.y + stratH / 2 - 5})`} fill={primaryStroke} style={{ filter: `url(#${uid}-glow)` }}>
                  <polygon points="0,5 9,0 9,10" />
                  <line x1="9" y1="5" x2="18" y2="5" stroke={primaryStroke} strokeWidth="2" />
                </g>
              )}
            </g>
          );
        })}
      </g>
    );
  };
  const renderMathCanvas = () => {
    const eq = spec.equation || '‖f(x) - f*(x)‖ ≤ ε';
    const displayTitle = spec.title || 'Theoretical Invariant';
    const { lines, fontSize } = fitLabel(eq, 240, 40);

    return (
      <>
        <g stroke={primaryStroke} strokeWidth="1.2" fill="none" opacity="0.2">
          <circle cx={width / 2} cy={height / 2} r="50" />
          <circle cx={width / 2} cy={height / 2} r="30" strokeDasharray="3 3" />
          <line x1={width / 2 - 90} y1={height / 2} x2={width / 2 + 90} y2={height / 2} />
          <line x1={width / 2} y1={height / 2 - 55} x2={width / 2} y2={height / 2 + 55} />
        </g>

        <rect
          x={width / 2 - 125}
          y={height / 2 - 30}
          width="250"
          height="60"
          rx="12"
          fill="#ffffff"
          stroke={primaryStroke}
          strokeWidth="2.2"
          style={{ filter: `drop-shadow(0 2px 6px rgba(${theme.glowColor}, 0.1))` }}
        />
        <text
          x={width / 2}
          y={height / 2 - 12}
          textAnchor="middle"
          fontSize="8"
          fontFamily="var(--font-mono)"
          fontWeight="bold"
          fill={primaryStroke}
          opacity="0.8"
          letterSpacing="0.8"
        >
          {displayTitle.toUpperCase()}
        </text>
        <text x={width / 2} y={height / 2 + 10} textAnchor="middle" fontSize={fontSize + 3} fontFamily="var(--font-mono)" fontWeight="bold" fill={primaryStroke}>
          {lines.map((line, i) => (
            <tspan key={i} x={width / 2} dy={i === 0 ? 0 : fontSize + 6}>{line}</tspan>
          ))}
        </text>
      </>
    );
  };

  // --- DYNAMIC FORMAT SWITCHER ---
  const isPullQuote = spec.primitive === 'pull_quote';

  // Helper styles injector
  const renderFormatStyles = () => (
    <style>{`
      .hero-format-card {
        width: 100%;
        height: 100%;
        position: relative;
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
        padding: 16px 20px;
        overflow: hidden;
      }

      /* 4. Editorial Pull Quote styling */
      .pull-quote-card {
        justify-content: center;
        align-items: center;
        text-align: center;
        padding: 24px;
      }
      .pull-quote-quote-text {
        font-family: var(--font-display);
        font-size: 0.94rem;
        font-weight: 700;
        color: #1c1b18; /* Warm Charcoal Ink */
        line-height: 1.5;
        margin-bottom: 12px;
        max-width: 360px;
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .pull-quote-attribution {
        font-family: var(--font-mono);
        font-size: 0.64rem;
        font-weight: 700;
        color: #828076; /* Warm Gray/Stone */
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }

      /* 1. Stat Delta Barometer / 2D Bar Chart styling */
      .barometer-card {
        justify-content: space-between;
      }
      .barometer-title-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .barometer-title {
        font-family: var(--font-mono);
        font-size: 0.64rem;
        font-weight: 700;
        color: #828076;
        letter-spacing: 0.05em;
      }
      .barometer-rows {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 6px;
        margin-bottom: 6px;
      }
      .barometer-item {
        display: flex;
        flex-direction: column;
        gap: 3px;
      }
      .barometer-meta {
        display: flex;
        justify-content: space-between;
        font-size: 0.76rem;
        font-family: var(--font-sans);
      }
      .barometer-label {
        font-weight: 700;
        color: #1c1b18;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 280px;
      }
      .barometer-val {
        font-family: var(--font-mono);
        color: #828076;
        font-weight: 700;
      }
      .barometer-track {
        height: 6px;
        background: rgba(9, 9, 11, 0.03);
        border-radius: 99px;
        overflow: hidden;
        border: 1px solid rgba(9, 9, 11, 0.06);
      }
      .barometer-fill {
        height: 100%;
        border-radius: 99px;
        transition: width 0.5s ease;
      }
      .barometer-footer {
        display: flex;
        align-items: center;
        gap: 8px;
        font-family: var(--font-mono);
        font-size: 0.64rem;
        border-top: 1px dashed rgba(9, 9, 11, 0.08);
        padding-top: 6px;
      }
      .barometer-footer-metric {
        font-weight: 800;
      }
      .barometer-footer-text {
        color: #828076;
      }

      /* 3. Math Card styling */
      .math-proof-card {
        justify-content: space-between;
        align-items: center;
      }
      .math-proof-eq {
        font-family: var(--font-mono);
        font-size: 1.1rem;
        font-weight: 700;
        text-align: center;
        margin-top: 12px;
        margin-bottom: 12px;
        letter-spacing: -0.02em;
        color: #1c1b18;
        max-width: 360px;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .math-proof-legend {
        width: 100%;
        border-top: 1px dashed rgba(9, 9, 11, 0.08);
        padding-top: 8px;
      }
      .legend-label {
        font-family: var(--font-mono);
        font-size: 0.58rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        margin-bottom: 6px;
      }
      .legend-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 4px;
      }
      .legend-item {
        display: flex;
        gap: 4px;
        font-size: 0.68rem;
        line-height: 1.2;
      }
      .legend-symbol {
        font-family: var(--font-mono);
        font-weight: 700;
      }
      .legend-text {
        color: #4a4843;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .math-frac {
        display: inline-flex;
        flex-direction: column;
        vertical-align: middle;
        text-align: center;
        padding: 0 4px;
      }
      .math-num {
        border-bottom: 1.5px solid #1c1b18;
        padding-bottom: 1px;
        font-size: 0.85em;
      }
      .math-den {
        padding-top: 1px;
        font-size: 0.85em;
      }

      /* 6. Stat & Odds Card styling */
      .stat-odds-card {
        justify-content: space-between;
        align-items: flex-start;
      }
      .stat-odds-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
      }
      .stat-odds-badge {
        font-family: var(--font-mono);
        font-size: 0.58rem;
        font-weight: 800;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        border: 1px solid currentColor;
        padding: 2px 6px;
        border-radius: 4px;
      }
      .stat-odds-body {
        display: flex;
        align-items: center;
        gap: 24px;
        width: 100%;
        margin-top: 4px;
        margin-bottom: 4px;
      }
      .stat-odds-hero-val {
        font-family: var(--font-display);
        font-size: 3.8rem;
        font-weight: 800;
        line-height: 1;
        letter-spacing: -0.05em;
      }
      .stat-odds-meta {
        display: flex;
        flex-direction: column;
        gap: 4px;
        flex: 1;
      }
      .stat-odds-lbl {
        font-family: var(--font-mono);
        font-size: 0.6rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .stat-odds-text {
        font-size: 0.8rem;
        color: var(--text-secondary);
        line-height: 1.4;
      }

      /* 7. Timeline Card styling */
      .timeline-card {
        justify-content: flex-start;
        gap: 8px;
      }
      .timeline-title-row {
        display: flex;
        align-items: center;
      }
      .timeline-badge {
        font-family: var(--font-mono);
        font-size: 0.64rem;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }
      .timeline-container {
        position: relative;
        padding-left: 20px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-top: 4px;
        flex: 1;
      }
      .timeline-line {
        position: absolute;
        left: 5px;
        top: 6px;
        bottom: 6px;
        width: 1px;
        border-left: 1.5px dashed var(--border-glass-bright);
      }
      .timeline-node {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .timeline-dot {
        position: absolute;
        left: -20px;
        top: 3px;
        width: 11px;
        height: 11px;
        border-radius: 50%;
        background: #ebe2d0;
        border: 2px solid var(--bg-darkest);
        box-sizing: border-box;
      }
      .timeline-dot.highlight {
        background: var(--color-primary);
        box-shadow: 0 0 8px var(--color-primary);
      }
      .timeline-node-header {
        font-family: var(--font-mono);
        font-size: 0.58rem;
        font-weight: 800;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .timeline-node-body {
        font-size: 0.72rem;
        line-height: 1.4;
        color: var(--text-secondary);
      }
    `}</style>
  );

  // 4. Editorial Pull Quote Format
  if (isPullQuote) {
    return (
      <div className="hero-format-card pull-quote-card" style={{ background: bgFill }}>
        {renderFormatStyles()}
        {renderBackgroundGridCSS()}
        <div className="pull-quote-quote-text">
          “{paper.coreIdea || paper.purpose || paper.title}”
        </div>
        <div className="pull-quote-attribution">
          — Core Takeaway // {title}
        </div>
      </div>
    );
  }

  // 6. Stat & Odds Callout Card Format
  if (spec.primitive === 'stat_odds') {
    const callout = spec.statCallout || { metric: '95%', label: 'EFFICACY', text: 'Conferred high protection' };
    return (
      <div className="hero-format-card stat-odds-card" style={{ background: bgFill }}>
        {renderFormatStyles()}
        {renderBackgroundGridCSS()}
        <div className="stat-odds-header">
          <span className="stat-odds-badge" style={{ borderColor: primaryStroke, color: primaryStroke }}>{spec.canvas.badge}</span>
        </div>
        <div className="stat-odds-body">
          <div className="stat-odds-hero-val" style={{ color: primaryStroke, textShadow: `0 2px 10px rgba(${theme.glowColor}, 0.12)` }}>
            {callout.metric}
          </div>
          <div className="stat-odds-meta">
            <div className="stat-odds-lbl" style={{ color: primaryStroke }}>{callout.label}</div>
            <p className="stat-odds-text">{callout.text}</p>
          </div>
        </div>
      </div>
    );
  }

  // 7. Timeline & Evolution Card Format (Vertical layout to avoid horizontal overflow)
  if (spec.primitive === 'timeline_evolution') {
    const timeline = spec.timeline || { pastEra: 'PAST', pastConcept: 'Legacy belief', breakthroughEra: 'TODAY', breakthroughConcept: 'New paradigm' };
    return (
      <div className="hero-format-card timeline-card" style={{ background: bgFill }}>
        {renderFormatStyles()}
        {renderBackgroundGridCSS()}
        <div className="timeline-title-row">
          <span className="timeline-badge" style={{ color: primaryStroke }}>{spec.title.toUpperCase()}</span>
        </div>
        <div className="timeline-container">
          <div className="timeline-line" style={{ borderLeftColor: primaryStroke, opacity: 0.25 }} />
          
          <div className="timeline-node">
            <div className="timeline-dot" style={{ borderColor: bgFill }} />
            <div className="timeline-node-header" style={{ color: '#828076' }}>{timeline.pastEra}</div>
            <p className="timeline-node-body">{timeline.pastConcept}</p>
          </div>

          <div className="timeline-node highlight">
            <div className="timeline-dot highlight" style={{ background: primaryStroke, borderColor: bgFill, boxShadow: `0 0 6px rgba(${theme.glowColor}, 0.3)` }} />
            <div className="timeline-node-header" style={{ color: primaryStroke }}>{timeline.breakthroughEra}</div>
            <p className="timeline-node-body" style={{ fontWeight: 600, color: '#1c1b18' }}>{timeline.breakthroughConcept}</p>
          </div>
        </div>
      </div>
    );
  }

  // 1. Interactive "Stat Delta" Barometer / 2D Horizontal Bar Chart Format
  if (spec.primitive === 'comparison_delta') {
    const nodes = spec.nodes;
    const callout = spec.deltaCallout;

    // Helper to extract values
    const parseValue = (n: any): number => {
      const match = n.subtext?.match(/-?\d+(\.\d+)?/);
      return match ? parseFloat(match[0]) : n.highlight ? 92.4 : 68.0;
    };
    const values = nodes.map(parseValue);
    const maxVal = 100;

    // Grid Mapping coords
    const minX = 130;
    const maxX = 390;
    const scaleVal = (val: number) => {
      const pct = val / 100;
      return minX + pct * (maxX - minX);
    };

    return (
      <div className="hero-format-card barometer-card" style={{ background: bgFill }}>
        {renderFormatStyles()}
        {renderBackgroundGridCSS()}
        <div className="barometer-title-row">
          <span className="barometer-title">{spec.title.toUpperCase()}</span>
        </div>

        {/* 2D Vector Bar Chart Canvas */}
        <div style={{ flex: 1, position: 'relative', marginTop: '6px', marginBottom: '6px' }}>
          <svg width="100%" height="100%" viewBox="0 0 440 100" style={{ background: 'transparent' }}>
            {/* Grid Line Ticks */}
            {[0, 25, 50, 75, 100].map((tick) => (
              <g key={tick}>
                <line 
                  x1={scaleVal(tick)} 
                  y1="10" 
                  x2={scaleVal(tick)} 
                  y2="75" 
                  stroke="rgba(9, 9, 11, 0.05)" 
                  strokeDasharray="2 2" 
                />
                <text 
                  x={scaleVal(tick)} 
                  y="86" 
                  textAnchor="middle" 
                  fontSize="6.5" 
                  fontFamily="var(--font-mono)" 
                  fill="#828076"
                >
                  {tick}%
                </text>
              </g>
            ))}

            {/* Render 2D Bars */}
            {nodes.map((node: any, idx: number) => {
              const y = idx === 0 ? 18 : 46;
              const val = values[idx];
              const barW = (val / 100) * (maxX - minX);
              const isHighlight = !!node.highlight;
              
              const barFill = isHighlight ? primaryStroke : '#ffffff';
              const strokeColor = primaryStroke;
              const textFill = isHighlight ? '#1c1b18' : primaryStroke;

              return (
                <g key={node.id}>
                  {/* Label Text */}
                  <text 
                    x="10" 
                    y={y + 11} 
                    fontSize="7.5" 
                    fontFamily="var(--font-sans)" 
                    fontWeight="bold" 
                    fill={isHighlight ? primaryStroke : '#828076'}
                  >
                    {node.label.length > 22 ? node.label.slice(0, 20) + '…' : node.label}
                  </text>

                  {/* Axis line behind bars */}
                  <line x1={minX} y1="10" x2={minX} y2="75" stroke={primaryStroke} strokeWidth="1" opacity="0.3" />

                  {/* 2D Bar Rect */}
                  <rect 
                    x={minX} 
                    y={y} 
                    width={barW} 
                    height={16} 
                    rx="3" 
                    fill={barFill} 
                    stroke={strokeColor} 
                    strokeWidth="1.2"
                    style={{ filter: isHighlight ? `drop-shadow(0 2px 4px rgba(${theme.glowColor}, 0.12))` : 'none' }}
                  />

                  {/* Value callout inside/next to bar */}
                  <text 
                    x={minX + barW + 8} 
                    y={y + 11} 
                    fontSize="7.5" 
                    fontFamily="var(--font-mono)" 
                    fontWeight="bold" 
                    fill={isHighlight ? primaryStroke : '#828076'}
                  >
                    {val}%
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {callout && (
          <div className="barometer-footer">
            <span className="barometer-footer-metric" style={{ color: primaryStroke }}>{callout.metric}</span>
            <span className="barometer-footer-text">{callout.comparisonText}</span>
          </div>
        )}
      </div>
    );
  }

  // 3. Typographic Macro "Proof Card" Format
  if (spec.primitive === 'math_blueprint') {
    const eq = spec.equation || '‖f(x) - f*(x)‖ ≤ ε';
    return (
      <div className="hero-format-card math-proof-card" style={{ background: bgFill }}>
        {renderFormatStyles()}
        {renderBackgroundGridCSS()}
        <div className="math-proof-eq">
          {formatEquationToHtml(eq)}
        </div>
        <div className="math-proof-legend">
          <div className="legend-label" style={{ color: primaryStroke }}>VARIABLE LEGEND // FORMAL NOTATION</div>
          <div className="legend-grid">
            {spec.nodes?.slice(0, 4).map((n: any, idx: number) => (
              <div key={idx} className="legend-item">
                <span className="legend-symbol" style={{ color: primaryStroke }}>{n.id.toUpperCase()}</span>
                <span className="legend-text">{n.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 2. Procedural SVG Canvas Format (Pipeline, Tree, Layers)
  return (
    <div className="hero-format-card svg-canvas-card" style={{ background: bgFill, position: 'relative' }}>
      {renderFormatStyles()}
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} style={{ background: 'transparent' }}>
        {renderDefs()}
        <rect width="100%" height="100%" fill={`url(#${activePatternId})`} />

        {spec.primitive === 'pipeline' && renderPipelineCanvas()}
        {spec.primitive === 'tree' && renderTreeCanvas()}
        {spec.primitive === 'spatial_layers' && renderLayeredCanvas()}
        {spec.primitive === 'math_blueprint' && renderMathCanvas()}
      </svg>
    </div>
  );
};