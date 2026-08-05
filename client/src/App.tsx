import React, { useEffect, useState } from 'react'
import { Routes, Route, Link, NavLink, useNavigate } from 'react-router-dom'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { Bell, CalendarDays, Home, Layers, LogOut, User, Users, X } from 'lucide-react'
import { firebaseAuth, firebaseAuthReady } from './services/firebase'
import ProtectedRoute from './components/ProtectedRoute'
import PwaInstallPrompt from './components/PwaInstallPrompt'
import BrandMark from './components/BrandMark'
import { listenToForegroundPush, syncDeviceNotificationsIfGranted } from './services/push'
import OnboardingTutorial from './components/OnboardingTutorial'
import LoginNotificationPrompt from './components/LoginNotificationPrompt'
import api from './services/api'

const Landing = React.lazy(() => import('./pages/Landing'))
const Login = React.lazy(() => import('./pages/Login'))
const Register = React.lazy(() => import('./pages/Register'))
const Dashboard = React.lazy(() => import('./pages/Dashboard'))
const GroupsList = React.lazy(() => import('./pages/GroupsList'))
const GroupDetail = React.lazy(() => import('./pages/GroupDetail'))
const GroupAuctions = React.lazy(() => import('./pages/GroupAuctions'))
const CreateGroup = React.lazy(() => import('./pages/CreateGroup'))
const JoinGroup = React.lazy(() => import('./pages/JoinGroup'))
const CharactersList = React.lazy(() => import('./pages/CharactersList'))
const CreateCharacter = React.lazy(() => import('./pages/CreateCharacter'))
const CardsList = React.lazy(() => import('./pages/CardsList'))
const CreateCard = React.lazy(() => import('./pages/CreateCard'))
const EventsList = React.lazy(() => import('./pages/EventsList'))
const CreateEvent = React.lazy(() => import('./pages/CreateEvent'))
const EventDetail = React.lazy(() => import('./pages/EventDetail'))
const TelegramLogin = React.lazy(() => import('./pages/TelegramLogin'))
const TelegramMiniApp = React.lazy(() => import('./pages/TelegramMiniApp'))
const ProfileSetup = React.lazy(() => import('./pages/ProfileSetup'))
const AdminConsole = React.lazy(() => import('./pages/AdminConsole'))
const AdminLogin = React.lazy(() => import('./pages/AdminLogin'))
const Notifications = React.lazy(() => import('./pages/Notifications'))

function useLoggedIn() {
  const [loggedIn, setLoggedIn] = useState(Boolean(localStorage.getItem('fd_token')))
  useEffect(() => onAuthStateChanged(firebaseAuth, (user) => setLoggedIn(Boolean(user) || Boolean(localStorage.getItem('fd_token')))), [])
  return loggedIn
}

function useUnreadNotificationCount(loggedIn: boolean) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!loggedIn) { setCount(0); return }
    let active = true
    const refresh = () => void api.get('/profile/notifications/unread-count').then((response) => {
      if (active) setCount(Math.max(0, Number(response.data?.unreadCount) || 0))
    }).catch(() => undefined)
    refresh()
    const refreshWhenVisible = () => { if (document.visibilityState === 'visible') refresh() }
    const timer = window.setInterval(refreshWhenVisible, 120_000)
    window.addEventListener('fd:notifications-changed', refresh)
    window.addEventListener('focus', refreshWhenVisible)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener('fd:notifications-changed', refresh)
      window.removeEventListener('focus', refreshWhenVisible)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [loggedIn])
  return count
}

function NotificationLabel({ count }: { count: number }) {
  return <span className="notification-nav-label">Notifiche{count > 0 && <i aria-label={`${count} avvisi non letti`}>{count > 99 ? '99+' : count}</i>}</span>
}

