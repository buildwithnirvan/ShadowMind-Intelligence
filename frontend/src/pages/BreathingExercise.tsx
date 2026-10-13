import { useState, useEffect, useRef, useCallback } from 'react';
import { Wind, Play, Pause, RotateCcw, Volume2, Sparkles, Heart, Square, CheckCircle, ArrowRight } from 'lucide-react';

type Phase = 'inhale' | 'hold-in' | 'exhale' | 'hold-out' | 'idle';

interface Pattern {
  name: string;
  label: string;
  inhale: number;
  holdIn: number;
  exhale: number;
  holdOut: number;
  description: string;
  color: string;
  noHold?: boolean;
}

const PATTERNS: Pattern[] = [
  {
    name: 'gentle',
    label: 'Gentle Paced (No Hold)',
    inhale: 4,
    holdIn: 0,
    exhale: 4,
    holdOut: 0,
    description: 'A smooth, effortless 4-4 flow without breath-holding. Ideal for easing into calm.',
    color: '#38bdf8',
    noHold: true,
  },
  {
    name: 'box',
    label: 'Box Breathing',
    inhale: 4,
    holdIn: 4,
    exhale: 4,
    holdOut: 4,
    description: 'Equal 4-second phases for quick stabilization and reducing cognitive stress.',
    color: '#06b6d4',
  },
  {
    name: '478',
    label: '4-7-8 Somatic Rest',
    inhale: 4,
    holdIn: 7,
    exhale: 8,
    holdOut: 0,
    description: 'Extended exhalation vagal nerve stimulation optimized for sleep and deep calming.',
    color: '#22c55e',
  },
  {
    name: 'longer_exhale',
    label: 'Longer-Exhale Breathing',
    inhale: 4,
    holdIn: 0,
    exhale: 6,
    holdOut: 0,
    description: 'A gentle 4-in, 6-out pattern that triggers parasympathetic nervous system down-regulation.',
    color: '#a855f7',
    noHold: true,
  },
  {
    name: 'energize',
    label: 'Awakening Pranayama',
    inhale: 6,
    holdIn: 2,
    exhale: 2,
    holdOut: 0,
    description: 'Sympathetic arousal pattern designed to clear mental fog and increase morning alertness.',
    color: '#f97316',
  },
];

const PHASE_CONFIG: Record<Phase, { text: string; sub: string; guide: string }> = {
  inhale: { text: 'INHALE', sub: 'Fill your chest & expand your belly', guide: 'Breathe in slowly and smoothly through your nose' },
  'hold-in': { text: 'HOLD', sub: 'Rest gently in the stillness', guide: 'Keep your shoulders soft and body still' },
  exhale: { text: 'EXHALE', sub: 'Let go of tension completely', guide: 'Release the air gently through parted lips' },
  'hold-out': { text: 'REST', sub: 'Empty stillness before next breath', guide: 'Pause calmly before the next breath begins' },
  idle: { text: 'READY', sub: 'Choose a rhythm and press Start', guide: 'Find a comfortable upright posture' },
};

