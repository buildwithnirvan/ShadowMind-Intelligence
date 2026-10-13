import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, Trash2, Activity, Sparkles, X, BarChart3, Clock, Moon,
  Zap, HeartPulse, RefreshCw, AlertCircle, ArrowRight, Wind, Compass, BookOpen, MessageSquare, ShieldAlert
} from 'lucide-react';
import toast from 'react-hot-toast';
import { moodsApi } from '../services/api';
import { Mood, MoodCreate } from '../types';
import MoodPicker from '../components/MoodPicker';
import LoadingSpinner from '../components/LoadingSpinner';
import { format } from 'date-fns';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface MoodInsightData {
  insights: string;
  trend: 'improving' | 'declining' | 'stable' | 'insufficient_data';
  trend_desc?: string;
  average_score?: number;
  average_stress?: number;
  average_energy?: number;
  average_anxiety?: number;
  total_entries: number;
  themes?: string[];
  correlations?: string[];
  suggested_actions?: Array<{
    title: string;
    description: string;
    link: string;
    badge: string;
  }>;
  insufficient_data?: boolean;
  is_fallback?: boolean;
}

const DEFAULT_FORM: MoodCreate = {
  score: 6.5,
  label: 'content',
  energy_level: 6,
  stress_level: 4,
  anxiety_level: 3,
  sleep_hours: 7.5,
  notes: '',
  tags: [],
  triggers: [],
};

