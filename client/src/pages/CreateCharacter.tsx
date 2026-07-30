import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import api from '../services/api'
import { useNavigate } from 'react-router-dom'
import ImageForge from '../components/ImageForge'

const schema = z.object({ name: z.string().min(1), nickname: z.string().optional(), groupId: z.string(), image: z.string().optional() })

export default function CreateCharacter() {
  const { register, handleSubmit, setValue, watch } = useForm({ resolver: zodResolver(schema) }); const navigate = useNavigate(); const [groups, setGroups] = useState<any[]>([]); const [error, setError] = useState<string | null>(null); const [saving, setSaving] = useState(false); const [loading, setLoading] = useState(true)
  useEffect(() => { api.get('/groups').then((res) => setGroups((res.data.groups || []).filter((group: any) => group.currentUserRole === 'ADMIN'))).catch(() => setError('Non riesco a caricare i gruppi.')).finally(() => setLoading(false)) }, [])
  const onSubmit = async (data: any) => { if (saving) return; setSaving(true); setError(null); try { await api.post('/characters', data); navigate('/groups') } catch (err: any) { setError(err.response?.data?.error || 'Non riesco a creare il personaggio.') } finally { setSaving(false) } }
  return <form onSubmit={handleSubmit(onSubmit)} className="max-w-md"><h2 className="text-2xl mb-4">Crea personaggio</h2><label className="block mb-2">Nome</label><input {...register('name')} className="input" /><label className="block mt-4 mb-2">Nickname</label><input {...register('nickname')} className="input" /><label className="block mt-4 mb-2">Gruppo</label><select {...register('groupId')} className="input" defaultValue=""><option value="" disabled>Seleziona il gruppo</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select><ImageForge kind="AVATAR" imageUrl={watch('image')} onChange={(url) => setValue('image', url)} />{!loading && !groups.length && <p className="profile-error">Solo chi amministra una crew può aggiungere personaggi.</p>}{error && <p className="profile-error" role="alert">{error}</p>}<button className="btn mt-4" disabled={saving || loading || !groups.length}>{loading ? 'Carico le crew…' : saving ? 'Creazione…' : 'Crea personaggio'}</button></form>
}
