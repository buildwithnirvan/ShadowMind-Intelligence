import { useState, useRef, useCallback } from 'react';

interface Options { onFinalResult?: (text: string) => void; }

export function useSpeechToText(options?: Options) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript]   = useState('');
  const [error, setError]             = useState<string | null>(null);
  const recogRef = useRef<any>(null);

  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setError('Speech recognition not supported in this browser.'); return; }
    if (isListening) return;

    const r = new SR();
    r.continuous = true; r.interimResults = true; r.lang = 'en-US';
    r.onstart  = () => { setIsListening(true); setError(null); setTranscript(''); };
    r.onerror  = (e: any) => { setError(e.error); setIsListening(false); };
    r.onend    = () => setIsListening(false);
    r.onresult = (e: any) => {
      let fin = '', interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) { fin += t + ' '; } else { interim += t; }
      }
      setTranscript(fin + interim);
      if (fin.trim() && options?.onFinalResult) options.onFinalResult(fin.trim());
    };
    recogRef.current = r;
    r.start();
  }, [isListening, options]);

  const stopListening = useCallback(() => {
    recogRef.current?.stop();
    setIsListening(false);
  }, []);

  const isSupported = typeof window !== 'undefined' && Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  return { isListening, transcript, error, startListening, stopListening, isSupported };
}
