import { useState, useEffect, useCallback } from 'react';
import { moodsApi } from '../services/api';
import { Mood, MoodCreate, MoodStats } from '../types';
import toast from 'react-hot-toast';

export function useMoods(days = 30) {
  const [moods, setMoods] = useState<Mood[]>([]);
  const [stats, setStats] = useState<MoodStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [moodRes, statsRes] = await Promise.all([
        moodsApi.list({ limit: 100, days }),
        moodsApi.stats(days),
      ]);
      setMoods(moodRes.data);
      setStats(statsRes.data);
    } catch (e) {
      setError('Failed to load mood data');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const createMood = async (data: MoodCreate) => {
    const res = await moodsApi.create(data);
    setMoods(prev => [res.data, ...prev]);
    toast.success('MOOD LOGGED');
    load(); // refresh stats
    return res.data;
  };

  const deleteMood = async (id: string) => {
    await moodsApi.delete(id);
    setMoods(prev => prev.filter(m => m.id !== id));
    toast.success('Entry deleted');
  };

  return { moods, stats, loading, error, createMood, deleteMood, reload: load };
}
