import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

interface SentimentData {
  score: number;
  primary_emotion: string;
}

export function useSentiment(text: string, delay: number = 800) {
  const [sentiment, setSentiment] = useState<SentimentData | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cacheRef = useRef<Record<string, SentimentData>>({});
  const lastAnalyzedRef = useRef<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = text.trim();

    // Do not analyze if empty or too short (UI only displays for >8 / >10 characters)
    if (!trimmed || trimmed.length < 8) {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
      setSentiment(null);
      setLoading(false);
      lastAnalyzedRef.current = '';
      return;
    }

    // If identical to last analyzed text, avoid duplicate request
    if (trimmed === lastAnalyzedRef.current) {
      return;
    }

    // Check in-memory cache
    if (cacheRef.current[trimmed]) {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
      setSentiment(cacheRef.current[trimmed]);
      setLoading(false);
      lastAnalyzedRef.current = trimmed;
      return;
    }

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    setLoading(true);

    debounceTimer.current = setTimeout(async () => {
      // Abort any prior in-flight sentiment request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const response = await axios.post(
          '/api/sentiment/analyze',
          { text: trimmed },
          { signal: controller.signal }
        );
        cacheRef.current[trimmed] = response.data;
        lastAnalyzedRef.current = trimmed;
        setSentiment(response.data);
      } catch (err: any) {
        if (err?.name !== 'CanceledError' && err?.code !== 'ERR_CANCELED') {
          console.error('Sentiment analysis failed', err);
        }
      } finally {
        setLoading(false);
      }
    }, delay);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [text, delay]);

  return { sentiment, loading };
}
