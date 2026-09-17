import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './components/Toast'
import Layout from './components/Layout'
import { LoadingPage } from './components/ui'
import { isConfigured } from './lib/supabase'
import { Login, Register, Blocked, NotConfigured } from './pages/Auth'
import Home from './pages/Home'
import Classes from './pages/Classes'
import ClassDetail from './pages/ClassDetail'
import Attendance from './pages/Attendance'
import ClassHistory, { HistoryIndex } from './pages/History'
import StudentDetail from './pages/StudentDetail'
import Exports from './pages/Exports'
import Settings from './pages/Settings'
import Admin from './pages/Admin'

/** Garde : connecté + compte actif (ou admin) */
function Protected({ children }) {
  const { session, profile, profileLoading } = useAuth()
  const loc = useLocation()
  if (session === undefined) return <FullLoader />
  if (!session) return <Navigate to="/connexion" replace state={{ from: loc }} />
  if (!profile) {
    if (profileLoading) return <FullLoader />
    return <ProfileUnavailable />
  }
  if (profile.role !== 'admin' && profile.status !== 'active') return <Blocked />
  return children
}

function AdminOnly({ children }) {
  const { profile } = useAuth()
  if (profile?.role !== 'admin') return <Navigate to="/" replace />
  return children
}

/** Redirige vers l'accueil si déjà connecté */
function Public({ children }) {
  const { session } = useAuth()
  if (session === undefined) return <FullLoader />
  if (session) return <Navigate to="/" replace />
  return children
}

const FullLoader = () => <div className="auth"><LoadingPage /></div>

/** Profil non chargé (hors-ligne sans cache, ou ligne profil manquante) */
function ProfileUnavailable() {
  const { refreshProfile, signOut, profileLoading } = useAuth()
  return (
    <div className="auth">
      <div className="box">
        <div className="card center">
          <div style={{ fontSize: 44 }}>📡</div>
          <h2 className="mt-1">Profil indisponible</h2>
          <p className="muted mt-1">Impossible de charger votre profil. Vérifiez votre connexion internet puis réessayez.</p>
          <div className="col mt-3">
            <button className="btn" onClick={refreshProfile} disabled={profileLoading}>Réessayer</button>
            <button className="btn ghost" onClick={signOut}>Se déconnecter</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  if (!isConfigured) return <NotConfigured />
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/connexion" element={<Public><Login /></Public>} />
            <Route path="/inscription" element={<Public><Register /></Public>} />
            <Route element={<Protected><Layout /></Protected>}>
              <Route index element={<Home />} />
              <Route path="classes" element={<Classes />} />
              <Route path="classes/:id" element={<ClassDetail />} />
              <Route path="appel/:classId" element={<Attendance />} />
              <Route path="historique" element={<HistoryIndex />} />
              <Route path="historique/:classId" element={<ClassHistory />} />
              <Route path="eleve/:id" element={<StudentDetail />} />
              <Route path="exports" element={<Exports />} />
              <Route path="reglages" element={<Settings />} />
              <Route path="admin" element={<AdminOnly><Admin /></AdminOnly>} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
