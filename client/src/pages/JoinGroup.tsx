import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import api from '../services/api'
import { useNavigate, useSearchParams } from 'react-router-dom'

const schema = z.object({ code: z.string().min(1) })

export default function JoinGroup() {
  const [searchParams] = useSearchParams()
  const { register, handleSubmit } = useForm({ resolver: zodResolver(schema), defaultValues: { code: searchParams.get('code') || '' } })
  const navigate = useNavigate()
  const [isJoining, setIsJoining] = useState(false)
  const [error, setError] = useState('')
  const onSubmit = async (data: any) => {
    if (isJoining) return
    setIsJoining(true); setError('')
    try {
      await api.post('/groups/join', data)
      navigate('/groups')
    } catch (err: any) {
      const code = err.response?.data?.error
      setError(code === 'already_member' ? 'Fai già parte di questa crew.' : code === 'group_not_found' ? 'Codice invito non valido.' : 'Non riesco a farti entrare nella crew. Riprova.')
    } finally { setIsJoining(false) }
  }
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-md">
      <h2 className="text-2xl mb-4">Entra nel gruppo</h2>
      {searchParams.get('code') && <p className="contact-message">Invito riconosciuto: conferma per entrare nella crew.</p>}
      <label className="block mb-2">Codice invito</label>
      <input {...register('code')} className="input" />
      {error && <p className="profile-error" role="alert">{error}</p>}
      <button className="btn mt-4" disabled={isJoining}>{isJoining ? 'Ingresso…' : 'Entra'}</button>
    </form>
  )
}
