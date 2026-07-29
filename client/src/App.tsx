import React from 'react'
import { Routes, Route, Link, NavLink, useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { CalendarDays, Flame, Home, Layers, User, Users } from 'lucide-react'
import { firebaseAuth } from './services/firebase'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import GroupsList from './pages/GroupsList'
import CreateGroup from './pages/CreateGroup'
import JoinGroup from './pages/JoinGroup'
import CharactersList from './pages/CharactersList'
import CreateCharacter from './pages/CreateCharacter'
import CardsList from './pages/CardsList'
import CreateCard from './pages/CreateCard'
import EventsList from './pages/EventsList'
import CreateEvent from './pages/CreateEvent'
import EventDetail from './pages/EventDetail'
import ProtectedRoute from './components/ProtectedRoute'
import TelegramLogin from './pages/TelegramLogin'
import TelegramMiniApp from './pages/TelegramMiniApp'
import ProfileSetup from './pages/ProfileSetup'
import AdminConsole from './pages/AdminConsole'
import AdminLogin from './pages/AdminLogin'
import Notifications from './pages/Notifications'
import PwaInstallPrompt from './components/PwaInstallPrompt'

function Header() {
  const navigate = useNavigate()
  const loggedIn = Boolean(localStorage.getItem('fd_token'))
  const logout = async () => {
    await signOut(firebaseAuth)
    localStorage.removeItem('fd_token')
    navigate('/')
  }
  return <header className="app-header"><div className="app-header-inner">
    <Link to="/" className="brand" onDoubleClick={(event) => { event.preventDefault(); navigate('/admin') }}><span className="brand-mark"><Flame size={18} fill="currentColor" /></span>FantaDrama</Link>
    <nav className="nav-links">{loggedIn ? <>
      <Link to="/dashboard">Dashboard</Link><Link to="/groups">Gruppi</Link><Link to="/events">Eventi</Link><Link to="/cards">Carte</Link><Link to="/notifications">Notifiche</Link><Link to="/profile/setup">Profilo</Link><button type="button" onClick={logout}>Esci</button>
    </> : <><Link to="/login">Accedi</Link><Link to="/register">Registrati</Link></>}</nav>
  </div></header>
}

function MobileNav() {
  if (!localStorage.getItem('fd_token')) return null
  const items = [[Home, '/dashboard', 'Home'], [Users, '/groups', 'Crew'], [CalendarDays, '/events', 'Eventi'], [Layers, '/cards', 'Carte'], [User, '/profile/setup', 'Profilo']] as const
  return <nav className="mobile-nav" aria-label="Navigazione principale">{items.map(([Icon, to, label]) => <NavLink key={to} to={to}><Icon size={19} /><span>{label}</span></NavLink>)}</nav>
}

export default function App() {
  return <div className="app-shell"><PwaInstallPrompt />
    <Header />
    <main className="app-main"><Routes>
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
      <Route path="/groups/:groupId/characters" element={<ProtectedRoute><CharactersList /></ProtectedRoute>} />
      <Route path="/characters/create" element={<ProtectedRoute><CreateCharacter /></ProtectedRoute>} />
      <Route path="/cards" element={<ProtectedRoute><CardsList /></ProtectedRoute>} />
      <Route path="/cards/create" element={<ProtectedRoute><CreateCard /></ProtectedRoute>} />
      <Route path="/events" element={<ProtectedRoute><EventsList /></ProtectedRoute>} />
      <Route path="/events/create" element={<ProtectedRoute><CreateEvent /></ProtectedRoute>} />
      <Route path="/events/:id" element={<ProtectedRoute><EventDetail /></ProtectedRoute>} />
    </Routes></main><MobileNav />
    <footer className="app-footer">FantaDrama è un gioco di intrattenimento tra amici. Nessun denaro reale, nessuna vincita economica.</footer>
  </div>
}
