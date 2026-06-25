'use client'

import imageCompression from 'browser-image-compression'

// Generate a tiny, low-quality preview of an image as a data URL. Upscaled in the
// UI it reads as a soft blur — the WhatsApp-style instant placeholder shown the
// moment a chat opens, before the full image has downloaded. Kept very small
// (~1–2 KB) so it can ride inside the (encrypted) message metadata and is therefore
// available offline for free, with no separate download.
export async function makeBlurThumb(file: File | Blob, maxDim = 32): Promise<string | null> {
  try {
    const f = file instanceof File
      ? file
      : new File([file], 'img', { type: (file as Blob).type || 'image/jpeg' })
    const tiny = await imageCompression(f, {
      maxWidthOrHeight: maxDim,
      maxSizeMB: 0.02,
      useWebWorker: true,
      initialQuality: 0.4,
      fileType: 'image/jpeg',
    })
    return await blobToDataUrl(tiny)
  } catch {
    return null
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onloadend = () => resolve(r.result as string)
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}

// Capture a still poster frame from a video file, plus its duration and pixel
// dimensions. Used the moment a video is sent so the chat shows a WhatsApp-style
// thumbnail (with a play button) instead of a heavy inline <video>. The poster is
// kept small (~max 400px, JPEG) so it can ride inside the (encrypted) metadata and
// is therefore available offline with no separate download.
export async function makeVideoThumb(
  file: File | Blob,
): Promise<{ thumb: string | null; dur: number; w: number; h: number } | null> {
  if (typeof document === 'undefined') return null
  return new Promise((resolve) => {
    let settled = false
    let url = ''
    const finish = (result: { thumb: string | null; dur: number; w: number; h: number } | null) => {
      if (settled) return
      settled = true
      if (url) { try { URL.revokeObjectURL(url) } catch { /* ignore */ } }
      resolve(result)
    }
    try {
      url = URL.createObjectURL(file)
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.muted = true
      ;(video as HTMLVideoElement & { playsInline?: boolean }).playsInline = true
      video.crossOrigin = 'anonymous'
      video.src = url

      const capture = (dur: number, w: number, h: number) => {
        try {
          const maxDim = 400
          const scale = Math.min(1, maxDim / Math.max(w || maxDim, h || maxDim))
          const cw = Math.max(1, Math.round((w || maxDim) * scale))
          const ch = Math.max(1, Math.round((h || maxDim) * scale))
          const canvas = document.createElement('canvas')
          canvas.width = cw
          canvas.height = ch
          const ctx = canvas.getContext('2d')
          if (!ctx) return finish({ thumb: null, dur, w, h })
          ctx.drawImage(video, 0, 0, cw, ch)
          const thumb = canvas.toDataURL('image/jpeg', 0.55)
          finish({ thumb, dur, w, h })
        } catch {
          finish({ thumb: null, dur, w, h })
        }
      }

      video.onloadedmetadata = () => {
        const dur = isFinite(video.duration) && video.duration > 0 ? video.duration : 0
        const w = video.videoWidth || 0
        const h = video.videoHeight || 0
        // Seek a touch into the clip (avoids an all-black first frame).
        const seekTo = Math.min(1, (video.duration || 0) * 0.1) || 0
        video.onseeked = () => capture(dur, w, h)
        try { video.currentTime = seekTo } catch { capture(dur, w, h) }
      }
      video.onerror = () => finish(null)
      // Never hang the send on a stubborn codec.
      setTimeout(() => finish({ thumb: null, dur: 0, w: 0, h: 0 }), 5000)
    } catch {
      finish(null)
    }
  })
}

// Read the duration (seconds) of an audio file via a throwaway <audio> element.
// Recorded WebM voice notes sometimes report Infinity, so callers pass the known
// timer value for those; this is for picked audio files.
export async function getAudioDuration(file: File | Blob): Promise<number> {
  if (typeof document === 'undefined') return 0
  return new Promise((resolve) => {
    let settled = false
    let url = ''
    const done = (d: number) => {
      if (settled) return
      settled = true
      if (url) { try { URL.revokeObjectURL(url) } catch { /* ignore */ } }
      resolve(isFinite(d) && d > 0 ? d : 0)
    }
    try {
      url = URL.createObjectURL(file)
      const audio = document.createElement('audio')
      audio.preload = 'metadata'
      audio.src = url
      audio.onloadedmetadata = () => done(audio.duration)
      audio.onerror = () => done(0)
      setTimeout(() => done(0), 3000)
    } catch {
      done(0)
    }
  })
}
