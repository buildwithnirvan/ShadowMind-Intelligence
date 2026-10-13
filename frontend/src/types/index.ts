export interface User {
  id: string;
  email?: string;
  username: string;
  role?: 'admin' | 'user';
  full_name?: string;
  bio?: string;
  avatar_url?: string;
  is_active: boolean;
  created_at: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

export interface Mood {
  id: string;
  user_id: string;
  score: number;
  label: string;
  energy_level?: number;
  stress_level?: number;
  anxiety_level?: number;
  sleep_hours?: number;
  notes?: string;
  tags?: string[];
  triggers?: string[];
  created_at: string;
}

export interface MoodCreate {
  score: number;
  label: string;
  energy_level?: number;
  stress_level?: number;
  anxiety_level?: number;
  sleep_hours?: number;
  notes?: string;
  tags?: string[];
  triggers?: string[];
}

export interface MoodStats {
  total_entries: number;
  average_score: number;
  max_score: number;
  min_score: number;
  trend: 'improving' | 'declining' | 'stable';
  label_distribution: Record<string, number>;
  timeline: { 
    date: string; 
    score: number; 
    label: string; 
    energy_level?: number; 
    stress_level?: number; 
    sleep_hours?: number; 
  }[];
}

export interface Journal {
  id: string;
  user_id: string;
  title: string;
  content: string;
  mood_score?: number;
  tags?: string[];
  is_private: boolean;
  ai_summary?: string;
  ai_emotions?: { name: string; intensity: number }[];
  ai_wellbeing_score?: number;
  ai_future_mistakes?: string[];
  ai_corrective_actions?: string[];
  ai_insights?: string[];
  ai_reflection_question?: string;
  word_count: number;
  created_at: string;
  updated_at?: string;
}

export interface JournalCreate {
  title: string;
  content: string;
  mood_score?: number;
  tags?: string[];
  is_private?: boolean;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface ChatSession {
  id: string;
  user_id?: string;
  title?: string;
  session_type: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  messages?: ChatMessage[];
  ai_emotions?: { name: string; intensity: number }[];
  ai_wellbeing_score?: number;
  ai_future_mistakes?: string[];
  ai_corrective_actions?: string[];
}

export interface AnalyticsOverview {
  period_days: number;
  mood_entries: number;
  average_mood?: number;
  journal_entries: number;
  chat_sessions: number;
  total_words_written: number;
  current_streak_days: number;
  trend?: string;
}

export const MOOD_LABELS = [
  'anxious', 'angry', 'sad', 'depressed', 'numb',
  'neutral', 'calm', 'content', 'happy', 'euphoric',
  'stressed', 'overwhelmed', 'hopeful', 'grateful', 'focused',
] as const;

export type MoodLabel = typeof MOOD_LABELS[number];

export const SESSION_TYPES = [
  { value: 'general',     label: 'General Support',  description: 'Open conversation & emotional support' },
  { value: 'cbt',         label: 'CBT Mode',         description: 'Cognitive behavioral therapy techniques' },
  { value: 'mindfulness', label: 'Mindfulness',       description: 'Guided meditation & breathing' },
  { value: 'crisis',      label: 'Crisis Support',    description: 'Immediate emotional support' },
] as const;
