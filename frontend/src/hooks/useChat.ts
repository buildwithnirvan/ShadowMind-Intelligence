import { useState, useCallback } from 'react';
import { chatApi } from '../services/api';
import { ChatSession, ChatMessage } from '../types';
import toast from 'react-hot-toast';

export function useChat() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);

  const loadSessions = useCallback(async () => {
    try {
      const res = await chatApi.getSessions();
      setSessions(res.data);
    } catch { /* silent */ }
  }, []);

  const openSession = async (id: string) => {
    const res = await chatApi.getSession(id);
    setActiveSession(res.data);
    setMessages(res.data.messages);
  };

  const newSession = async (sessionType = 'general') => {
    const res = await chatApi.createSession({ session_type: sessionType });
    setSessions(prev => [res.data, ...prev]);
    setActiveSession(res.data);
    setMessages([]);
    return res.data;
  };

  const deleteSession = async (id: string) => {
    await chatApi.deleteSession(id);
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSession?.id === id) { setActiveSession(null); setMessages([]); }
    toast.success('Session deleted');
  };

  const sendMessage = async (text: string, sessionType = 'general') => {
    if (!text.trim() || sending) return;
    setSending(true);

    const tempMsg: ChatMessage = {
      id: Date.now().toString(),
      session_id: activeSession?.id ?? "",
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMsg]);

    try {
      const res = await chatApi.sendMessage({
        message: text,
        session_id: activeSession?.id,
        session_type: sessionType,
      });
      const { session_id, message } = res.data;

      if (!activeSession || activeSession.id !== session_id) {
        loadSessions();
      }
      setMessages(prev => [
        ...prev.filter(m => m.id !== tempMsg.id),
        tempMsg,
        { id: message.id, session_id, role: 'assistant', content: message.content, created_at: message.created_at },
      ]);
    } catch {
      setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
      toast.error('Message failed to send');
    } finally {
      setSending(false);
    }
  };

  return {
    sessions, activeSession, messages, sending,
    loadSessions, openSession, newSession, deleteSession, sendMessage,
  };
}
