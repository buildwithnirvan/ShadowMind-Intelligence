import { useState, useEffect, useMemo, FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Shield, Users, Activity, BookOpen, MessageSquare, RefreshCw,
  Search, ExternalLink, LogOut, CheckCircle2, AlertTriangle, Lock,
  TrendingUp, TrendingDown, HelpCircle, BarChart3, UserPlus, Calendar,
  ChevronLeft, ChevronRight, ArrowUpDown, Info, KeyRound, Sparkles, X, AlertCircle
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend, Cell, PieChart, Pie
} from 'recharts';
import toast from 'react-hot-toast';
import { adminApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useExit } from '../context/ExitContext';

type AdminTab = 'overview' | 'users' | 'emotions' | 'admins';

interface OverviewStats {
  status: string;
  system_time: string;
  total_users: number;
  total_active_users: number;
  total_admins: number;
  total_sessions_recorded: number;
  total_chat_sessions: number;
  total_mood_logs: number;
  total_journal_entries: number;
  total_users_analyzed: number;
  most_frequent_emotions: Array<{
    id: string;
    category: string;
    count: number;
    percentage: number;
    color: string;
  }>;
  trend_improving_users: number;
  trend_improving_depression: number;
  trend_improving_anxiety: number;
  trend_improving_both: number;
  trend_worsening_users: number;
  trend_insufficient_users: number;
  trend_unchanged_users: number;
  current_admin: string;
}

interface UserRecord {
  id: string;
  username: string;
  email?: string;
  role: string;
  full_name?: string;
  is_active: boolean;
  created_at?: string;
  last_active?: string;
  session_count: number;
  latest_analysis?: string;
  account_status: string;
}

interface EmotionSummaryItem {
  id: string;
  label: string;
  description: string;
  color: string;
  user_count: number;
  percentage: number;
  session_count: number;
}

interface EmotionalAnalyticsData {
  reporting_period: {
    start_date: string;
    end_date: string;
    days_analyzed: number;
  };
  total_users_analyzed: number;
  total_sessions_recorded: number;
  category_summaries: EmotionSummaryItem[];
  visual_analytics: {
    category_distribution: Array<{
      id: string;
      name: string;
      user_count: number;
      percentage: number;
      session_count: number;
      color: string;
    }>;
    trends_over_time: Array<any>;
    depression_trends: Array<{ date: string; depression_signals: number }>;
    anxiety_trends: Array<{ date: string; anxiety_signals: number }>;
    positive_trends: Array<{ date: string; positive_signals: number }>;
    user_activity: Array<{ date: string; users_analyzed: number; sessions_recorded: number }>;
  };
  improvement_trends: {
    improving_depression: number;
    improving_anxiety: number;
    improving_both: number;
    unchanged: number;
    worsening: number;
    insufficient_data: number;
    methodology_explanation: string;
  };
}

