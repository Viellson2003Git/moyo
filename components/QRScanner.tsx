// components/QRScanner.tsx
import { useEffect, useRef, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  Platform, ActivityIndicator, Vibration
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { Colors } from '../constants/colors'

type Props = {
  onScanned: (codigo: string) => void
  onFechar?: () => void
  titulo?: string
}

// ── MOBILE — usa CameraView nativo ──
function ScannerMobile({ onScanned, onFechar, titulo }: Props) {
  const [permissao, setPermissao] = useState<boolean | null>(null)
  const [scanned, setScanned]     = useState(false)
  const [torch, setTorch]         = useState(false)
  const [zoom, setZoom]           = useState(0)
  const timeoutRef = useRef<any>(null)

  useEffect(() => {
    pedirPermissao()
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }
  }, [])

  async function pedirPermissao() {
    try {
      const { Camera } = require('expo-camera')
      const { status } = await Camera.requestCameraPermissionsAsync()
      setPermissao(status === 'granted')
    } catch {
      setPermissao(false)
    }
  }

  function handleScanned({ data }: { data: string }) {
    if (scanned) return
    setScanned(true)
    Vibration.vibrate(100)
    onScanned(data)
    timeoutRef.current = setTimeout(() => setScanned(false), 2000)
  }

  if (permissao === null) return (
    <View style={s.center}>
      <ActivityIndicator size="large" color={Colors.red} />
      <Text style={s.loadingText}>A solicitar permissão da câmara...</Text>
    </View>
  )

  if (!permissao) return (
    <View style={s.center}>
      <Feather name="camera-off" size={48} color={Colors.muted2} style={{ marginBottom: 16 }} />
      <Text style={s.semPermissaoTitle}>Câmara bloqueada</Text>
      <Text style={s.semPermissaoText}>
        Activa o acesso à câmara nas definições do dispositivo para usar o scanner.
      </Text>
    </View>
  )

  try {
    const { CameraView } = require('expo-camera')

    return (
      <View style={s.root}>
        <CameraView
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : handleScanned}
        zoom={zoom}
        enableTorch={torch}
        autoFocus="on"
        />
        <View style={s.overlay}>
          <View style={s.overlayEdge} />
          <View style={s.overlayMid}>
            <View style={s.overlayEdgeSide} />
            <View style={s.scanArea}>
              <View style={[s.corner, s.cornerTL]} />
              <View style={[s.corner, s.cornerTR]} />
              <View style={[s.corner, s.cornerBL]} />
              <View style={[s.corner, s.cornerBR]} />
              {!scanned && <ScanLine />}
              {scanned && (
                <View style={s.successOverlay}>
                  <Feather name="check-circle" size={48} color={Colors.green} />
                  <Text style={s.successText}>Lido!</Text>
                </View>
              )}
            </View>
            <View style={s.overlayEdgeSide} />
          </View>
          <View style={s.overlayEdge} />
        </View>

        <View style={[s.topbar, { paddingTop: safeTop + 8 }]}>
          {onFechar && (
            <TouchableOpacity style={s.topBarBtn} onPress={onFechar}>
              <Feather name="x" size={22} color={Colors.white} />
            </TouchableOpacity>
          )}
          <Text style={s.topBarTitle}>{titulo || 'Scanner QR'}</Text>
          <TouchableOpacity
            style={[s.topBarBtn, torch && s.topBarBtnActive]}
            onPress={() => setTorch(!torch)}
          >
            <Feather name="zap" size={20} color={torch ? Colors.gold : Colors.white} />
          </TouchableOpacity>
        </View>

        <View style={s.dicaBox}>
          <Text style={s.dicaText}>
            {scanned ? '✓ Código lido com sucesso' : 'Aponta a câmara para o QR Code do cartão'}
          </Text>
        </View>

        <View style={s.zoomBar}>
          <TouchableOpacity
            style={s.zoomBtn}
            onPress={() => setZoom(Math.max(0, parseFloat((zoom - 0.1).toFixed(1))))}
            disabled={zoom <= 0}
          >
            <Feather name="zoom-out" size={18} color={zoom <= 0 ? Colors.muted2 : Colors.white} />
          </TouchableOpacity>

          <View style={s.zoomTrack}>
            <View style={[s.zoomFill, { width: `${zoom * 100}%` as any }]} />
          </View>

          <TouchableOpacity
            style={s.zoomBtn}
            onPress={() => setZoom(Math.min(1, parseFloat((zoom + 0.1).toFixed(1))))}
            disabled={zoom >= 1}
          >
            <Feather name="zoom-in" size={18} color={zoom >= 1 ? Colors.muted2 : Colors.white} />
          </TouchableOpacity>

          <Text style={s.zoomLabel}>{Math.round(zoom * 100)}%</Text>
        </View>
      </View>
    )
  } catch {
    return (
      <View style={s.center}>
        <Feather name="camera-off" size={40} color={Colors.muted2} />
        <Text style={s.semPermissaoText}>expo-camera não disponível</Text>
      </View>
    )
  }
}

