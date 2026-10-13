import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Trash2, BookOpen, Sparkles, Search, Mic, ArrowLeft,
  Calendar, Check, Copy, RefreshCw, FileText, ListFilter,
  Layers, Lightbulb, CheckCircle2, ChevronRight, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { journalsApi } from '../services/api';
import { Journal, JournalCreate } from '../types';
import { format } from 'date-fns';
import { useSpeechToText } from '../hooks/useSpeechToText';
import { useSentiment } from '../hooks/useSentiment';
import CrisisBanner from '../components/CrisisBanner';
import LoadingSpinner from '../components/LoadingSpinner';

const DRAFT_STORAGE_KEY = 'shadowmind_journal_draft';

const DEFAULT_FORM: JournalCreate = {
  title: '',
  content: '',
  mood_score: undefined,
  tags: [],
  is_private: true,
};

type ViewMode = 'list' | 'write' | 'read';
type AssistantTab = 'prompts' | 'analyze' | 'reflection' | 'rewrite' | 'summary';

export default function JournalPage() {
  const [journals, setJournals] = useState<Journal[]>([]);
  const [form, setForm] = useState<JournalCreate>(DEFAULT_FORM);
  const [mode, setMode] = useState<ViewMode>('list');
  const [selected, setSelected] = useState<Journal | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [showCrisis, setShowCrisis] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);

  // AI Assistant States
  const [activeTab, setActiveTab] = useState<AssistantTab>('prompts');
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [prompts, setPrompts] = useState<string[]>([]);
  const [selectedMoodPrompt, setSelectedMoodPrompt] = useState('general');
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);
  const [reflectionResult, setReflectionResult] = useState<string | null>(null);
  const [rewriteType, setRewriteType] = useState<string>('readability');
  const [rewriteResult, setRewriteResult] = useState<{ revised_text: string; explanation: string } | null>(null);
  const [summaryResult, setSummaryResult] = useState<any | null>(null);

  const { isListening, startListening, stopListening, isSupported, error: speechError } =
    useSpeechToText({
      onFinalResult: (text) => {
        setForm((f) => ({ ...f, content: f.content ? f.content + ' ' + text : text }));
      },
    });

  const { sentiment } = useSentiment(form.content, 500);

  useEffect(() => {
    if (speechError) toast.error(speechError);
  }, [speechError]);

  useEffect(() => {
    loadJournals();
  }, []);

  // Restore draft from localStorage on initial render
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.title || parsed.content) {
          setForm(parsed);
          setDraftSavedAt('Restored from draft');
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Auto-save draft when writing
  useEffect(() => {
    if (mode === 'write' && (form.title || form.content)) {
      const timer = setTimeout(() => {
        try {
          localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(form));
          setDraftSavedAt(format(new Date(), 'HH:mm:ss'));
        } catch {
          /* ignore */
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [form, mode]);

  const loadJournals = async (q?: string) => {
    try {
      const res = await journalsApi.list({ limit: 50, search: q });
      setJournals(Array.isArray(res.data) ? res.data : []);
    } catch {
      setJournals([]);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    loadJournals(e.target.value || undefined);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      toast.error('Please provide both a title and entry content');
      return;
    }
    setLoading(true);
    try {
      const resp = await journalsApi.create(form);
      if (resp.data.crisis_alert) {
        setShowCrisis(true);
      }
      toast.success('Journal entry saved');
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      setForm(DEFAULT_FORM);
      setMode('list');
      loadJournals();
    } catch {
      toast.error('Failed to save journal');
    } finally {
      setLoading(false);
    }
  };

  const deleteJournal = async (id: string) => {
    if (!confirm('Permanently delete this journal entry?')) return;
    try {
      await journalsApi.delete(id);
      setJournals((prev) => prev.filter((j) => j.id !== id));
      if (selected?.id === id) {
        setSelected(null);
        setMode('list');
      }
      toast.success('Journal entry deleted');
    } catch {
      toast.error('Delete failed');
    }
  };

  const openEntry = (j: Journal) => {
    setSelected(j);
    setMode('read');
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !form.tags?.includes(t)) setForm((f) => ({ ...f, tags: [...(f.tags || []), t] }));
    setTagInput('');
  };

  // AI Feature 1: Load Prompts
  const fetchPrompts = useCallback(async (mood?: string) => {
    setAssistantLoading(true);
    try {
      const res = await journalsApi.getPrompts({ mood: mood || selectedMoodPrompt });
      setPrompts(res.data.prompts || []);
    } catch {
      toast.error('Unable to load reflection prompts');
    } finally {
      setAssistantLoading(false);
    }
  }, [selectedMoodPrompt]);

  useEffect(() => {
    if (mode === 'write' && (prompts || []).length === 0) {
      fetchPrompts();
    }
  }, [mode, fetchPrompts, prompts?.length]);

  // AI Feature 2: Analyze Current Text
  const handleAnalyze = async () => {
    const targetContent = mode === 'write' ? form.content : selected?.content;
    if (!targetContent || targetContent.trim().length < 15) {
      toast.error('Please write a bit more before requesting analysis (at least 15 characters).');
      return;
    }
    setAssistantLoading(true);
    try {
      const res = await journalsApi.assistant({ action: 'analyze', content: targetContent });
      setAnalysisResult(res.data);
      toast.success('Analysis complete');
    } catch {
      toast.error('Analysis failed');
    } finally {
      setAssistantLoading(false);
    }
  };

  // AI Feature 3: Personalized Reflection
  const handleReflection = async () => {
    const targetContent = mode === 'write' ? form.content : selected?.content;
    if (!targetContent || targetContent.trim().length < 15) {
      toast.error('Please write a bit more before requesting reflection.');
      return;
    }
    setAssistantLoading(true);
    try {
      const res = await journalsApi.assistant({ action: 'reflection', content: targetContent });
      setReflectionResult(res.data.reflection);
      toast.success('Reflection generated');
    } catch {
      toast.error('Failed to generate reflection');
    } finally {
      setAssistantLoading(false);
    }
  };

  // AI Feature 4: Rewrite & Organize
  const handleRewrite = async (type: string) => {
    const targetContent = mode === 'write' ? form.content : selected?.content;
    if (!targetContent || targetContent.trim().length < 15) {
      toast.error('Please write some content first before requesting a rewrite.');
      return;
    }
    setRewriteType(type);
    setAssistantLoading(true);
    try {
      const res = await journalsApi.assistant({
        action: 'rewrite',
        content: targetContent,
        rewrite_type: type,
      });
      setRewriteResult({
        revised_text: res.data.revised_text,
        explanation: res.data.explanation,
      });
      toast.success('Revision ready for preview');
    } catch {
      toast.error('Rewrite failed');
    } finally {
      setAssistantLoading(false);
    }
  };

  const applyRewriteToEntry = () => {
    if (!rewriteResult?.revised_text) return;
    setForm((f) => ({ ...f, content: rewriteResult.revised_text }));
    toast.success('Applied revision to journal draft');
  };

  // AI Feature 5: Recent Journal Summary
  const handleMultiEntrySummary = async () => {
    setAssistantLoading(true);
    try {
      const res = await journalsApi.assistant({ action: 'summary', entries_count: 5 });
      if (res.data) {
        setSummaryResult(res.data);
        if (res.data.insufficient_data) {
          toast(res.data.summary, { icon: 'ℹ️' });
        } else {
          toast.success('Journal summary ready');
        }
      }
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Failed to summarize journal entries';
      toast.error(msg);
    } finally {
      setAssistantLoading(false);
    }
  };

  const wordCount = (form?.content || '').split(/\s+/).filter(Boolean).length;

  // ── WRITE MODE ──
  if (mode === 'write') {
    return (
      <div className="animate-fade-in-up" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {showCrisis && <CrisisBanner onClose={() => setShowCrisis(false)} />}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <button onClick={() => setMode('list')} className="btn btn-ghost">
            <ArrowLeft size={16} /> Return to Archive
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {draftSavedAt && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                Draft saved: {draftSavedAt}
              </span>
            )}
            <span className="badge badge-accent">NEW REFLECTION</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(320px, 1.2fr)', gap: '1.5rem', alignItems: 'start' }}>
          {/* Main Writing Area */}
          <form
            onSubmit={handleSubmit}
            className="glass-panel"
            style={{
              padding: '2rem',
              border: '1px solid var(--accent-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem',
            }}
          >
            <div>
              <label
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.68rem',
                  color: 'var(--text-secondary)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  display: 'block',
                  marginBottom: '6px',
                  fontWeight: 600,
                }}
              >
                ENTRY TITLE
              </label>
              <input
                className="input-base"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Give this reflection a title..."
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.2rem',
                  fontWeight: 700,
                  padding: '0.85rem 1rem',
                }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.68rem',
                    color: 'var(--text-secondary)',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                  }}
                >
                  YOUR REFLECTION
                </label>
                {isSupported && (
                  <button
                    type="button"
                    onClick={isListening ? stopListening : startListening}
                    className="btn btn-ghost"
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.72rem',
                      color: isListening ? 'var(--accent-bright)' : 'var(--text-secondary)',
                      borderColor: isListening ? 'var(--accent)' : 'var(--border-dim)',
                    }}
                  >
                    <Mic size={14} /> {isListening ? 'STOPPING...' : 'DICTATE'}
                  </button>
                )}
              </div>

              <div style={{ position: 'relative' }}>
                <textarea
                  className="input-base"
                  value={form.content}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                  placeholder="Write freely. Your thoughts are completely private to your account..."
                  rows={14}
                  style={{
                    resize: 'vertical',
                    lineHeight: 1.8,
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.95rem',
                    padding: '1rem 1.25rem',
                  }}
                />

                {sentiment && (form?.content || '').length > 10 && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '15px',
                      right: '15px',
                      fontSize: '0.72rem',
                      fontFamily: 'var(--font-mono)',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      background: 'rgba(0,0,0,0.6)',
                      border: '1px solid var(--border-dim)',
                      color:
                        sentiment.score > 0.2
                          ? '#4ade80'
                          : sentiment.score < -0.2
                          ? 'var(--accent-bright)'
                          : 'var(--text-secondary)',
                    }}
                  >
                    TONE: {sentiment.primary_emotion.toUpperCase()}
                  </div>
                )}
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '1.25rem',
                alignItems: 'flex-start',
              }}
            >
              <div>
                <label
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.68rem',
                    color: 'var(--text-secondary)',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    display: 'block',
                    marginBottom: '6px',
                    fontWeight: 600,
                  }}
                >
                  ASSOCIATED MOOD (1-10)
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  className="input-base"
                  value={form.mood_score || ''}
                  onChange={(e) => setForm((f) => ({ ...f, mood_score: parseInt(e.target.value) || undefined }))}
                  placeholder="Optional (1 to 10)"
                />
              </div>

              <div>
                <label
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.68rem',
                    color: 'var(--text-secondary)',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    display: 'block',
                    marginBottom: '6px',
                    fontWeight: 600,
                  }}
                >
                  TAGS
                </label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  {form.tags?.map((t) => (
                    <span
                      key={t}
                      onClick={() => setForm((f) => ({ ...f, tags: f.tags?.filter((x) => x !== t) }))}
                      className="badge badge-accent"
                      style={{ cursor: 'pointer' }}
                    >
                      #{t} ×
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    className="input-base"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    placeholder="add tag + enter"
                  />
                  <button type="button" onClick={addTag} className="btn btn-ghost">
                    +
                  </button>
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderTop: '1px solid var(--border-dim)',
                paddingTop: '1.25rem',
              }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {wordCount} words logged
              </span>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" onClick={() => setMode('list')} className="btn btn-ghost">
                  CANCEL
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'SAVING...' : 'SAVE JOURNAL ENTRY'}
                </button>
              </div>
            </div>
          </form>

          {/* AI Journal Assistant Panel */}
          <div
            className="card"
            style={{
              padding: '1.5rem',
              border: '1px solid var(--accent-border)',
              background: 'linear-gradient(145deg, rgba(18, 22, 34, 0.8) 0%, rgba(13, 16, 26, 0.95) 100%)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} color="var(--accent-bright)" />
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700 }}>
                AI Journal Assistant
              </h3>
            </div>

            {/* Assistant Navigation Tabs */}
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', borderBottom: '1px solid var(--border-dim)', paddingBottom: '8px' }}>
              {[
                { id: 'prompts', label: 'Prompts' },
                { id: 'analyze', label: 'Analyze' },
                { id: 'reflection', label: 'Reflection' },
                { id: 'rewrite', label: 'Rewrite' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as AssistantTab)}
                  style={{
                    background: activeTab === tab.id ? 'var(--accent)' : 'transparent',
                    color: activeTab === tab.id ? '#fff' : 'var(--text-secondary)',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    fontFamily: 'var(--font-mono)',
                    cursor: 'pointer',
                    transition: 'var(--transition)',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab 1: Reflection Prompts */}
            {activeTab === 'prompts' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {['anxious', 'stressed', 'sad', 'calm', 'grateful', 'general'].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setSelectedMoodPrompt(m);
                        fetchPrompts(m);
                      }}
                      style={{
                        padding: '3px 8px',
                        fontSize: '0.68rem',
                        fontFamily: 'var(--font-mono)',
                        borderRadius: '4px',
                        border: `1px solid ${selectedMoodPrompt === m ? 'var(--accent-bright)' : 'var(--border-dim)'}`,
                        background: selectedMoodPrompt === m ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                        color: selectedMoodPrompt === m ? 'var(--accent-bright)' : 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      {m}
                    </button>
                  ))}
                </div>

                {assistantLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '1rem', color: 'var(--text-muted)' }}>
                    <LoadingSpinner size="sm" /> Generating prompts...
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {prompts.map((p, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '6px',
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid var(--border-dim)',
                          fontSize: '0.82rem',
                          lineHeight: 1.5,
                          cursor: 'pointer',
                        }}
                        onClick={() => {
                          setForm((f) => ({
                            ...f,
                            content: f.content ? f.content + '\n\n' + p + '\n' : p + '\n',
                          }));
                          toast.success('Prompt inserted into entry');
                        }}
                        title="Click to insert into your entry"
                      >
                        <p style={{ margin: 0, color: 'var(--text-primary)' }}>"{p}"</p>
                        <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-bright)' }}>
                          + Insert into draft
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Emotional & Thematic Analysis */}
            {activeTab === 'analyze' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Extract themes, emotional frequencies, and reflective questions from your draft.
                </p>
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={assistantLoading}
                  className="btn btn-primary"
                  style={{ fontSize: '0.8rem', padding: '0.6rem 1rem' }}
                >
                  {assistantLoading ? 'Analyzing Draft...' : 'Analyze Current Text'}
                </button>

                {analysisResult && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
                    <div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        PRIMARY THEMES:
                      </span>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                        {analysisResult.themes?.map((th: string) => (
                          <span key={th} className="badge badge-accent" style={{ fontSize: '0.68rem' }}>
                            {th}
                          </span>
                        ))}
                      </div>
                    </div>

                    {analysisResult?.emotions && (analysisResult.emotions || []).length > 0 && (
                      <div>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                          EXPRESSED EMOTIONS:
                        </span>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                          {analysisResult.emotions.map((em: any) => (
                            <span key={em.name} className="badge badge-subtle" style={{ fontSize: '0.68rem' }}>
                              {em.name} ({em.intensity}/10)
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {analysisResult.reflection_questions && (
                      <div style={{ padding: '8px 10px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-dim)' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--accent-bright)' }}>
                          REFLECTION QUESTION:
                        </span>
                        <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-primary)', fontStyle: 'italic' }}>
                          "{analysisResult.reflection_questions[0]}"
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Personalized Reflection */}
            {activeTab === 'reflection' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Generate an empathetic observation, deeper inquiry, and small practical next step.
                </p>
                <button
                  type="button"
                  onClick={handleReflection}
                  disabled={assistantLoading}
                  className="btn btn-primary"
                  style={{ fontSize: '0.8rem', padding: '0.6rem 1rem' }}
                >
                  {assistantLoading ? 'Reflecting...' : 'Generate Reflection'}
                </button>

                {reflectionResult && (
                  <div
                    style={{
                      padding: '12px',
                      borderRadius: '6px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-dim)',
                      fontSize: '0.84rem',
                      lineHeight: 1.6,
                      color: 'var(--text-primary)',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {reflectionResult}
                  </div>
                )}
              </div>
            )}

            {/* Tab 4: Rewrite & Organize (Preview Only - never auto-overwrites) */}
            {activeTab === 'rewrite' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Choose an organization format. Your original text is never changed unless you choose to apply it.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  {[
                    { id: 'readability', label: 'Polish Readability' },
                    { id: 'paragraphs', label: 'Organize Paragraphs' },
                    { id: 'summarize', label: 'Summarize' },
                    { id: 'actions', label: 'Extract Actions' },
                  ].map((btn) => (
                    <button
                      key={btn.id}
                      type="button"
                      onClick={() => handleRewrite(btn.id)}
                      disabled={assistantLoading}
                      className="btn btn-ghost"
                      style={{ fontSize: '0.72rem', padding: '6px 8px', textAlign: 'center' }}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>

                {assistantLoading && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                    <LoadingSpinner size="sm" /> Preparing suggested draft...
                  </div>
                )}

                {rewriteResult && (
                  <div
                    style={{
                      padding: '12px',
                      borderRadius: '6px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--accent-border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="badge badge-accent" style={{ fontSize: '0.65rem' }}>
                        Preview: {rewriteType}
                      </span>
                      <button
                        type="button"
                        onClick={applyRewriteToEntry}
                        className="btn btn-primary"
                        style={{ fontSize: '0.72rem', padding: '4px 10px' }}
                      >
                        Apply to Draft
                      </button>
                    </div>

                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>
                      {rewriteResult.explanation}
                    </p>

                    <div
                      style={{
                        maxHeight: '180px',
                        overflowY: 'auto',
                        fontSize: '0.82rem',
                        lineHeight: 1.6,
                        color: 'var(--text-primary)',
                        whiteSpace: 'pre-wrap',
                        borderTop: '1px solid var(--border-dim)',
                        paddingTop: '6px',
                      }}
                    >
                      {rewriteResult.revised_text}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── READ / SYNTHESIS MODE ──
  if (mode === 'read' && selected) {
    return (
      <div className="animate-fade-in-up" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
        {showCrisis && <CrisisBanner onClose={() => setShowCrisis(false)} />}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <button onClick={() => setMode('list')} className="btn btn-ghost">
            <ArrowLeft size={16} /> Return to Archive
          </button>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => {
                setForm({
                  title: selected.title,
                  content: selected.content,
                  mood_score: selected.mood_score,
                  tags: selected.tags || [],
                  is_private: selected.is_private,
                });
                setMode('write');
              }}
              className="btn btn-ghost"
            >
              Edit in Draft
            </button>
            <button
              onClick={() => deleteJournal(selected.id)}
              className="btn btn-danger"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        {/* Entry Full Content */}
        <div className="glass-panel" style={{ padding: '2.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div>
              <h1
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.8rem',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.01em',
                  marginBottom: '0.4rem',
                }}
              >
                {selected.title}
              </h1>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.72rem',
                  color: 'var(--text-muted)',
                }}
              >
                <span>{format(new Date(selected.created_at), 'EEEE, MMMM d, yyyy • HH:mm')}</span>
                <span>//</span>
                <span>{selected.word_count} words</span>
              </div>
            </div>

            {selected.mood_score && (
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.8rem',
                  fontWeight: 800,
                  color:
                    selected.mood_score >= 7.5
                      ? '#22c55e'
                      : selected.mood_score >= 5.0
                      ? '#eab308'
                      : '#ef4444',
                }}
              >
                {selected.mood_score}/10
              </div>
            )}
          </div>

          {selected?.tags && (selected.tags || []).length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
              {selected.tags.map((t) => (
                <span key={t} className="badge badge-accent">
                  #{t}
                </span>
              ))}
            </div>
          )}

          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '1rem',
              color: 'var(--text-primary)',
              lineHeight: 1.85,
              whiteSpace: 'pre-wrap',
              borderTop: '1px solid var(--border-dim)',
              paddingTop: '1.5rem',
            }}
          >
            {selected.content}
          </div>
        </div>

        {/* AI Synthesis Summary if Available */}
        {selected.ai_summary && (
          <div className="card" style={{ padding: '1.75rem', border: '1px solid var(--accent-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <Sparkles size={16} color="var(--accent-bright)" />
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 700 }}>
                AI Reflection Observation
              </h3>
            </div>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {selected.ai_summary}
            </p>
          </div>
        )}
      </div>
    );
  }

  // ── ARCHIVE LIST MODE ──
  return (
    <div className="animate-fade-in-up" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {showCrisis && <CrisisBanner onClose={() => setShowCrisis(false)} />}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.6rem',
              fontWeight: 800,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
            }}
          >
            Journal & Reflection Space
          </h2>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {(journals || []).length} entries preserved • Private and protected reflection assistant
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={handleMultiEntrySummary}
            disabled={assistantLoading}
            className="btn btn-ghost"
            style={{ padding: '0.65rem 1rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Sparkles size={15} color="var(--accent-bright)" className={assistantLoading ? 'animate-spin' : ''} />
            {assistantLoading ? 'Summarizing...' : 'Recent Entries Summary'}
          </button>
          <button onClick={() => setMode('write')} className="btn btn-primary" style={{ padding: '0.65rem 1.25rem' }}>
            <Plus size={16} /> NEW JOURNAL ENTRY
          </button>
        </div>
      </div>

      {/* Multi-entry Summary Modal / Panel */}
      {summaryResult && (
        <div
          className="glass-panel animate-fade-in-scale"
          style={{
            padding: '1.75rem',
            border: '1px solid var(--accent-border)',
            background: 'linear-gradient(135deg, rgba(20, 24, 38, 0.9) 0%, rgba(13, 16, 26, 0.95) 100%)',
            position: 'relative',
          }}
        >
          <button
            onClick={() => setSummaryResult(null)}
            style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Sparkles size={18} color="var(--accent-bright)" />
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', fontWeight: 700 }}>
              Recent Entries Synthesis
            </h3>
            <span className="badge badge-accent" style={{ fontSize: '0.65rem' }}>
              {summaryResult.covered_period}
            </span>
          </div>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>
            {summaryResult.summary}
          </p>
        </div>
      )}

      {/* Search Bar */}
      <div style={{ position: 'relative' }}>
        <Search
          size={16}
          color="var(--text-muted)"
          style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}
        />
        <input
          className="input-base"
          value={search}
          onChange={handleSearch}
          placeholder="Search journal entries by title, keywords, or topics..."
          style={{ paddingLeft: '2.5rem', borderRadius: 'var(--radius-sm)' }}
        />
      </div>

      {(journals || []).length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <BookOpen size={36} color="var(--text-muted)" style={{ margin: '0 auto 1rem', display: 'block', opacity: 0.4 }} />
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            {search ? 'No journal records match your search criteria.' : 'No journal records yet. Tap "New Journal Entry" to write your first reflection.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {journals.map((j) => (
            <div
              key={j.id}
              onClick={() => openEntry(j)}
              className="card card-interactive"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '1.5rem',
                minHeight: '180px',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                  <h3
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '1.05rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      lineHeight: 1.3,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {j.title}
                  </h3>
                  {j.ai_summary && <Sparkles size={15} color="var(--accent-bright)" style={{ flexShrink: 0 }} />}
                </div>

                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.82rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.6,
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    marginBottom: '1rem',
                  }}
                >
                  {j.content}
                </p>
              </div>

              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderTop: '1px solid var(--border-dim)',
                    paddingTop: '0.75rem',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.68rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  <span>{format(new Date(j.created_at), 'MMM d, yyyy')}</span>
                  <span>{j.word_count} words</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
