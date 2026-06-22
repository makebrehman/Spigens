import nacl from 'tweetnacl'
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from 'tweetnacl-util'

export function generateKeyPair(): { publicKey: string; privateKey: string } {
  const kp = nacl.box.keyPair()
  return { publicKey: encodeBase64(kp.publicKey), privateKey: encodeBase64(kp.secretKey) }
}

function localKey(userId: string) { return `spigens_pk_${userId}` }

export function storePrivateKey(privateKey: string, userId: string): void {
  if (typeof window !== 'undefined') localStorage.setItem(localKey(userId), privateKey)
}

export function loadPrivateKey(userId: string): string | null {
  if (typeof window !== 'undefined') return localStorage.getItem(localKey(userId))
  return null
}

export async function deriveWrappingKey(password: string, userId: string): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const base = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode(userId), iterations: 100_000, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function wrapPrivateKey(privateKey: string, wrappingKey: CryptoKey): Promise<string> {
  const enc = new TextEncoder()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, wrappingKey, enc.encode(privateKey))
  const out = new Uint8Array(12 + ciphertext.byteLength)
  out.set(iv)
  out.set(new Uint8Array(ciphertext), 12)
  return encodeBase64(out)
}

export async function unwrapPrivateKey(blob: string, wrappingKey: CryptoKey): Promise<string | null> {
  try {
    const combined = decodeBase64(blob)
    const iv = combined.slice(0, 12)
    const ct = combined.slice(12)
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, wrappingKey, ct)
    return new TextDecoder().decode(plain)
  } catch { return null }
}

export function encryptMessage(plaintext: string, otherPublicKeyB64: string, myPrivateKeyB64: string): string {
  const msg = decodeUTF8(plaintext)
  const theirPub = decodeBase64(otherPublicKeyB64)
  const myPriv = decodeBase64(myPrivateKeyB64)
  const nonce = nacl.randomBytes(nacl.box.nonceLength)
  const encrypted = nacl.box(msg, nonce, theirPub, myPriv)
  const combined = new Uint8Array(nonce.length + encrypted.length)
  combined.set(nonce)
  combined.set(encrypted, nonce.length)
  return encodeBase64(combined)
}

export function decryptMessage(encryptedB64: string, otherPublicKeyB64: string, myPrivateKeyB64: string): string | null {
  try {
    const combined = decodeBase64(encryptedB64)
    const nonce = combined.slice(0, nacl.box.nonceLength)
    const ct = combined.slice(nacl.box.nonceLength)
    const theirPub = decodeBase64(otherPublicKeyB64)
    const myPriv = decodeBase64(myPrivateKeyB64)
    const plain = nacl.box.open(ct, nonce, theirPub, myPriv)
    return plain ? encodeUTF8(plain) : null
  } catch { return null }
}
