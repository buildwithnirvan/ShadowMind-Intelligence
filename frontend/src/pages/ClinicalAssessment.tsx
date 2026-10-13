import React, { useState } from 'react';
import { ClipboardList, CheckCircle2, AlertTriangle, Info, ArrowRight, ShieldCheck, Download, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

interface Question {
  id: number;
  text: string;
}

const PHQ9_QUESTIONS: Question[] = [
  { id: 1, text: "Little interest or pleasure in doing things?" },
  { id: 2, text: "Feeling down, depressed, or hopeless?" },
  { id: 3, text: "Trouble falling or staying asleep, or sleeping too much?" },
  { id: 4, text: "Feeling tired or having little energy?" },
  { id: 5, text: "Poor appetite or overeating?" },
  { id: 6, text: "Feeling bad about yourself — or that you are a failure or have let yourself or your family down?" },
  { id: 7, text: "Trouble concentrating on things, such as reading the newspaper or watching television?" },
  { id: 8, text: "Moving or speaking so slowly that other people could have noticed? Or the opposite — being so fidgety or restless?" },
  { id: 9, text: "Thoughts that you would be better off dead, or of hurting yourself in some way?" }
];

const GAD7_QUESTIONS: Question[] = [
  { id: 1, text: "Feeling nervous, anxious, or on edge?" },
  { id: 2, text: "Not being able to stop or control worrying?" },
  { id: 3, text: "Worrying too much about different things?" },
  { id: 4, text: "Trouble relaxing?" },
  { id: 5, text: "Being so restless that it is hard to sit still?" },
  { id: 6, text: "Becoming easily annoyed or irritable?" },
  { id: 7, text: "Feeling afraid as if something awful might happen?" }
];

const OPTIONS = [
  { label: "Not at all", value: 0 },
  { label: "Several days", value: 1 },
  { label: "More than half the days", value: 2 },
  { label: "Nearly every day", value: 3 }
];

export default function ClinicalAssessment() {
  const [activeTab, setActiveTab] = useState<'phq9' | 'gad7'>('phq9');
  const [phq9Answers, setPhq9Answers] = useState<Record<number, number>>({});
  const [gad7Answers, setGad7Answers] = useState<Record<number, number>>({});
  const [phq9Submitted, setPhq9Submitted] = useState(false);
  const [gad7Submitted, setGad7Submitted] = useState(false);

  const calculateScore = (answers: Record<number, number>, totalQuestions: number) => {
    let score = 0;
    for (let i = 1; i <= totalQuestions; i++) {
      score += answers[i] ?? 0;
    }
    return score;
  };

  const phq9Score = calculateScore(phq9Answers, 9);
  const gad7Score = calculateScore(gad7Answers, 7);

  const getPhq9Result = (score: number) => {
    if (score <= 4) return { level: "Minimal / None", color: "#22c55e", desc: "No significant depressive symptoms indicated.", action: "Maintain routine wellness practices." };
    if (score <= 9) return { level: "Mild Depression", color: "#eab308", desc: "Mild depressive symptoms present.", action: "Consider mindfulness, regular sleep, and light CBT exercises." };
    if (score <= 14) return { level: "Moderate Depression", color: "#f97316", desc: "Moderate depressive symptoms detected.", action: "Recommended to speak with a counselor or mental health specialist." };
    if (score <= 19) return { level: "Moderately Severe Depression", color: "#ef4444", desc: "Significant depressive symptoms present.", action: "Consultation with a healthcare provider is strongly recommended." };
    return { level: "Severe Depression", color: "#dc2626", desc: "Severe depressive symptoms detected.", action: "Immediate evaluation by a mental health professional is recommended." };
  };

  const getGad7Result = (score: number) => {
    if (score <= 4) return { level: "Minimal Anxiety", color: "#22c55e", desc: "Minimal anxiety symptoms present.", action: "Continue healthy stress management routines." };
    if (score <= 9) return { level: "Mild Anxiety", color: "#eab308", desc: "Mild anxiety symptoms observed.", action: "Practice daily breath pacing and relaxation exercises." };
    if (score <= 14) return { level: "Moderate Anxiety", color: "#f97316", desc: "Moderate anxiety symptoms present.", action: "Consider structured CBT exercises and professional advice." };
    return { level: "Severe Anxiety", color: "#ef4444", desc: "Severe anxiety symptoms detected.", action: "Professional evaluation and support is strongly advised." };
  };

  const isPhq9Complete = Object.keys(phq9Answers).length === 9;
  const isGad7Complete = Object.keys(gad7Answers).length === 7;

  const handlePhq9Submit = () => {
    if (!isPhq9Complete) {
      toast.error("Please answer all 9 questions before completing.");
      return;
    }
    setPhq9Submitted(true);
    toast.success("PHQ-9 Assessment completed successfully!");
  };

  const handleGad7Submit = () => {
    if (!isGad7Complete) {
      toast.error("Please answer all 7 questions before completing.");
      return;
    }
    setGad7Submitted(true);
    toast.success("GAD-7 Assessment completed successfully!");
  };

  const resetPhq9 = () => {
    setPhq9Answers({});
    setPhq9Submitted(false);
  };

  const resetGad7 = () => {
    setGad7Answers({});
    setGad7Submitted(false);
  };

  const phq9Res = getPhq9Result(phq9Score);
  const gad7Res = getGad7Result(gad7Score);

  return (
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <ClipboardList size={28} color="var(--accent-bright)" />
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0 }}>Clinical Self-Assessments</h1>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
          Standard validated medical screening instruments (PHQ-9 & GAD-7) to measure depression and anxiety symptom severity over the last 2 weeks.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '2rem', borderBottom: '1px solid var(--border-dim)', paddingBottom: '1rem' }}>
        <button
          onClick={() => setActiveTab('phq9')}
          className="btn"
          style={{
            background: activeTab === 'phq9' ? 'var(--accent-subtle)' : 'transparent',
            border: `1px solid ${activeTab === 'phq9' ? 'var(--accent-bright)' : 'var(--border-dim)'}`,
            color: activeTab === 'phq9' ? '#fff' : 'var(--text-secondary)',
            fontWeight: 600
          }}
        >
          PHQ-9 (Depression Scale)
        </button>
        <button
          onClick={() => setActiveTab('gad7')}
          className="btn"
          style={{
            background: activeTab === 'gad7' ? 'var(--accent-subtle)' : 'transparent',
            border: `1px solid ${activeTab === 'gad7' ? 'var(--accent-bright)' : 'var(--border-dim)'}`,
            color: activeTab === 'gad7' ? '#fff' : 'var(--text-secondary)',
            fontWeight: 600
          }}
        >
          GAD-7 (Anxiety Scale)
        </button>
      </div>

      {/* Medical Disclaimer */}
      <div style={{
        background: 'rgba(59, 130, 246, 0.08)',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        borderRadius: '12px',
        padding: '1rem 1.25rem',
        marginBottom: '2rem',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontSize: '0.85rem',
        color: 'var(--text-secondary)'
      }}>
        <Info size={20} color="#60a5fa" style={{ flexShrink: 0 }} />
        <span>
          <strong>Clinical Disclaimer:</strong> These questionnaires are validated self-report screening tools for monitoring symptoms over time. They are not intended as diagnostic tools. Always consult a qualified medical professional for clinical evaluation.
        </span>
      </div>

      {/* PHQ-9 Form / Results */}
      {activeTab === 'phq9' && (
        <div>
          {!phq9Submitted ? (
            <div style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '1.75rem', border: '1px solid var(--border-dim)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-[#fff]', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>PHQ-9 Question Set</h2>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Answered: {Object.keys(phq9Answers).length} / 9
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {PHQ9_QUESTIONS.map((q) => (
                  <div key={q.id} style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid var(--border-dim)' }}>
                    <p style={{ fontWeight: 600, fontSize: '0.92rem', marginBottom: '0.75rem' }}>
                      {q.id}. Over the last 2 weeks, how often have you been bothered by: <em>{q.text}</em>
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                      {OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setPhq9Answers(prev => ({ ...prev, [q.id]: opt.value }))}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: `1px solid ${phq9Answers[q.id] === opt.value ? 'var(--accent-bright)' : 'var(--border-dim)'}`,
                            background: phq9Answers[q.id] === opt.value ? 'var(--accent-subtle)' : 'transparent',
                            color: phq9Answers[q.id] === opt.value ? '#fff' : 'var(--text-secondary)',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            textAlign: 'center',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          {opt.label} ({opt.value})
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={handlePhq9Submit}
                  className="btn btn-primary"
                  style={{ padding: '0.75rem 2rem', fontSize: '0.95rem' }}
                >
                  Calculate PHQ-9 Score <ArrowRight size={16} />
                </button>
              </div>
            </div>
          ) : (
            <div style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '2rem', border: '1px solid var(--border-dim)' }}>
              <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <CheckCircle2 size={48} color={phq9Res.color} style={{ margin: '0 auto 1rem' }} />
                <h2 style={{ fontSize: '1.6rem', fontWeight: 800 }}>PHQ-9 Score: {phq9Score} / 27</h2>
                <div style={{
                  display: 'inline-block',
                  margin: '0.5rem 0',
                  padding: '6px 16px',
                  borderRadius: '20px',
                  background: `${phq9Res.color}22`,
                  border: `1px solid ${phq9Res.color}`,
                  color: phq9Res.color,
                  fontWeight: 700,
                  fontSize: '0.95rem'
                }}>
                  {phq9Res.level}
                </div>
                <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '0.5rem auto 0' }}>
                  {phq9Res.desc}
                </p>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '1.25rem', marginBottom: '2rem', border: '1px solid var(--border-dim)' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={18} color="var(--accent-bright)" /> Recommended Action Plan
                </h4>
                <p style={{ color: 'var(--text-primary)', fontSize: '0.9rem', margin: 0 }}>
                  {phq9Res.action}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button onClick={resetPhq9} className="btn btn-ghost">
                  <RefreshCw size={16} /> Retake Assessment
                </button>
                <button onClick={() => window.print()} className="btn btn-outline">
                  <Download size={16} /> Export / Print Results
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* GAD-7 Form / Results */}
      {activeTab === 'gad7' && (
        <div>
          {!gad7Submitted ? (
            <div style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '1.75rem', border: '1px solid var(--border-dim)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>GAD-7 Question Set</h2>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Answered: {Object.keys(gad7Answers).length} / 7
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {GAD7_QUESTIONS.map((q) => (
                  <div key={q.id} style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid var(--border-dim)' }}>
                    <p style={{ fontWeight: 600, fontSize: '0.92rem', marginBottom: '0.75rem' }}>
                      {q.id}. Over the last 2 weeks, how often have you been bothered by: <em>{q.text}</em>
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                      {OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setGad7Answers(prev => ({ ...prev, [q.id]: opt.value }))}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: `1px solid ${gad7Answers[q.id] === opt.value ? 'var(--accent-bright)' : 'var(--border-dim)'}`,
                            background: gad7Answers[q.id] === opt.value ? 'var(--accent-subtle)' : 'transparent',
                            color: gad7Answers[q.id] === opt.value ? '#fff' : 'var(--text-secondary)',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            textAlign: 'center',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          {opt.label} ({opt.value})
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={handleGad7Submit}
                  className="btn btn-primary"
                  style={{ padding: '0.75rem 2rem', fontSize: '0.95rem' }}
                >
                  Calculate GAD-7 Score <ArrowRight size={16} />
                </button>
              </div>
            </div>
          ) : (
            <div style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '2rem', border: '1px solid var(--border-dim)' }}>
              <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <CheckCircle2 size={48} color={gad7Res.color} style={{ margin: '0 auto 1rem' }} />
                <h2 style={{ fontSize: '1.6rem', fontWeight: 800 }}>GAD-7 Score: {gad7Score} / 21</h2>
                <div style={{
                  display: 'inline-block',
                  margin: '0.5rem 0',
                  padding: '6px 16px',
                  borderRadius: '20px',
                  background: `${gad7Res.color}22`,
                  border: `1px solid ${gad7Res.color}`,
                  color: gad7Res.color,
                  fontWeight: 700,
                  fontSize: '0.95rem'
                }}>
                  {gad7Res.level}
                </div>
                <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '0.5rem auto 0' }}>
                  {gad7Res.desc}
                </p>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '1.25rem', marginBottom: '2rem', border: '1px solid var(--border-dim)' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={18} color="var(--accent-bright)" /> Recommended Action Plan
                </h4>
                <p style={{ color: 'var(--text-primary)', fontSize: '0.9rem', margin: 0 }}>
                  {gad7Res.action}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button onClick={resetGad7} className="btn btn-ghost">
                  <RefreshCw size={16} /> Retake Assessment
                </button>
                <button onClick={() => window.print()} className="btn btn-outline">
                  <Download size={16} /> Export / Print Results
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
