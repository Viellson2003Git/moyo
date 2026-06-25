// components/MapaMoyo.tsx
import { useEffect, useState, useRef } from 'react'
import {
  View, Text, StyleSheet, Platform,
  ActivityIndicator, TouchableOpacity
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { Colors } from '../constants/colors'

type Marcador = {
  id: string
  nome: string
  tipo: 'hospital' | 'ong' | 'posto'
  latitude: number
  longitude: number
  municipio?: string
  telefone?: string
  descricao?: string
}

export default function MapaMoyo({
  altura = 320,
  provincia,
}: {
  altura?: number
  provincia?: string
}) {
  const [marcadores, setMarcadores] = useState<Marcador[]>([])
  const [loading, setLoading]       = useState(true)
  const iframeRef = useRef<any>(null)

  useEffect(() => { loadMarcadores() }, [provincia])

  async function loadMarcadores() {
    setLoading(true)

    const [{ data: hosps }, { data: ongs }] = await Promise.all([
      supabase
        .from('bancos_sangue')
        .select('id, nome, municipio, telefone, latitude, longitude')
        .eq('ativo', true)
        .not('latitude', 'is', null),
      supabase
        .from('ongs')
        .select('id, nome, municipio, descricao, telefone, latitude, longitude')
        .eq('estado', 'ativa')
        .not('latitude', 'is', null),
    ])

    const lista: Marcador[] = [
      ...(hosps || []).map((h: any) => ({
        id: h.id, nome: h.nome, tipo: 'hospital' as const,
        latitude: h.latitude, longitude: h.longitude,
        municipio: h.municipio, telefone: h.telefone,
      })),
      ...(ongs || []).map((o: any) => ({
        id: o.id, nome: o.nome, tipo: 'ong' as const,
        latitude: o.latitude, longitude: o.longitude,
        municipio: o.municipio, telefone: o.telefone,
        descricao: o.descricao,
      })),
    ]

    setMarcadores(lista)
    setLoading(false)
  }

  // ── WEB — Leaflet com tiles escuros ──
  if (Platform.OS === 'web') {
    const centro = marcadores[0]
      ? { lat: marcadores[0].latitude, lng: marcadores[0].longitude }
      : { lat: -15.1961, lng: 12.1522 }

    const marcadoresJson = JSON.stringify(marcadores)

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
  <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0D0D0F; }
    #map { width: 100vw; height: 100vh; }

    /* Remove atribuição Leaflet (mantém no tile) */
    .leaflet-control-attribution {
      background: rgba(13,13,15,0.8) !important;
      color: #555 !important;
      font-size: 9px !important;
    }

    /* Popup personalizado */
    .leaflet-popup-content-wrapper {
      background: #1A1A1F !important;
      border: 1px solid rgba(255,255,255,0.1) !important;
      border-radius: 12px !important;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6) !important;
      padding: 0 !important;
    }
    .leaflet-popup-tip {
      background: #1A1A1F !important;
    }
    .leaflet-popup-content {
      margin: 0 !important;
      min-width: 200px !important;
    }
    .popup-inner {
      padding: 14px 16px;
    }
    .popup-tipo {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .popup-nome {
      font-size: 14px;
      font-weight: 700;
      color: #fff;
      margin-bottom: 4px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    }
    .popup-local {
      font-size: 12px;
      color: #888;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 4px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    }
    .popup-tel {
      font-size: 12px;
      color: #aaa;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    }
    .popup-desc {
      font-size: 11px;
      color: #777;
      margin-top: 6px;
      line-height: 1.4;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    }
    .popup-header {
      border-radius: 12px 12px 0 0;
      padding: 10px 16px 8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    /* Ícone SVG personalizado */
    .marker-hospital, .marker-ong, .marker-posto {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2.5px solid;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      font-size: 16px;
    }
  </style>
</head>
<body>
<div id="map"></div>
<script>
  const marcadores = ${marcadoresJson};
  const centro = [${centro.lat}, ${centro.lng}];

  const map = L.map('map', {
    zoomControl: false,
    attributionControl: true,
  }).setView(centro, 13);

  // Tiles escuros — CartoDB Dark Matter
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19,
  }).addTo(map);

  // Controlo de zoom personalizado
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  // Cria ícones personalizados
  function criarIcone(tipo) {
    const cfg = {
      hospital: { bg: 'rgba(232,23,58,0.2)',  border: '#E8173A', emoji: '🏥' },
      ong:      { bg: 'rgba(74,158,255,0.2)', border: '#4A9EFF', emoji: '🤝' },
      posto:    { bg: 'rgba(46,204,113,0.2)', border: '#2ECC71', emoji: '💉' },
    }[tipo] || { bg: 'rgba(255,255,255,0.1)', border: '#fff', emoji: '📍' };

    return L.divIcon({
      className: '',
      html: \`
        <div style="
          width:40px; height:40px; border-radius:50%;
          background:\${cfg.bg};
          border: 2.5px solid \${cfg.border};
          display:flex; align-items:center; justify-content:center;
          font-size:18px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.5), 0 0 0 4px \${cfg.border}22;
          cursor: pointer;
          transition: transform 0.15s;
        " onmouseover="this.style.transform='scale(1.15)'" onmouseout="this.style.transform='scale(1)'">\${cfg.emoji}</div>
      \`,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
      popupAnchor: [0, -24],
    });
  }

  // Cores dos tipos
  const tipoCor = {
    hospital: '#E8173A',
    ong: '#4A9EFF',
    posto: '#2ECC71',
  };

  const tipoLabel = {
    hospital: 'Hospital / Banco de Sangue',
    ong: 'ONG Parceira',
    posto: 'Posto de Saúde',
  };

  // Adiciona marcadores
  marcadores.forEach(m => {
    const cor = tipoCor[m.tipo] || '#fff';
    const label = tipoLabel[m.tipo] || m.tipo;

    const popup = \`
      <div class="popup-header" style="background: \${cor}18; border-bottom: 1px solid \${cor}30;">
        <span style="font-size:20px">\${m.tipo === 'hospital' ? '🏥' : m.tipo === 'ong' ? '🤝' : '💉'}</span>
        <span class="popup-tipo" style="color: \${cor}">\${label}</span>
      </div>
      <div class="popup-inner">
        <div class="popup-nome">\${m.nome}</div>
        \${m.municipio ? '<div class="popup-local">📍 ' + m.municipio + '</div>' : ''}
        \${m.telefone ? '<div class="popup-tel">📞 ' + m.telefone + '</div>' : ''}
        \${m.descricao ? '<div class="popup-desc">' + m.descricao.slice(0,80) + (m.descricao.length > 80 ? '...' : '') + '</div>' : ''}
      </div>
    \`;

    L.marker([m.latitude, m.longitude], { icon: criarIcone(m.tipo) })
      .addTo(map)
      .bindPopup(popup, { maxWidth: 260 });
  });

  // Se só há 1 marcador, centra nele com zoom maior
  if (marcadores.length === 1) {
    map.setView([marcadores[0].latitude, marcadores[0].longitude], 15);
  } else if (marcadores.length > 1) {
    // Ajusta o bounds para mostrar todos os marcadores
    const bounds = marcadores.map(m => [m.latitude, m.longitude]);
    map.fitBounds(bounds, { padding: [40, 40] });
  }
</script>
</body>
</html>`

    return (
      <View style={[styles.container, { height: altura }]}>
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={Colors.red} />
            <Text style={styles.loadingText}>A carregar mapa...</Text>
          </View>
        ) : (
          <View style={{ flex: 1, position: 'relative' }}>
            <iframe
              ref={iframeRef}
              srcDoc={html}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                borderRadius: 16,
              } as any}
              title="Mapa Moyo"
            />

            {/* Legenda */}
            <View style={styles.legenda}>
              <LegendaItem cor="#E8173A" emoji="🏥" label="Hospital" />
              <LegendaItem cor="#4A9EFF" emoji="🤝" label="ONG" />
              <LegendaItem cor="#2ECC71" emoji="💉" label="Posto" />
            </View>

            {/* Botão de recarregar */}
            <TouchableOpacity style={styles.refreshBtn} onPress={loadMarcadores}>
              <Feather name="refresh-cw" size={14} color={Colors.muted} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    )
  }

  // ── MOBILE — react-native-maps com tema escuro ──
  try {
    const MapView    = require('react-native-maps').default
    const { Marker, Callout } = require('react-native-maps')

    const regiao = {
      latitude:      marcadores[0]?.latitude  ?? -15.1961,
      longitude:     marcadores[0]?.longitude ?? 12.1522,
      latitudeDelta:  0.5,
      longitudeDelta: 0.5,
    }

    const corMarcador: Record<string, string> = {
      hospital: '#E8173A',
      ong:      '#4A9EFF',
      posto:    '#2ECC71',
    }

    const emojiMarcador: Record<string, string> = {
      hospital: '🏥',
      ong:      '🤝',
      posto:    '💉',
    }

    return (
      <View style={[styles.container, { height: altura }]}>
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={Colors.red} />
            <Text style={styles.loadingText}>A carregar mapa...</Text>
          </View>
        ) : (
          <>
            <MapView
              style={{ flex: 1 }}
              initialRegion={regiao}
              userInterfaceStyle="dark"
              mapType="standard"
            >
              {marcadores.map(m => (
                <Marker
                  key={m.id}
                  coordinate={{ latitude: m.latitude, longitude: m.longitude }}
                  pinColor={corMarcador[m.tipo] || '#fff'}
                >
                  <View style={[
                    styles.marcadorMobile,
                    { borderColor: corMarcador[m.tipo], backgroundColor: corMarcador[m.tipo] + '30' }
                  ]}>
                    <Text style={{ fontSize: 18 }}>{emojiMarcador[m.tipo] || '📍'}</Text>
                  </View>
                  <Callout>
                    <View style={{ padding: 10, maxWidth: 200 }}>
                      <Text style={{ fontWeight: '700', fontSize: 13 }}>{m.nome}</Text>
                      {m.municipio && (
                        <Text style={{ fontSize: 11, color: '#666', marginTop: 3 }}>
                          📍 {m.municipio}
                        </Text>
                      )}
                      {m.telefone && (
                        <Text style={{ fontSize: 11, color: '#666' }}>📞 {m.telefone}</Text>
                      )}
                    </View>
                  </Callout>
                </Marker>
              ))}
            </MapView>

            {/* Legenda mobile */}
            <View style={styles.legenda}>
              <LegendaItem cor="#E8173A" emoji="🏥" label="Hospital" />
              <LegendaItem cor="#4A9EFF" emoji="🤝" label="ONG" />
              <LegendaItem cor="#2ECC71" emoji="💉" label="Posto" />
            </View>
          </>
        )}
      </View>
    )
  } catch {
    return (
      <View style={[styles.container, styles.placeholder, { height: altura }]}>
        <Feather name="map" size={32} color={Colors.muted2} />
        <Text style={styles.placeholderText}>Mapa não disponível</Text>
      </View>
    )
  }
}

