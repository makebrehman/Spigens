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
