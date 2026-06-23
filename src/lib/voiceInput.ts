import { Capacitor, registerPlugin } from '@capacitor/core'

// Voice typing abstraction.
// - On a native device: uses the @capacitor-community/speech-recognition plugin
//   (accessed via registerPlugin, so no npm dependency is needed at build time —
//   the plugin just has to be installed in the native Android/iOS project).
// - On web (your testing path): uses the browser Web Speech API.
//
// Both paths report through a single onTranscript(text) callback, where `text`
// is the best current transcript for the session (cumulative).

const SpeechRecognition = registerPlugin<any>('SpeechRecognition')

export interface VoiceSession {
  stop: () => void
}

export function isVoiceInputSupported(): boolean {
  if (typeof window === 'undefined') return false
  if (Capacitor.isNativePlatform()) return true
  return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
}

export async function startVoiceInput(opts: {
  onTranscript: (text: string) => void
  onError?: (message: string) => void
  onEnd?: () => void
}): Promise<VoiceSession | null> {
  const { onTranscript, onError, onEnd } = opts

  // ---- Native path ----
  if (Capacitor.isNativePlatform()) {
    try {
      const perm = await SpeechRecognition.checkPermissions().catch(() => null)
      if (!perm || perm.speechRecognition !== 'granted') {
        const req = await SpeechRecognition.requestPermissions().catch(() => null)
        if (!req || req.speechRecognition !== 'granted') {
          onError?.('Microphone permission denied')
          return null
        }
      }

      const handle = await SpeechRecognition.addListener('partialResults', (data: any) => {
        const m = data?.matches?.[0]
        if (m) onTranscript(String(m))
      })

      await SpeechRecognition.start({ language: 'en-US', partialResults: true, popup: false })

      return {
        stop: async () => {
          try { await SpeechRecognition.stop() } catch { /* ignore */ }
          try { await handle.remove() } catch { /* ignore */ }
          onEnd?.()
        },
      }
    } catch {
      onError?.('Voice input needs the speech-recognition plugin in the native build')
      return null
    }
  }

  // ---- Web fallback (testing) ----
  const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  if (!Ctor) {
    onError?.('Voice typing isn’t supported in this browser')
    return null
  }

  const rec = new Ctor()
  rec.lang = 'en-US'
  rec.continuous = true
  rec.interimResults = true

  let finals = ''
  rec.onresult = (e: any) => {
    let interim = ''
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript
      if (e.results[i].isFinal) finals += t + ' '
      else interim += t
    }
    onTranscript((finals + interim).trim())
  }
  rec.onerror = (e: any) => {
    onError?.(e?.error === 'not-allowed' ? 'Microphone permission denied' : 'Voice error')
  }
  rec.onend = () => onEnd?.()

  try { rec.start() } catch { /* already started */ }

  return {
    stop: () => { try { rec.stop() } catch { /* ignore */ } },
  }
}