interface AdministratorRecord {
  id: string;
  username: string;
  email?: string;
  full_name?: string;
  role: string;
  is_active: boolean;
  created_at?: string;
  last_login?: string;
}

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const { openExitDialog } = useExit();
  const navigate = useNavigate();
  const { section } = useParams();

  // Active section management
  const getInitialTab = (): AdminTab => {
    if (section === 'users') return 'users';
    if (section === 'emotions' || section === 'analytics') return 'emotions';
    if (section === 'admins' || section === 'management') return 'admins';
    return 'overview';
  };

  const [activeTab, setActiveTab] = useState<AdminTab>(getInitialTab);

  useEffect(() => {
    if (section === 'users') setActiveTab('users');
    else if (section === 'emotions' || section === 'analytics') setActiveTab('emotions');
    else if (section === 'admins' || section === 'management') setActiveTab('admins');
    else if (section === 'overview') setActiveTab('overview');
  }, [section]);

  const switchTab = (tab: AdminTab) => {
    setActiveTab(tab);
    navigate(`/admin/${tab}`);
  };

  // 1. Overview State
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

  // 2. Users State
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [userPage, setUserPage] = useState(1);
  const userPageSize = 10;
  const [userSearch, setUserSearch] = useState('');
  const [userSortBy, setUserSortBy] = useState('created_at');
  const [userSortOrder, setUserSortOrder] = useState<'asc' | 'desc'>('desc');
  const [usersLoading, setUsersLoading] = useState(false);
  const [inspectUser, setInspectUser] = useState<UserRecord | null>(null);

  // 3. Emotional Analytics State
  const [analytics, setAnalytics] = useState<EmotionalAnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [dateFilterDays, setDateFilterDays] = useState<number | 'custom'>(30);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // 4. Admin Management State
  const [adminsList, setAdminsList] = useState<AdministratorRecord[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [showCreateAdminModal, setShowCreateAdminModal] = useState(false);
  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [newAdminFullName, setNewAdminFullName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newAdminConfirmPassword, setNewAdminConfirmPassword] = useState('');
  const [createAdminLoading, setCreateAdminLoading] = useState(false);
  const [createAdminError, setCreateAdminError] = useState('');

  // Global Refresh state
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch Overview Data
  const fetchOverview = async () => {
    setOverviewLoading(true);
    try {
      const res = await adminApi.overview();
      setOverview(res.data);
    } catch (err: any) {
      if (err?.response?.status === 403) {
        toast.error('Access forbidden: Administrator privileges required');
        navigate('/mood');
      } else {
        toast.error('Failed to load administrative overview');
      }
    } finally {
      setOverviewLoading(false);
    }
  };

  // Fetch Users
  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const skip = (userPage - 1) * userPageSize;
      const res = await adminApi.users({
        skip,
        limit: userPageSize,
        search: userSearch,
        sort_by: userSortBy,
        sort_order: userSortOrder,
      });
      setUsers(res.data.users || []);
      setTotalUsers(res.data.total || 0);
    } catch (err: any) {
      toast.error('Failed to load user directory');
    } finally {
      setUsersLoading(false);
    }
  };

  // Fetch Emotional Analytics
  const fetchEmotionalAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const params: any = {};
      if (dateFilterDays === 'custom') {
        if (customStartDate && customEndDate) {
          params.start_date = customStartDate;
          params.end_date = customEndDate;
        } else {
          params.days = 30;
        }
      } else {
        params.days = dateFilterDays;
      }
      const res = await adminApi.emotionalAnalytics(params);
      setAnalytics(res.data);
    } catch (err: any) {
      toast.error('Failed to load emotional analytics');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // Fetch Admins List
  const fetchAdmins = async () => {
    setAdminsLoading(true);
    try {
      const res = await adminApi.administrators();
      setAdminsList(res.data.administrators || []);
    } catch (err: any) {
      toast.error('Failed to load administrators');
    } finally {
      setAdminsLoading(false);
    }
  };

  // Initial and reactive data fetching
  useEffect(() => {
    if (activeTab === 'overview') fetchOverview();
    else if (activeTab === 'users') fetchUsers();
    else if (activeTab === 'emotions') fetchEmotionalAnalytics();
    else if (activeTab === 'admins') fetchAdmins();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    }
  }, [userPage, userSortBy, userSortOrder]);

  // Debounced search for Users
  useEffect(() => {
    if (activeTab === 'users') {
      const timer = setTimeout(() => {
        setUserPage(1);
        fetchUsers();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [userSearch]);

  // Handle Date Filter Change in Emotional Analytics
  const handleApplyDateFilter = (days: number | 'custom') => {
    setDateFilterDays(days);
    if (days !== 'custom') {
      adminApi.emotionalAnalytics({ days }).then(res => setAnalytics(res.data)).catch(() => {});
    }
  };

  const handleApplyCustomDates = (e: FormEvent) => {
    e.preventDefault();
    if (!customStartDate || !customEndDate) {
      toast.error('Please specify both start and end dates');
      return;
    }
    fetchEmotionalAnalytics();
  };

  // Handle Create Admin Submit
  const handleCreateAdmin = async (e: FormEvent) => {
    e.preventDefault();
    setCreateAdminError('');

    if (!newAdminUsername.trim()) {
      setCreateAdminError('Username is required.');
      return;
    }
    if (newAdminUsername.length < 3) {
      setCreateAdminError('Username must be at least 3 characters.');
      return;
    }
    if (!newAdminPassword) {
      setCreateAdminError('Password is required.');
      return;
    }
    if (newAdminPassword.length < 6) {
      setCreateAdminError('Password must be at least 6 characters.');
      return;
    }
    if (newAdminPassword !== newAdminConfirmPassword) {
      setCreateAdminError('Password confirmation does not match.');
      return;
    }

    setCreateAdminLoading(true);
    try {
      await adminApi.createAdministrator({
        username: newAdminUsername.trim(),
        password: newAdminPassword,
        confirm_password: newAdminConfirmPassword,
        full_name: newAdminFullName.trim() || undefined,
        email: newAdminEmail.trim() || undefined,
      });
      toast.success(`Administrator '${newAdminUsername.trim()}' successfully created`);
      setShowCreateAdminModal(false);
      setNewAdminUsername('');
      setNewAdminFullName('');
      setNewAdminEmail('');
      setNewAdminPassword('');
      setNewAdminConfirmPassword('');
      fetchAdmins();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Failed to create administrator';
      setCreateAdminError(msg);
      toast.error(msg);
    } finally {
      setCreateAdminLoading(false);
    }
  };

  // Global Refresh
  const handleGlobalRefresh = async () => {
    setIsRefreshing(true);
    if (activeTab === 'overview') await fetchOverview();
    else if (activeTab === 'users') await fetchUsers();
    else if (activeTab === 'emotions') await fetchEmotionalAnalytics();
    else if (activeTab === 'admins') await fetchAdmins();
    setIsRefreshing(false);
    toast.success('Administrative telemetry updated');
  };

  const handleSignOut = () => {
    logout();
    toast.success('Administrator signed out');
    navigate('/login');
  };

  const totalUserPages = Math.ceil(totalUsers / userPageSize) || 1;

  // Custom Recharts Tooltip
  const CustomChartTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div
          style={{
            background: 'rgba(9, 21, 38, 0.95)',
            border: '1px solid var(--accent-border)',
            borderRadius: '8px',
            padding: '0.65rem 0.9rem',
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            fontSize: '0.75rem',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>{label}</div>
          {payload.map((entry: any, index: number) => (
            <div key={`item-${index}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '2px 0' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color || entry.fill }} />
              <span style={{ color: 'var(--text-secondary)' }}>{entry.name}:</span>
              <strong style={{ color: '#fff' }}>{entry.value}</strong>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#050a14',
        backgroundImage: `
          radial-gradient(circle at 10% 15%, rgba(232, 117, 34, 0.12), transparent 40%),
          radial-gradient(circle at 90% 85%, rgba(46, 111, 145, 0.15), transparent 45%)
        `,
        color: 'var(--text-primary)',
        padding: '1.75rem',
        fontFamily: 'var(--font-body)',
      }}
    >
      <div style={{ maxWidth: '1360px', margin: '0 auto' }}>

        {/* Top Header Bar */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1.15rem 1.6rem',
            background: 'rgba(10, 22, 38, 0.94)',
            border: '1px solid #1a3047',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            marginBottom: '1.5rem',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: '#040711',
                border: '1.5px solid rgba(255, 255, 255, 0.22)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 16px rgba(232, 117, 34, 0.4), 0 0 24px rgba(46, 111, 145, 0.35)',
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              <img src="/shadowmind-logo.png" alt="ShadowMind" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, letterSpacing: '-0.01em', color: '#fff' }}>
                  ShadowMind Admin Console
                </h1>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.62rem',
                    background: 'rgba(232, 117, 34, 0.2)',
                    color: 'var(--accent-bright)',
                    border: '1px solid var(--accent-border)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    letterSpacing: '0.08em',
                  }}
                >
                  ADMIN LEVEL 1
                </span>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '3px 0 0' }}>
                Signed in as <strong style={{ color: '#fff' }}>{user?.username || 'nirvan'}</strong> • Server-Verified RBAC Active
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={handleGlobalRefresh}
              disabled={isRefreshing}
              className="btn btn-ghost"
              style={{
                border: '1px solid var(--border-dim)',
                padding: '0.5rem 0.9rem',
                fontSize: '0.78rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
              Refresh
            </button>

            <button
              onClick={() => navigate('/chat')}
              className="btn btn-ghost"
              style={{
                border: '1px solid var(--border-dim)',
                padding: '0.5rem 0.9rem',
                fontSize: '0.78rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: 'var(--blue-bright)',
              }}
            >
              <ExternalLink size={14} /> Wellness App
            </button>

            <button
              onClick={openExitDialog}
              className="btn btn-ghost"
              style={{
                border: '1px solid rgba(239, 68, 68, 0.3)',
                background: 'rgba(239, 68, 68, 0.08)',
                color: '#ef4444',
                padding: '0.5rem 0.9rem',
                fontSize: '0.78rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <LogOut size={14} /> Exit App
            </button>

            <button
              onClick={handleSignOut}
              className="btn btn-primary"
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.78rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </header>

        {/* Navigation Tabs Bar */}
        <nav
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(9, 21, 38, 0.7)',
            padding: '6px',
            borderRadius: '12px',
            border: '1px solid var(--border-dim)',
            marginBottom: '1.75rem',
            overflowX: 'auto',
          }}
        >
          <button
            onClick={() => switchTab('overview')}
            id="tab-admin-overview"
            style={{
              padding: '0.6rem 1.15rem',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              border: activeTab === 'overview' ? '1px solid var(--accent-border)' : '1px solid transparent',
              background: activeTab === 'overview' ? 'rgba(232, 117, 34, 0.15)' : 'transparent',
              color: activeTab === 'overview' ? 'var(--accent-bright)' : 'var(--text-secondary)',
            }}
          >
            <Activity size={16} />
            <span>1. Overview</span>
          </button>

          <button
            onClick={() => switchTab('users')}
            id="tab-admin-users"
            style={{
              padding: '0.6rem 1.15rem',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              border: activeTab === 'users' ? '1px solid var(--accent-border)' : '1px solid transparent',
              background: activeTab === 'users' ? 'rgba(232, 117, 34, 0.15)' : 'transparent',
              color: activeTab === 'users' ? 'var(--accent-bright)' : 'var(--text-secondary)',
            }}
          >
            <Users size={16} />
            <span>2. Users</span>
          </button>

          <button
            onClick={() => switchTab('emotions')}
            id="tab-admin-emotions"
            style={{
              padding: '0.6rem 1.15rem',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              border: activeTab === 'emotions' ? '1px solid var(--accent-border)' : '1px solid transparent',
              background: activeTab === 'emotions' ? 'rgba(232, 117, 34, 0.15)' : 'transparent',
              color: activeTab === 'emotions' ? 'var(--accent-bright)' : 'var(--text-secondary)',
            }}
          >
            <BarChart3 size={16} />
            <span>3. Emotional Analytics</span>
          </button>

          <button
            onClick={() => switchTab('admins')}
            id="tab-admin-management"
            style={{
              padding: '0.6rem 1.15rem',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              border: activeTab === 'admins' ? '1px solid var(--accent-border)' : '1px solid transparent',
              background: activeTab === 'admins' ? 'rgba(232, 117, 34, 0.15)' : 'transparent',
              color: activeTab === 'admins' ? 'var(--accent-bright)' : 'var(--text-secondary)',
            }}
          >
            <Shield size={16} />
            <span>4. Admin Management</span>
          </button>
        </nav>

        {/* ═══════════════════════════════════════════════════════════════════════
            PAGE 1: OVERVIEW
        ══════════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
            {overviewLoading && !overview ? (
              <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
                <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px' }} />
                <p>Loading real platform metrics from MongoDB…</p>
              </div>
            ) : (
              <>
                {/* Primary Metric Summary Cards */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: '1.25rem',
                  }}
                >
                  {/* Total Registered Users */}
                  <div
                    style={{
                      padding: '1.25rem',
                      background: 'rgba(10, 22, 38, 0.85)',
                      border: '1px solid var(--border-dim)',
                      borderRadius: '14px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                        TOTAL REGISTERED USERS
                      </span>
                      <Users size={18} color="#5db7f2" />
                    </div>
                    <div style={{ fontSize: '2.15rem', fontWeight: 800, color: '#ffffff', margin: '0.45rem 0 0.2rem' }}>
                      {overview?.total_users ?? 0}
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Actual registered accounts in database
                    </span>
                  </div>

                  {/* Total Active Users */}
                  <div
                    style={{
                      padding: '1.25rem',
                      background: 'rgba(10, 22, 38, 0.85)',
                      border: '1px solid var(--border-dim)',
                      borderRadius: '14px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.75rem', color: '#22c55e', fontFamily: 'var(--font-mono)' }}>
                        TOTAL ACTIVE USERS
                      </span>
                      <CheckCircle2 size={18} color="#22c55e" />
                    </div>
                    <div style={{ fontSize: '2.15rem', fontWeight: 800, color: '#ffffff', margin: '0.45rem 0 0.2rem' }}>
                      {overview?.total_active_users ?? 0}
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Non-deactivated platform accounts
                    </span>
                  </div>

                  {/* Total Sessions Recorded */}
                  <div
                    style={{
                      padding: '1.25rem',
                      background: 'rgba(10, 22, 38, 0.85)',
                      border: '1px solid var(--border-dim)',
                      borderRadius: '14px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                        SESSIONS RECORDED
                      </span>
                      <Activity size={18} color="#a855f7" />
                    </div>
                    <div style={{ fontSize: '2.15rem', fontWeight: 800, color: '#ffffff', margin: '0.45rem 0 0.2rem' }}>
                      {overview?.total_sessions_recorded ?? 0}
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {overview?.total_chat_sessions ?? 0} chats • {overview?.total_mood_logs ?? 0} moods • {overview?.total_journal_entries ?? 0} journals
                    </span>
                  </div>

                  {/* Total Users With Emotional Data */}
                  <div
                    style={{
                      padding: '1.25rem',
                      background: 'rgba(10, 22, 38, 0.85)',
                      border: '1px solid var(--accent-border)',
                      borderRadius: '14px',
                      boxShadow: '0 0 16px rgba(232, 117, 34, 0.08)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--accent-bright)', fontFamily: 'var(--font-mono)' }}>
                        USERS WITH EMOTIONAL DATA
                      </span>
                      <BarChart3 size={18} color="var(--accent-bright)" />
                    </div>
                    <div style={{ fontSize: '2.15rem', fontWeight: 800, color: 'var(--accent-bright)', margin: '0.45rem 0 0.2rem' }}>
                      {overview?.total_users_analyzed ?? 0}
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Distinct users with recorded wellness data
                    </span>
                  </div>
                </div>

                {/* Most Frequently Detected Emotional Categories */}
                <div
                  style={{
                    background: 'rgba(10, 22, 38, 0.94)',
                    border: '1px solid #1a3047',
                    borderRadius: '16px',
                    padding: '1.5rem',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                    <div>
                      <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, color: '#fff' }}>
                        Most Frequently Detected Emotional Categories
                      </h2>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                        Aggregated occurrences across all stored sessions and observations in MongoDB
                      </p>
                    </div>
                  </div>

                  {!overview?.most_frequent_emotions || overview.most_frequent_emotions.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No emotional categories detected yet
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '1rem',
                      }}
                    >
                      {overview.most_frequent_emotions.map((em) => (
                        <div
                          key={em.id}
                          style={{
                            padding: '1rem 1.15rem',
                            background: 'rgba(17, 35, 56, 0.6)',
                            border: `1px solid ${em.color}40`,
                            borderRadius: '12px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fff' }}>
                              {em.category}
                            </span>
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                background: em.color,
                                boxShadow: `0 0 8px ${em.color}`,
                              }}
                            />
                          </div>
                          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: em.color }}>
                            {em.count}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            {em.percentage}% of detected signals
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Trend Summary Cards (Improving / Worsening / Insufficient Data) */}
                <div
                  style={{
                    background: 'rgba(10, 22, 38, 0.94)',
                    border: '1px solid #1a3047',
                    borderRadius: '16px',
                    padding: '1.5rem',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  }}
                >
                  <div style={{ marginBottom: '1.25rem' }}>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, color: '#fff' }}>
                      User Emotional-Signal Improvement Trends
                    </h2>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                      Grounded in chronological baseline vs recent period comparisons (≥4 recorded sessions required)
                    </p>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: '1.25rem',
                    }}
                  >
                    {/* Improving Trends */}
                    <div
                      style={{
                        padding: '1.25rem',
                        background: 'rgba(34, 197, 94, 0.08)',
                        border: '1px solid rgba(34, 197, 94, 0.3)',
                        borderRadius: '14px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.75rem', color: '#22c55e', fontFamily: 'var(--font-mono)' }}>
                          IMPROVING TRENDS
                        </span>
                        <TrendingUp size={18} color="#22c55e" />
                      </div>
                      <div style={{ fontSize: '2.15rem', fontWeight: 800, color: '#22c55e', margin: '0.45rem 0 0.2rem' }}>
                        {overview?.trend_improving_users ?? 0}
                      </div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        Users showing decline in distress indicators
                      </span>
                    </div>

                    {/* Worsening Trends */}
                    <div
                      style={{
                        padding: '1.25rem',
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '14px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.75rem', color: '#ef4444', fontFamily: 'var(--font-mono)' }}>
                          WORSENING TRENDS
                        </span>
                        <TrendingDown size={18} color="#ef4444" />
                      </div>
                      <div style={{ fontSize: '2.15rem', fontWeight: 800, color: '#ef4444', margin: '0.45rem 0 0.2rem' }}>
                        {overview?.trend_worsening_users ?? 0}
                      </div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        Users showing elevated distress indicators
                      </span>
                    </div>

                    {/* Unchanged Trends */}
                    <div
                      style={{
                        padding: '1.25rem',
                        background: 'rgba(59, 130, 246, 0.08)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        borderRadius: '14px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.75rem', color: '#60a5fa', fontFamily: 'var(--font-mono)' }}>
                          UNCHANGED TRENDS
                        </span>
                        <Activity size={18} color="#60a5fa" />
                      </div>
                      <div style={{ fontSize: '2.15rem', fontWeight: 800, color: '#ffffff', margin: '0.45rem 0 0.2rem' }}>
                        {overview?.trend_unchanged_users ?? 0}
                      </div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        Sufficient data with stable signals
                      </span>
                    </div>

                    {/* Insufficient Data */}
                    <div
                      style={{
                        padding: '1.25rem',
                        background: 'rgba(148, 163, 184, 0.08)',
                        border: '1px solid rgba(148, 163, 184, 0.25)',
                        borderRadius: '14px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          INSUFFICIENT DATA
                        </span>
                        <HelpCircle size={18} color="var(--text-muted)" />
                      </div>
                      <div style={{ fontSize: '2.15rem', fontWeight: 800, color: 'var(--text-secondary)', margin: '0.45rem 0 0.2rem' }}>
                        {overview?.trend_insufficient_users ?? 0}
                      </div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Users with &lt;4 recorded observations
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            PAGE 2: USERS PAGE
        ══════════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'users' && (
          <div
            style={{
              background: 'rgba(10, 22, 38, 0.94)',
              border: '1px solid #1a3047',
              borderRadius: '16px',
              padding: '1.75rem',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1.5rem',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0, color: '#fff' }}>
                  Registered Users Directory
                </h2>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Searchable, paginated user management and activity inspection
                </p>
              </div>

              {/* Search & Sort Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', width: '280px' }}>
                  <input
                    id="input-user-search"
                    className="input-base"
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search by username or email…"
                    style={{ paddingLeft: '2.4rem', fontSize: '0.8rem' }}
                  />
                  <Search
                    size={15}
                    color="var(--text-muted)"
                    style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
                  />
                </div>

                <select
                  value={userSortBy}
                  onChange={(e) => setUserSortBy(e.target.value)}
                  className="input-base"
                  style={{ fontSize: '0.8rem', padding: '0.5rem 0.8rem', cursor: 'pointer' }}
                >
                  <option value="created_at">Sort by Registration Date</option>
                  <option value="username">Sort by Username</option>
                  <option value="session_count">Sort by Session Count</option>
                  <option value="last_active">Sort by Last Active Date</option>
                </select>

                <button
                  onClick={() => setUserSortOrder(userSortOrder === 'asc' ? 'desc' : 'asc')}
                  className="btn btn-ghost"
                  title="Toggle sort direction"
                  style={{
                    border: '1px solid var(--border-dim)',
                    padding: '0.5rem 0.8rem',
                    fontSize: '0.78rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <ArrowUpDown size={14} />
                  <span>{userSortOrder.toUpperCase()}</span>
                </button>
              </div>
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                <thead>
                  <tr
                    style={{
                      borderBottom: '1px solid var(--border-dim)',
                      color: 'var(--text-secondary)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.68rem',
                      letterSpacing: '0.08em',
                    }}
                  >
                    <th style={{ padding: '0.85rem 1rem' }}>USERNAME</th>
                    <th style={{ padding: '0.85rem 1rem' }}>REGISTERED</th>
                    <th style={{ padding: '0.85rem 1rem' }}>LAST ACTIVE</th>
                    <th style={{ padding: '0.85rem 1rem' }}>SESSIONS</th>
                    <th style={{ padding: '0.85rem 1rem' }}>LATEST ANALYSIS</th>
                    <th style={{ padding: '0.85rem 1rem' }}>STATUS</th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {usersLoading ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                        Loading user records from database…
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No accounts matched query '{userSearch}'
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => {
                      const isAdmin = u.role === 'admin';
                      return (
                        <tr
                          key={u.id}
                          style={{
                            borderBottom: '1px solid rgba(255,255,255,0.03)',
                            transition: 'background 0.15s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          {/* Username */}
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div
                                style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: '50%',
                                  background: isAdmin ? 'rgba(232, 117, 34, 0.2)' : 'rgba(46, 111, 145, 0.2)',
                                  border: isAdmin ? '1px solid var(--accent-border)' : '1px solid rgba(46, 111, 145, 0.4)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '0.78rem',
                                  fontWeight: 700,
                                  color: isAdmin ? 'var(--accent-bright)' : '#5db7f2',
                                }}
                              >
                                {u.username.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontWeight: 600, color: '#ffffff' }}>{u.username}</div>
                                {u.email && (
                                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                    {u.email}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Created At */}
                          <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                            {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                          </td>

                          {/* Last Active */}
                          <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                            {u.last_active ? new Date(u.last_active).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : 'Never'}
                          </td>

                          {/* Session Count */}
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                fontFamily: 'var(--font-mono)',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: '6px',
                                background: u.session_count > 0 ? 'rgba(93, 183, 242, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                color: u.session_count > 0 ? '#5db7f2' : 'var(--text-muted)',
                              }}
                            >
                              {u.session_count}
                            </span>
                          </td>

                          {/* Latest Analysis */}
                          <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                            {u.latest_analysis ? new Date(u.latest_analysis).toLocaleDateString() : 'No Analysis'}
                          </td>

                          {/* Status */}
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                fontSize: '0.72rem',
                                fontFamily: 'var(--font-mono)',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                background: u.is_active ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                color: u.is_active ? '#22c55e' : '#ef4444',
                              }}
                            >
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: u.is_active ? '#22c55e' : '#ef4444' }} />
                              {u.account_status}
                            </span>
                          </td>

                          {/* Actions */}
                          <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                            <button
                              onClick={() => setInspectUser(u)}
                              className="btn btn-ghost"
                              style={{
                                padding: '0.35rem 0.75rem',
                                fontSize: '0.72rem',
                                border: '1px solid var(--border-dim)',
                              }}
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: '1.5rem',
                flexWrap: 'wrap',
                gap: '1rem',
                fontSize: '0.78rem',
                color: 'var(--text-muted)',
              }}
            >
              <div>
                Showing {Math.min((userPage - 1) * userPageSize + 1, totalUsers)} to {Math.min(userPage * userPageSize, totalUsers)} of {totalUsers} registered users
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => setUserPage(p => Math.max(1, p - 1))}
                  disabled={userPage <= 1}
                  className="btn btn-ghost"
                  style={{
                    padding: '0.4rem 0.8rem',
                    fontSize: '0.78rem',
                    border: '1px solid var(--border-dim)',
                    opacity: userPage <= 1 ? 0.4 : 1,
                  }}
                >
                  <ChevronLeft size={14} /> Previous
                </button>
                <span style={{ fontFamily: 'var(--font-mono)', padding: '0 8px' }}>
                  Page {userPage} of {totalUserPages}
                </span>
                <button
                  onClick={() => setUserPage(p => Math.min(totalUserPages, p + 1))}
                  disabled={userPage >= totalUserPages}
                  className="btn btn-ghost"
                  style={{
                    padding: '0.4rem 0.8rem',
                    fontSize: '0.78rem',
                    border: '1px solid var(--border-dim)',
                    opacity: userPage >= totalUserPages ? 0.4 : 1,
                  }}
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Inspect User Account Modal */}
        {inspectUser && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(2, 6, 14, 0.85)',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100,
              padding: '1.25rem',
            }}
            onClick={() => setInspectUser(null)}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '460px',
                background: '#0a1728',
                border: '1px solid var(--accent-border)',
                borderRadius: '16px',
                padding: '2rem',
                boxShadow: '0 16px 48px rgba(0, 0, 0, 0.85)',
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#fff' }}>
                    User Account Supervision
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--accent-bright)', fontFamily: 'var(--font-mono)', margin: '2px 0 0' }}>
                    DATABASE RECORD DETAILS
                  </p>
                </div>
                <button
                  onClick={() => setInspectUser(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', fontSize: '0.82rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Account ID</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: '#fff' }}>{inspectUser.id}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Username</span>
                  <strong style={{ color: '#fff' }}>{inspectUser.username}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Role</span>
                  <span style={{ color: inspectUser.role === 'admin' ? 'var(--accent-bright)' : '#5db7f2', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                    {inspectUser.role.toUpperCase()}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Email</span>
                  <span style={{ color: '#fff' }}>{inspectUser.email || '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Status</span>
                  <span style={{ color: inspectUser.is_active ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                    {inspectUser.account_status}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Recorded Sessions</span>
                  <strong style={{ color: '#5db7f2' }}>{inspectUser.session_count}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Created At</span>
                  <span style={{ color: '#fff', fontFamily: 'var(--font-mono)' }}>
                    {inspectUser.created_at ? new Date(inspectUser.created_at).toLocaleString() : '—'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Last Active Date</span>
                  <span style={{ color: '#fff', fontFamily: 'var(--font-mono)' }}>
                    {inspectUser.last_active ? new Date(inspectUser.last_active).toLocaleString() : 'Never'}
                  </span>
                </div>
              </div>

              <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
                <button onClick={() => setInspectUser(null)} className="btn btn-primary" style={{ padding: '0.5rem 1.25rem', fontSize: '0.8rem' }}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            PAGE 3: EMOTIONAL ANALYTICS
        ══════════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'emotions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Header & Date Range Filter Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(10, 22, 38, 0.94)',
                border: '1px solid #1a3047',
                borderRadius: '16px',
                padding: '1.25rem 1.75rem',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0, color: '#fff' }}>
                  Platform Aggregate Emotional Analytics
                </h2>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                  Reporting period: {analytics?.reporting_period?.start_date ? new Date(analytics.reporting_period.start_date).toLocaleDateString() : '—'} to {analytics?.reporting_period?.end_date ? new Date(analytics.reporting_period.end_date).toLocaleDateString() : '—'} • {analytics?.total_users_analyzed ?? 0} distinct users analyzed
                </p>
              </div>

              {/* Date Filters */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => handleApplyDateFilter(7)}
                  className="btn btn-ghost"
                  style={{
                    padding: '0.45rem 0.85rem',
                    fontSize: '0.75rem',
                    border: dateFilterDays === 7 ? '1px solid var(--accent-border)' : '1px solid var(--border-dim)',
                    background: dateFilterDays === 7 ? 'rgba(232, 117, 34, 0.2)' : 'transparent',
                    color: dateFilterDays === 7 ? 'var(--accent-bright)' : 'var(--text-secondary)',
                  }}
                >
                  Last 7 days
                </button>

                <button
                  onClick={() => handleApplyDateFilter(30)}
                  className="btn btn-ghost"
                  style={{
                    padding: '0.45rem 0.85rem',
                    fontSize: '0.75rem',
                    border: dateFilterDays === 30 ? '1px solid var(--accent-border)' : '1px solid var(--border-dim)',
                    background: dateFilterDays === 30 ? 'rgba(232, 117, 34, 0.2)' : 'transparent',
                    color: dateFilterDays === 30 ? 'var(--accent-bright)' : 'var(--text-secondary)',
                  }}
                >
                  Last 30 days
                </button>

                <button
                  onClick={() => handleApplyDateFilter(90)}
                  className="btn btn-ghost"
                  style={{
                    padding: '0.45rem 0.85rem',
                    fontSize: '0.75rem',
                    border: dateFilterDays === 90 ? '1px solid var(--accent-border)' : '1px solid var(--border-dim)',
                    background: dateFilterDays === 90 ? 'rgba(232, 117, 34, 0.2)' : 'transparent',
                    color: dateFilterDays === 90 ? 'var(--accent-bright)' : 'var(--text-secondary)',
                  }}
                >
                  Last 90 days
                </button>

                <button
                  onClick={() => setDateFilterDays('custom')}
                  className="btn btn-ghost"
                  style={{
                    padding: '0.45rem 0.85rem',
                    fontSize: '0.75rem',
                    border: dateFilterDays === 'custom' ? '1px solid var(--accent-border)' : '1px solid var(--border-dim)',
                    background: dateFilterDays === 'custom' ? 'rgba(232, 117, 34, 0.2)' : 'transparent',
                    color: dateFilterDays === 'custom' ? 'var(--accent-bright)' : 'var(--text-secondary)',
                  }}
                >
                  Custom Range
                </button>
              </div>
            </div>

            {/* Custom Date Range Picker */}
            {dateFilterDays === 'custom' && (
              <form
                onSubmit={handleApplyCustomDates}
                style={{
                  background: 'rgba(10, 22, 38, 0.9)',
                  border: '1px solid var(--accent-border)',
                  borderRadius: '12px',
                  padding: '1rem 1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>From:</span>
                  <input
                    type="date"
                    className="input-base"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    required
                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.7rem' }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>To:</span>
                  <input
                    type="date"
                    className="input-base"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    required
                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.7rem' }}
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ padding: '0.45rem 1rem', fontSize: '0.78rem' }}
                >
                  Apply Custom Range
                </button>
              </form>
            )}

            {/* A. EMOTION SUMMARY CARDS (One for every supported category) */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0, color: '#fff' }}>
                  Supported Emotion Category Summary Cards
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Distinct User Counts vs Recorded Session Counts clearly distinguished
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                  gap: '1.25rem',
                }}
              >
                {analytics?.category_summaries?.map((cat) => (
                  <div
                    key={cat.id}
                    style={{
                      background: 'rgba(10, 22, 38, 0.94)',
                      border: `1px solid ${cat.color}50`,
                      borderRadius: '14px',
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.65rem',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#fff' }}>
                        {cat.label}
                      </span>
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: cat.color,
                          boxShadow: `0 0 10px ${cat.color}`,
                        }}
                      />
                    </div>

                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {cat.description}
                    </div>

                    <div style={{ margin: '0.4rem 0', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                      <span style={{ fontSize: '2rem', fontWeight: 800, color: cat.color }}>
                        {cat.user_count}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        distinct users ({cat.percentage}%)
                      </span>
                    </div>

                    <div
                      style={{
                        paddingTop: '0.5rem',
                        borderTop: '1px solid rgba(255,255,255,0.06)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '0.72rem',
                        color: 'var(--text-muted)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      <span>RECORDED SESSIONS:</span>
                      <strong style={{ color: '#fff' }}>{cat.session_count}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* B. USERS SHOWING IMPROVING TRENDS SECTION */}
            <div
              style={{
                background: 'rgba(10, 22, 38, 0.94)',
                border: '1px solid #1a3047',
                borderRadius: '16px',
                padding: '1.75rem',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              }}
            >
              <div style={{ marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, color: '#fff' }}>
                  Users Showing Improving Trends (Depression & Anxiety Indicators)
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                  Comparative historical analysis tracking changes in model-detected mental distress signals
                </p>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '1rem',
                  marginBottom: '1.5rem',
                }}
              >
                {/* Improving Depression Signals */}
                <div
                  style={{
                    padding: '1.15rem',
                    background: 'rgba(34, 197, 94, 0.08)',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    borderRadius: '12px',
                  }}
                >
                  <div style={{ fontSize: '0.72rem', color: '#22c55e', fontFamily: 'var(--font-mono)' }}>
                    IMPROVING DEPRESSION SIGNALS
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#22c55e', margin: '0.35rem 0' }}>
                    {analytics?.improvement_trends?.improving_depression ?? 0}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Users with ≥15% decline in sadness/low-mood
                  </div>
                </div>

                {/* Improving Anxiety Signals */}
                <div
                  style={{
                    padding: '1.15rem',
                    background: 'rgba(34, 197, 94, 0.08)',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    borderRadius: '12px',
                  }}
                >
                  <div style={{ fontSize: '0.72rem', color: '#22c55e', fontFamily: 'var(--font-mono)' }}>
                    IMPROVING ANXIETY SIGNALS
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#22c55e', margin: '0.35rem 0' }}>
                    {analytics?.improvement_trends?.improving_anxiety ?? 0}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Users with ≥15% decline in anxiety/panic
                  </div>
                </div>

                {/* Improving in Both Categories */}
                <div
                  style={{
                    padding: '1.15rem',
                    background: 'rgba(232, 117, 34, 0.1)',
                    border: '1px solid var(--accent-border)',
                    borderRadius: '12px',
                  }}
                >
                  <div style={{ fontSize: '0.72rem', color: 'var(--accent-bright)', fontFamily: 'var(--font-mono)' }}>
                    IMPROVING IN BOTH CATEGORIES
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-bright)', margin: '0.35rem 0' }}>
                    {analytics?.improvement_trends?.improving_both ?? 0}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Simultaneous improvement in both indicators
                  </div>
                </div>

                {/* Unchanged Trends */}
                <div
                  style={{
                    padding: '1.15rem',
                    background: 'rgba(59, 130, 246, 0.08)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: '12px',
                  }}
                >
                  <div style={{ fontSize: '0.72rem', color: '#60a5fa', fontFamily: 'var(--font-mono)' }}>
                    UNCHANGED TRENDS
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff', margin: '0.35rem 0' }}>
                    {analytics?.improvement_trends?.unchanged ?? 0}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Stable indicators across periods
                  </div>
                </div>

                {/* Worsening Trends */}
                <div
                  style={{
                    padding: '1.15rem',
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '12px',
                  }}
                >
                  <div style={{ fontSize: '0.72rem', color: '#ef4444', fontFamily: 'var(--font-mono)' }}>
                    WORSENING TRENDS
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#ef4444', margin: '0.35rem 0' }}>
                    {analytics?.improvement_trends?.worsening ?? 0}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Users with increasing distress signals
                  </div>
                </div>

                {/* Insufficient Data */}
                <div
                  style={{
                    padding: '1.15rem',
                    background: 'rgba(148, 163, 184, 0.08)',
                    border: '1px solid rgba(148, 163, 184, 0.25)',
                    borderRadius: '12px',
                  }}
                >
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    INSUFFICIENT DATA
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-secondary)', margin: '0.35rem 0' }}>
                    {analytics?.improvement_trends?.insufficient_data ?? 0}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Users with &lt;4 recorded observations
                  </div>
                </div>
              </div>

              {/* Methodology & Clinical Disclaimer Card */}
              <div
                style={{
                  padding: '1rem 1.25rem',
                  background: 'rgba(232, 117, 34, 0.06)',
                  border: '1px solid var(--accent-border)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                }}
              >
                <Info size={18} color="var(--accent-bright)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  <strong style={{ color: '#fff' }}>Methodology & Clinical Notice:</strong> {analytics?.improvement_trends?.methodology_explanation}
                </div>
              </div>
            </div>

            {/* C. VISUAL ANALYTICS CHARTS (6 Charts) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, color: '#fff' }}>
                Visual Analytics & Temporal Trends
              </h3>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))',
                  gap: '1.5rem',
                }}
              >
                {/* 1. Emotional Category Distribution */}
                <div
                  style={{
                    background: 'rgba(10, 22, 38, 0.94)',
                    border: '1px solid #1a3047',
                    borderRadius: '16px',
                    padding: '1.5rem',
                  }}
                >
                  <h4 style={{ fontSize: '0.92rem', fontWeight: 600, margin: '0 0 1rem', color: '#fff' }}>
                    1. Emotional Category Distribution (Distinct Users)
                  </h4>
                  <div style={{ height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics?.visual_analytics?.category_distribution || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                        <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} interval={0} angle={-20} textAnchor="end" height={60} />
                        <YAxis stroke="var(--text-muted)" fontSize={11} allowDecimals={false} />
                        <Tooltip content={<CustomChartTooltip />} />
                        <Bar dataKey="user_count" name="Users" radius={[6, 6, 0, 0]}>
                          {analytics?.visual_analytics?.category_distribution?.map((entry, idx) => (
                            <Cell key={`cell-${idx}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 2. Emotional Trends Over Time */}
                <div
                  style={{
                    background: 'rgba(10, 22, 38, 0.94)',
                    border: '1px solid #1a3047',
                    borderRadius: '16px',
                    padding: '1.5rem',
                  }}
                >
                  <h4 style={{ fontSize: '0.92rem', fontWeight: 600, margin: '0 0 1rem', color: '#fff' }}>
                    2. Emotional Trends Over Time (Daily Signals)
                  </h4>
                  <div style={{ height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analytics?.visual_analytics?.trends_over_time || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                        <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} />
                        <YAxis stroke="var(--text-muted)" fontSize={11} allowDecimals={false} />
                        <Tooltip content={<CustomChartTooltip />} />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Line type="monotone" dataKey="depression" name="Depression" stroke="#ef4444" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="anxiety" name="Anxiety" stroke="#f59e0b" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="joy" name="Joy" stroke="#10b981" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="stress" name="Stress" stroke="#e87522" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 3. Depression-Related Signal Trends */}
                <div
                  style={{
                    background: 'rgba(10, 22, 38, 0.94)',
                    border: '1px solid #1a3047',
                    borderRadius: '16px',
                    padding: '1.5rem',
                  }}
                >
                  <h4 style={{ fontSize: '0.92rem', fontWeight: 600, margin: '0 0 1rem', color: '#ef4444' }}>
                    3. Depression-Related Signal Trends
                  </h4>
                  <div style={{ height: 240 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analytics?.visual_analytics?.depression_trends || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                        <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} />
                        <YAxis stroke="var(--text-muted)" fontSize={11} allowDecimals={false} />
                        <Tooltip content={<CustomChartTooltip />} />
                        <Line type="monotone" dataKey="depression_signals" name="Depression Indicators" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 4. Anxiety-Related Signal Trends */}
                <div
                  style={{
                    background: 'rgba(10, 22, 38, 0.94)',
                    border: '1px solid #1a3047',
                    borderRadius: '16px',
                    padding: '1.5rem',
                  }}
                >
                  <h4 style={{ fontSize: '0.92rem', fontWeight: 600, margin: '0 0 1rem', color: '#f59e0b' }}>
                    4. Anxiety-Related Signal Trends
                  </h4>
                  <div style={{ height: 240 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analytics?.visual_analytics?.anxiety_trends || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                        <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} />
                        <YAxis stroke="var(--text-muted)" fontSize={11} allowDecimals={false} />
                        <Tooltip content={<CustomChartTooltip />} />
                        <Line type="monotone" dataKey="anxiety_signals" name="Anxiety Indicators" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 5. Positive Emotion Trends */}
                <div
                  style={{
                    background: 'rgba(10, 22, 38, 0.94)',
                    border: '1px solid #1a3047',
                    borderRadius: '16px',
                    padding: '1.5rem',
                  }}
                >
                  <h4 style={{ fontSize: '0.92rem', fontWeight: 600, margin: '0 0 1rem', color: '#10b981' }}>
                    5. Positive Emotion Trends (Joy & Calm)
                  </h4>
                  <div style={{ height: 240 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analytics?.visual_analytics?.positive_trends || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                        <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} />
                        <YAxis stroke="var(--text-muted)" fontSize={11} allowDecimals={false} />
                        <Tooltip content={<CustomChartTooltip />} />
                        <Line type="monotone" dataKey="positive_signals" name="Positive Signals" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 6. User Activity */}
                <div
                  style={{
                    background: 'rgba(10, 22, 38, 0.94)',
                    border: '1px solid #1a3047',
                    borderRadius: '16px',
                    padding: '1.5rem',
                  }}
                >
                  <h4 style={{ fontSize: '0.92rem', fontWeight: 600, margin: '0 0 1rem', color: '#5db7f2' }}>
                    6. User Activity (Users Analyzed & Recorded Sessions)
                  </h4>
                  <div style={{ height: 240 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analytics?.visual_analytics?.user_activity || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                        <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} />
                        <YAxis stroke="var(--text-muted)" fontSize={11} allowDecimals={false} />
                        <Tooltip content={<CustomChartTooltip />} />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Line type="monotone" dataKey="users_analyzed" name="Active Users" stroke="#5db7f2" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="sessions_recorded" name="Sessions" stroke="#a855f7" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            PAGE 4: ADMIN MANAGEMENT
        ══════════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'admins' && (
          <div
            style={{
              background: 'rgba(10, 22, 38, 0.94)',
              border: '1px solid #1a3047',
              borderRadius: '16px',
              padding: '1.75rem',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1.5rem',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0, color: '#fff' }}>
                  Administrator Supervision & Access Control
                </h2>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Manage verified system administrators. Privilege assignment is strictly enforced on the server.
                </p>
              </div>

              <button
                onClick={() => {
                  setShowCreateAdminModal(true);
                  setCreateAdminError('');
                }}
                id="btn-open-create-admin"
                className="btn btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '0.55rem 1.15rem',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                }}
              >
                <UserPlus size={16} />
                <span>Create Admin</span>
              </button>
            </div>

            {/* Administrators Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                <thead>
                  <tr
                    style={{
                      borderBottom: '1px solid var(--border-dim)',
                      color: 'var(--text-secondary)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.68rem',
                      letterSpacing: '0.08em',
                    }}
                  >
                    <th style={{ padding: '0.85rem 1rem' }}>ADMINISTRATOR</th>
                    <th style={{ padding: '0.85rem 1rem' }}>EMAIL</th>
                    <th style={{ padding: '0.85rem 1rem' }}>ROLE</th>
                    <th style={{ padding: '0.85rem 1rem' }}>ACCOUNT CREATED</th>
                    <th style={{ padding: '0.85rem 1rem' }}>LAST LOGIN</th>
                    <th style={{ padding: '0.85rem 1rem' }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {adminsLoading ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                        Loading administrators…
                      </td>
                    </tr>
                  ) : adminsList.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No administrators found
                      </td>
                    </tr>
                  ) : (
                    adminsList.map((adminItem) => (
                      <tr
                        key={adminItem.id}
                        style={{
                          borderBottom: '1px solid rgba(255,255,255,0.03)',
                          transition: 'background 0.15s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: '50%',
                                background: 'rgba(232, 117, 34, 0.2)',
                                border: '1px solid var(--accent-border)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                color: 'var(--accent-bright)',
                              }}
                            >
                              <Shield size={16} />
                            </div>
                            <div>
                              <strong style={{ color: '#fff' }}>{adminItem.username}</strong>
                              {adminItem.full_name && (
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                  {adminItem.full_name}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                          {adminItem.email || '—'}
                        </td>

                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.65rem',
                              letterSpacing: '0.06em',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontWeight: 600,
                              background: 'rgba(232, 117, 34, 0.18)',
                              color: 'var(--accent-bright)',
                              border: '1px solid var(--accent-border)',
                            }}
                          >
                            ADMIN
                          </span>
                        </td>

                        <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                          {adminItem.created_at ? new Date(adminItem.created_at).toLocaleDateString() : '—'}
                        </td>

                        <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                          {adminItem.last_login ? new Date(adminItem.last_login).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : 'Never'}
                        </td>

                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              fontSize: '0.72rem',
                              fontFamily: 'var(--font-mono)',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: adminItem.is_active ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                              color: adminItem.is_active ? '#22c55e' : '#ef4444',
                            }}
                          >
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: adminItem.is_active ? '#22c55e' : '#ef4444' }} />
                            {adminItem.is_active ? 'Active' : 'Deactivated'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Create Admin Modal */}
            {showCreateAdminModal && (
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(2, 6, 14, 0.85)',
                  backdropFilter: 'blur(10px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 100,
                  padding: '1.25rem',
                }}
                onClick={() => setShowCreateAdminModal(false)}
              >
                <div
                  style={{
                    width: '100%',
                    maxWidth: '460px',
                    background: '#0a1728',
                    border: '1px solid var(--accent-border)',
                    borderRadius: '16px',
                    padding: '2rem',
                    boxShadow: '0 16px 48px rgba(0, 0, 0, 0.85), 0 0 24px rgba(232, 117, 34, 0.15)',
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: '10px',
                          background: 'rgba(232, 117, 34, 0.15)',
                          border: '1px solid var(--accent-border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <UserPlus size={18} color="var(--accent-bright)" />
                      </div>
                      <div>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#fff' }}>
                          Create Administrator
                        </h3>
                        <p style={{ fontSize: '0.72rem', color: 'var(--accent-bright)', fontFamily: 'var(--font-mono)', margin: '2px 0 0' }}>
                          PRIVILEGED ACCOUNT PROVISIONING
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowCreateAdminModal(false)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.4 }}>
                    New administrators have full access to platform analytics, user supervision, and security settings.
                  </p>

                  {createAdminError && (
                    <div
                      style={{
                        padding: '0.65rem 0.85rem',
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.35)',
                        borderRadius: '8px',
                        color: '#fca5a5',
                        fontSize: '0.78rem',
                        marginBottom: '1.2rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <AlertCircle size={15} style={{ flexShrink: 0 }} />
                      <span>{createAdminError}</span>
                    </div>
                  )}

                  <form onSubmit={handleCreateAdmin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontFamily: 'var(--font-mono)' }}>
                        ADMINISTRATOR USERNAME *
                      </label>
                      <input
                        id="new-admin-username"
                        className="input-base"
                        type="text"
                        value={newAdminUsername}
                        onChange={(e) => setNewAdminUsername(e.target.value)}
                        placeholder="e.g. security_lead"
                        required
                        autoFocus
                        style={{ width: '100%', fontSize: '0.84rem' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontFamily: 'var(--font-mono)' }}>
                        FULL NAME (OPTIONAL)
                      </label>
                      <input
                        id="new-admin-fullname"
                        className="input-base"
                        type="text"
                        value={newAdminFullName}
                        onChange={(e) => setNewAdminFullName(e.target.value)}
                        placeholder="e.g. Maya Lin"
                        style={{ width: '100%', fontSize: '0.84rem' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontFamily: 'var(--font-mono)' }}>
                        EMAIL ADDRESS (OPTIONAL)
                      </label>
                      <input
                        id="new-admin-email"
                        className="input-base"
                        type="email"
                        value={newAdminEmail}
                        onChange={(e) => setNewAdminEmail(e.target.value)}
                        placeholder="admin@shadowmind.ai"
                        style={{ width: '100%', fontSize: '0.84rem' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontFamily: 'var(--font-mono)' }}>
                        PASSWORD *
                      </label>
                      <input
                        id="new-admin-password"
                        className="input-base"
                        type="password"
                        value={newAdminPassword}
                        onChange={(e) => setNewAdminPassword(e.target.value)}
                        placeholder="Minimum 6 characters"
                        required
                        style={{ width: '100%', fontSize: '0.84rem' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontFamily: 'var(--font-mono)' }}>
                        CONFIRM PASSWORD *
                      </label>
                      <input
                        id="new-admin-confirm-password"
                        className="input-base"
                        type="password"
                        value={newAdminConfirmPassword}
                        onChange={(e) => setNewAdminConfirmPassword(e.target.value)}
                        placeholder="Re-enter password"
                        required
                        style={{ width: '100%', fontSize: '0.84rem' }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '10px', marginTop: '0.75rem' }}>
                      <button
                        type="button"
                        onClick={() => setShowCreateAdminModal(false)}
                        className="btn btn-ghost"
                        style={{ flex: 1, padding: '0.65rem', fontSize: '0.82rem', border: '1px solid var(--border-dim)' }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        id="btn-create-admin-submit"
                        disabled={createAdminLoading}
                        className="btn btn-primary"
                        style={{ flex: 1.3, padding: '0.65rem', fontSize: '0.82rem', fontWeight: 600 }}
                      >
                        {createAdminLoading ? 'Provisioning…' : 'Create Admin'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