export default function MoodPage() {
  const [moods, setMoods] = useState<Mood[]>([]);
  const [form, setForm] = useState<MoodCreate>(DEFAULT_FORM);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [historyPeriod, setHistoryPeriod] = useState<number | null>(30); // 7, 14, 30, null (all)
  const [tagInput, setTagInput] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // AI Insights State
  const [insights, setInsights] = useState<MoodInsightData | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  const loadMoods = useCallback(async () => {
    try {
      const params: any = { limit: 100 };
      if (historyPeriod) params.days = historyPeriod;
      const res = await moodsApi.list(params);
      setMoods(Array.isArray(res.data) ? res.data : []);
    } catch {
      setMoods([]);
      toast.error('Unable to fetch mood entries');
    }
  }, [historyPeriod]);

  const fetchInsights = useCallback(async () => {
    setInsightsLoading(true);
    setInsightsError(null);
    try {
      const res = await moodsApi.getInsights();
      if (res.data) {
        setInsights(res.data);
      }
    } catch (err: any) {
      setInsightsError('Unable to generate AI insights right now. Please try again.');
    } finally {
      setInsightsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMoods();
  }, [loadMoods]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.label) {
      toast.error('Please select an emotional label');
      return;
    }
    setLoading(true);
    try {
      await moodsApi.create(form);
      toast.success('Mood check-in recorded');
      setForm(DEFAULT_FORM);
      setShowForm(false);
      await loadMoods();
      fetchInsights();
    } catch {
      toast.error('Failed to log mood check-in');
    } finally {
      setLoading(false);
    }
  };

  const deleteMood = async (id: string) => {
    try {
      await moodsApi.delete(id);
      setMoods((prev) => prev.filter((m) => m.id !== id));
      toast.success('Check-in removed');
      fetchInsights();
    } catch {
      toast.error('Failed to remove check-in');
    }
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !form.tags?.includes(t)) {
      setForm((f) => ({ ...f, tags: [...(f.tags || []), t] }));
    }
    setTagInput('');
  };

  const safeMoods = Array.isArray(moods) ? moods : [];
  const filteredMoods = selectedTag
    ? safeMoods.filter((m) => m?.tags?.includes(selectedTag))
    : safeMoods;

  const chartData = [...safeMoods]
    .reverse()
    .slice(-14)
    .map((m) => ({
      date: m?.created_at ? format(new Date(m.created_at), 'MM/dd') : '',
      score: m?.score ?? 5,
      energy: m?.energy_level || 5,
      stress: m?.stress_level || 5,
      anxiety: m?.anxiety_level || 3,
      label: m?.label,
    }));

  const Slider = ({
    label,
    value,
    onChange,
    min = 1,
    max = 10,
    step = 0.5,
    unit = '',
    color = 'var(--accent)',
    icon: Icon,
  }: {
    label: string;
    value: number;
    onChange: (v: number) => void;
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
    color?: string;
    icon?: any;
  }) => (
    <div
      style={{
        padding: '0.85rem 1rem',
        borderRadius: 'var(--radius-sm)',
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid var(--border-dim)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {Icon && <Icon size={14} color={color} />}
          <label
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.68rem',
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontWeight: 600,
            }}
          >
            {label}
          </label>
        </div>
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1rem',
            fontWeight: 800,
            color,
          }}
        >
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{
          width: '100%',
          accentColor: color,
          cursor: 'pointer',
        }}
      />
    </div>
  );

  return (
    <div className="animate-fade-in-up" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* ── HEADER BANNER ── */}
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
            }}
          >
            Emotional Well-being & Mood
          </h2>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {(moods || []).length} check-ins recorded • Log daily to uncover personal patterns
          </p>
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="btn btn-primary"
          style={{ padding: '0.65rem 1.25rem' }}
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'CLOSE CHECK-IN' : 'NEW MOOD CHECK-IN'}
        </button>
      </div>

      {/* ── LOGGING FORM MODAL / PANEL ── */}
      {showForm && (
        <div
          className="glass-panel animate-fade-in-scale"
          style={{
            padding: '2rem',
            border: '1px solid var(--accent-border)',
            background: 'linear-gradient(145deg, var(--bg-card) 0%, rgba(20, 24, 36, 0.95) 100%)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1.5rem',
              borderBottom: '1px solid var(--border-dim)',
              paddingBottom: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} color="var(--accent-bright)" />
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', fontWeight: 700 }}>
                Record Mood Check-in
              </h3>
            </div>
            <span className="badge badge-accent" style={{ fontSize: '0.65rem' }}>
              Self-Reported
            </span>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <label
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.68rem',
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  display: 'block',
                  marginBottom: '10px',
                  fontWeight: 600,
                }}
              >
                HOW ARE YOU FEELING RIGHT NOW?
              </label>
              <MoodPicker value={form.label} onChange={(label) => setForm((f) => ({ ...f, label }))} />
            </div>

            {/* Slider Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                gap: '1rem',
              }}
            >
              <Slider
                label="Mood Intensity"
                value={form.score}
                onChange={(v) => setForm((f) => ({ ...f, score: v }))}
                icon={HeartPulse}
                color="var(--accent-bright)"
                unit="/10"
              />
              <Slider
                label="Perceived Stress"
                value={form.stress_level || 5}
                onChange={(v) => setForm((f) => ({ ...f, stress_level: v }))}
                icon={Activity}
                color="#f97316"
                unit="/10"
              />
              <Slider
                label="Anxiety / Worry"
                value={form.anxiety_level || 3}
                onChange={(v) => setForm((f) => ({ ...f, anxiety_level: v }))}
                icon={ShieldAlert}
                color="#ec4899"
                unit="/10"
              />
              <Slider
                label="Energy Level"
                value={form.energy_level || 5}
                onChange={(v) => setForm((f) => ({ ...f, energy_level: v }))}
                icon={Zap}
                color="#38bdf8"
                unit="/10"
              />
              <Slider
                label="Sleep (Hours)"
                value={form.sleep_hours || 7}
                onChange={(v) => setForm((f) => ({ ...f, sleep_hours: v }))}
                min={0}
                max={14}
                step={0.5}
                icon={Moon}
                color="#a855f7"
                unit="h"
              />
            </div>

            {/* Qualitative Notes */}
            <div>
              <label
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.68rem',
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: 600,
                }}
              >
                WHAT INFLUENCED YOUR MOOD? (OPTIONAL)
              </label>
              <textarea
                className="input-base"
                rows={3}
                value={form.notes || ''}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Mention what happened today, interactions, thoughts, or physical state..."
                style={{ resize: 'none' }}
              />
            </div>

            {/* Context Tags */}
            <div>
              <label
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.68rem',
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: 600,
                }}
              >
                TAGS (PRESS ENTER TO ADD)
              </label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                {form.tags?.map((tag) => (
                  <span
                    key={tag}
                    onClick={() => setForm((f) => ({ ...f, tags: f.tags?.filter((t) => t !== tag) }))}
                    className="badge badge-accent"
                    style={{ cursor: 'pointer', padding: '4px 10px' }}
                    title="Click to remove"
                  >
                    #{tag} ×
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px', maxWidth: '400px' }}>
                <input
                  className="input-base"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  placeholder="e.g. work, workout, deadline, family, restful"
                />
                <button type="button" onClick={addTag} className="btn btn-ghost" style={{ whiteSpace: 'nowrap' }}>
                  Add
                </button>
              </div>
            </div>

            {/* Submit / Cancel Buttons */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '0.5rem' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
                style={{ padding: '0.75rem 1.75rem' }}
              >
                {loading ? 'SAVING...' : 'SAVE CHECK-IN'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn btn-ghost">
                CANCEL
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── AI MOOD INSIGHTS SECTION ── */}
      <div
        className="card"
        style={{
          padding: '1.75rem',
          border: '1px solid var(--accent-border)',
          background: 'linear-gradient(135deg, rgba(20, 24, 38, 0.7) 0%, rgba(13, 16, 26, 0.9) 100%)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                background: 'rgba(56, 189, 248, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8',
              }}
            >
              <Sparkles size={18} />
            </div>
            <div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', fontWeight: 700 }}>
                Your Mood Insights
              </h3>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Personalized AI observations based on your actual check-ins
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {insights?.is_fallback && (
              <span
                className="badge"
                style={{
                  background: 'rgba(56, 189, 248, 0.1)',
                  color: '#38bdf8',
                  border: '1px solid #38bdf840',
                  fontSize: '0.62rem',
                }}
              >
                Curated Fallback
              </span>
            )}
            {insights && !insights.insufficient_data && (
              <span
                className="badge"
                style={{
                  background:
                    insights.trend === 'improving'
                      ? 'rgba(34, 197, 94, 0.15)'
                      : insights.trend === 'declining'
                      ? 'rgba(239, 68, 68, 0.15)'
                      : 'rgba(56, 189, 248, 0.15)',
                  color:
                    insights.trend === 'improving'
                      ? '#22c55e'
                      : insights.trend === 'declining'
                      ? '#ef4444'
                      : '#38bdf8',
                  border: '1px solid currentColor',
                  textTransform: 'uppercase',
                  fontSize: '0.68rem',
                }}
              >
                Trend: {insights.trend}
              </span>
            )}
            <button
              onClick={fetchInsights}
              disabled={insightsLoading}
              className="btn btn-ghost"
              style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '5px' }}
              title="Refresh observations"
            >
              <RefreshCw size={13} className={insightsLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {insightsLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '1.5rem 0', color: 'var(--text-secondary)' }}>
            <LoadingSpinner size="sm" />
            <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}>
              Synthesizing emotional trends and check-in history...
            </span>
          </div>
        ) : (!insights && insightsError) ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#ef4444', padding: '1rem 0' }}>
            <AlertCircle size={18} />
            <span style={{ fontSize: '0.85rem' }}>{insightsError}</span>
            <button onClick={fetchInsights} className="btn btn-ghost" style={{ fontSize: '0.75rem', marginLeft: 'auto' }}>
              Retry
            </button>
          </div>
        ) : (
          <>
            {insightsError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#f59e0b', padding: '0.5rem 0', fontSize: '0.8rem' }}>
                <AlertCircle size={14} />
                <span>Could not refresh insights. Displaying latest valid records.</span>
                <button onClick={fetchInsights} className="btn btn-ghost" style={{ fontSize: '0.72rem', padding: '2px 8px', marginLeft: 'auto' }}>
                  Retry
                </button>
              </div>
            )}
            {insights?.insufficient_data ? (
              <div
                style={{
                  padding: '1.25rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px dashed var(--border-dim)',
                  color: 'var(--text-secondary)',
                  fontSize: '0.88rem',
                  lineHeight: 1.6,
                }}
              >
                <p style={{ margin: 0 }}>
                  {insights.insights}
                </p>
              </div>
            ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '0.92rem',
                color: 'var(--text-primary)',
                lineHeight: 1.7,
                margin: 0,
              }}
            >
              {insights?.insights}
            </p>

            {/* Metrics Chips & Correlations */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '4px' }}>
              {insights?.average_score !== undefined && (
                <div
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-dim)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.72rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  Avg Mood: <strong style={{ color: 'var(--accent-bright)' }}>{insights.average_score}/10</strong>
                </div>
              )}
              {insights?.average_stress !== undefined && (
                <div
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-dim)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.72rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  Avg Stress: <strong style={{ color: '#f97316' }}>{insights.average_stress}/10</strong>
                </div>
              )}
              {insights?.average_energy !== undefined && (
                <div
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-dim)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.72rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  Avg Energy: <strong style={{ color: '#38bdf8' }}>{insights.average_energy}/10</strong>
                </div>
              )}
              {insights?.average_anxiety !== undefined && (
                <div
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-dim)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.72rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  Avg Worry: <strong style={{ color: '#ec4899' }}>{insights.average_anxiety}/10</strong>
                </div>
              )}
            </div>

            {/* Recurring Themes */}
            {insights?.themes && insights.themes.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '2px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  Frequent themes:
                </span>
                {insights.themes.map((theme) => (
                  <span key={theme} className="badge badge-subtle" style={{ fontSize: '0.68rem' }}>
                    {theme}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </>
    )}
  </div>

      {/* ── SUGGESTED NEXT STEPS (ACTION CARDS) ── */}
      {insights?.suggested_actions && insights.suggested_actions.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Sparkles size={16} color="var(--accent-bright)" />
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 700 }}>
              Suggested Next Steps
            </h3>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Tailored to your current state
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '12px',
            }}
          >
            {insights.suggested_actions.map((act) => {
              const IconComponent =
                act.badge === 'Breathing'
                  ? Wind
                  : act.badge === 'Meditation'
                  ? Compass
                  : act.badge === 'Journal'
                  ? BookOpen
                  : MessageSquare;

              return (
                <Link
                  key={act.title}
                  to={act.link}
                  className="card"
                  style={{
                    padding: '1.25rem',
                    textDecoration: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '12px',
                    border: '1px solid var(--border-dim)',
                    transition: 'var(--transition)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent-bright)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-dim)')}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '8px',
                          background: 'rgba(255, 255, 255, 0.04)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--accent-bright)',
                        }}
                      >
                        <IconComponent size={16} />
                      </div>
                      <span className="badge badge-accent" style={{ fontSize: '0.65rem' }}>
                        {act.badge}
                      </span>
                    </div>
                    <ArrowRight size={14} color="var(--text-muted)" />
                  </div>

                  <div>
                    <h4
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '0.95rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        marginBottom: '4px',
                      }}
                    >
                      {act.title}
                    </h4>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                      {act.description}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 14-DAY MULTI-VARIABLE TREND CHART ── */}
      {chartData.length > 1 && (
        <div className="card" style={{ padding: '1.75rem' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.25rem',
            }}
          >
            <div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 700 }}>
                Emotional Timeline Waveform
              </h3>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Comparing mood intensity, stress, and somatic energy over your recent entries
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.68rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-bright)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-bright)' }} /> Mood
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#f97316' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f97316' }} /> Stress
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#38bdf8' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#38bdf8' }} /> Energy
              </span>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="moodScoreGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent-bright)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="energyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
              <XAxis
                dataKey="date"
                tick={{ fontFamily: 'var(--font-mono)', fontSize: 10, fill: 'var(--text-muted)' }}
                axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                tickLine={false}
              />
              <YAxis
                domain={[1, 10]}
                tick={{ fontFamily: 'var(--font-mono)', fontSize: 10, fill: 'var(--text-muted)' }}
                axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--accent-border)',
                  borderRadius: '8px',
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.8rem',
                }}
              />
              <Area type="monotone" dataKey="score" stroke="var(--accent-bright)" strokeWidth={2.5} fill="url(#moodScoreGrad)" />
              <Area type="monotone" dataKey="stress" stroke="#f97316" strokeWidth={1.5} strokeDasharray="4 4" fill="none" />
              <Area type="monotone" dataKey="energy" stroke="#38bdf8" strokeWidth={1.5} strokeDasharray="2 2" fill="url(#energyGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── HISTORICAL MOOD LOG & FILTERING ── */}
      <div className="card" style={{ padding: '1.75rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.5rem',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={16} color="var(--accent-bright)" />
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 700 }}>
              Your Mood History
            </h3>
          </div>

          {/* Period Filter Buttons */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {[
              { label: '7D', val: 7 },
              { label: '14D', val: 14 },
              { label: '30D', val: 30 },
              { label: 'All', val: null },
            ].map((p) => {
              const active = historyPeriod === p.val;
              return (
                <button
                  key={p.label}
                  onClick={() => setHistoryPeriod(p.val)}
                  className={active ? 'btn btn-primary' : 'btn btn-ghost'}
                  style={{
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.72rem',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Tag Filter active badge */}
          {selectedTag && (
            <button
              onClick={() => setSelectedTag(null)}
              className="badge badge-accent"
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              Filtering: #{selectedTag} <X size={12} />
            </button>
          )}
        </div>

        {filteredMoods.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '3rem 1rem',
              fontFamily: 'var(--font-body)',
              color: 'var(--text-muted)',
              fontSize: '0.9rem',
            }}
          >
            <Activity size={32} style={{ margin: '0 auto 0.75rem', opacity: 0.3 }} />
            No check-ins recorded for this period. Tap "New Mood Check-in" above to log how you feel.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredMoods.map((m) => {
              const scoreColor =
                m.score >= 7.5 ? '#22c55e' : m.score >= 5.0 ? '#eab308' : '#ef4444';
              return (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    padding: '1rem 1.25rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-dim)',
                    transition: 'var(--transition)',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'baseline',
                          gap: '2px',
                          fontFamily: 'var(--font-display)',
                          fontSize: '1.4rem',
                          fontWeight: 800,
                          color: scoreColor,
                        }}
                      >
                        {m.score.toFixed(1)}
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>/10</span>
                      </div>

                      <span
                        className="badge"
                        style={{
                          background: `${scoreColor}18`,
                          color: scoreColor,
                          border: `1px solid ${scoreColor}40`,
                        }}
                      >
                        {m.label}
                      </span>

                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.68rem',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {format(new Date(m.created_at), 'EEE, MMM d • HH:mm')}
                      </span>
                    </div>

                    {/* Vitals Sub-row */}
                    <div
                      style={{
                        display: 'flex',
                        gap: '14px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.68rem',
                        color: 'var(--text-secondary)',
                        marginBottom: m.notes ? '6px' : '0',
                        flexWrap: 'wrap',
                      }}
                    >
                      {m.stress_level && <span>🔥 Stress: {m.stress_level}/10</span>}
                      {m.anxiety_level && <span>🛡️ Worry: {m.anxiety_level}/10</span>}
                      {m.energy_level && <span>⚡ Energy: {m.energy_level}/10</span>}
                      {m.sleep_hours && <span>🌙 Sleep: {m.sleep_hours}h</span>}
                    </div>

                    {m.notes && (
                      <p
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: '0.88rem',
                          color: 'var(--text-primary)',
                          lineHeight: 1.6,
                          marginTop: '4px',
                        }}
                      >
                        {m.notes}
                      </p>
                    )}

                    {m.tags && m.tags.length > 0 && (
                      <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                        {m.tags.map((t) => (
                          <button
                            key={t}
                            onClick={() => setSelectedTag(t)}
                            style={{
                              background: 'rgba(255, 255, 255, 0.04)',
                              border: '1px solid var(--border-dim)',
                              borderRadius: '4px',
                              padding: '2px 8px',
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.65rem',
                              color: 'var(--text-secondary)',
                              cursor: 'pointer',
                            }}
                          >
                            #{t}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => deleteMood(m.id)}
                    className="btn-ghost"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      padding: '6px',
                      borderRadius: '4px',
                      marginLeft: '12px',
                    }}
                    title="Delete log"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
