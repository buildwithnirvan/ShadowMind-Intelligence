import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, BookOpen, MessageSquare, Flame, TrendingUp, TrendingDown, Minus,
  Brain, Wind, ChevronRight, Stethoscope, Compass, Sparkles, ShieldAlert, ArrowUpRight
} from 'lucide-react';
import { analyticsApi, moodsApi, doctorsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import StatCard from '../components/StatCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { AnalyticsOverview, Mood } from '../types';
import { format } from 'date-fns';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function Dashboard() {
  const { user } = useAuth();
  const { applyWellnessTheme, wellnessLabel } = useTheme();
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [moods, setMoods] = useState<Mood[]>([]);
  const [insight, setInsight] = useState('');
  const [loading, setLoading] = useState(true);
  const [orbStatus, setOrbStatus] = useState<'idle' | 'thinking' | 'active'>('idle');
  const [doctorRec, setDoctorRec] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const [ov, md] = await Promise.all([
          analyticsApi.overview(30),
          moodsApi.list({ limit: 14, days: 14 }),
        ]);
        setOverview(ov.data);
        setMoods(md.data);
        if (ov.data?.average_mood) applyWellnessTheme(ov.data.average_mood);
        setOrbStatus('thinking');

        Promise.all([
          analyticsApi.aiInsight().catch(() => ({ data: { insight: '' } })),
          doctorsApi.getRecommendations().catch(() => ({ data: { recommendations: [] } })),
        ])
          .then(([insightRes, docRes]) => {
            setInsight(insightRes.data.insight);
            if (docRes.data.recommendations && docRes.data.recommendations.length > 0) {
              setDoctorRec(docRes.data.recommendations[0]);
            }
            setOrbStatus('active');
          })
          .catch(() => setOrbStatus('idle'));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const avg = overview?.average_mood;
  const wl = avg ? wellnessLabel(avg) : null;
  const trend = (t?: string) =>
    t === 'improving' ? (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#22c55e' }}>
        <TrendingUp size={14} /> Improving
      </span>
    ) : t === 'declining' ? (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: 'var(--accent-bright)' }}>
        <TrendingDown size={14} /> Attention Needed
      </span>
    ) : (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: 'var(--text-secondary)' }}>
        <Minus size={14} /> Stable
      </span>
    );

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const chart = [...moods].reverse().map((m) => ({
    date: format(new Date(m.created_at), 'MM/dd'),
    score: m.score,
    label: m.label,
  }));

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '65vh' }}>
        <LoadingSpinner message="Loading your dashboard…" size="lg" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up stagger-children" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* ── HERO COMMAND BANNER ── */}
      <div
        className="glass-panel"
        style={{
          padding: '2rem 2.25rem',
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: '2rem',
          alignItems: 'center',
          position: 'relative',
          overflow: 'hidden',
          border: '1px solid var(--accent-border)',
          background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(20, 24, 34, 0.9) 100%)',
        }}
      >
        {/* Glow ambient circle */}
        <div
          style={{
            position: 'absolute',
            top: '-40%',
            right: '-10%',
            width: '350px',
            height: '350px',
            background: 'radial-gradient(circle, var(--accent-glow) 0%, transparent 70%)',
            pointerEvents: 'none',
            borderRadius: '50%',
            opacity: 0.6,
          }}
        />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.7rem',
              color: 'var(--text-secondary)',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              marginBottom: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>{greet}</span>
            <span style={{ color: 'var(--text-muted)' }}>//</span>
            <span>{format(new Date(), 'EEEE, MMMM do, yyyy')}</span>
          </div>

          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(1.8rem, 3.5vw, 2.6rem)',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
              marginBottom: '0.85rem',
            }}
          >
            Welcome back, {user?.full_name || user?.username || 'friend'}
          </h1>

          {wl && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 14px',
                  borderRadius: '999px',
                  background: `${wl.color}15`,
                  border: `1px solid ${wl.color}40`,
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: wl.color,
                    boxShadow: `0 0 10px ${wl.color}`,
                    animation: 'pulseGlow 2.5s ease-in-out infinite',
                  }}
                />
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: wl.color,
                    letterSpacing: '0.08em',
                  }}
                >
                  {wl.label}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '1.05rem',
                    color: wl.color,
                    fontWeight: 800,
                    marginLeft: '4px',
                  }}
                >
                  {avg?.toFixed(1)}/10
                </span>
              </div>

              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.72rem',
                  padding: '6px 12px',
                  borderRadius: '999px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-dim)',
                }}
              >
                {trend(overview?.trend)}
              </div>
            </div>
          )}
        </div>

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: '50%',
              border: '1.5px solid rgba(255, 255, 255, 0.22)',
              background: '#05070B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 24px rgba(255, 138, 36, 0.4), 0 0 32px rgba(39, 184, 255, 0.35)',
              overflow: 'hidden',
              transition: 'var(--transition)',
            }}
          >
            <img
              src="/assets/shadowmind-blackhole.png"
              alt="ShadowMind Core"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        </div>
      </div>

      {/* ── KPI METRICS GRID ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1.25rem',
        }}
      >
        <StatCard
          label="Mood check-ins"
          value={overview?.mood_entries ?? 0}
          icon={Activity}
          sub={`Average ${avg?.toFixed(1) ?? '—'}/10 score`}
          color="var(--accent)"
        />
        <StatCard
          label="Journal entries"
          value={overview?.journal_entries ?? 0}
          icon={BookOpen}
          color="#38bdf8"
          sub={`${(overview?.total_words_written ?? 0).toLocaleString()} words logged`}
        />
        <StatCard
          label="Chat sessions"
          value={overview?.chat_sessions ?? 0}
          icon={MessageSquare}
          color="#a855f7"
          sub="Conversations with Shadow"
        />
        <StatCard
          label="Day streak"
          value={overview?.current_streak_days ?? 0}
          icon={Flame}
          color="#f97316"
          sub="Consecutive active days"
          trend="up"
          trendValue="Active"
        />
      </div>

      {/* ── MAIN CHARTS & COGNITIVE INSIGHT ROW ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1.2fr)',
          gap: '1.5rem',
        }}
      >
        {/* Timeline Curve */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: '320px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.25rem',
            }}
          >
            <div>
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                }}
              >
                Emotional Frequency Waveform
              </h3>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                14-Day longitudinal valence & intensity track
              </p>
            </div>
            <Link
              to="/analytics"
              className="btn btn-ghost"
              style={{ fontSize: '0.72rem', padding: '4px 10px', borderRadius: '6px' }}
            >
              Full Analytics <ChevronRight size={13} />
            </Link>
          </div>

          <div style={{ flex: 1, width: '100%', minHeight: '220px' }}>
            {chart.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="waveformGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent-bright)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.0} />
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
                      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                    }}
                    formatter={(v: number) => [`${v.toFixed(1)} / 10`, 'Mood Score']}
                  />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="var(--accent-bright)"
                    strokeWidth={3}
                    fill="url(#waveformGradient)"
                    dot={{ fill: 'var(--accent-bright)', r: 3, strokeWidth: 1, stroke: '#fff' }}
                    activeDot={{ r: 6, fill: '#fff', stroke: 'var(--accent-bright)', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div
                style={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.85rem',
                }}
              >
                <Activity size={32} style={{ opacity: 0.3 }} />
                <span>Log mood vectors to generate frequency wave analysis</span>
              </div>
            )}
          </div>
        </div>

        {/* Cognitive AI Insight Card */}
        <div
          className="card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            background: 'linear-gradient(145deg, var(--bg-card) 0%, rgba(25, 20, 35, 0.7) 100%)',
          }}
        >
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={16} color="var(--accent-bright)" />
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.72rem',
                    letterSpacing: '0.12em',
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                  }}
                >
                  Insight from your recent entries
                </span>
              </div>
              {orbStatus === 'thinking' && (
                <span className="badge badge-accent" style={{ fontSize: '0.62rem' }}>
                  Thinking…
                </span>
              )}
            </div>

            <div
              style={{
                padding: '1.25rem',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-dim)',
                lineHeight: 1.7,
                fontFamily: 'var(--font-body)',
                fontSize: '0.9rem',
                color: 'var(--text-primary)',
                fontStyle: insight ? 'italic' : 'normal',
                minHeight: '130px',
              }}
            >
              {insight ? (
                `"${insight}"`
              ) : moods.length === 0 ? (
                'Log a few moods and journal entries and I\'ll start noticing patterns and sharing gentle insights here.'
              ) : (
                'Looking at your recent entries…'
              )}
            </div>
          </div>

          <div style={{ marginTop: '1.25rem' }}>
            <Link
              to="/chat"
              className="btn btn-primary"
              style={{
                width: '100%',
                justifyContent: 'center',
                fontSize: '0.82rem',
              }}
            >
              <MessageSquare size={15} /> Talk to Shadow
            </Link>
          </div>
        </div>
      </div>

      {/* ── QUICK ACTIONS & PATTERNS TO WATCH ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1.8fr)', gap: '1.5rem', flexWrap: 'wrap' }}>
        {/* Patterns to Watch Card */}
        <div
          className="card"
          style={{
            background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(30, 20, 40, 0.6) 100%)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '1.5rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: '#ef4444', letterSpacing: '0.12em', fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Brain size={14} /> Pattern to Watch
              </span>
              <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', fontSize: '0.62rem' }}>
                Active Habit
              </span>
            </div>

            <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Academic pressure may increase your tendency to delay difficult tasks.
            </h4>

            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '12px' }}>
              <strong style={{ color: 'var(--text-primary)' }}>Early sign:</strong> "I'll start later" or excessive phone use.
            </p>

            <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px solid var(--border-dim)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              💡 <strong style={{ color: 'var(--accent-bright)' }}>Prevention:</strong> Start with 10 minutes (the Micro-Start rule).
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '1.25rem' }}>
            <Link to="/predictions" className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center', fontSize: '0.78rem' }}>
              View Plan
            </Link>
            <Link to="/chat" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', fontSize: '0.78rem' }}>
              Talk to Shadow
            </Link>
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.68rem',
              color: 'var(--text-secondary)',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              fontWeight: 600,
              marginBottom: '0.85rem',
            }}
          >
            Quick actions
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '1rem',
            }}
          >
            {[
              { to: '/chat', label: 'Chat', sub: 'Talk to Shadow', icon: MessageSquare, color: 'var(--accent)' },
              { to: '/mood', label: 'Log Mood', sub: 'State check-in', icon: Activity, color: '#38bdf8' },
              { to: '/journal', label: 'Journal', sub: 'Deep introspection', icon: BookOpen, color: '#a855f7' },
              { to: '/breathe', label: 'Breathing', sub: 'Somatic calming', icon: Wind, color: '#22c55e' },
              { to: '/meditation', label: 'Mindfulness', sub: 'Grounding timer', icon: Compass, color: '#f59e0b' },
              { to: '/predictions', label: 'Patterns', sub: 'Patterns to Watch', icon: Brain, color: '#e87522' },
            ].map(({ to, label, sub, icon: Icon, color }) => (
              <Link
                key={to}
                to={to}
                className="card card-interactive"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  padding: '1.1rem',
                  textDecoration: 'none',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    background: `${color}18`,
                    border: `1px solid ${color}44`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '2px',
                  }}
                >
                  <Icon size={17} color={color} />
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  {label}
                  <ArrowUpRight size={13} style={{ color: 'var(--text-muted)' }} />
                </div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                  {sub}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── AI CLINICAL SPECIALIST RECOMMENDATION ── */}
      {doctorRec && (
        <div
          className="card"
          style={{
            background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(20, 30, 45, 0.8) 100%)',
            border: `1px solid ${doctorRec.color || 'var(--accent)'}44`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1.5rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flex: 1, minWidth: '280px' }}>
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '12px',
                background: `${doctorRec.color || 'var(--accent)'}20`,
                border: `1px solid ${doctorRec.color || 'var(--accent)'}50`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
              }}
            >
              <Stethoscope size={24} color={doctorRec.color || 'var(--accent-bright)'} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.68rem',
                    color: 'var(--text-secondary)',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                  }}
                >
                  Recommended specialty
                </span>
                <span
                  className="badge badge-accent"
                  style={{
                    fontSize: '0.62rem',
                    padding: '2px 8px',
                    background: `${doctorRec.color}22`,
                    color: doctorRec.color,
                  }}
                >
                  {doctorRec.match_strength || 'High'} Match
                </span>
              </div>
              <h4
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.15rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                }}
              >
                {doctorRec.specialty}
              </h4>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.82rem',
                  color: 'var(--text-secondary)',
                  marginTop: '3px',
                }}
              >
                {doctorRec.why}
              </p>
            </div>
          </div>

          <Link
            to="/doctors"
            className="btn btn-ghost"
            style={{
              borderColor: `${doctorRec.color || 'var(--accent)'}66`,
              color: doctorRec.color || 'var(--text-primary)',
            }}
          >
            View directory <ChevronRight size={14} />
          </Link>
        </div>
      )}
    </div>
  );
}
