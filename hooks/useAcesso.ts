// hooks/useAcesso.ts
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useAcesso() {
  const [estado, setEstado] = useState<string>('pendente')
  const [loading, setLoading] = useState(true)

  const isApto      = estado === 'apto'
  const isPendente  = estado === 'pendente'
  const isEmExame   = estado === 'em_exame'
  const isVerificado = isApto

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data } = await supabase
        .from('voluntarios').select('estado').eq('profile_id', user.id).single()
      if (data) setEstado(data.estado)
      setLoading(false)
    }
    load()
  }, [])

  return { estado, isApto, isPendente, isEmExame, isVerificado, loading }
}