// ── LINHA DE SCAN ANIMADA ──
// CORRECÇÃO 3: usa dirRef em vez de estado 'dir' para evitar flickering
function ScanLine() {
  const [pos, setPos] = useState(0)
  const dirRef        = useRef(1)       // ← ref em vez de useState
  const ref           = useRef<any>(null)

  useEffect(() => {
    ref.current = setInterval(() => {
      setPos(p => {
        const next = p + dirRef.current * 2
        if (next >= 220) dirRef.current = -1  // ← actualiza ref directamente
        if (next <= 0)   dirRef.current = 1
        return next
      })
    }, 16)
    return () => clearInterval(ref.current)
  }, []) // ← sem dependências — só corre uma vez, sem flickering

  return (
    <View style={[s.scanLine, { top: pos }]}>
      <View style={s.scanLineGradient} />
    </View>
  )
}

// ── WEB — usa @zxing/library para descodificação rápida ──
function ScannerWeb({ onScanned, onFechar, titulo }: Props) {
  const videoRef  = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState<'loading' | 'active' | 'erro'>('loading')
  const [scanned, setScanned] = useState(false)

  // CORRECÇÃO 2: ref para evitar closure stale
  const scannedRef  = useRef(false)
  const scanRef     = useRef<any>(null)
  const streamRef   = useRef<MediaStream | null>(null)

  useEffect(() => {
    iniciarCamera()
    return () => { pararCamera() }
  }, [])

  async function iniciarCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width:  { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
        videoRef.current.onloadedmetadata = () => {
          setStatus('active')
          iniciarScan()
        }
      }
    } catch {
      setStatus('erro')
    }
  }

  function pararCamera() {
    if (scanRef.current) cancelAnimationFrame(scanRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
  }

  // Helper para marcar como scanned (actualiza estado + ref em conjunto)
  function marcarScanned(codigo: string) {
    if (scannedRef.current) return
    scannedRef.current = true
    setScanned(true)
    onScanned(codigo)
    setTimeout(() => {
      scannedRef.current = false
      setScanned(false)
    }, 2000)
  }

  async function iniciarScan() {
  // Tenta BarcodeDetector nativo (Chrome/Edge modernos)
  if ('BarcodeDetector' in window) {
    iniciarScanNativo()
    return
  }

  // Fallback — canvas manual sem @zxing
  iniciarScanCanvas()
}

function iniciarScanNativo() {
  const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] })
  async function scan() {
    if (!videoRef.current) return
    try {
      const codes = await detector.detect(videoRef.current)
      if (codes.length > 0 && !scannedRef.current) {
        marcarScanned(codes[0].rawValue)
      }
    } catch { }
    scanRef.current = requestAnimationFrame(scan)
  }
  scan()
}

function iniciarScanCanvas() {
  // Canvas simples sem biblioteca externa
  async function scan() {
    if (!videoRef.current || !canvasRef.current) return
    const video  = videoRef.current
    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')
    if (!ctx || video.readyState < 2) {
      scanRef.current = requestAnimationFrame(scan)
      return
    }
    canvas.width  = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0)
    scanRef.current = requestAnimationFrame(scan)
  }
  scan()
}

  // SUBSTITUI o bloco do retorno do ScannerWeb por:
return (
  <View style={s.root}>
    {/* ── Vídeo web via dangerouslySetInnerHTML não — usa ref directamente ── */}
    {Platform.OS === 'web' && (
      <>
        {/* @ts-ignore — elementos HTML nativos no web */}
        <video
          ref={videoRef as any}
          style={{
            position: 'absolute', top: 0, left: 0,
            width: '100%', height: '100%',
            objectFit: 'cover',
          } as any}
          playsInline
          muted
        />
        {/* @ts-ignore */}
        <canvas ref={canvasRef as any} style={{ display: 'none' } as any} />
      </>
    )}

    {/* Loading */}
{status === 'loading' && (
  <View style={s.absoluteCenter}>
    <ActivityIndicator size="large" color={Colors.red} />
    <Text style={s.loadingText}>A iniciar câmara...</Text>
  </View>
)}

{/* Erro */}
{status === 'erro' && (
  <View style={s.absoluteCenter}>
    <Feather name="camera-off" size={48} color={Colors.muted2} style={{ marginBottom: 16 }} />
    <Text style={s.semPermissaoTitle}>Câmara não disponível</Text>
    <Text style={s.semPermissaoText}>
      Verifica as permissões no browser e usa HTTPS ou localhost.
    </Text>
  </View>
)}

    {/* Overlay */}
    {status === 'active' && (
      <>
        <View style={s.overlay} pointerEvents="none">
          <View style={s.overlayEdge} />
          <View style={s.overlayMid}>
            <View style={s.overlayEdgeSide} />
            <View style={s.scanArea}>
              <View style={[s.corner, s.cornerTL]} />
              <View style={[s.corner, s.cornerTR]} />
              <View style={[s.corner, s.cornerBL]} />
              <View style={[s.corner, s.cornerBR]} />
              {!scanned && <ScanLine />}
              {scanned && (
                <View style={s.successOverlay}>
                  <Feather name="check-circle" size={48} color={Colors.green} />
                  <Text style={s.successText}>Lido!</Text>
                </View>
              )}
            </View>
            <View style={s.overlayEdgeSide} />
          </View>
          <View style={s.overlayEdge} />
        </View>

        <View style={[s.topbar, { paddingTop: safeTop + 8 }]}>
          {onFechar && (
            <TouchableOpacity style={s.topBarBtn} onPress={onFechar}>
              <Feather name="x" size={22} color={Colors.white} />
            </TouchableOpacity>
          )}
          <Text style={s.topBarTitle}>{titulo || 'Scanner QR'}</Text>
          <View style={s.topBarBtn} />
        </View>

        <View style={s.dicaBox}>
          <Text style={s.dicaText}>
            {scanned ? '✓ Código lido!' : 'Centra o QR Code na área de leitura'}
          </Text>
        </View>
      </>
    )}
  </View>
)
}

