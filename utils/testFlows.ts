// utils/testFlows.ts
import { supabase } from '../lib/supabase'

export async function diagnosticar() {
  const resultados: Record<string, boolean | string> = {}

  try {
    // 1. Autenticação
    const { data: { session } } = await supabase.auth.getSession()
const user = session?.user
    resultados['auth'] = !!user

    if (!user) return resultados

    // 2. Perfil existe
    const { data: prof } = await supabase
      .from('profiles').select('id, tipo, provincia_id').eq('id', user.id).single()
    resultados['perfil'] = !!prof
    resultados['tipo']   = prof?.tipo || 'não definido'
    resultados['provincia'] = prof?.provincia_id ? 'definida' : 'não definida'

    // 3. Voluntário existe
    if (prof?.tipo === 'voluntario') {
      const { data: vol } = await supabase
        .from('voluntarios').select('id, estado, numero_serial').eq('profile_id', user.id).single()
      resultados['voluntario']      = !!vol
      resultados['estado_doador']   = vol?.estado || 'não definido'
      resultados['serial']          = vol?.numero_serial || 'não gerado'
    }

    // 4. Tabelas acessíveis
    const { error: eSlots } = await supabase.from('slots').select('id').limit(1)
    resultados['slots_acessiveis'] = !eSlots

    const { error: eCamps } = await supabase.from('campanhas').select('id').limit(1)
    resultados['campanhas_acessiveis'] = !eCamps

    const { error: eEmerg } = await supabase.from('pedidos_emergencia').select('id').limit(1)
    resultados['emergencias_acessiveis'] = !eEmerg

    // 5. Províncias carregadas
    const { data: provs } = await supabase.from('provincias').select('id').limit(1)
    resultados['provincias_ok'] = (provs?.length || 0) > 0

  } catch (e: any) {
    resultados['erro_geral'] = e.message
  }

  return resultados
}