function LegendaItem({ cor, emoji, label }: { cor: string; emoji: string; label: string }) {
  return (
    <View style={styles.legendaItem}>
      <View style={[styles.legendaDot, { backgroundColor: cor }]} />
      <Text style={styles.legendaLabel}>{emoji} {label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16, overflow: 'hidden',
    backgroundColor: '#0D0D0F',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    marginBottom: 16,
  },
  loading: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#0D0D0F',
  },
  loadingText: { fontSize: 13, color: Colors.muted },

  legenda: {
    position: 'absolute', bottom: 12, left: 12,
    flexDirection: 'row', gap: 10,
    backgroundColor: 'rgba(13,13,15,0.9)',
    borderRadius: 10, padding: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  legendaItem:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendaDot:   { width: 8, height: 8, borderRadius: 4 },
  legendaLabel: { fontSize: 11, color: '#ccc', fontWeight: '500' },

  refreshBtn: {
    position: 'absolute', bottom: 12, right: 12,
    backgroundColor: 'rgba(13,13,15,0.9)',
    borderRadius: 8, padding: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },

  marcadorMobile: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5, shadowRadius: 8, elevation: 6,
  },

  placeholder: {
    alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#0D0D0F',
  },
  placeholderText: { fontSize: 14, color: Colors.muted },
})