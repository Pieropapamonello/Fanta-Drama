import React, { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signInWithCustomToken } from 'firebase/auth'
import api, { setAuthToken } from '../services/api'
import { firebaseAuth } from '../services/firebase'

export default function AdminLogin() {
  const navigate = useNavigate(); const [password, setPassword] = useState(''); const [message, setMessage] = useState(''); const [working, setWorking] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setWorking(true); setMessage('')
    try {
      const response = await api.post('/admin/password-login', { password })
      const credential = await signInWithCustomToken(firebaseAuth, response.data.customToken)
      const token = await credential.user.getIdToken(true); localStorage.setItem('fd_token', token); setAuthToken(token); navigate('/admin/console', { replace: true })
    } catch (error: any) { setMessage(error.response?.data?.error === 'invalid_admin_password' ? 'Password admin non valida.' : 'Non riesco ad aprire la console admin.') } finally { setWorking(false) }
  }
  return <section className="admin-gate"><p className="eyebrow">Accesso separato</p><h2>Console FantaDrama</h2><p>Questa sessione è indipendente dagli account giocatore e richiede solo la password amministratore.</p><form onSubmit={submit}><input className="input" type="password" autoFocus autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password amministratore" required /><button className="btn" disabled={working}>{working ? 'Verifica…' : 'Accedi alla console'}</button></form>{message && <p className="admin-notice">{message}</p>}</section>
}
