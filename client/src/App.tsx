import React from 'react'
import { Routes, Route, Link } from 'react-router-dom'
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

export default function App() {
  return (
    <div className="min-h-screen bg-cream text-slate-900">
      <header className="p-4 border-b">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">FantaDrama — Pronostica il caos</h1>
          <nav>
            <Link to="/">Home</Link>
          </nav>
        </div>
      </header>
      <main className="container mx-auto p-4">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
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
        </Routes>
      </main>
      <footer className="p-4 text-center text-sm border-t">
        FantaDrama è un gioco di intrattenimento tra amici. Non utilizza denaro reale e non permette vincite economiche.
      </footer>
    </div>
  )
}
