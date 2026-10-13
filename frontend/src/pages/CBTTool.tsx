import React, { useState } from 'react';
import { BrainCircuit, Sparkles, Plus, CheckCircle2, Trash2, ArrowRight, Lightbulb, Save } from 'lucide-react';
import toast from 'react-hot-toast';

interface Distortion {
  id: string;
  name: string;
  desc: string;
}

const DISTORTIONS: Distortion[] = [
  { id: 'catastrophizing', name: 'Catastrophizing', desc: 'Expecting the worst possible scenario to happen.' },
  { id: 'all_or_nothing', name: 'All-or-Nothing Thinking', desc: 'Viewing things in black-and-white extremes (total success or complete failure).' },
  { id: 'mind_reading', name: 'Mind Reading', desc: 'Assuming you know what others are thinking without concrete evidence.' },
  { id: 'emotional_reasoning', name: 'Emotional Reasoning', desc: 'Believing that because you feel a certain way, it must be true.' },
  { id: 'overgeneralization', name: 'Overgeneralization', desc: 'Viewing a single negative event as a never-ending pattern of defeat.' },
  { id: 'personalization', name: 'Personalization', desc: 'Holding yourself responsible for events outside your control.' }
];

interface CbtEntry {
  id: string;
  date: string;
  situation: string;
  negativeThought: string;
  distortions: string[];
  evidenceAgainst: string;
  balancedThought: string;
}

