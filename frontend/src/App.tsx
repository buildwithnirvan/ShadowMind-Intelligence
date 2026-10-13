import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ExitProvider } from './context/ExitContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import Layout from './components/Layout';
import WelcomeModal from './components/WelcomeModal';
import ExitConfirmationModal from './components/ExitConfirmationModal';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminDashboard from './pages/AdminDashboard';
import Chat from './pages/Chat';
import MoodPage from './pages/Mood';
import JournalPage from './pages/Journal';
import Analytics from './pages/Analytics';
import Profile from './pages/Profile';
import BreathingExercise from './pages/BreathingExercise';
import History from './pages/History';
import Predictions from './pages/Predictions';
import Doctors from './pages/Doctors';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';
import Help from './pages/Help';
import Meditation from './pages/Meditation';
import ClinicalAssessment from './pages/ClinicalAssessment';
import CBTTool from './pages/CBTTool';
import SafetyPlan from './pages/SafetyPlan';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ExitProvider>
          <BrowserRouter>
            <Toaster
              position="top-right"
              toastOptions={{
                style: {
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--accent-border)',
                  fontFamily: "'DM Mono', monospace",
                  fontSize: '.78rem',
                  letterSpacing: '.04em',
                },
                success: { iconTheme: { primary: '#44dd88', secondary: 'var(--bg-card)' } },
                error: { iconTheme: { primary: 'var(--accent-bright)', secondary: 'var(--bg-card)' } },
              }}
            />

            {/* Global Role-Based Welcome Popup & Exit Confirmation Modal */}
            <WelcomeModal />
            <ExitConfirmationModal />

            <Routes>
              {/* Authentication Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/login/admin" element={<Login />} />
              <Route path="/login/user" element={<Login />} />
              <Route path="/register" element={<Register />} />

              {/* Protected Admin Routes */}
              <Route
                path="/admin"
                element={
                  <AdminRoute>
                    <AdminDashboard />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/:section"
                element={
                  <AdminRoute>
                    <AdminDashboard />
                  </AdminRoute>
                }
              />

              {/* Protected User Routes */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                {/* Default root goes to Chat with Shadow */}
                <Route index element={<Navigate to="/chat" replace />} />
                <Route path="dashboard" element={<Navigate to="/chat" replace />} />

                {/* 1. Chat with Shadow */}
                <Route path="chat" element={<Chat />} />

                {/* 3. Mood Tracker */}
                <Route path="mood" element={<MoodPage />} />

                {/* 4. Meditation */}
                <Route path="meditation" element={<Meditation />} />

                {/* 5. Journal */}
                <Route path="journal" element={<JournalPage />} />

                {/* 6. CBT Coach */}
                <Route path="cbt" element={<CBTTool />} />

                {/* 7. Other Existing Pages */}
                <Route path="breathe" element={<BreathingExercise />} />
                <Route path="assessment" element={<ClinicalAssessment />} />
                <Route path="safety" element={<SafetyPlan />} />
                <Route path="analytics" element={<Analytics />} />
                <Route path="predictions" element={<Predictions />} />
                <Route path="history" element={<History />} />
                <Route path="doctors" element={<Doctors />} />
                <Route path="help" element={<Help />} />
                <Route path="settings" element={<Settings />} />
                <Route path="profile" element={<Profile />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </ExitProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
