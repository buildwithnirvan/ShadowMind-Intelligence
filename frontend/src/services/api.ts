import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach token
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('shadowmind_token') || localStorage.getItem('shadowmind_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      sessionStorage.removeItem('shadowmind_token');
      sessionStorage.removeItem('shadowmind_user');
      sessionStorage.removeItem('shadowmind_welcome_dismissed');
      localStorage.removeItem('shadowmind_token');
      localStorage.removeItem('shadowmind_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (data: { username: string; password: string; confirm_password?: string; email?: string; full_name?: string }) =>
    api.post('/auth/register', data),
  login: (data: { username?: string; email?: string; password: string }) =>
    api.post('/auth/login', data),
  userLogin: (data: { username?: string; email?: string; password: string }) =>
    api.post('/auth/user/login', data),
  adminLogin: (data: { username?: string; email?: string; password: string }) =>
    api.post('/auth/admin/login', data),
  googleLogin: (data: { credential?: string; token?: string; email?: string; name?: string; picture?: string; google_id?: string }) =>
    api.post('/auth/google', data),
  me: () => api.get('/auth/me'),
  updateMe: (data: { full_name?: string; bio?: string; avatar_url?: string }) =>
    api.put('/auth/me', data),
  deleteAccount: () => api.delete('/auth/me'),
};

// ── Admin ─────────────────────────────────────────────────────────────────────
export const adminApi = {
  overview: () => api.get('/admin/overview'),
  users: (params?: { skip?: number; limit?: number; search?: string; sort_by?: string; sort_order?: string }) =>
    api.get('/admin/users', { params }),
  emotionalAnalytics: (params?: { days?: number; start_date?: string; end_date?: string }) =>
    api.get('/admin/emotional-analytics', { params }),
  administrators: () => api.get('/admin/administrators'),
  createAdministrator: (data: { username: string; password: string; confirm_password: string; full_name?: string; email?: string }) =>
    api.post('/admin/administrators', data),
  system: () => api.get('/admin/system'),
};

// ── Moods ─────────────────────────────────────────────────────────────────────
export const moodsApi = {
  create: (data: unknown) => api.post('/moods/', data),
  list: (params?: { skip?: number; limit?: number; days?: number }) =>
    api.get('/moods/', { params }),
  stats: (days?: number) => api.get('/moods/stats', { params: { days } }),
  getInsights: () => api.get('/moods/ai-insights'),
  get: (id: string) => api.get(`/moods/${id}`),
  update: (id: string, data: unknown) => api.put(`/moods/${id}`, data),
  delete: (id: string) => api.delete(`/moods/${id}`),
};

// ── Journals ──────────────────────────────────────────────────────────────────
export const journalsApi = {
  create: (data: unknown) => api.post('/journals/', data),
  list: (params?: { skip?: number; limit?: number; search?: string }) =>
    api.get('/journals/', { params }),
  get: (id: string) => api.get(`/journals/${id}`),
  update: (id: string, data: unknown) => api.put(`/journals/${id}`, data),
  delete: (id: string) => api.delete(`/journals/${id}`),
  analyze: (id: string) => api.post(`/journals/${id}/analyze`),
  getPrompts: (data: { mood?: string; topic?: string }) => api.post('/journals/ai-prompts', data),
  assistant: (data: { action: string; content?: string; journal_id?: string; rewrite_type?: string; entries_count?: number }) =>
    api.post('/journals/ai-assistant', data),
};

// ── Meditations ───────────────────────────────────────────────────────────────
export const meditationsApi = {
  generate: (data: { duration_minutes: number; focus_area: string; experience_level?: string; guidance_style?: string }) =>
    api.post('/meditations/generate', data),
  complete: (data: { title: string; duration_minutes: number; focus_area: string; elapsed_seconds: number }) =>
    api.post('/meditations/complete', data),
};

// ── Chat ──────────────────────────────────────────────────────────────────────
export const chatApi = {
  getSessions: () => api.get('/chat/sessions'),
  getSession: (id: string) => api.get(`/chat/sessions/${id}`),
  createSession: (data: { session_type?: string; title?: string }) => api.post('/chat/sessions', data),
  deleteSession: (id: string) => api.delete(`/chat/sessions/${id}`),
  sendMessage: (data: { message: string; session_id?: string; session_type?: string }) =>
    api.post('/chat/message', data),
  sendMessageStream: async (
    data: { message: string; session_id?: string; session_type?: string },
    callbacks: {
      onStart?: (meta: any, sessionId: string, userMsgId: string) => void;
      onDelta?: (text: string) => void;
      onDone?: (payload: any) => void;
      onError?: (err: any) => void;
      signal?: AbortSignal;
    }
  ) => {
    const token = sessionStorage.getItem('shadowmind_token') || localStorage.getItem('shadowmind_token');
    try {
      const response = await fetch('/api/chat/message/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(data),
        signal: callbacks.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (!reader) throw new Error('No readable stream available');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            try {
              const event = JSON.parse(trimmed.slice(6));
              if (event.type === 'start') {
                callbacks.onStart?.(event.meta, event.session_id, event.user_message_id);
              } else if (event.type === 'delta') {
                callbacks.onDelta?.(event.text);
              } else if (event.type === 'done') {
                callbacks.onDone?.(event);
              }
            } catch (e) {
              console.warn('Failed to parse SSE event:', e);
            }
          }
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return;
      }
      callbacks.onError?.(err);
    }
  },
  analyzeSession: (id: string) =>
    api.post(`/chat/sessions/${id}/analyze`),
};

export const doctorsApi = {
  getRecommendations: () => api.get('/doctors/'),
  get: () => api.get('/doctors/'),
};

// ── Analytics ─────────────────────────────────────────────────────────────────
export const analyticsApi = {
  overview: (days?: number) => api.get('/analytics/overview', { params: { days } }),
  heatmap: (days?: number) => api.get('/analytics/mood-heatmap', { params: { days } }),
  aiInsight: () => api.get('/analytics/ai-insight'),
  weeklySummary: () => api.get('/analytics/weekly-summary'),
  emotionalInsights: (days?: number) => api.get('/analytics/emotional-insights', { params: { days } }),
};

// ── Predictions & Patterns to Watch ──────────────────────────────────────────
export const predictionsApi = {
  get: () => api.get('/predictions/'),
  getDetail: (id: string) => api.get(`/predictions/${id}`),
  getPreventionPlan: (id: string) => api.get(`/predictions/${id}/prevention-plan`),
  saveFeedback: (id: string, rating: 'accurate' | 'somewhat' | 'not_accurate') =>
    api.post(`/predictions/${id}/feedback`, { rating }),
  dismiss: (id: string) => api.post(`/predictions/${id}/dismiss`),
};

export default api;
