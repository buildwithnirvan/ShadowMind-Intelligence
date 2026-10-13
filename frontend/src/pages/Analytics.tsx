import { useState, useEffect } from 'react';
import {
  Brain, TrendingUp, TrendingDown, Minus, RefreshCw, AlertTriangle,
  CheckCircle, Sparkles, Activity, ShieldCheck, PieChart as PieIcon, LineChart as ChartIcon, Printer
} from 'lucide-react';
import { analyticsApi, moodsApi } from '../services/api';
import { AnalyticsOverview, MoodStats } from '../types';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, RadarChart, PolarGrid,
  PolarAngleAxis, Radar, Cell, PieChart, Pie, Legend,
} from 'recharts';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import { useTheme, wellnessLabel } from '../context/ThemeContext';
import StatCard from '../components/StatCard';

const PERIOD_OPTIONS = [7, 14, 30, 60, 90] as const;

export default function Analytics() {
  const { applyWellnessTheme } = useTheme();
  const [period, setPeriod] = useState<number>(30);
  const [activeMetric, setActiveMetric] = useState<'score' | 'energy_level' | 'stress_level' | 'sleep_hours'>('score');
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [moodStats, setMoodStats] = useState<MoodStats | null>(null);
  const [weekly, setWeekly] = useState<{ day: string; avg_score: number | null; entries: number }[]>([]);
  const [aiInsight, setAiInsight] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [emotionalData, setEmotionalData] = useState<{
    average_wellbeing: number;
    emotions: { name: string; intensity: number }[];
    future_mistakes: string[];
    corrective_actions: string[];
    timeline: { date: string; wellbeing: number; type: string }[];
  } | null>(null);

  useEffect(() => {
    load();
  }, [period]);

  const load = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [ovRes, moodRes, weeklyRes, emoRes] = await Promise.all([
        analyticsApi.overview(period),
        moodsApi.stats(period),
        analyticsApi.weeklySummary(),
        analyticsApi.emotionalInsights(period),
      ]);
      setOverview(ovRes.data);
      setMoodStats(moodRes.data);
      setWeekly(weeklyRes.data.weekly_pattern || []);
      setEmotionalData(emoRes.data);
      if (moodRes.data?.average_score != null) {
        applyWellnessTheme(moodRes.data.average_score);
      }
      if (!aiInsight || showRefresh) {
        analyticsApi
          .aiInsight()
          .then((r) => setAiInsight(r.data.insight))
          .catch(() => {});
      }
    } catch {
      toast.error('Failed to synchronize analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const pieData = moodStats?.label_distribution
    ? Object.entries(moodStats.label_distribution).map(([name, value]) => ({ name, value }))
    : [];

  const PIE_COLORS = [
    '#e50914', '#38bdf8', '#a855f7', '#22c55e', '#f97316',
    '#eab308', '#e87522', '#06b6d4', '#8b5cf6', '#64748b'
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '65vh' }}>
        <LoadingSpinner message="CALCULATING COGNITIVE HARMONICS" size="lg" />
      </div>
    );
  }

  const band = moodStats?.average_score != null ? wellnessLabel(moodStats.average_score) : null;

  return (
    <div className="animate-fade-in-up stagger-children" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* ── HEADER WITH PERIOD FILTER ── */}
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
            Your analytics
          </h2>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Multi-variable longitudinal evaluation across {period} days
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div
            style={{
              display: 'flex',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 'var(--radius-sm)',
              padding: '3px',
              border: '1px solid var(--border-dim)',
            }}
          >
            {PERIOD_OPTIONS.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                style={{
                  border: 'none',
                  background: period === p ? 'var(--accent)' : 'transparent',
                  color: period === p ? '#ffffff' : 'var(--text-secondary)',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'var(--transition)',
                  boxShadow: period === p ? '0 0 10px var(--accent-glow)' : 'none',
                }}
              >
                {p}D
              </button>
            ))}
          </div>

          <button
            onClick={() => window.print()}
            className="btn btn-outline"
            style={{
              gap: '6px',
              fontSize: '0.78rem',
              padding: '6px 12px',
            }}
          >
            <Printer size={14} /> Export Report
          </button>

          <button
            onClick={() => load(true)}
            className="btn btn-ghost"
            style={{ padding: '0.65rem', borderRadius: 'var(--radius-sm)' }}
            disabled={refreshing}
            title="Refresh analytics data"
          >
            <RefreshCw size={15} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>

      {/* ── KPI METRICS CARDS ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1.25rem',
        }}
      >
        {band && (
          <div
            className="card"
            style={{
              padding: '1.35rem 1.5rem',
              borderColor: `${band.color}55`,
              background: `linear-gradient(135deg, ${band.color}15 0%, rgba(20,24,34,0.8) 100%)`,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.68rem',
                color: 'var(--text-secondary)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                fontWeight: 600,
              }}
            >
              STATE CLASSIFICATION
            </div>
            <div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.75rem',
                  fontWeight: 800,
                  color: band.color,
                }}
              >
                {band.label.toUpperCase()}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: band.color, opacity: 0.8, marginTop: '4px' }}>
                Mean Index: {moodStats?.average_score?.toFixed(2)}/10
              </div>
            </div>
          </div>
        )}

        <StatCard
          label="Total Moods"
          value={overview?.mood_entries ?? 0}
          icon={Activity}
          sub={`Avg ${overview?.average_mood?.toFixed(1) ?? '—'}/10 score`}
          color="var(--accent)"
        />
        <StatCard
          label="Introspective Words"
          value={(overview?.total_words_written ?? 0).toLocaleString()}
          icon={Brain}
          sub={`${overview?.journal_entries ?? 0} total entries`}
          color="#38bdf8"
        />
        <StatCard
          label="Chat sessions"
          value={overview?.chat_sessions ?? 0}
          icon={Sparkles}
          sub="Guided cognitive chats"
          color="#a855f7"
        />
      </div>

      {/* ── MAIN LONGITUDINAL AREA WAVEFORM ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1.2fr)',
          gap: '1.5rem',
        }}
      >
        {/* Metric Waveform */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: '1.75rem' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.25rem',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700 }}>
                Mood over time
              </h3>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Inspect variable changes over selected timeframe
              </p>
            </div>

            {/* Metric Switcher */}
            <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.02)', padding: '2px', borderRadius: '6px', border: '1px solid var(--border-dim)' }}>
              {(['score', 'energy_level', 'stress_level', 'sleep_hours'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setActiveMetric(m)}
                  style={{
                    background: activeMetric === m ? 'var(--accent-subtle)' : 'transparent',
                    border: `1px solid ${activeMetric === m ? 'var(--accent)' : 'transparent'}`,
                    color: activeMetric === m ? 'var(--text-primary)' : 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    padding: '4px 8px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                  }}
                >
                  {m === 'score' ? 'Valence' : m === 'energy_level' ? 'Energy' : m === 'stress_level' ? 'Stress' : 'Sleep'}
                </button>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, minHeight: '230px' }}>
            {moodStats?.timeline && moodStats.timeline.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={moodStats.timeline.slice(-30).map((t) => ({
                    date: t.date ? new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '',
                    value: t[activeMetric] !== undefined && t[activeMetric] !== null ? Number(t[activeMetric]) : null,
                  }))}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="metricAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent-bright)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontFamily: 'var(--font-mono)', fontSize: 10, fill: 'var(--text-muted)' }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={activeMetric === 'sleep_hours' ? [0, 14] : [1, 10]}
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
                    formatter={(v: number) => [`${v}`, activeMetric.replace('_', ' ').toUpperCase()]}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="var(--accent-bright)"
                    strokeWidth={2.5}
                    fill="url(#metricAreaGrad)"
                    dot={{ fill: 'var(--accent-bright)', r: 3 }}
                    connectNulls
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: '0.85rem' }}>
                Not enough entries yet to plot a trend
              </div>
            )}
          </div>
        </div>

        {/* Mood Distribution Donut */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: '1.75rem' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            Emotional Category Distribution
          </h3>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Proportional frequency across state labels
          </p>

          <div style={{ flex: 1, minHeight: '220px' }}>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    dataKey="value"
                    paddingAngle={3}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="rgba(0,0,0,0.5)" />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--accent-border)',
                      borderRadius: '8px',
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.8rem',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: '0.85rem' }}>
                No emotional category data recorded
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── ROW 2: WEEKLY PATTERN & COGNITIVE RADAR ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.5rem',
        }}
      >
        {/* Weekly Day Distribution */}
        <div className="card" style={{ padding: '1.75rem' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            Circadian Weekly Patterns
          </h3>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
            Mean valence index sorted by weekday
          </p>

          <div style={{ height: '200px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekly} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="day"
                  tickFormatter={(d) => d.slice(0, 3).toUpperCase()}
                  tick={{ fontFamily: 'var(--font-mono)', fontSize: 10, fill: 'var(--text-muted)' }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 10]}
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
                <Bar dataKey="avg_score" fill="var(--accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Emotional Radar */}
        <div className="card" style={{ padding: '1.75rem' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            Core Emotional Radar Harmonics
          </h3>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
            Multidimensional intensity vector distribution
          </p>

          <div style={{ height: '200px' }}>
            {emotionalData?.emotions && emotionalData.emotions.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={emotionalData.emotions}>
                  <PolarGrid stroke="rgba(255,255,255,0.08)" />
                  <PolarAngleAxis
                    dataKey="name"
                    tick={{ fontFamily: 'var(--font-mono)', fontSize: 10, fill: 'var(--text-secondary)' }}
                  />
                  <Radar name="Intensity" dataKey="intensity" stroke="var(--accent-bright)" fill="var(--accent)" fillOpacity={0.4} />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: '0.85rem' }}>
                No emotional harmonics mapped yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── AI COGNITIVE SYNTHESIS SUMMARY ── */}
      {aiInsight && (
        <div
          className="glass-panel"
          style={{
            padding: '1.75rem',
            background: 'linear-gradient(135deg, rgba(20, 24, 38, 0.9) 0%, rgba(30, 20, 40, 0.8) 100%)',
            border: '1px solid var(--accent-border)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '1.25rem',
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '12px',
              background: 'var(--accent-subtle)',
              border: '1px solid var(--accent-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Brain size={22} color="var(--accent-bright)" />
          </div>

          <div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.68rem',
                color: 'var(--accent-bright)',
                letterSpacing: '0.12em',
                fontWeight: 700,
                textTransform: 'uppercase',
                marginBottom: '4px',
              }}
            >
              LONGITUDINAL AI COGNITIVE SYNTHESIS
            </div>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '0.92rem',
                color: 'var(--text-primary)',
                lineHeight: 1.7,
                fontStyle: 'italic',
              }}
            >
              "{aiInsight}"
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
