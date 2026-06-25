// contexts/ProvinciaContext.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '../lib/supabase'

export type Provincia = {
  id: string
  nome: string
  codigo: string
  capital: string
}

type ProvinciaCtx = {
  provincia: Provincia | null
  provincias: Provincia[]
  setProvincia: (p: Provincia) => void
  loading: boolean
}

const Ctx = createContext<ProvinciaCtx>({
  provincia: null, provincias: [],
  setProvincia: () => {}, loading: true,
})

export function ProvinciaProvider({ children }: { children: ReactNode }) {
  const [provincia, setProvinciaState] = useState<Provincia | null>(null)
  const [provincias, setProvincias]    = useState<Provincia[]>([])
  const [loading, setLoading]          = useState(true)

  useEffect(() => {
    // Carrega lista de províncias
    supabase.from('provincias').select('*').eq('ativo', true).order('nome')
      .then(({ data }) => {
        setProvincias((data as any) || [])
        setLoading(false)
      })

    // Carrega província do perfil
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('profiles')
        .select('provincia_id, provincias(id, nome, codigo, capital)')
        .eq('id', user.id)
        .single()
        .then(({ data }: any) => {
          if (data?.provincias) setProvinciaState(data.provincias)
        })
    })
  }, [])

  function setProvincia(p: Provincia) {
    setProvinciaState(p)
  }

  return (
    <Ctx.Provider value={{ provincia, provincias, setProvincia, loading }}>
      {children}
    </Ctx.Provider>
  )
}

export const useProvincia = () => useContext(Ctx)