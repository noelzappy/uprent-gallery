const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

export async function importEncryptionKey(
  base64Key: string,
): Promise<CryptoKey> {
  const raw = Buffer.from(base64Key, 'base64')
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, true, [
    'encrypt',
    'decrypt',
  ])
}

export async function encrypt(
  plaintext: string,
  key: CryptoKey,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = textEncoder.encode(plaintext)

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data,
  )

  const cipherBytes = new Uint8Array(cipherBuffer)

  const result = new Uint8Array(iv.length + cipherBytes.length)
  result.set(iv, 0)
  result.set(cipherBytes, iv.length)

  return Buffer.from(result).toString('base64')
}

export async function decrypt(
  ciphertextBase64: string,
  key: CryptoKey,
): Promise<string> {
  const bytes = new Uint8Array(Buffer.from(ciphertextBase64, 'base64'))

  const iv = bytes.slice(0, 12)
  const cipherBytes = bytes.slice(12)

  const plainBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    cipherBytes,
  )

  return textDecoder.decode(plainBuffer)
}