function Header({ unreadCount }: { unreadCount: number }) {
  const navigate = useNavigate()
  const loggedIn = useLoggedIn()
  const logout = async () => {
    await signOut(firebaseAuth)
    localStorage.removeItem('fd_token')
    navigate('/')
  }
  const telegramApp = (window as any).Telegram?.WebApp
  const exitApp = () => {
    if (telegramApp?.close) { telegramApp.close(); return }
    if (loggedIn) { void logout(); return }
    navigate('/')
  }
  const exitLabel = telegramApp?.initData ? 'Chiudi' : loggedIn ? 'Esci' : 'Chiudi'
  return <header className="app-header"><div className="app-header-inner">
    <Link to="/" className="brand" onDoubleClick={(event) => { event.preventDefault(); navigate('/admin') }}><BrandMark />FantaDrama</Link><button type="button" className="mobile-exit" onClick={exitApp} aria-label={exitLabel}>{telegramApp?.initData ? <X size={16} /> : <LogOut size={15} />}{exitLabel}</button><PwaInstallPrompt />
    <nav className="nav-links">{loggedIn ? <>
      <Link to="/dashboard">Dashboard</Link><Link to="/groups">Gruppi</Link><Link to="/events">Eventi</Link><Link to="/cards">Carte</Link><Link to="/notifications"><NotificationLabel count={unreadCount} /></Link><Link to="/profile/setup">Profilo</Link><button type="button" onClick={logout}>Esci</button>
    </> : <><Link to="/login">Accedi</Link><Link to="/register">Registrati</Link></>}</nav>
  </div></header>
}

function MobileNav({ unreadCount }: { unreadCount: number }) {
  const loggedIn = useLoggedIn()
  if (!loggedIn) return null
  const items = [[Home, '/dashboard', 'Home'], [Users, '/groups', 'Crew'], [CalendarDays, '/events', 'Eventi'], [Layers, '/cards', 'Carte'], [Bell, '/notifications', 'Avvisi'], [User, '/profile/setup', 'Profilo']] as const
  return <nav className="mobile-nav" aria-label="Navigazione principale">{items.map(([Icon, to, label]) => <NavLink key={to} to={to}><span className="mobile-nav-icon"><Icon size={19} />{to === '/notifications' && unreadCount > 0 && <i className="notification-nav-badge" aria-label={`${unreadCount} avvisi non letti`}>{unreadCount > 99 ? '99+' : unreadCount}</i>}</span><span>{label}</span></NavLink>)}</nav>
}

export default function App() {
  const loggedIn = useLoggedIn()
  const unreadCount = useUnreadNotificationCount(loggedIn)
  React.useEffect(() => {
    let unsubscribe: (() => void) | undefined
    void listenToForegroundPush().then((stop) => { unsubscribe = stop })
    return () => unsubscribe?.()
  }, [])
  React.useEffect(() => {
    if (!loggedIn) return
    void firebaseAuthReady.then((user) => user && syncDeviceNotificationsIfGranted()).catch(() => undefined)
  }, [loggedIn])
  return <div className="app-shell">
    <Header unreadCount={unreadCount} />
    <main className="app-main"><React.Suspense fallback={<div className="empty-state" role="status">Apro la drama room…</div>}><Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/telegram" element={<TelegramLogin />} />
      <Route path="/telegram-miniapp" element={<TelegramMiniApp />} />
      <Route path="/profile/setup" element={<ProtectedRoute><ProfileSetup /></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
      <Route path="/admin" element={<AdminLogin />} />
      <Route path="/admin/console" element={<ProtectedRoute><AdminConsole /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/groups" element={<ProtectedRoute><GroupsList /></ProtectedRoute>} />
      <Route path="/groups/create" element={<ProtectedRoute><CreateGroup /></ProtectedRoute>} />
      <Route path="/groups/join" element={<ProtectedRoute><JoinGroup /></ProtectedRoute>} />
      <Route path="/groups/:groupId" element={<ProtectedRoute><GroupDetail /></ProtectedRoute>} />
      <Route path="/groups/:groupId/cards" element={<ProtectedRoute><GroupAuctions /></ProtectedRoute>} />
      <Route path="/groups/:groupId/characters" element={<ProtectedRoute><CharactersList /></ProtectedRoute>} />
      <Route path="/characters/create" element={<ProtectedRoute><CreateCharacter /></ProtectedRoute>} />
      <Route path="/cards" element={<ProtectedRoute><CardsList /></ProtectedRoute>} />
      <Route path="/cards/create" element={<ProtectedRoute><CreateCard /></ProtectedRoute>} />
      <Route path="/events" element={<ProtectedRoute><EventsList /></ProtectedRoute>} />
      <Route path="/events/create" element={<ProtectedRoute><CreateEvent /></ProtectedRoute>} />
      <Route path="/events/:id" element={<ProtectedRoute><EventDetail /></ProtectedRoute>} />
    </Routes></React.Suspense></main><MobileNav unreadCount={unreadCount} />
    <OnboardingTutorial loggedIn={loggedIn} /><LoginNotificationPrompt loggedIn={loggedIn} />
    <footer className="app-footer">FantaDrama è un gioco di intrattenimento tra amici. Nessun denaro reale, nessuna vincita economica.</footer>
  </div>
}