// ── COMPONENTE PRINCIPAL — escolhe mobile vs web ──
export default function QRScanner(props: Props) {
  if (Platform.OS === 'web') return <ScannerWeb {...props} />
  return <ScannerMobile {...props} />
}

const SCAN_SIZE    = 240
const CORNER_SIZE  = 24
const CORNER_WIDTH = 3

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#000' },
 loadingText: { fontSize: 14, color: Colors.muted, marginTop: 14, textAlign: 'center' },
  semPermissaoTitle: { fontSize: 18, fontWeight: '700', color: Colors.white, marginBottom: 8, textAlign: 'center' },
  semPermissaoText:  { fontSize: 14, color: Colors.muted, textAlign: 'center', lineHeight: 20 },

overlay: {
  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
  flexDirection: 'column',
},
  overlayEdge:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  overlayMid:      { flexDirection: 'row', height: SCAN_SIZE },
  overlayEdgeSide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },

  scanArea: {
    width: SCAN_SIZE, height: SCAN_SIZE,
    backgroundColor: 'transparent',
    overflow: 'hidden',
    position: 'relative',
  },

  corner:    { position: 'absolute', width: CORNER_SIZE, height: CORNER_SIZE, borderColor: Colors.red },
  cornerTL:  { top: 0,    left: 0,  borderTopWidth: CORNER_WIDTH,    borderLeftWidth: CORNER_WIDTH,  borderTopLeftRadius: 4     },
  cornerTR:  { top: 0,    right: 0, borderTopWidth: CORNER_WIDTH,    borderRightWidth: CORNER_WIDTH, borderTopRightRadius: 4    },
  cornerBL:  { bottom: 0, left: 0,  borderBottomWidth: CORNER_WIDTH, borderLeftWidth: CORNER_WIDTH,  borderBottomLeftRadius: 4  },
  cornerBR:  { bottom: 0, right: 0, borderBottomWidth: CORNER_WIDTH, borderRightWidth: CORNER_WIDTH, borderBottomRightRadius: 4 },

  scanLine: { position: 'absolute', left: 0, right: 0, height: 2 },
  scanLineGradient: {
    height: 2,
    backgroundColor: Colors.red,
    opacity: 0.9,
    shadowColor: Colors.red,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
  },

  successOverlay: {
  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.6)',
  alignItems: 'center', justifyContent: 'center', gap: 8,
},
  successText: { fontSize: 18, fontWeight: '800', color: Colors.green },

  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingHorizontal: 16, paddingBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  topBarBtn:       { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  topBarBtnActive: { backgroundColor: 'rgba(232,180,75,0.3)' },
  topBarTitle:     { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: Colors.white },

  dicaBox: {
    position: 'absolute', bottom: 100, left: 20, right: 20,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, padding: 12, alignItems: 'center',
  },
  dicaText: { fontSize: 13, color: Colors.white, textAlign: 'center' },

  zoomBar: {
    position: 'absolute', bottom: 40, left: 40, right: 40,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 10,
  },
  zoomBtn:   { padding: 4 },
  zoomTrack: { flex: 1, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, overflow: 'hidden' },
  zoomFill:  { height: 4, backgroundColor: Colors.red, borderRadius: 2 },
  zoomLabel: { fontSize: 11, color: Colors.muted, minWidth: 32, textAlign: 'right' },

  // Substitui o estilo 'center' existente por dois estilos separados:
center: {
  flex: 1,
  backgroundColor: Colors.dark,
  alignItems: 'center',
  justifyContent: 'center',
  padding: 32,
},
absoluteCenter: {
  position: 'absolute',
  top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: Colors.dark,
  alignItems: 'center',
  justifyContent: 'center',
  padding: 32,
},
})
