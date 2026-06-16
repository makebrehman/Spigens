import nacl from 'tweetnacl'
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from 'tweetnacl-util'

const PRIVATE_KEY_STORAGE_KEY = 'spigen_private_key'

// Generate a new keypair on signup
export function generateKeyPair(): { publicKey: string; privateKey: string } {
  const keyPair = nacl.box.keyPair()
  return {
    publicKey: encodeBase64(keyPair.publicKey),
    privateKey: encodeBase64(keyPair.secretKey),
  }
}

// Store private key on device (localStorage for now, Capacitor SecureStorage later)
export function storePrivateKey(privateKey: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(PRIVATE_KEY_STORAGE_KEY, privateKey)
  }
}

// Load private key from device
export function loadPrivateKey(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(PRIVATE_KEY_STORAGE_KEY)
  }
  return null
}

// Clear private key on logout
export function clearPrivateKey(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(PRIVATE_KEY_STORAGE_KEY)
  }
}

// Encrypt a message for a recipient using their public key
export function encryptMessage(
  plaintext: string,
  recipientPublicKeyB64: string,
  senderPrivateKeyB64: string
): string {
  const message = decodeUTF8(plaintext)
  const recipientPublicKey = decodeBase64(recipientPublicKeyB64)
  const senderPrivateKey = decodeBase64(senderPrivateKeyB64)
  const nonce = nacl.randomBytes(nacl.box.nonceLength)
  const encrypted = nacl.box(message, nonce, recipientPublicKey, senderPrivateKey)
  // Pack nonce + encrypted into one base64 string
  const combined = new Uint8Array(nonce.length + encrypted.length)
  combined.set(nonce)
  combined.set(encrypted, nonce.length)
  return encodeBase64(combined)
}

// Decrypt a message using sender's public key and own private key
export function decryptMessage(
  encryptedB64: string,
  senderPublicKeyB64: string,
  recipientPrivateKeyB64: string
): string | null {
  try {
    const combined = decodeBase64(encryptedB64)
    const nonce = combined.slice(0, nacl.box.nonceLength)
    const encrypted = combined.slice(nacl.box.nonceLength)
    const senderPublicKey = decodeBase64(senderPublicKeyB64)
    const recipientPrivateKey = decodeBase64(recipientPrivateKeyB64)
    const decrypted = nacl.box.open(encrypted, nonce, senderPublicKey, recipientPrivateKey)
    if (!decrypted) return null
    return encodeUTF8(decrypted)
  } catch {
    return null
  }
}
