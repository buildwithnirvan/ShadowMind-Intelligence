import { useState, useEffect, useRef } from 'react';
import {
  Send, Plus, Trash2, Bot, User as UserIcon, Mic, MicOff, Save,
  Sparkles, ShieldAlert, CheckCircle2, MessageSquare, X, Menu
} from 'lucide-react';
import toast from 'react-hot-toast';
import { chatApi } from '../services/api';
import { ChatSession, ChatMessage, SESSION_TYPES } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import CrisisDialog from '../components/CrisisDialog';
import { useSpeechToText } from '../hooks/useSpeechToText';
import { useSentiment } from '../hooks/useSentiment';
import { format } from 'date-fns';

const QUICK_PROMPTS = [
  "I've been feeling anxious and could use some grounding.",
  'Help me work through a negative thought.',
  "I'm not sure how I feel today, can we talk it through?",
  "I'm feeling drained and unmotivated.",
];

export default function Chat() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [active, setActive] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [requestState, setRequestState] = useState<'IDLE' | 'SUBMITTING' | 'WAITING_FOR_FIRST_TOKEN' | 'STREAMING' | 'COMPLETED' | 'ERROR'>('IDLE');
  const [activeAssistantMsgId, setActiveAssistantMsgId] = useState<string | null>(null);
  const activeRequestIdRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [showCrisis, setShowCrisis] = useState(false);
  const [suggestions, setSuggestions] = useState<{ key: string; label: string; route: string }[]>([]);
  const [sessType, setSessType] = useState('general');
  const [sessLoading, setSessLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const { isListening, startListening, stopListening, error: sttError } =
    useSpeechToText({ onFinalResult: (t) => setInput((prev) => (prev + ' ' + t).trim()) });

  const { sentiment } = useSentiment(input, 500);

  useEffect(() => {
    loadSessions();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (requestState === 'STREAMING') {
      endRef.current?.scrollIntoView({ behavior: 'auto' });
    } else {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, requestState]);

  useEffect(() => {
    if (sttError) toast.error(sttError);
  }, [sttError]);

  const loadSessions = async () => {
    setSessLoading(true);
    try {
      const r = await chatApi.getSessions();
      setSessions(r.data);
    } catch {
      toast.error('Failed to load chat history');
    } finally {
      setSessLoading(false);
    }
  };

  const loadSession = async (id: string) => {
    try {
      const r = await chatApi.getSession(id);
      setActive(r.data);
      setMessages(r.data.messages || []);
      setSessType(r.data.session_type || 'general');
    } catch {
      toast.error('Failed to load session');
    }
  };

  const newSession = async () => {
    try {
      const r = await chatApi.createSession({ session_type: sessType });
      setSessions((p) => [r.data, ...p]);
      setActive(r.data);
      setMessages([]);
      toast.success('New conversation started');
    } catch {
      toast.error('Failed to create session');
    }
  };

  const delSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await chatApi.deleteSession(id);
      setSessions((p) => p.filter((s) => s.id !== id));
      if (active?.id === id) {
        setActive(null);
        setMessages([]);
      }
      toast.success('Conversation deleted');
    } catch {
      toast.error('Delete failed');
    }
  };

  const send = async (customText?: string) => {
    const text = (customText || input).trim();
    if (!text || loading) return;
    setInput('');

    // Cancel any in-flight request to avoid race conditions
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const reqId = 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    activeRequestIdRef.current = reqId;

    const userTmpId = 'u_' + Date.now();
    const assistantTmpId = 'a_' + Date.now();

    const userMsg: ChatMessage = {
      id: userTmpId,
      session_id: active?.id ?? '',
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };

    const assistantPlaceholder: ChatMessage = {
      id: assistantTmpId,
      session_id: active?.id ?? '',
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
    };

    setMessages((p) => [...p, userMsg, assistantPlaceholder]);
    setLoading(true);
    setRequestState('WAITING_FOR_FIRST_TOKEN');
    setActiveAssistantMsgId(assistantTmpId);

    let accumulatedText = '';

    await chatApi.sendMessageStream(
      {
        message: text,
        session_id: active?.id,
        session_type: sessType,
      },
      {
        signal: controller.signal,
        onStart: (_meta, sessionId) => {
          if (activeRequestIdRef.current !== reqId) return;
          if (!active || active.id !== sessionId) {
            setActive({
              id: sessionId,
              title: text.length > 30 ? text.slice(0, 30) + '...' : text,
              session_type: sessType,
              is_active: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
            loadSessions();
          }
        },
        onDelta: (chunk) => {
          if (activeRequestIdRef.current !== reqId) return;
          setRequestState('STREAMING');
          accumulatedText += chunk;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantTmpId ? { ...msg, content: accumulatedText } : msg
            )
          );
        },
        onDone: (payload) => {
          if (activeRequestIdRef.current !== reqId) return;
          const { message_id, text: finalText, crisis_alert, suggestions: sug } = payload;
          if (crisis_alert) setShowCrisis(true);
          setSuggestions(sug || []);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantTmpId
                ? { ...msg, id: message_id || assistantTmpId, content: finalText || accumulatedText }
                : msg
            )
          );
          setRequestState('COMPLETED');
          setActiveAssistantMsgId(null);
          setLoading(false);
          activeRequestIdRef.current = null;
        },
        onError: (_err) => {
          if (activeRequestIdRef.current !== reqId) return;
          toast.error("Shadow couldn't respond right now. Please try again.");
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantTmpId
                ? {
                    ...msg,
                    content:
                      accumulatedText ||
                      "Shadow couldn't connect right now. Please check your connection and try again.",
                  }
                : msg
            )
          );
          setRequestState('ERROR');
          setActiveAssistantMsgId(null);
          setLoading(false);
          activeRequestIdRef.current = null;
        },
      }
    );
  };

  const endAndLog = async () => {
    if (!active) return;
    setLoading(true);
    try {
      await chatApi.analyzeSession(active.id.toString());
      toast.success('Saved to your mood log and journal');
    } catch {
      toast.error('Could not save this session');
    } finally {
      setLoading(false);
    }
  };

  const toggleVoice = () => {
    if (isListening) stopListening();
    else startListening();
  };

  const isCrisis = sessType === 'crisis';

  return (
    <div
      className="animate-fade-in-up"
      style={{
        display: 'flex',
        height: '100%',
        flex: 1,
        padding: '1rem',
        overflow: 'hidden',
      }}
    >
      {showCrisis && <CrisisDialog urgent onClose={() => setShowCrisis(false)} />}

      {/* ── SESSIONS DRAWER ── */}
      {showHistory && (
        <>
          <div
            onClick={() => setShowHistory(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.5)',
              zIndex: 40,
            }}
          />
          <div
            className="glass-panel"
            style={{
              position: 'fixed',
              top: 0,
              bottom: 0,
              left: 0,
              width: '320px',
              zIndex: 50,
              display: 'flex',
              flexDirection: 'column',
              padding: '1.25rem',
              gap: '1rem',
              borderRadius: '0 16px 16px 0',
              boxShadow: '4px 0 24px rgba(0,0,0,0.5)',
              border: '1px solid var(--border-dim)',
              borderLeft: 'none',
              background: 'rgba(10, 22, 38, 0.95)',
              backdropFilter: 'blur(16px)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)' }}>
                Conversations
              </div>
              <button onClick={() => setShowHistory(false)} className="btn-ghost" style={{ padding: '4px' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label className="section-label">Conversation type</label>
          <select
            value={sessType}
            onChange={(e) => setSessType(e.target.value)}
            className="input-base"
            style={{ fontSize: '0.82rem', padding: '0.55rem 0.75rem' }}
          >
            {SESSION_TYPES.map((t) => (
              <option key={t.value} value={t.value} style={{ background: 'var(--bg-elevated)' }}>
                {t.label}
              </option>
            ))}
          </select>
          <button
            onClick={newSession}
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', fontSize: '0.8rem', padding: '0.6rem' }}
          >
            <Plus size={15} /> New conversation
          </button>
        </div>

        <div className="section-label" style={{ marginTop: '0.5rem' }}>
          Your conversations
        </div>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            paddingRight: '4px',
          }}
        >
          {sessLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '2rem' }}>
              <LoadingSpinner size="sm" message="" />
            </div>
          ) : sessions.length === 0 ? (
            <div
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                textAlign: 'center',
                padding: '2rem 1rem',
              }}
            >
              No conversations yet. Start one above.
            </div>
          ) : (
            sessions.map((s) => (
              <div
                key={s.id}
                onClick={() => loadSession(s.id)}
                style={{
                  padding: '0.75rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  border: `1px solid ${active?.id === s.id ? 'var(--accent)' : 'var(--border-dim)'}`,
                  background: active?.id === s.id ? 'var(--accent-subtle)' : 'rgba(255, 255, 255, 0.02)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'var(--transition)',
                }}
              >
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontWeight: 600,
                      fontSize: '0.82rem',
                      color: active?.id === s.id ? '#fff' : 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {s.title || 'Conversation'}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.62rem',
                      color: active?.id === s.id ? 'var(--accent-bright)' : 'var(--text-muted)',
                      marginTop: '2px',
                      textTransform: 'uppercase',
                    }}
                  >
                    {s.session_type}
                  </div>
                </div>
                <button
                  onClick={(e) => delSession(s.id, e)}
                  className="btn-ghost"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    padding: '4px',
                    borderRadius: '4px',
                  }}
                  aria-label="Delete session"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
      </>
      )}

      {/* ── CHAT MAIN CONTAINER ── */}
      <div
        className="glass-panel"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
          height: '100%',
        }}
      >
        {/* Chat Header */}
        <div
          style={{
            padding: '1.1rem 1.75rem',
            borderBottom: '1px solid var(--border-dim)',
            background: 'linear-gradient(180deg, rgba(56, 189, 248, 0.05) 0%, transparent 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: '#05070B',
                border: '1.5px solid rgba(255, 255, 255, 0.22)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isCrisis
                  ? '0 0 16px rgba(239,68,68,0.5)'
                  : '0 0 14px rgba(255, 138, 36, 0.4), 0 0 18px rgba(39, 184, 255, 0.3)',
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              <img src="/assets/shadowmind-blackhole.png" alt="Shadow" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.2rem',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  letterSpacing: '0.02em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                SHADOW
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.68rem',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginTop: '1px',
                }}
              >
                <span>AI WELLNESS COMPANION</span>
                <span style={{ color: 'var(--text-muted)' }}>•</span>
                <span style={{ color: '#22c55e', fontWeight: 700 }}>● ONLINE</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => setShowHistory(true)}
              className="btn btn-ghost"
              style={{
                fontSize: '0.78rem',
                padding: '6px 14px',
                borderRadius: '6px',
              }}
            >
              <Menu size={14} /> History
            </button>
            {active && (
              <button
                onClick={endAndLog}
                disabled={loading || messages.length === 0}
                className="btn btn-ghost"
                style={{
                  fontSize: '0.78rem',
                  padding: '6px 14px',
                  borderRadius: '6px',
                }}
              >
                <Save size={14} /> Save session
              </button>
            )}
          </div>
        </div>

        {isCrisis && (
          <div style={{ padding: '0.85rem 1.75rem', borderBottom: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.82rem', color: '#fca5a5' }}>This is a safe space. If things feel urgent, immediate help is one tap away.</span>
            <button onClick={() => setShowCrisis(true)} className="btn btn-danger btn-sm">Get help now</button>
          </div>
        )}

        {/* Messages Stream */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.75rem 2.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
          }}
        >
          {messages.length === 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                margin: 'auto 0',
                textAlign: 'center',
                padding: '2rem 1rem',
              }}
            >
              <div
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: '50%',
                  background: '#040711',
                  border: '1.5px solid rgba(255, 255, 255, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 28px rgba(232, 117, 34, 0.45), 0 0 40px rgba(46, 111, 145, 0.35)',
                  marginBottom: '1.25rem',
                  overflow: 'hidden',
                }}
              >
                <img src="/assets/shadowmind-blackhole.png" alt="Shadow AI" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>

              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.5rem',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  marginBottom: '0.5rem',
                }}
              >
                Hi, I'm Shadow
              </h3>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.95rem',
                  color: 'var(--text-secondary)',
                  maxWidth: '520px',
                  lineHeight: 1.6,
                  marginBottom: '1.75rem',
                }}
              >
                {SESSION_TYPES.find((t) => t.value === sessType)?.description ||
                  "I'm here to listen without judgment. Tell me what's on your mind today."}
              </p>

              {/* Quick Prompts Chips */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '10px',
                  justifyContent: 'center',
                  maxWidth: '680px',
                }}
              >
                {QUICK_PROMPTS.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => send(p)}
                    className="btn-ghost"
                    style={{
                      padding: '0.6rem 1.1rem',
                      borderRadius: '999px',
                      fontSize: '0.82rem',
                      fontFamily: 'var(--font-body)',
                      cursor: 'pointer',
                      border: '1px solid var(--border-dim)',
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                gap: '14px',
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                alignItems: 'flex-start',
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  flexShrink: 0,
                  background: msg.role === 'user' ? 'rgba(46, 111, 145, 0.25)' : '#040711',
                  border: `1px solid ${msg.role === 'user' ? 'rgba(46, 111, 145, 0.5)' : 'rgba(232, 117, 34, 0.45)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: msg.role === 'user' ? '0 0 12px rgba(46, 111, 145, 0.3)' : '0 0 14px rgba(232, 117, 34, 0.35)',
                  overflow: 'hidden',
                }}
              >
                {msg.role === 'user' ? (
                  <UserIcon size={18} color="#3b82a8" />
                ) : (
                  <img src="/assets/shadowmind-blackhole.png" alt="Shadow" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
              </div>

              <div
                style={{
                  maxWidth: msg.role === 'user' ? '75%' : '80%',
                  background: msg.role === 'user' ? 'rgba(13, 27, 42, 0.95)' : 'rgba(10, 22, 38, 0.95)',
                  border: `1px solid ${msg.role === 'user' ? 'rgba(46, 111, 145, 0.4)' : 'rgba(232, 117, 34, 0.25)'}`,
                  borderLeft: msg.role === 'assistant' ? '3px solid #e87522' : undefined,
                  borderRadius: '16px',
                  padding: '1.1rem 1.4rem',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                }}
              >
                {msg.content ? (
                  <p
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '1rem',
                      color: 'var(--text-primary)',
                      lineHeight: 1.65,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {msg.content}
                    {msg.id === activeAssistantMsgId && requestState === 'STREAMING' && (
                      <span
                        style={{
                          display: 'inline-block',
                          width: '3px',
                          height: '0.95rem',
                          background: '#f28c28',
                          marginLeft: '4px',
                          verticalAlign: 'text-bottom',
                          animation: 'pulse 1s infinite',
                        }}
                      />
                    )}
                  </p>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '2px 0' }}>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f28c28', display: 'inline-block', opacity: 0.8 }} />
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f28c28', display: 'inline-block', opacity: 0.5 }} />
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f28c28', display: 'inline-block', opacity: 0.3 }} />
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Shadow is thinking…
                    </span>
                  </div>
                )}
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.64rem',
                    color: 'var(--text-muted)',
                    marginTop: '8px',
                    textAlign: msg.role === 'user' ? 'right' : 'left',
                  }}
                >
                  {format(new Date(msg.created_at), 'HH:mm')}
                </div>
              </div>
            </div>
          ))}

          {!loading && suggestions.length > 0 && messages.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingLeft: 50 }}>
              {suggestions.map((s) => (
                <a key={s.key} href={`#${s.route}`} onClick={(e) => { e.preventDefault(); window.location.hash = ''; window.history.pushState({}, '', s.route); window.dispatchEvent(new PopStateEvent('popstate')); }} className="chip">
                  {s.label}
                </a>
              ))}
            </div>
          )}

          <div ref={endRef} />
        </div>

        {/* Input Bar */}
        <div
          style={{
            padding: '1.25rem 1.75rem',
            borderTop: '1px solid var(--border-dim)',
            background: 'linear-gradient(0deg, rgba(5,8,17,0.9) 0%, transparent 100%)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {sentiment && input.length > 8 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.72rem', fontFamily: 'var(--font-mono)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Sensing tone:</span>
              <span className="badge" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)', fontSize: '0.65rem' }}>
                {sentiment.primary_emotion}
              </span>
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <textarea
                className="input-base"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={
                  isListening
                    ? 'Listening… speak now'
                    : "Type how you're feeling… (Enter to send, Shift+Enter for new line)"
                }
                rows={2}
                style={{
                  resize: 'none',
                  padding: '0.85rem 1.1rem',
                  fontSize: '0.95rem',
                  borderRadius: '12px',
                  minHeight: '64px',
                }}
              />
            </div>

            <button
              onClick={toggleVoice}
              className="btn btn-ghost"
              style={{
                padding: '0.85rem 1rem',
                borderRadius: '12px',
                minHeight: '52px',
                borderColor: isListening ? '#38bdf8' : 'var(--border-dim)',
                background: isListening ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                boxShadow: isListening ? '0 0 16px rgba(56, 189, 248, 0.4)' : 'none',
              }}
              title={isListening ? 'Stop recording' : 'Voice input'}
            >
              {isListening ? <MicOff size={20} color="#38bdf8" /> : <Mic size={20} color="#38bdf8" />}
            </button>

            <button
              onClick={() => send()}
              disabled={loading || !input.trim()}
              className="btn btn-primary"
              style={{
                padding: '0.85rem 1.5rem',
                borderRadius: '12px',
                minHeight: '52px',
                background: 'var(--accent)',
                fontSize: '0.92rem',
                fontWeight: 700,
              }}
            >
              <Send size={18} /> Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
