import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { predictionsApi } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import { Brain, AlertCircle, CheckCircle, ChevronDown, ChevronUp, Sparkles, ThumbsUp, ThumbsDown, XCircle, ShieldCheck, ArrowRight, Compass } from 'lucide-react';
import toast from 'react-hot-toast';

interface PatternToWatch {
  id: string;
  concern: string;
  pattern: string;
  possible_mistake: string;
  confidence: string;
  reason: string;
  warning_signs: string[];
  prevention_steps: string[];
  recommended_action: string;
  suggested_cbt?: string;
  color: string;
}

export default function Predictions() {
  const [patterns, setPatterns] = useState<PatternToWatch[]>([]);
  const [meta, setMeta] = useState<{ based_on_entries: number; avg_mood?: number; generated_at: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadPatterns();
  }, []);

  const loadPatterns = () => {
    setLoading(true);
    predictionsApi
      .get()
      .then((r) => {
        setPatterns(r.data.predictions || []);
        setMeta(r.data);
      })
      .catch((err) => {
        console.error(err);
        toast.error('Could not load patterns');
      })
      .finally(() => setLoading(false));
  };

  const handleFeedback = async (id: string, rating: 'accurate' | 'somewhat' | 'not_accurate', e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await predictionsApi.saveFeedback(id, rating);
      toast.success(rating === 'not_accurate' ? 'Feedback saved. We will adjust this pattern.' : 'Thank you for your feedback!');
      if (rating === 'not_accurate') {
        setPatterns((prev) => prev.filter((p) => p.id !== id));
      }
    } catch {
      toast.error('Failed to save feedback');
    }
  };

  const handleDismiss = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await predictionsApi.dismiss(id);
      setPatterns((prev) => prev.filter((p) => p.id !== id));
      toast.success('Pattern dismissed');
    } catch {
      toast.error('Could not dismiss pattern');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '65vh' }}>
        <LoadingSpinner message="ANALYZING PERSONALIZED WELLNESS PATTERNS" size="lg" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up stagger-children" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* ── HEADER ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.6rem',
              fontWeight: 800,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <Brain size={24} color="var(--accent-bright)" /> Patterns to Watch
          </h2>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Supportive insights to help you recognize recurring habits early and take gentle preventive action.
          </p>
        </div>

        {meta && (
          <div className="badge badge-accent" style={{ padding: '6px 12px', fontSize: '0.72rem' }}>
            INSIGHTS FROM {meta.based_on_entries} RECENT ENTRIES
          </div>
        )}
      </div>

      {patterns.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <ShieldCheck size={42} color="var(--accent-bright)" style={{ margin: '0 auto 1rem', display: 'block' }} />
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
            No Active Warning Patterns
          </h3>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.9rem', color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto' }}>
            Your recent check-ins show balanced emotional trajectory. Keep logging check-ins to stay ahead of potential stressors.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {patterns.map((p) => {
            const open = expanded === p.id;
            return (
              <div
                key={p.id}
                className="card"
                style={{
                  border: `1px solid ${p.color}44`,
                  background: open ? 'var(--bg-card-hover)' : 'var(--bg-card)',
                  transition: 'var(--transition)',
                  padding: '1.5rem',
                }}
              >
                {/* Header Row */}
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', cursor: 'pointer' }}
                  onClick={() => setExpanded(open ? null : p.id)}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                      <span
                        className="badge"
                        style={{
                          background: `${p.color}20`,
                          color: p.color,
                          border: `1px solid ${p.color}44`,
                          fontSize: '0.7rem',
                          fontWeight: 700,
                        }}
                      >
                        {p.concern}
                      </span>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.68rem',
                          color: 'var(--text-muted)',
                        }}
                      >
                        • {p.confidence}
                      </span>
                    </div>

                    <h3
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '1.15rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        marginBottom: '6px',
                        lineHeight: 1.4,
                      }}
                    >
                      {p.possible_mistake}
                    </h3>

                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      <strong style={{ color: 'var(--text-primary)' }}>Why:</strong> {p.reason}
                    </p>
                  </div>

                  <button
                    className="btn-ghost"
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', padding: '4px' }}
                    aria-label="Toggle pattern details"
                  >
                    {open ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </button>
                </div>

                {/* Expanded Prevention & Warning Signs */}
                {open && (
                  <div
                    className="animate-fade-in-up"
                    style={{
                      marginTop: '1.25rem',
                      paddingTop: '1.25rem',
                      borderTop: `1px solid ${p.color}25`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1.25rem',
                    }}
                  >
                    {/* Early Warning Signs */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem 1.25rem', borderRadius: '8px', border: '1px solid var(--border-dim)' }}>
                      <div
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.7rem',
                          color: 'var(--accent-bright)',
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          fontWeight: 700,
                          marginBottom: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <AlertCircle size={14} /> Early Warning Signs
                      </div>
                      <ul style={{ listStyle: 'disc', paddingLeft: '1.25rem', margin: 0 }}>
                        {p.warning_signs.map((sign, idx) => (
                          <li key={idx} style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                            {sign}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* How to Overcome It */}
                    <div>
                      <div
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.7rem',
                          color: 'var(--text-primary)',
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          fontWeight: 700,
                          marginBottom: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Compass size={14} color="var(--accent-bright)" /> How to Overcome It (Prevention Steps)
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {p.prevention_steps.map((step, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                            <div
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: '50%',
                                background: `${p.color}22`,
                                border: `1px solid ${p.color}44`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontFamily: 'var(--font-mono)',
                                fontSize: '0.65rem',
                                color: p.color,
                                flexShrink: 0,
                                marginTop: '1px',
                                textAlign: 'center',
                                lineHeight: '20px',
                              }}
                            >
                              {idx + 1}
                            </div>
                            <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                              {step}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* CBT Reframing if available */}
                    {p.suggested_cbt && (
                      <div
                        style={{
                          padding: '0.85rem 1rem',
                          background: 'rgba(99, 102, 241, 0.08)',
                          borderLeft: '3px solid var(--accent-bright)',
                          borderRadius: '4px',
                        }}
                      >
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--accent-bright)', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '2px' }}>
                          CBT Thought Reframe
                        </span>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-primary)', fontStyle: 'italic', margin: 0 }}>
                          "{p.suggested_cbt}"
                        </p>
                      </div>
                    )}

                    {/* Footer Actions */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', paddingTop: '0.5rem' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)' }}>Was this accurate?</span>
                        <button
                          onClick={(e) => handleFeedback(p.id, 'accurate', e)}
                          className="btn btn-ghost"
                          style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                          title="Accurate pattern"
                        >
                          <ThumbsUp size={13} color="#22c55e" /> Yes
                        </button>
                        <button
                          onClick={(e) => handleFeedback(p.id, 'not_accurate', e)}
                          className="btn btn-ghost"
                          style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                          title="Not accurate"
                        >
                          <ThumbsDown size={13} color="var(--accent-bright)" /> No
                        </button>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={(e) => handleDismiss(p.id, e)}
                          className="btn btn-ghost"
                          style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                        >
                          Dismiss
                        </button>
                        <button
                          onClick={() => navigate('/chat')}
                          className="btn btn-primary"
                          style={{ fontSize: '0.78rem', padding: '6px 14px' }}
                        >
                          Talk to Shadow <ArrowRight size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Safety Boundary Notice */}
      <div
        style={{
          padding: '1.25rem',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--border-dim)',
          borderRadius: '8px',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.68rem',
          color: 'var(--text-muted)',
          lineHeight: 1.6,
        }}
      >
        <span style={{ color: 'var(--accent-bright)', fontWeight: 700 }}>SAFETY NOTICE:</span> Patterns to Watch identifies non-clinical behavioral habits (e.g. overthinking, procrastination, sleep disruption) to support personal awareness. It never predicts medical or crisis conditions. If you are in crisis, please use the Crisis Support tab.
      </div>
    </div>
  );
}

