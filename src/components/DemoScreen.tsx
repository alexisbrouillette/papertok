import React, { useState, useEffect } from 'react';
import { SemanticZoomDrawer, type ZoomData } from './SemanticZoomDrawer';
import { ArrowLeft, Layers, Sparkles, Binary, Award, LineChart } from 'lucide-react';

interface MockPaper {
  id: string;
  category: 'methodology' | 'empirical_study' | 'theoretical' | 'review_survey';
  categoryLabel: string;
  title: string;
  authors: string;
  year: number;
  citationCount: number;
  venue: string;
  abstract: string;
  teaserVerdict: string;
  zoomData: ZoomData;
}

const MOCK_PAPERS: MockPaper[] = [
  {
    id: 'methodology-1',
    category: 'methodology',
    categoryLabel: '⚙️ Methodology: System & Equation Decoder',
    title: 'Generative Adversarial Nets',
    authors: 'Ian Goodfellow, Jean Pouget-Abadie, Mehdi Mirza, Bing Xu, David Warde-Farley, Sherjil Ozair, Aaron Courville, Yoshua Bengio',
    year: 2014,
    citationCount: 48291,
    venue: 'NeurIPS 2014',
    abstract: 'We propose a new framework for estimating generative models via an adversarial process, in which we simultaneously train two models: a generative model G that captures the data distribution, and a discriminative model D that estimates the probability that a sample came from the training data rather than G.',
    teaserVerdict: 'Optimizes a minimax game between Generator and Discriminator.',
    zoomData: {
      rawFormula: '\\min_{G} \\max_{D} V(D, G) = \\mathbb{E}_{x \\sim p_{data}(x)}[\\log D(x)] + \\mathbb{E}_{z \\sim p_z(z)}[\\log(1 - D(G(z)))]',
      translation: 'Train the discriminator D to maximize accuracy in separating real from fake samples, while generator G is trained to minimize the likelihood that D detects its outputs as fake.',
      terms: [
        {
          symbol: '\\min_{G}',
          definition: "Minimize G: The generator G's objective to minimize the probability that the discriminator detects its fakes.",
          deepDive: "G aims to reduce the value function, forcing log(1 - D(G(z))) to be as small as possible.",
          subDefinitions: [
            { term: "min", definition: "Minimization operator, indicating the objective is to find parameters that yield the lowest output value." },
            { term: "G", definition: "The Generator network, parameterized to synthesize realistic fake samples from noise inputs." }
          ]
        },
        {
          symbol: '\\max_{D}',
          definition: "Maximize D: The discriminator D's objective to maximize correct labeling of both real and generated fakes.",
          deepDive: "D aims to maximize the value function, getting log D(x) and log(1 - D(G(z))) close to 0.",
          subDefinitions: [
            { term: "max", definition: "Maximization operator, indicating the objective is to find parameters that yield the highest output value." },
            { term: "D", definition: "The Discriminator network, parameterized to classify inputs as either real or synthetic fake." }
          ]
        },
        {
          symbol: 'V(D, G)',
          definition: "The value function of the minimax game representing the binary cross-entropy loss.",
          deepDive: "Optimizing this function yields a Nash Equilibrium where the generator replicates real data and the discriminator predicts 0.5.",
          subDefinitions: [
            { term: "V", definition: "Value function (or utility function) defining the zero-sum objective game played between the two networks." },
            { term: "D", definition: "The Discriminator model classifier." },
            { term: "G", definition: "The Generator model synthesiser." }
          ]
        },
        {
          symbol: '\\mathbb{E}_{x \\sim p_{data}(x)}',
          definition: "Expected value (average probability) calculated over the real training dataset.",
          deepDive: "Measures the discriminator's average performance on genuine samples drawn from the training distribution.",
          subDefinitions: [
            { term: "𝔼_x", definition: "Expected value (average) calculated over variable x" },
            { term: "p_data(x)", definition: "Probability distribution of the real training dataset" },
            { term: "x", definition: "An individual real sample (e.g. an image) drawn from the training data" }
          ]
        },
        {
          symbol: '\\mathbb{E}_{z \\sim p_z(z)}',
          definition: "Expected value calculated over the generator's random noise inputs.",
          deepDive: "Computes average discriminator response over synthetic images generated from the noise space.",
          subDefinitions: [
            { term: "𝔼_z", definition: "Expected value (average) calculated over random noise z" },
            { term: "p_z(z)", definition: "Probability distribution of the latent noise space" },
            { term: "z", definition: "A low-dimensional latent noise vector (random seed) input to G" }
          ]
        },
        {
          symbol: '\\log(1 - D(G(z)))',
          definition: "The log-probability that the discriminator correctly identifies a generated sample as fake.",
          deepDive: "The generator G wants this value to go to negative infinity, which means D(G(z)) goes to 1.",
          subDefinitions: [
            { term: "log", definition: "Natural logarithm operator, transforming probability outputs into stable additive gradients for optimization." },
            { term: "1 - D(G(z))", definition: "The probability that the discriminator predicts the generated sample G(z) is fake (1 minus the probability it thinks it is real)." },
            { term: "D", definition: "The Discriminator neural network, evaluating whether a sample is real (outputs close to 1) or synthetic (outputs close to 0)." },
            { term: "G", definition: "The Generator neural network, mapping random noise seeds to synthesized high-dimensional samples." },
            { term: "z", definition: "The latent noise vector input to G, representing the random seed configuration." }
          ]
        },
        {
          symbol: '\\log D(x)',
          definition: "The logarithmic likelihood that the discriminator correctly identifies a real sample.",
          deepDive: "Using the logarithm transforms probability multiplication into addition, stabilizing gradients during backpropagation.",
          subDefinitions: [
            { term: "log", definition: "Natural logarithm operator, resolving diminishing gradient issues during training updates." },
            { term: "D(x)", definition: "Discriminator probability prediction that real training sample x is genuine." },
            { term: "x", definition: "The individual training sample drawn from the real data distribution." }
          ]
        },
        {
          symbol: 'D(G(z))',
          definition: "The discriminator's probability output for the generator's fake sample G(z).",
          deepDive: "A value of 1.0 means D was completely fooled; 0.5 means D is guessing randomly.",
          subDefinitions: [
            { term: "D", definition: "The Discriminator network, evaluating real vs fake inputs." },
            { term: "G(z)", definition: "The synthesized data sample outputted by Generator G from input z." },
            { term: "G", definition: "The Generator network, learning to synthesize realistic inputs." },
            { term: "z", definition: "The low-dimensional latent space noise input vector." }
          ]
        },
        {
          symbol: 'D(x)',
          definition: "The probability outputted by the discriminator that the real data sample x is genuine (close to 1 if real, 0 if fake).",
          deepDive: "The discriminator is a neural network binary classifier mapping inputs to scalar probabilities.",
          subDefinitions: [
            { term: "D", definition: "The Discriminator neural network classifier." },
            { term: "x", definition: "A real data sample drawn from the training dataset distribution." }
          ]
        },
        {
          symbol: 'G(z)',
          definition: "The fake sample synthesized by generator G from a random noise vector z.",
          deepDive: "The generator learns a differentiable mapping from latent space to the high-dimensional data distribution.",
          subDefinitions: [
            { term: "G", definition: "The Generator neural network mapping function." },
            { term: "z", definition: "Random noise vector seed representing the latent space position." }
          ]
        }
      ]
    }
  },
  {
    id: 'empirical-1',
    category: 'empirical_study',
    categoryLabel: '📊 Empirical Study: Setup & Trend Decoder',
    title: 'Tirzepatide once weekly for the treatment of obesity',
    authors: 'Ania M. Jastreboff, Louis J. Aronne, Ruizan Ahmad, Juan P. Frias, Xiaomei Gu, Wenyu Ye',
    year: 2022,
    citationCount: 840,
    venue: 'New England Journal of Medicine (NEJM)',
    abstract: 'Obesity is a chronic disease that requires effective long-term management. Tirzepatide is a novel once-weekly GIP and GLP-1 receptor agonist. In this phase 3 trial, we evaluated the efficacy and safety of weekly tirzepatide compared to placebo in adults with obesity.',
    teaserVerdict: 'weekly tirzepatide led to a mean body-weight reduction of 20.9% over 72 weeks.',
    zoomData: {
      verdict: 'Weekly Tirzepatide achieves up to 20.9% body weight reduction in adults with obesity.',
      metrics: [
        {
          category: 'Efficacy Outcomes',
          label: 'Weight Loss (Placebo)',
          rawValue: '3.1%',
          explanation: 'Mean body weight reduction in control group patients receiving weekly placebo injections alongside lifestyle intervention.',
          cohortContext: 'Serves as the baseline comparator proving drug-specific efficacy (p < 0.001 delta for all treatment arms).'
        },
        {
          category: 'Efficacy Outcomes',
          label: 'Weight Loss (5mg)',
          rawValue: '15.0%',
          explanation: 'Mean percentage weight change from baseline at week 72 for patients taking the starting 5mg dose.',
          cohortContext: 'Targeted a subgroup of n = 630 randomized patients, demonstrating significant low-dose therapeutic efficacy.'
        },
        {
          category: 'Efficacy Outcomes',
          label: 'Weight Loss (10mg)',
          rawValue: '19.5%',
          explanation: 'Mean percentage weight change from baseline at week 72 for patients taking the intermediate 10mg dose.',
          cohortContext: 'Demonstrated intermediate dose-response efficacy in a cohort of 636 randomized subjects.'
        },
        {
          category: 'Efficacy Outcomes',
          label: 'Weight Loss (15mg)',
          rawValue: '20.9%',
          explanation: 'Mean percentage weight change from baseline at week 72 for patients taking the maximum 15mg dose.',
          cohortContext: 'High-dose cohort of 630 subjects showing near-maximum clinical efficacy and therapeutic response.'
        },
        {
          category: 'Study Parameters',
          label: 'Baseline Weight',
          rawValue: '104.8 kg',
          explanation: 'Average body weight of randomized trial participants at day 1 of the study.',
          cohortContext: 'Reflected a heavily obese clinical cohort with a baseline body-mass index (BMI) averaging 38.0.'
        },
        {
          category: 'Study Parameters',
          label: 'Trial Duration',
          rawValue: '72 weeks',
          explanation: 'Total active maintenance and double-blind treatment period evaluated in the clinical study.',
          cohortContext: 'Allows assessment of long-term weight reduction curves, plateaus, and safety/tolerability profiles.'
        },
        {
          category: 'Study Parameters',
          label: 'Sample Size (n)',
          rawValue: '2539 patients',
          explanation: 'Total number of randomized patients enrolled across international multi-center sites.',
          cohortContext: 'Assigned in a 1:1:1:1 ratio to receive 5 mg, 10 mg, or 15 mg of tirzepatide or placebo weekly.'
        }
      ]
    }
  },
  {
    id: 'theoretical-1',
    category: 'theoretical',
    categoryLabel: '📐 Theoretical: Theorem & Proof Step Decoder',
    title: 'On the Convergence of Gradient Descent for Deep Linear Networks',
    authors: 'Sanjeev Arora, Nadav Cohen, Noah Golowich, Wei Hu',
    year: 2018,
    citationCount: 310,
    venue: 'ICML 2018',
    abstract: 'Deep linear networks provide an elegant mathematical sandbox for studying deep learning optimization. We prove that under mild initialization conditions, gradient descent is guaranteed to converge to the global minimum, establishing geometric convergence rates.',
    teaserVerdict: 'Proves global convergence bounds for deep linear networks under gradient descent.',
    zoomData: {
      promise: 'Guarantees that gradient descent converges to a global minimum geometrically fast for deep linear networks.',
      steps: [
        {
          stepLabel: 'Characterize dynamical trajectory',
          inequalityUsed: '\\frac{d}{dt} W_j^T W_j = \\frac{d}{dt} W_{j+1} W_{j+1}^T',
          explanation: 'Establishes that the weight matrices of different layers remain balanced and dynamic paths are tightly coupled.',
          deepDive: 'This invariant arises because gradient descent updates respect the matrix transpose invariants of linear layers.'
        },
        {
          stepLabel: 'Establish strict saddle property',
          explanation: 'Shows that all saddle points are strict, meaning they have directions of negative curvature where gradient updates can escape.',
          deepDive: 'Uses Hessian eigenvalues to prove the absence of degenerate saddle points.'
        },
        {
          stepLabel: 'Convergence to global minimum',
          inequalityUsed: 'f(W(t)) - f^* \\le e^{-c t}(f(W(0)) - f^*)',
          explanation: 'Leverages the trajectory invariants and saddle property to prove error decays exponentially over iterations.',
          deepDive: 'Requires bounding step sizes using Lipschitz constants of the gradient mapping.'
        }
      ]
    }
  },
  {
    id: 'review-1',
    category: 'review_survey',
    categoryLabel: '📚 Review / Survey: Taxonomy & Gap Decoder',
    title: 'Self-Supervised Learning: Generative vs Contrastive Taxonomy',
    authors: 'Lilian Weng',
    year: 2021,
    citationCount: 450,
    venue: 'Lil\'Log Academic Surveys',
    abstract: 'Self-supervised learning allows neural networks to learn representations without human-labeled datasets. This survey categorizes the state of the art into generative models (which reconstruct input pixels) and contrastive models (which pull matching representations together).',
    teaserVerdict: 'Maps out generative vs contrastive paradigms, defining current computational limits.',
    zoomData: {
      summary: 'Self-supervised learning trains representation networks without human labels by defining pretext tasks.',
      subcategories: [
        {
          name: 'Generative Representation',
          approach: 'Autoencoders and Generative Models (e.g. MAE) mask parts of the input and predict missing values.',
          seminalPapers: ['He et al. (MAE, 2021)', 'Devlin et al. (BERT, 2018)']
        },
        {
          name: 'Contrastive Representation',
          approach: 'SimCLR, MoCo feed multiple augmented views of an image and pull matches together while pushing mismatches apart.',
          seminalPapers: ['Chen et al. (SimCLR, 2020)', 'He et al. (MoCo, 2019)']
        }
      ],
      gaps: [
        {
          challenge: 'High Sensitivity to Augmentations',
          reason: 'Contrastive algorithms rely heavily on specific augmentation sets (crop, jitter); wrong choices lead to collapsed representations.'
        },
        {
          challenge: 'OOM / Large Batch Size Dependency',
          reason: 'To find sufficient negative samples, models like SimCLR require massive batch sizes (e.g., 4096), demanding huge GPU cluster budgets.'
        }
      ]
    }
  }
];