export default function BreathingExercise() {
  const [pattern, setPattern] = useState<Pattern>(PATTERNS[0]);
  const [running, setRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [timeLeft, setTimeLeft] = useState(0); // whole seconds for display
  const [cycles, setCycles] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [scale, setScale] = useState(0.45);
  const [sessionCompleted, setSessionCompleted] = useState(false);

  // References to preserve exact paused fractions and avoid desync
  const phaseRef = useRef<Phase>('idle');
  const phaseDurationRef = useRef<number>(4);
  const phaseElapsedMsRef = useRef<number>(0);
  const totalElapsedSecRef = useRef<number>(0);
  const cyclesCountRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getNextPhase = useCallback(
    (current: Phase): { next: Phase; duration: number } => {
      switch (current) {
        case 'idle':
        case 'hold-out':
          return { next: 'inhale', duration: pattern.inhale };
        case 'inhale':
          if (pattern.holdIn > 0) return { next: 'hold-in', duration: pattern.holdIn };
          return { next: 'exhale', duration: pattern.exhale };
        case 'hold-in':
          return { next: 'exhale', duration: pattern.exhale };
        case 'exhale':
          if (pattern.holdOut > 0) return { next: 'hold-out', duration: pattern.holdOut };
          cyclesCountRef.current += 1;
          setCycles(cyclesCountRef.current);
          return { next: 'inhale', duration: pattern.inhale };
        default:
          return { next: 'inhale', duration: pattern.inhale };
      }
    },
    [pattern]
  );

  // Start Session from beginning
  const startSession = () => {
    setSessionCompleted(false);
    setIsPaused(false);
    setRunning(true);

    const { next, duration } = getNextPhase('idle');
    phaseRef.current = next;
    phaseDurationRef.current = duration;
    phaseElapsedMsRef.current = 0;
    setPhase(next);
    setTimeLeft(duration);
    setScale(next === 'inhale' ? 0.45 : 1.0);
  };

  // Pause session (freezes exact phase & elapsed progress)
  const pauseSession = () => {
    setIsPaused(true);
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  // Resume session (continues from frozen phase and remaining fraction)
  const resumeSession = () => {
    setIsPaused(false);
    setRunning(true);
  };

  // Restart session
  const restartSession = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRunning(false);
    setIsPaused(false);
    setSessionCompleted(false);
    setPhase('idle');
    setTimeLeft(0);
    setCycles(0);
    setTotalTime(0);
    setScale(0.45);
    phaseRef.current = 'idle';
    phaseDurationRef.current = 4;
    phaseElapsedMsRef.current = 0;
    totalElapsedSecRef.current = 0;
    cyclesCountRef.current = 0;
  };

  // End session
  const endSession = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRunning(false);
    setIsPaused(false);
    setSessionCompleted(true);
    setPhase('idle');
    setScale(0.45);
  };

  // Main 50ms animation and timing loop
  useEffect(() => {
    if (!running || isPaused) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    const TICK_MS = 50;
    let secCounter = 0;

    intervalRef.current = setInterval(() => {
      phaseElapsedMsRef.current += TICK_MS;
      secCounter += TICK_MS;

      if (secCounter >= 1000) {
        secCounter -= 1000;
        totalElapsedSecRef.current += 1;
        setTotalTime(totalElapsedSecRef.current);
      }

      const totalPhaseMs = phaseDurationRef.current * 1000;
      const remainingSec = Math.max(1, Math.ceil((totalPhaseMs - phaseElapsedMsRef.current) / 1000));
      setTimeLeft(remainingSec);

      // Smooth mathematical progress
      const progress = Math.min(1.0, phaseElapsedMsRef.current / totalPhaseMs);
      const currentP = phaseRef.current;

      if (currentP === 'inhale') {
        // Expand from 0.45 to 1.0
        setScale(0.45 + 0.55 * progress);
      } else if (currentP === 'hold-in') {
        // Hold steady at 1.0
        setScale(1.0);
      } else if (currentP === 'exhale') {
        // Contract from 1.0 to 0.45
        setScale(1.0 - 0.55 * progress);
      } else if (currentP === 'hold-out') {
        // Hold steady at 0.45
        setScale(0.45);
      }

      // Check phase transition
      if (phaseElapsedMsRef.current >= totalPhaseMs) {
        if (currentP === 'exhale' && pattern.holdOut === 0) {
          cyclesCountRef.current += 1;
          setCycles(cyclesCountRef.current);
        } else if (currentP === 'hold-out') {
          cyclesCountRef.current += 1;
          setCycles(cyclesCountRef.current);
        }

        const { next, duration } = getNextPhase(currentP);
        phaseRef.current = next;
        phaseDurationRef.current = duration;
        phaseElapsedMsRef.current = 0;
        setPhase(next);
        setTimeLeft(duration);
      }
    }, TICK_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, isPaused, getNextPhase, pattern]);

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const circleColor = pattern.color;
  const currentConfig = PHASE_CONFIG[phase];

  return (
    <div className="animate-fade-in-up" style={{ maxWidth: '820px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
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
          Resonance Breathwork Pacer
        </h2>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
          Calibrate your nervous system, lower somatic stress, and restore balance
        </p>
      </div>

      {/* ── TECHNIQUE SELECTOR ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
        {PATTERNS.map((p) => {
          const selected = pattern.name === p.name;
          return (
            <button
              key={p.name}
              disabled={running}
              onClick={() => {
                restartSession();
                setPattern(p);
              }}
              style={{
                background: selected ? `${p.color}15` : 'rgba(255, 255, 255, 0.02)',
                border: `1px solid ${selected ? p.color : 'var(--border-dim)'}`,
                borderRadius: 'var(--radius-sm)',
                padding: '1rem',
                cursor: running ? 'not-allowed' : 'pointer',
                textAlign: 'left',
                opacity: running && !selected ? 0.5 : 1,
                transition: 'var(--transition)',
                boxShadow: selected ? `0 0 16px ${p.color}30` : 'none',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '0.92rem',
                  fontWeight: 700,
                  color: selected ? p.color : 'var(--text-primary)',
                  marginBottom: '4px',
                }}
              >
                {p.label}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                {p.inhale}s In • {p.holdIn > 0 ? `${p.holdIn}s Hold • ` : ''}{p.exhale}s Out{p.holdOut > 0 ? ` • ${p.holdOut}s Rest` : ''}
              </div>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.72rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.4,
                  margin: 0,
                }}
              >
                {p.description}
              </p>
            </button>
          );
        })}
      </div>

      {/* ── SESSION COMPLETED MODAL / CARD ── */}
      {sessionCompleted && (
        <div
          className="glass-panel animate-fade-in-scale"
          style={{
            padding: '2.5rem',
            textAlign: 'center',
            border: '1px solid var(--accent-border)',
            background: 'linear-gradient(135deg, rgba(20, 24, 38, 0.95) 0%, rgba(13, 16, 26, 0.98) 100%)',
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'rgba(34, 197, 94, 0.15)',
              color: '#22c55e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
            }}
          >
            <CheckCircle size={28} />
          </div>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 800, marginBottom: '6px' }}>
            Session Complete
          </h3>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: 'var(--text-secondary)', maxWidth: '440px', margin: '0 auto 1.5rem' }}>
            Well done. You practiced <strong>{pattern.label}</strong> for <strong>{fmtTime(totalTime)}</strong>, completing <strong>{cycles} breath cycles</strong>.
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button onClick={restartSession} className="btn btn-primary" style={{ padding: '0.65rem 1.5rem' }}>
              Practice Again
            </button>
          </div>
        </div>
      )}

      {/* ── CENTRAL ANIMATED PACER CONTAINER ── */}
      {!sessionCompleted && (
        <div
          className="glass-panel"
          style={{
            position: 'relative',
            padding: '3rem 2rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--accent-border)',
            minHeight: '440px',
            overflow: 'hidden',
          }}
        >
          {/* Subtle concentric ambient aura */}
          <div
            style={{
              position: 'absolute',
              width: 380,
              height: 380,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${circleColor}20 0%, transparent 70%)`,
              opacity: running ? 0.8 : 0.2,
              transition: 'opacity 0.8s ease',
              pointerEvents: 'none',
            }}
          />

          {/* Central Synchronized Visualizer */}
          <div
            style={{
              position: 'relative',
              width: 260,
              height: 260,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Outer Soft Ring */}
            <div
              style={{
                position: 'absolute',
                width: 240,
                height: 240,
                borderRadius: '50%',
                border: `1.5px solid ${circleColor}30`,
                transform: `scale(${scale * 1.15})`,
                transition: 'border-color 0.4s ease',
              }}
            />

            {/* Glowing Orb / Core Ring */}
            <div
              style={{
                position: 'absolute',
                width: 200,
                height: 200,
                borderRadius: '50%',
                background: `radial-gradient(circle, ${circleColor}35 0%, ${circleColor}10 70%, transparent 100%)`,
                border: `2px solid ${circleColor}`,
                boxShadow: running
                  ? `0 0 45px ${circleColor}55, inset 0 0 25px ${circleColor}35`
                  : `0 0 15px ${circleColor}20`,
                transform: `scale(${scale})`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* Inner Phase Counter & Label */}
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.35rem',
                  fontWeight: 800,
                  color: '#ffffff',
                  letterSpacing: '0.04em',
                  textShadow: '0 2px 10px rgba(0,0,0,0.5)',
                  marginBottom: '2px',
                }}
              >
                {currentConfig.text}
              </div>

              {running && timeLeft > 0 && (
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '1.8rem',
                    fontWeight: 800,
                    color: circleColor,
                    lineHeight: 1,
                  }}
                >
                  {timeLeft}
                </div>
              )}
            </div>
          </div>

          {/* Guidance text under orb */}
          <div style={{ textAlign: 'center', marginTop: '2rem', zIndex: 1 }}>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '0.92rem',
                color: 'var(--text-primary)',
                fontWeight: 600,
                margin: 0,
              }}
            >
              {currentConfig.sub}
            </p>
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.72rem',
                color: 'var(--text-muted)',
                marginTop: '4px',
              }}
            >
              {currentConfig.guide}
            </p>
          </div>

          {/* Vitals sub-bar: elapsed time & completed cycles */}
          <div
            style={{
              display: 'flex',
              gap: '24px',
              marginTop: '1.75rem',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              borderTop: '1px solid var(--border-dim)',
              paddingTop: '1rem',
              width: '100%',
              justifyContent: 'center',
            }}
          >
            <span>Elapsed: <strong style={{ color: 'var(--text-primary)' }}>{fmtTime(totalTime)}</strong></span>
            <span>•</span>
            <span>Cycles: <strong style={{ color: circleColor }}>{cycles}</strong></span>
            <span>•</span>
            <span>Technique: <strong style={{ color: 'var(--text-primary)' }}>{pattern.label}</strong></span>
          </div>

          {/* ── SESSION CONTROLS (Start, Pause, Resume, Restart, End) ── */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            {!running && !isPaused ? (
              <button
                onClick={startSession}
                className="btn btn-primary"
                style={{ padding: '0.75rem 2rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Play size={16} fill="currentColor" /> START BREATHING
              </button>
            ) : running ? (
              <button
                onClick={pauseSession}
                className="btn btn-ghost"
                style={{ padding: '0.75rem 1.75rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Pause size={16} /> PAUSE
              </button>
            ) : (
              <button
                onClick={resumeSession}
                className="btn btn-primary"
                style={{ padding: '0.75rem 1.75rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Play size={16} fill="currentColor" /> RESUME
              </button>
            )}

            {(running || isPaused || totalTime > 0) && (
              <>
                <button
                  onClick={restartSession}
                  className="btn btn-ghost"
                  style={{ padding: '0.75rem 1.25rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                  title="Reset and start over"
                >
                  <RotateCcw size={15} /> Restart
                </button>
                <button
                  onClick={endSession}
                  className="btn btn-ghost"
                  style={{
                    padding: '0.75rem 1.25rem',
                    fontSize: '0.85rem',
                    color: '#ef4444',
                    borderColor: 'rgba(239, 68, 68, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                  title="Finish session now"
                >
                  <Square size={14} fill="currentColor" /> End Session
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
