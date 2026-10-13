import { useState, useEffect, useRef } from 'react';
import {
  Play, Pause, Square, Wind, Clock, Sparkles, Volume2, VolumeX,
  Compass, RotateCcw, ChevronRight, ChevronLeft, CheckCircle2,
  AlertCircle, ShieldCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import { meditationsApi } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

const FOCUS_AREAS = [
  { id: 'Anxiety Relief', label: 'Anxiety & Stress Relief', desc: 'Somatic grounding & nervous system calming' },
  { id: 'Deep Sleep', label: 'Deep Sleep & Relaxation', desc: 'Hypnagogic theta state induction & body rest' },
  { id: 'Focus & Clarity', label: 'Focus & Mental Clarity', desc: 'Cognitive de-cluttering & alert presence' },
  { id: 'Self-Compassion', label: 'Self-Compassion & Healing', desc: 'Emotional safety & non-judgmental acceptance' },
  { id: 'Mindful Awareness', label: 'Mindful Awareness', desc: 'Present-moment grounding and sensory anchoring' },
];

const EXPERIENCE_LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
const GUIDANCE_STYLES = [
  { id: 'calm', label: 'Gentle & Warm' },
  { id: 'grounded', label: 'Direct & Grounded' },
  { id: 'spacious', label: 'Slow & Spacious' },
];

interface GeneratedMeditation {
  title: string;
  script: string;
  duration: number;
  focus_area: string;
  stages: string[];
  is_fallback?: boolean;
}

export default function Meditation() {
  const [duration, setDuration] = useState(5);
  const [focusArea, setFocusArea] = useState('Anxiety Relief');
  const [experienceLevel, setExperienceLevel] = useState('Beginner');
  const [guidanceStyle, setGuidanceStyle] = useState('calm');

  const [meditation, setMeditation] = useState<GeneratedMeditation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Player States
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionPaused, setSessionPaused] = useState(false);
  const [currentStageIdx, setCurrentStageIdx] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [totalElapsed, setTotalElapsed] = useState(0);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [sessionCompleted, setSessionCompleted] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up speech and intervals on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setMeditation(null);
    setSessionActive(false);
    setSessionCompleted(false);

    try {
      const res = await meditationsApi.generate({
        duration_minutes: duration,
        focus_area: focusArea,
        experience_level: experienceLevel,
        guidance_style: guidanceStyle,
      });

      if (res.data && (res.data.script || res.data.stages)) {
        const rawStages = Array.isArray(res.data.stages) && res.data.stages.length > 0
          ? res.data.stages
          : (res.data.script ? res.data.script.split(/\n\n+/).map((s: string) => s.trim()).filter(Boolean) : []);
        const stages = rawStages.length > 0 ? rawStages : [res.data.script || 'Begin by resting your attention on your breathing.'];
        const safeMeditation: GeneratedMeditation = {
          title: res.data.title || `Meditation for ${focusArea}`,
          script: res.data.script || stages.join('\n\n'),
          duration: Number(res.data.duration) || duration,
          focus_area: res.data.focus_area || focusArea,
          stages,
          is_fallback: Boolean(res.data.is_fallback),
        };
        setMeditation(safeMeditation);
        setSecondsRemaining(safeMeditation.duration * 60);
        setCurrentStageIdx(0);
        setTotalElapsed(0);
        toast.success(
          safeMeditation.is_fallback
            ? 'Loaded curated offline meditation session'
            : 'Custom meditation session generated'
        );
      } else {
        throw new Error('Received empty meditation response');
      }
    } catch (err: any) {
      const errMsg =
        err?.response?.data?.detail ||
        err?.message ||
        'Failed to generate meditation session. Please try again.';
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const speakStage = (text: string) => {
    if (!ttsEnabled || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.85;
    utterance.pitch = 0.95;
    window.speechSynthesis.speak(utterance);
  };

  const startSession = () => {
    setSessionActive(true);
    setSessionPaused(false);
    setSessionCompleted(false);

    if (meditation && Array.isArray(meditation.stages) && meditation.stages.length > 0) {
      speakStage(meditation.stages[currentStageIdx] || meditation.script);
    }

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          finishSession();
          return 0;
        }
        return prev - 1;
      });
      setTotalElapsed((e) => e + 1);
    }, 1000);
  };

  const pauseSession = () => {
    setSessionPaused(true);
    if (timerRef.current) clearInterval(timerRef.current);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  const resumeSession = () => {
    setSessionPaused(false);
    if (meditation && Array.isArray(meditation.stages) && meditation.stages.length > 0) {
      speakStage(meditation.stages[currentStageIdx] || meditation.script);
    }
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          finishSession();
          return 0;
        }
        return prev - 1;
      });
      setTotalElapsed((e) => e + 1);
    }, 1000);
  };

  const finishSession = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSessionActive(false);
    setSessionPaused(false);
    setSessionCompleted(true);

    if (meditation) {
      try {
        await meditationsApi.complete({
          title: meditation.title,
          duration_minutes: meditation.duration,
          focus_area: meditation.focus_area,
          elapsed_seconds: totalElapsed,
        });
      } catch {
        /* non-blocking */
      }
    }
    toast.success('Meditation completed');
  };

  const nextStage = () => {
    if (!meditation) return;
    const totalStages = Array.isArray(meditation.stages) ? meditation.stages.length : 1;
    if (currentStageIdx < totalStages - 1) {
      const nextIdx = currentStageIdx + 1;
      setCurrentStageIdx(nextIdx);
      if (sessionActive && !sessionPaused && meditation.stages?.[nextIdx]) {
        speakStage(meditation.stages[nextIdx]);
      }
    } else {
      finishSession();
    }
  };

  const prevStage = () => {
    if (!meditation) return;
    if (currentStageIdx > 0) {
      const prevIdx = currentStageIdx - 1;
      setCurrentStageIdx(prevIdx);
      if (sessionActive && !sessionPaused && meditation.stages?.[prevIdx]) {
        speakStage(meditation.stages[prevIdx]);
      }
    }
  };

  const fmtTime = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div
      className="animate-fade-in-up"
      style={{
        maxWidth: '820px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.75rem',
      }}
    >
      {/* ── HEADER ── */}
      <div style={{ textAlign: 'center' }}>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.8rem',
            fontWeight: 800,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
          }}
        >
          Mindfulness & Guided Meditation
        </h2>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.88rem',
            color: 'var(--text-secondary)',
            marginTop: '4px',
          }}
        >
          Personalized guided practice generated for your intention and schedule
        </p>
      </div>

      {/* ── CONFIGURATION & GENERATOR FORM ── */}
      {!meditation && !loading && (
        <div
          className="glass-panel"
          style={{
            padding: '2.25rem',
            border: '1px solid var(--accent-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.75rem',
          }}
        >
          {/* Focus Target */}
          <div>
            <label
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.68rem',
                color: 'var(--text-secondary)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                fontWeight: 600,
                display: 'block',
                marginBottom: '10px',
              }}
            >
              1. CHOOSE MEDITATION FOCUS
            </label>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '10px',
              }}
            >
              {FOCUS_AREAS.map((fa) => {
                const selected = focusArea === fa.id;
                return (
                  <button
                    key={fa.id}
                    type="button"
                    onClick={() => setFocusArea(fa.id)}
                    style={{
                      background: selected
                        ? 'rgba(56, 189, 248, 0.12)'
                        : 'rgba(255, 255, 255, 0.02)',
                      border: `1px solid ${
                        selected ? 'var(--accent-bright)' : 'var(--border-dim)'
                      }`,
                      borderRadius: 'var(--radius-sm)',
                      padding: '1rem',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'var(--transition)',
                      boxShadow: selected
                        ? '0 0 14px rgba(56, 189, 248, 0.2)'
                        : 'none',
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '0.92rem',
                        fontWeight: 700,
                        color: selected
                          ? 'var(--accent-bright)'
                          : 'var(--text-primary)',
                        marginBottom: '4px',
                      }}
                    >
                      {fa.label}
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: '0.74rem',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.4,
                      }}
                    >
                      {fa.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Duration Selector */}
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '10px',
              }}
            >
              <label
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.68rem',
                  color: 'var(--text-secondary)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                }}
              >
                2. SESSION DURATION
              </label>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8rem',
                  color: 'var(--accent-bright)',
                  fontWeight: 700,
                }}
              >
                {duration} Minutes
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[3, 5, 10, 15, 20].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d)}
                  className={duration === d ? 'btn btn-primary' : 'btn btn-ghost'}
                  style={{
                    flex: 1,
                    minWidth: '60px',
                    padding: '0.6rem 0.5rem',
                    fontSize: '0.85rem',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {d}m
                </button>
              ))}
            </div>
          </div>

          {/* Level and Guidance Style Sub-grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1.25rem',
            }}
          >
            <div>
              <label
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.68rem',
                  color: 'var(--text-secondary)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  display: 'block',
                  marginBottom: '8px',
                }}
              >
                EXPERIENCE LEVEL
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {EXPERIENCE_LEVELS.map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setExperienceLevel(lvl)}
                    className={
                      experienceLevel === lvl ? 'btn btn-primary' : 'btn btn-ghost'
                    }
                    style={{
                      minHeight: '46px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      padding: '0.5rem 0.4rem',
                      fontSize: '0.78rem',
                      lineHeight: 1.25,
                      boxSizing: 'border-box',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.68rem',
                  color: 'var(--text-secondary)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  display: 'block',
                  marginBottom: '8px',
                }}
              >
                PACING & TONE
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {GUIDANCE_STYLES.map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setGuidanceStyle(st.id)}
                    className={
                      guidanceStyle === st.id ? 'btn btn-primary' : 'btn btn-ghost'
                    }
                    style={{
                      minHeight: '46px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      padding: '0.5rem 0.4rem',
                      fontSize: '0.78rem',
                      lineHeight: 1.25,
                      boxSizing: 'border-box',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#ef4444',
                fontSize: '0.85rem',
                padding: '0.75rem',
                borderRadius: '6px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
              }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Generate Button */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            className="btn btn-primary"
            style={{
              padding: '0.9rem',
              fontSize: '0.95rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              letterSpacing: '0.04em',
            }}
          >
            <Sparkles size={18} /> GENERATE GUIDED SESSION
          </button>
        </div>
      )}

      {/* ── GENERATING STATE ── */}
      {loading && (
        <div
          className="glass-panel"
          style={{
            padding: '4rem 2rem',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <LoadingSpinner size="lg" />
          <h3
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.25rem',
              fontWeight: 700,
            }}
          >
            Structuring Your Guided Meditation...
          </h3>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
              maxWidth: '420px',
              margin: 0,
            }}
          >
            Synthesizing cues for {duration}-minute {focusArea} with {experienceLevel} pacing...
          </p>
        </div>
      )}

      {/* ── SESSION COMPLETED SCREEN ── */}
      {sessionCompleted && (
        <div
          className="glass-panel animate-fade-in-scale"
          style={{
            padding: '3rem 2rem',
            textAlign: 'center',
            border: '1px solid var(--accent-border)',
            background:
              'linear-gradient(135deg, rgba(20, 24, 38, 0.95) 0%, rgba(13, 16, 26, 0.98) 100%)',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'rgba(34, 197, 94, 0.15)',
              color: '#22c55e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
            }}
          >
            <CheckCircle2 size={32} />
          </div>
          <h3
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.5rem',
              fontWeight: 800,
              marginBottom: '6px',
            }}
          >
            Practice Completed
          </h3>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.9rem',
              color: 'var(--text-secondary)',
              maxWidth: '460px',
              margin: '0 auto 1.5rem',
              lineHeight: 1.6,
            }}
          >
            You spent <strong>{fmtTime(totalElapsed)}</strong> grounding yourself with "
            {meditation?.title || 'Meditation'}". Allow yourself to carry this stillness into your next activity.
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button
              onClick={() => {
                setMeditation(null);
                setSessionCompleted(false);
              }}
              className="btn btn-primary"
              style={{ padding: '0.7rem 1.75rem' }}
            >
              Generate New Practice
            </button>
          </div>
        </div>
      )}

      {/* ── MEDITATION SESSION PLAYER ── */}
      {meditation && !sessionCompleted && (
        <div
          className="glass-panel animate-fade-in-up"
          style={{
            padding: '2.5rem',
            border: '1px solid var(--accent-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.75rem',
          }}
        >
          {/* Session Banner Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              borderBottom: '1px solid var(--border-dim)',
              paddingBottom: '1.25rem',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span className="badge badge-accent" style={{ fontSize: '0.65rem' }}>
                  {meditation.focus_area}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {meditation.duration} MIN PRACTICE
                </span>
                {meditation.is_fallback && (
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
              </div>
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.45rem',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.01em',
                  margin: 0,
                }}
              >
                {meditation.title}
              </h3>
            </div>

            {/* Audio Toggle & Discard */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setTtsEnabled(!ttsEnabled)}
                className="btn btn-ghost"
                style={{ padding: '0.45rem 0.8rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                title={ttsEnabled ? 'Voice Guidance Active' : 'Voice Guidance Muted'}
              >
                {ttsEnabled ? <Volume2 size={15} color="var(--accent-bright)" /> : <VolumeX size={15} />}
                {ttsEnabled ? 'Voice: On' : 'Voice: Muted'}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (timerRef.current) clearInterval(timerRef.current);
                  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
                  setMeditation(null);
                  setSessionActive(false);
                }}
                className="btn btn-ghost"
                style={{ padding: '0.45rem 0.8rem', fontSize: '0.75rem' }}
              >
                Discard
              </button>
            </div>
          </div>

          {/* Central Active Guidance Stage */}
          <div
            style={{
              padding: '2rem',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-dim)',
              textAlign: 'center',
              minHeight: '160px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.68rem',
                color: 'var(--accent-bright)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: '10px',
              }}
            >
              Stage {currentStageIdx + 1} of {(Array.isArray(meditation.stages) ? meditation.stages.length : 1)}
            </div>

            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '1.15rem',
                lineHeight: 1.8,
                color: 'var(--text-primary)',
                maxWidth: '650px',
                margin: '0 auto',
              }}
            >
              {(Array.isArray(meditation.stages) && meditation.stages[currentStageIdx]) || meditation.script || 'Breathe calmly...'}
            </p>
          </div>

          {/* Pacing & Timeline Progress */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
              }}
            >
              <span>Elapsed: {fmtTime(totalElapsed)}</span>
              <span>Remaining: {fmtTime(secondsRemaining)}</span>
            </div>

            {/* Progress bar */}
            <div
              style={{
                height: 4,
                width: '100%',
                background: 'rgba(255, 255, 255, 0.08)',
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(
                    100,
                    (totalElapsed / (meditation.duration * 60)) * 100
                  )}%`,
                  background: 'var(--accent-bright)',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>

          {/* Player Navigation & Controls */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={prevStage}
                disabled={currentStageIdx === 0}
                className="btn btn-ghost"
                style={{ padding: '0.55rem 0.9rem', fontSize: '0.8rem' }}
              >
                <ChevronLeft size={16} /> Prev Stage
              </button>
              <button
                type="button"
                onClick={nextStage}
                className="btn btn-ghost"
                style={{ padding: '0.55rem 0.9rem', fontSize: '0.8rem' }}
              >
                Next Stage <ChevronRight size={16} />
              </button>
            </div>

            {/* Central Play / Pause / Complete Button */}
            <div style={{ display: 'flex', gap: '10px' }}>
              {!sessionActive && !sessionPaused ? (
                <button
                  type="button"
                  onClick={startSession}
                  className="btn btn-primary"
                  style={{
                    padding: '0.7rem 1.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <Play size={16} fill="currentColor" /> START SESSION
                </button>
              ) : sessionActive ? (
                <button
                  type="button"
                  onClick={pauseSession}
                  className="btn btn-ghost"
                  style={{
                    padding: '0.7rem 1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <Pause size={16} /> PAUSE
                </button>
              ) : (
                <button
                  type="button"
                  onClick={resumeSession}
                  className="btn btn-primary"
                  style={{
                    padding: '0.7rem 1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <Play size={16} fill="currentColor" /> RESUME
                </button>
              )}

              <button
                type="button"
                onClick={finishSession}
                className="btn btn-ghost"
                style={{
                  padding: '0.7rem 1.25rem',
                  color: '#ef4444',
                  borderColor: 'rgba(239, 68, 68, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Square size={14} fill="currentColor" /> Finish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
