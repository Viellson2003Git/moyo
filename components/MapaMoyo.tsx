// components/MapaMoyo.tsx
import { useEffect, useState } from 'react'
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

function gerarHTML(marcadores: Marcador[]) {
  const centro = marcadores[0]
    ? [marcadores[0].latitude, marcadores[0].longitude]
    : [-15.1961, 12.1522]

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"/>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:#0D0D0F; }
    #map { width:100vw; height:100vh; }
    .leaflet-control-attribution { background:rgba(13,13,15,0.8)!important; color:#555!important; font-size:9px!important; }
    .leaflet-popup-content-wrapper { background:#1A1A1F!important; border:1px solid rgba(255,255,255,0.1)!important; border-radius:12px!important; box-shadow:0 8px 32px rgba(0,0,0,0.6)!important; }
    .leaflet-popup-tip { background:#1A1A1F!important; }
    .popup-nome { font-size:14px; font-weight:700; color:#fff; font-family:sans-serif; margin-bottom:4px; }
    .popup-sub  { font-size:12px; color:#888; font-family:sans-serif; }
    .popup-cor  { font-size:10px; font-weight:700; letter-spacing:0.8px; margin-bottom:6px; font-family:sans-serif; }
  </style>
</head>
<body>
<div id="map"></div>
<script>
var map = L.map('map',{zoomControl:false}).setView([${centro[0]},${centro[1]}],13);
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{
  attribution:'&copy; CARTO',subdomains:'abcd',maxZoom:19
}).addTo(map);
L.control.zoom({position:'bottomright'}).addTo(map);

var marcadores = ${JSON.stringify(marcadores)};
var cfg = {
  hospital:{cor:'#E8173A',emoji:'🏥',label:'Hospital'},
  ong:     {cor:'#4A9EFF',emoji:'🤝',label:'ONG'},
  posto:   {cor:'#2ECC71',emoji:'💉',label:'Posto'},
};

marcadores.forEach(function(m){
  var c = cfg[m.tipo]||cfg.hospital;
  var icon = L.divIcon({
    className:'',
    html:'<div style="width:36px;height:36px;border-radius:50%;background:'+c.cor+'22;border:2px solid '+c.cor+';display:flex;align-items:center;justify-content:center;font-size:17px;box-shadow:0 4px 12px rgba(0,0,0,0.5);">'+c.emoji+'</div>',
    iconSize:[36,36],iconAnchor:[18,18],popupAnchor:[0,-20]
  });
  var popup='<div style="padding:12px"><div class="popup-cor" style="color:'+c.cor+'">'+c.label+'</div><div class="popup-nome">'+m.nome+'</div>'+(m.municipio?'<div class="popup-sub">📍 '+m.municipio+'</div>':'')+(m.telefone?'<div class="popup-sub">📞 '+m.telefone+'</div>':'')+'</div>';
  L.marker([m.latitude,m.longitude],{icon:icon}).addTo(map).bindPopup(popup,{maxWidth:240});
});

if(marcadores.length===1){
  map.setView([marcadores[0].latitude,marcadores[0].longitude],15);
}else if(marcadores.length>1){
  var bounds=marcadores.map(function(m){return[m.latitude,m.longitude];});
  try{map.fitBounds(bounds,{padding:[40,40]});}catch(e){}
}
</script>
</body>
</html>`
}

export default function MapaMoyo({
  altura = 300,
}: {
  altura?: number
  provincia?: string
}) {
  const [marcadores, setMarcadores] = useState<Marcador[]>([])
  const [loading, setLoading]       = useState(true)

  useEffect(() => { loadMarcadores() }, [])

  async function loadMarcadores() {
    setLoading(true)
    const [{ data: hosps }, { data: ongs }] = await Promise.all([
      supabase.from('bancos_sangue').select('id,nome,municipio,telefone,latitude,longitude').eq('ativo',true).not('latitude','is',null),
      supabase.from('ongs').select('id,nome,municipio,descricao,telefone,latitude,longitude').eq('estado','ativa').not('latitude','is',null),
    ])
    const lista: Marcador[] = [
      ...(hosps||[]).map((h:any)=>({id:h.id,nome:h.nome,tipo:'hospital' as const,latitude:h.latitude,longitude:h.longitude,municipio:h.municipio,telefone:h.telefone})),
      ...(ongs||[]).map((o:any) =>({id:o.id,nome:o.nome,tipo:'ong' as const,    latitude:o.latitude,longitude:o.longitude,municipio:o.municipio,telefone:o.telefone})),
    ]
    setMarcadores(lista)
    setLoading(false)
  }

  const html = gerarHTML(marcadores)

  if (loading) return (
    <View style={[s.container, { height: altura }]}>
      <ActivityIndicator color={Colors.red} />
    </View>
  )

  // Web — usa iframe directamente
  if (Platform.OS === 'web') {
    return (
      <View style={[s.container, { height: altura }]}>
        <iframe
          srcDoc={html}
          style={{ width:'100%', height:'100%', border:'none', borderRadius:16 } as any}
          title="Mapa Moyo"
        />
        <Legenda />
      </View>
    )
  }

  // Mobile (APK) — usa WebView com o mesmo HTML
  // Mobile (APK) — WebView com configurações correctas para Android
try {
  const { WebView } = require('react-native-webview')
  return (
    <View style={[s.container, { height: altura }]}>
      <WebView
        source={{ html }}
        style={{ flex: 1, backgroundColor: '#0D0D0F' }}
        scrollEnabled={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        originWhitelist={['*']}
        mixedContentMode="always"
        allowUniversalAccessFromFileURLs={true}
        allowFileAccess={true}
        geolocationEnabled={false}
        onError={(e: any) => console.log('WebView erro:', e.nativeEvent)}
        onHttpError={(e: any) => console.log('WebView HTTP erro:', e.nativeEvent)}
        renderLoading={() => (
          <View style={[s.container, { height: altura, position: 'absolute', width: '100%' }]}>
            <ActivityIndicator color={Colors.red} />
            <Text style={{ color: Colors.muted, fontSize: 12, marginTop: 8 }}>
              A carregar mapa...
            </Text>
          </View>
        )}
        startInLoadingState={true}
      />
      <Legenda />
    </View>
  )
} catch {
  return (
    <View style={[s.container, s.placeholder, { height: altura }]}>
      <Feather name="map" size={32} color={Colors.muted2} />
      <Text style={s.placeholderText}>Mapa não disponível</Text>
    </View>
  )
}
}

function Legenda() {
  return (
    <View style={s.legenda}>
      <LItem cor="#E8173A" emoji="🏥" label="Hospital" />
      <LItem cor="#4A9EFF" emoji="🤝" label="ONG"      />
      <LItem cor="#2ECC71" emoji="💉" label="Posto"    />
    </View>
  )
}

function LItem({ cor, emoji, label }: { cor:string; emoji:string; label:string }) {
  return (
    <View style={{ flexDirection:'row', alignItems:'center', gap:5 }}>
      <View style={[s.legendaDot, { backgroundColor:cor }]} />
      <Text style={s.legendaLabel}>{emoji} {label}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  container: {
    borderRadius:16, overflow:'hidden',
    backgroundColor:'#0D0D0F',
    borderWidth:1, borderColor:'rgba(255,255,255,0.07)',
    marginBottom:16, alignItems:'center', justifyContent:'center',
  },
  legenda: {
    position:'absolute', bottom:12, left:12,
    flexDirection:'row', gap:10,
    backgroundColor:'rgba(13,13,15,0.9)',
    borderRadius:10, padding:8,
    borderWidth:1, borderColor:'rgba(255,255,255,0.08)',
  },
  legendaDot:   { width:7, height:7, borderRadius:4 },
  legendaLabel: { fontSize:11, color:'#ccc', fontWeight:'500' },
  placeholder:  { gap:10 },
  placeholderText: { fontSize:14, color:Colors.muted },
})