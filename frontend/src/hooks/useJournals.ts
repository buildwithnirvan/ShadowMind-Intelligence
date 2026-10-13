import { useState, useEffect, useCallback } from 'react';
import { journalsApi } from '../services/api';
import { Journal, JournalCreate } from '../types';
import toast from 'react-hot-toast';

export function useJournals(search?: string) {
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await journalsApi.list({ limit: 50, search });
      setJournals(res.data);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const createJournal = async (data: JournalCreate) => {
    const res = await journalsApi.create(data);
    toast.success('JOURNAL SAVED // AI ANALYSIS QUEUED');
    setJournals(prev => [res.data, ...prev]);
    return res.data;
  };

  const deleteJournal = async (id: string) => {
    await journalsApi.delete(id);
    setJournals(prev => prev.filter(j => j.id !== id));
    toast.success('Entry deleted');
  };

  const analyzeJournal = async (id: string) => {
    const res = await journalsApi.analyze(id);
    setJournals(prev => prev.map(j => (j.id === id ? res.data : j)));
    toast.success('AI ANALYSIS COMPLETE');
    return res.data as Journal;
  };

  return { journals, loading, createJournal, deleteJournal, analyzeJournal, reload: load };
}
