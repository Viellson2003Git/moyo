// hooks/useProvincia.ts
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export type Provincia = {
  id: string
  nome: string
  codigo: string
  capital: string
}

export function useProvinciaDoUser() {
  const [provinciaId, setProvinciaId] = useState<string | null>(null)
  const [provincia, setProvincia]     = useState<Provincia | null>(null)
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
const user = session?.user
      if (!user) { setLoading(false); return }

      const { data } = await supabase
        .from('profiles')
        .select('provincia_id, provincias(id, nome, codigo, capital)')
        .eq('id', user.id)
        .single()

      if ((data as any)?.provincias) {
        setProvincia((data as any).provincias)
        setProvinciaId((data as any).provincia_id)
      }
      setLoading(false)
    }
    load()
  }, [])

  return { provinciaId, provincia, loading }
}

export function useProvincias() {
  const [provincias, setProvincias] = useState<Provincia[]>([])

  useEffect(() => {
    supabase.from('provincias').select('*').eq('ativo', true).order('nome')
      .then(({ data }) => setProvincias((data as any) || []))
  }, [])

  return provincias
}