interface DemoScreenProps {
  onBack: () => void;
}

export const DemoScreen: React.FC<DemoScreenProps> = ({ onBack }) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activePaper, setActivePaper] = useState<MockPaper | null>(null);

  const [papers, setPapers] = useState<MockPaper[]>(MOCK_PAPERS);
  const [cachedTopics, setCachedTopics] = useState<string[]>([]);
  const [customTopic, setCustomTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  const [progressVal, setProgressVal] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  const fetchTopics = async () => {
    try {
      const token = localStorage.getItem('papertok_token');
      const headers: HeadersInit = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      
      const res = await fetch('/api/digest/topics', { headers });
      if (res.ok) {
        const data = await res.json();
        setCachedTopics(data.topics || []);
      }
    } catch (err) {
      console.error('Failed to fetch cached topics:', err);
    }
  };

  useEffect(() => {
    fetchTopics();
  }, []);

  const loadCachedTopic = async (topic: string) => {
    setLoading(true);
    setProgressMessage(`Loading cached digest for "${topic}"...`);
    try {
      const token = localStorage.getItem('papertok_token');
      const headers: HeadersInit = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      
      const res = await fetch(`/api/digest/history?topic=${encodeURIComponent(topic)}`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.history && data.history.length > 0) {
          const latest = data.history[data.history.length - 1];
          const mappedPapers = latest.papers.map((p: any, idx: number) => {
            const genre = p.explanation?.paperType || 'methodology';
            return {
              id: `real-${idx}`,
              category: genre,
              categoryLabel: genre === 'methodology' ? '⚙️ Methodology: System & Equation Decoder' : genre === 'empirical_study' ? '📊 Empirical Study: Setup & Trend Decoder' : genre === 'theoretical' ? '📐 Theoretical: Theorem & Proof Step Decoder' : '📚 Review / Survey: Taxonomy & Gap Decoder',
              title: p.title,
              authors: p.authors,
              year: p.year,
              citationCount: p.citationCount || 0,
              venue: p.venue || 'ArXiv',
              abstract: p.abstract || 'No abstract available.',
              teaserVerdict: p.teaserVerdict || p.coreIdea || 'Overview description',
              zoomData: p.zoomData || { rawFormula: '', translation: 'No mathematical formula deconstruction.', terms: [] }
            };
          });
          setPapers(mappedPapers);
          setProgressMessage('');
        } else {
          alert('No papers found for this topic.');
        }
      }
    } catch (err) {
      console.error(err);
      alert('Failed to fetch cached digest.');
    } finally {
      setLoading(false);
    }
  };

  const generateNewTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTopic || customTopic.trim() === '') return;
    
    setLoading(true);
    setIsGenerating(true);
    setProgressVal(0);
    setProgressMessage('Enqueuing generation task...');
    
    const token = localStorage.getItem('papertok_token');
    const url = `/api/digest/generate?topic=${encodeURIComponent(customTopic)}&bypassCache=true`;
    
    try {
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

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim().startsWith('data: ')) {
            const jsonStr = line.replace(/^data:\s*/, '').trim();
            if (!jsonStr) continue;

            const data = JSON.parse(jsonStr);
            if (data.error) {
              throw new Error(data.error);
            }
            if (data.progress !== undefined) {
              setProgressVal(data.progress);
              setProgressMessage(data.statusText || 'Generating...');
            }
            if (data.done && data.papers) {
              const mappedPapers = data.papers.map((p: any, idx: number) => {
                const genre = p.explanation?.paperType || 'methodology';
                return {
                  id: `real-${idx}`,
                  category: genre,
                  categoryLabel: genre === 'methodology' ? '⚙️ Methodology: System & Equation Decoder' : genre === 'empirical_study' ? '📊 Empirical Study: Setup & Trend Decoder' : genre === 'theoretical' ? '📐 Theoretical: Theorem & Proof Step Decoder' : '📚 Review / Survey: Taxonomy & Gap Decoder',
                  title: p.title,
                  authors: p.authors,
                  year: p.year,
                  citationCount: p.citationCount || 0,
                  venue: p.venue || 'ArXiv',
                  abstract: p.abstract || 'No abstract available.',
                  teaserVerdict: p.teaserVerdict || p.coreIdea || 'Overview description',
                  zoomData: p.zoomData || { rawFormula: '', translation: 'No mathematical formula deconstruction.', terms: [] }
                };
              });
              setPapers(mappedPapers);
              setLoading(false);
              setIsGenerating(false);
              fetchTopics();
              return;
            }
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      alert(`Generation error: ${err.message || err}`);
      setLoading(false);
      setIsGenerating(false);
    }
  };

  const openZoom = (paper: MockPaper) => {
    setActivePaper(paper);
    setDrawerOpen(true);
  };

  return (
    <div className="demo-screen-container">
      {/* Header */}
      <header className="demo-header glass-panel">
        <button className="back-circle-btn" onClick={onBack} title="Back to Search">
          <ArrowLeft size={18} />
        </button>
        <div className="demo-header-info">
          <h2>✨ Semantic Zoom UI Demo Sandbox</h2>
          <p>Test interactive bottom sheets against hardcoded mock papers or load real AI generated papers!</p>
        </div>
      </header>

      {/* Interactive Generator & Cache Selector */}
      <div className="sandbox-controls-box glass-panel anim-slide-up" style={{ width: '100%', maxWidth: '900px', marginBottom: '20px', padding: '16px', boxSizing: 'border-box' }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 10px 0', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-accent, #482e1d)' }}>
          🧠 Dynamic Live Digest Playground
        </h3>
        
        <form onSubmit={generateNewTopic} className="sandbox-form" style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
          <input 
            type="text" 
            placeholder="Type any scientific topic (e.g. Quantum Computing, CRISPR)..."
            value={customTopic}
            onChange={(e) => setCustomTopic(e.target.value)}
            disabled={loading}
            style={{ flex: 1, borderRadius: '6px', padding: '8px 12px', fontSize: '0.84rem' }}
          />
          <button 
            type="submit" 
            disabled={loading || !customTopic}
            style={{ background: 'linear-gradient(135deg, var(--color-primary, #1b4931), var(--color-secondary, #2d6a4f))', border: 'none', borderRadius: '6px', padding: '8px 16px', color: '#fff', fontWeight: 600, fontSize: '0.84rem', cursor: 'pointer', opacity: (loading || !customTopic) ? 0.6 : 1 }}
          >
            Generate Real Digest
          </button>
        </form>
 
        {/* Cached topics selection list */}
        {cachedTopics.length > 0 && (
          <div className="cached-topics-row" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary, #4a4843)', fontWeight: 600 }}>History Cache:</span>
            {cachedTopics.map((topic, idx) => (
              <button 
                key={idx} 
                className="topic-pill-btn" 
                onClick={() => loadCachedTopic(topic)}
                disabled={loading}
                style={{ borderRadius: '99px', padding: '4px 10px', fontSize: '0.74rem', cursor: 'pointer' }}
              >
                {topic}
              </button>
            ))}
            <button
              onClick={() => { setPapers(MOCK_PAPERS); }}
              className="reset-pill-btn"
              style={{ borderRadius: '99px', padding: '4px 10px', fontSize: '0.74rem', cursor: 'pointer' }}
            >
              Reset to Mock Data
            </button>
          </div>
        )}
 
        {/* Loading Progress indicators */}
        {loading && (
          <div className="sandbox-progress-indicator" style={{ marginTop: '14px', borderTop: '1px solid var(--border-glass, rgba(9, 9, 11, 0.08))', paddingTop: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-primary, #1c1b18)', marginBottom: '6px' }}>
              <span>{progressMessage}</span>
              {isGenerating && <span>{progressVal}%</span>}
            </div>
            {isGenerating && (
              <div style={{ width: '100%', height: '4px', background: 'rgba(9, 9, 11, 0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${progressVal}%`, height: '100%', background: 'linear-gradient(90deg, var(--color-primary, #1b4931), var(--color-secondary, #2d6a4f))', transition: 'width 0.3s ease' }} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Grid list */}
      <div className="demo-scroll-body">
        <div className="demo-cards-list">
          {papers.map((paper) => (
            <div key={paper.id} className="demo-paper-card glass-panel anim-slide-up">
              
              {/* Category Header Badge */}
              <div className="card-badge-header">
                <span className={`paper-type-badge ${paper.category}`}>
                  {paper.categoryLabel}
                </span>
              </div>

              {/* Title & Metadata */}
              <h3 className="paper-title">{paper.title}</h3>
              <div className="paper-authors-year" style={{ margin: '6px 0 12px 0' }}>
                <span className="author-text">{paper.authors}</span>
                <span className="dot-sep">•</span>
                <span className="year-text">{paper.year}</span>
                <span className="dot-sep">•</span>
                <span className="venue-text">{paper.venue}</span>
              </div>

              {/* Abstract */}
              <p className="paper-abstract">
                <strong>Abstract:</strong> {paper.abstract}
              </p>

              {/* Teaser Highlight Box */}
              <div className="teaser-highlight-box">
                <div className="teaser-icon-title">
                  <Sparkles size={14} className="spark-icon" />
                  <span>Interactive Highlights</span>
                </div>
                <p className="teaser-text">{paper.teaserVerdict}</p>
              </div>

              {/* Action Buttons to open Zoom Drawer */}
              <div className="card-actions-row">
                <button 
                  className={`zoom-trigger-btn ${paper.category}`} 
                  onClick={() => openZoom(paper)}
                >
                  {paper.category === 'methodology' && <Binary size={15} />}
                  {paper.category === 'empirical_study' && <LineChart size={15} />}
                  {paper.category === 'theoretical' && <Layers size={15} />}
                  {paper.category === 'review_survey' && <Award size={15} />}
                  <span>Zoom into {paper.category === 'methodology' ? 'Equation' : paper.category === 'empirical_study' ? 'Trend' : paper.category === 'theoretical' ? 'Proof' : 'Taxonomy'} ➔</span>
                </button>
              </div>

            </div>
          ))}
        </div>
      </div>

      {/* Reusable Zoom Drawer */}
      {activePaper && (
        <SemanticZoomDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          paperType={activePaper.category}
          title={activePaper.title}
          data={activePaper.zoomData}
        />
      )}

      <style>{`
        .demo-screen-container {
          min-height: 100vh;
          width: 100%;
          background: radial-gradient(circle at top left, rgba(168, 85, 247, 0.05) 0%, rgba(99, 102, 241, 0.02) 50%, rgba(0,0,0,0) 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 20px;
          box-sizing: border-box;
        }

        .demo-header {
          width: 100%;
          max-width: var(--max-width-feed, 680px);
          padding: 16px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 20px;
          backdrop-filter: blur(10px);
        }

        .back-circle-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--border-glass);
          color: var(--text-primary);
          cursor: pointer;
          transition: var(--transition-fast);
        }

        .back-circle-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          transform: scale(1.05);
        }

        .demo-header-info h2 {
          font-size: 1.25rem;
          font-weight: 800;
          background: linear-gradient(135deg, #a855f7, #6366f1);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .demo-header-info p {
          font-size: 0.75rem;
          color: var(--text-secondary);
          margin-top: 2px;
        }

        .demo-scroll-body {
          width: 100%;
          max-width: var(--max-width-feed, 680px);
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .demo-cards-list {
          display: flex;
          flex-direction: column;
          gap: 24px;
          width: 100%;
        }

        .demo-paper-card {
          width: 100%;
          padding: 24px;
          border-radius: var(--radius-lg);
          display: flex;
          flex-direction: column;
          gap: 12px;
          box-shadow: var(--shadow-sm);
        }

        .card-badge-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .paper-type-badge {
          font-size: 0.7rem;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 99px;
        }

        .paper-type-badge.methodology {
          background: rgba(168, 85, 247, 0.1);
          color: #a855f7;
          border: 1px solid rgba(168, 85, 247, 0.2);
        }

        .paper-type-badge.empirical_study {
          background: rgba(59, 130, 246, 0.1);
          color: #3b82f6;
          border: 1px solid rgba(59, 130, 246, 0.2);
        }

        .paper-type-badge.theoretical {
          background: rgba(16, 185, 129, 0.1);
          color: #10b981;
          border: 1px solid rgba(16, 185, 129, 0.2);
        }

        .paper-type-badge.review_survey {
          background: rgba(245, 158, 11, 0.1);
          color: #f59e0b;
          border: 1px solid rgba(245, 158, 11, 0.2);
        }

        .paper-title {
          font-size: 1.35rem;
          font-weight: 850;
          line-height: 1.25;
          color: var(--text-primary);
        }

        .paper-authors-year {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 6px;
          font-size: 0.76rem;
          color: var(--text-secondary);
        }

        .dot-sep {
          color: var(--text-muted);
        }

        .paper-abstract {
          font-size: 0.84rem;
          line-height: 1.5;
          color: var(--text-secondary);
        }

        .teaser-highlight-box {
          background: rgba(255, 255, 255, 0.02);
          border: 1px dashed var(--border-glass);
          padding: 12px 14px;
          border-radius: var(--radius-md);
          margin-top: 4px;
        }

        .teaser-icon-title {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.72rem;
          font-weight: 700;
          color: var(--text-secondary);
          margin-bottom: 4px;
        }

        .spark-icon {
          color: #a855f7;
        }

        .teaser-text {
          font-size: 0.8rem;
          font-style: italic;
          color: var(--text-primary);
        }

        .card-actions-row {
          display: flex;
          justify-content: flex-end;
          margin-top: 8px;
        }

        .zoom-trigger-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          border-radius: var(--radius-md);
          font-weight: 600;
          font-size: 0.84rem;
          border: none;
          cursor: pointer;
          transition: var(--transition-fast);
          color: white;
        }

        .zoom-trigger-btn.methodology {
          background: linear-gradient(135deg, #a855f7, #7c3aed);
        }
        .zoom-trigger-btn.empirical_study {
          background: linear-gradient(135deg, #3b82f6, #2563eb);
        }
        .zoom-trigger-btn.theoretical {
          background: linear-gradient(135deg, #10b981, #059669);
        }
        .zoom-trigger-btn.review_survey {
          background: linear-gradient(135deg, #f59e0b, #d97706);
        }

        .zoom-trigger-btn:hover {
          filter: brightness(1.15);
          transform: translateY(-1px);
        }
      `}</style>
    </div>
  );
};