export default function CBTTool() {
  const [step, setStep] = useState<number>(1);
  const [situation, setSituation] = useState('');
  const [negativeThought, setNegativeThought] = useState('');
  const [selectedDistortions, setSelectedDistortions] = useState<string[]>([]);
  const [evidenceAgainst, setEvidenceAgainst] = useState('');
  const [balancedThought, setBalancedThought] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  const [savedEntries, setSavedEntries] = useState<CbtEntry[]>(() => {
    try {
      const stored = localStorage.getItem('shadowmind_cbt_entries');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const toggleDistortion = (id: string) => {
    setSelectedDistortions(prev =>
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  };

  const handleAiSuggestReframing = async () => {
    if (!negativeThought.trim()) {
      toast.error('Please enter a negative thought first.');
      return;
    }
    setIsAiLoading(true);
    try {
      // Simulate/call AI suggestion
      const distortionNames = selectedDistortions.map(d => DISTORTIONS.find(item => item.id === d)?.name).filter(Boolean).join(', ');
      
      const token = sessionStorage.getItem('shadowmind_token') || localStorage.getItem('shadowmind_token');
      const res = await fetch('/api/chat/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          message: `Help me reframe this thought: "${negativeThought}". Identified cognitive distortions: ${distortionNames || 'None specified'}. Give me a concise, realistic, and balanced replacement thought in 2 sentences.`,
          session_type: 'cbt'
        })
      });

      if (res.ok) {
        const data = await res.json();
        const aiText = data.message?.content || data.response || data.reply;
        if (aiText) {
          setBalancedThought(aiText);
          toast.success('AI Reframing suggestion generated!');
        }
      } else {
        // Fallback realistic replacement generator
        setBalancedThought(`While it is natural to feel stressed about "${situation || 'this situation'}", my initial thought ("${negativeThought}") might be an exaggeration. I can handle this one step at a time with realistic effort.`);
        toast.success('Generated balanced replacement thought.');
      }
    } catch {
      setBalancedThought(`While it is natural to feel stressed about "${situation || 'this situation'}", my initial thought ("${negativeThought}") might be an exaggeration. I can handle this one step at a time with realistic effort.`);
      toast.success('Generated balanced replacement thought.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSaveEntry = () => {
    if (!negativeThought || !balancedThought) {
      toast.error('Please complete the thought reframing process before saving.');
      return;
    }
    const newEntry: CbtEntry = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      situation,
      negativeThought,
      distortions: selectedDistortions,
      evidenceAgainst,
      balancedThought
    };

    const updated = [newEntry, ...savedEntries];
    setSavedEntries(updated);
    localStorage.setItem('shadowmind_cbt_entries', JSON.stringify(updated));

    toast.success('CBT Thought Record saved!');
    // Reset form
    setStep(1);
    setSituation('');
    setNegativeThought('');
    setSelectedDistortions([]);
    setEvidenceAgainst('');
    setBalancedThought('');
  };

  const handleDeleteEntry = (id: string) => {
    const updated = savedEntries.filter(e => e.id !== id);
    setSavedEntries(updated);
    localStorage.setItem('shadowmind_cbt_entries', JSON.stringify(updated));
    toast.success('Entry removed.');
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <BrainCircuit size={28} color="var(--accent-bright)" />
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0 }}>CBT Thought Reframer</h1>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
          Cognitive Behavioral Therapy (CBT) structured tool to identify automatic negative thoughts, spot cognitive distortions, and reframe them into balanced rational thoughts.
        </p>
      </div>

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
        {/* Active Reframing Wizard */}
        <div style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '1.75rem', border: '1px solid var(--border-dim)' }}>
          {/* Step Indicator */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '2rem' }}>
            {[1, 2, 3, 4].map(s => (
              <div
                key={s}
                onClick={() => setStep(s)}
                style={{
                  flex: 1,
                  height: '6px',
                  borderRadius: '3px',
                  background: step >= s ? 'var(--accent-bright)' : 'var(--border-dim)',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
              />
            ))}
          </div>

          {/* STEP 1 */}
          {step === 1 && (
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem' }}>Step 1: The Trigger & Negative Thought</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                Describe what happened and the immediate negative thought that crossed your mind.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    1. What was the Situation / Trigger?
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Received critical feedback on a project presentation..."
                    value={situation}
                    onChange={e => setSituation(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '8px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--border-dim)',
                      color: 'var(--text-primary)',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    2. Automatic Negative Thought (ANT)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. I am completely incompetent and everyone thinks I am a failure."
                    value={negativeThought}
                    onChange={e => setNegativeThought(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '8px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--border-dim)',
                      color: 'var(--text-primary)',
                      fontSize: '0.9rem',
                      resize: 'none'
                    }}
                  />
                </div>
              </div>

              <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    if (!negativeThought.trim()) {
                      toast.error('Please enter your automatic negative thought.');
                      return;
                    }
                    setStep(2);
                  }}
                  className="btn btn-primary"
                >
                  Next: Identify Distortions <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem' }}>Step 2: Identify Cognitive Distortions</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                Select any unhelpful thinking styles present in your negative thought:
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px', marginBottom: '1.5rem' }}>
                {DISTORTIONS.map(d => {
                  const isSelected = selectedDistortions.includes(d.id);
                  return (
                    <div
                      key={d.id}
                      onClick={() => toggleDistortion(d.id)}
                      style={{
                        padding: '1rem',
                        borderRadius: '10px',
                        border: `1px solid ${isSelected ? 'var(--accent-bright)' : 'var(--border-dim)'}`,
                        background: isSelected ? 'var(--accent-subtle)' : 'rgba(255,255,255,0.02)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '4px', color: isSelected ? '#fff' : 'var(--text-primary)' }}>
                        {d.name}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                        {d.desc}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button onClick={() => setStep(1)} className="btn btn-ghost">Back</button>
                <button onClick={() => setStep(3)} className="btn btn-primary">
                  Next: Examine Evidence <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem' }}>Step 3: Examine Evidence Against The Thought</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                What facts or past experiences contradict your negative thought?
              </p>

              <textarea
                rows={4}
                placeholder="e.g. I have received positive reviews in the past. One piece of feedback does not negate all my work..."
                value={evidenceAgainst}
                onChange={e => setEvidenceAgainst(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border-dim)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  marginBottom: '1.5rem',
                  resize: 'none'
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button onClick={() => setStep(2)} className="btn btn-ghost">Back</button>
                <button onClick={() => setStep(4)} className="btn btn-primary">
                  Next: Formulate Balanced Thought <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem' }}>Step 4: Balanced Replacement Thought</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                Write a realistic, objective replacement thought to replace the negative thought.
              </p>

              <div style={{ marginBottom: '1rem' }}>
                <button
                  onClick={handleAiSuggestReframing}
                  disabled={isAiLoading}
                  className="btn btn-outline"
                  style={{ gap: '8px', fontSize: '0.82rem', marginBottom: '1rem' }}
                >
                  <Sparkles size={16} color="var(--accent-bright)" />
                  {isAiLoading ? 'AI Generating Reframing...' : 'AI Assist: Suggest Reframing'}
                </button>

                <textarea
                  rows={4}
                  placeholder="Write your balanced replacement thought here..."
                  value={balancedThought}
                  onChange={e => setBalancedThought(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--accent-bright)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    resize: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem' }}>
                <button onClick={() => setStep(3)} className="btn btn-ghost">Back</button>
                <button onClick={handleSaveEntry} className="btn btn-primary" style={{ gap: '8px' }}>
                  <Save size={16} /> Save CBT Record
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Saved Records Log */}
        {(savedEntries || []).length > 0 && (
          <div style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '1.75rem', border: '1px solid var(--border-dim)' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1.25rem' }}>Saved CBT Thought Logs</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {(savedEntries || []).map(e => (
                <div key={e.id} style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--border-dim)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{e.date}</span>
                    <button onClick={() => handleDeleteEntry(e.id)} style={{ background: 'none', border: 'none', color: 'var(--accent-bright)', cursor: 'pointer' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                  
                  {e.situation && (
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                      <strong>Situation:</strong> {e.situation}
                    </div>
                  )}

                  <div style={{ fontSize: '0.85rem', color: '#ef4444', marginBottom: '8px' }}>
                    <strong>Original ANT:</strong> "{e.negativeThought}"
                  </div>

                  <div style={{ fontSize: '0.88rem', color: '#22c55e', fontWeight: 600, background: 'rgba(34, 197, 94, 0.08)', padding: '8px 12px', borderRadius: '6px' }}>
                    <strong>Balanced Reframe:</strong> "{e.balancedThought}"
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
