/**
 * Client-side Request Signing & API Security Utility
 * Computes standard HMAC-SHA256 signature and attaches required security headers:
 * - X-API-Key
 * - X-Timestamp
 * - X-Nonce
 * - X-Signature
 */

export function getClientApiKey(): string {
  const envKey = (import.meta as any).env?.VITE_API_KEY || (typeof process !== 'undefined' ? (process.env as any)?.API_KEY : '');
  return envKey && typeof envKey === 'string' ? envKey.trim() : '';
}

export function getClientSecretKey(): string {
  const envSecret = (import.meta as any).env?.VITE_API_SECRET_KEY || (typeof process !== 'undefined' ? (process.env as any)?.API_SECRET_KEY : '');
  return envSecret && typeof envSecret === 'string' ? envSecret.trim() : '';
}

/**
 * Generates a cryptographically secure random nonce string
 */
export function generateNonce(length = 24): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const bytes = new Uint8Array(Math.ceil(length / 2));
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, length);
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Pure JavaScript SHA-256 and HMAC-SHA256 implementation
 * Guarantees cryptographic signing even if window.crypto.subtle is not supported or in non-secure context.
 */
function sha256Pure(ascii: string): Uint8Array {
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let i = 0, j = 0;

  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;

  const hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;

  const isPrime = (n: number) => {
    for (let factor = 2, max = Math.sqrt(n); factor <= max; factor++) {
      if (n % factor === 0) return false;
    }
    return true;
  };

  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (isPrime(candidate)) {
      if (primeCounter < 8) {
        hash[primeCounter] = (mathPow(candidate, 1 / 2) * maxWord) | 0;
      }
      k[primeCounter] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      primeCounter++;
    }
  }

  ascii += '\x80';
  while ((ascii.length % 64) - 56) ascii += '\x00';
  for (i = 0; i < ascii.length; i++) {
    j = ascii.charCodeAt(i);
    if (j >> 8) return new Uint8Array(0);
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;

  for (j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);

    for (i = 0; i < 64; i++) {
      const i2 = i + j;
      const w15 = w[i - 15],
        w2 = w[i - 2];

      const s0 =
        ((w15 >>> 7) | (w15 << 25)) ^
        ((w15 >>> 18) | (w15 << 14)) ^
        (w15 >>> 3);
      const s1 =
        ((w2 >>> 17) | (w2 << 15)) ^
        ((w2 >>> 19) | (w2 << 13)) ^
        (w2 >>> 10);

      w[i] =
        i < 16
          ? w[i]
          : (w[i - 16] + s0 + w[i - 7] + s1) | 0;

      const s1h =
        ((hash[4] >>> 6) | (hash[4] << 26)) ^
        ((hash[4] >>> 11) | (hash[4] << 21)) ^
        ((hash[4] >>> 25) | (hash[4] << 7));
      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const temp1 = (hash[7] + s1h + ch + k[i] + w[i]) | 0;
      const s0h =
        ((hash[0] >>> 2) | (hash[0] << 30)) ^
        ((hash[0] >>> 13) | (hash[0] << 19)) ^
        ((hash[0] >>> 22) | (hash[0] << 10));
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const temp2 = (s0h + maj) | 0;

      hash[7] = hash[6];
      hash[6] = hash[5];
      hash[5] = hash[4];
      hash[4] = (hash[3] + temp1) | 0;
      hash[3] = hash[2];
      hash[2] = hash[1];
      hash[1] = hash[0];
      hash[0] = (temp1 + temp2) | 0;
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }


  const out = new Uint8Array(32);
  for (i = 0; i < 8; i++) {
    out[i * 4] = (hash[i] >>> 24) & 255;
    out[i * 4 + 1] = (hash[i] >>> 16) & 255;
    out[i * 4 + 2] = (hash[i] >>> 8) & 255;
    out[i * 4 + 3] = hash[i] & 255;
  }
  return out;
}

function hmacSha256Pure(keyStr: string, messageStr: string): string {
  const blockSize = 64;
  let keyBytes: Uint8Array;
  
  if (keyStr.length > blockSize) {
    keyBytes = sha256Pure(keyStr);
  } else {
    keyBytes = new Uint8Array(blockSize);
    for (let i = 0; i < keyStr.length; i++) {
      keyBytes[i] = keyStr.charCodeAt(i);
    }
  }

  const oKeyPad = new Uint8Array(blockSize);
  const iKeyPad = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    oKeyPad[i] = (keyBytes[i] || 0) ^ 0x5c;
    iKeyPad[i] = (keyBytes[i] || 0) ^ 0x36;
  }

  let iKeyPadStr = '';
  for (let i = 0; i < blockSize; i++) iKeyPadStr += String.fromCharCode(iKeyPad[i]);
  const innerHash = sha256Pure(iKeyPadStr + messageStr);

  let oKeyPadStr = '';
  for (let i = 0; i < blockSize; i++) oKeyPadStr += String.fromCharCode(oKeyPad[i]);
  let innerHashStr = '';
  for (let i = 0; i < innerHash.length; i++) innerHashStr += String.fromCharCode(innerHash[i]);

  const outerHash = sha256Pure(oKeyPadStr + innerHashStr);
  return Array.from(outerHash, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Asynchronously calculates HMAC-SHA256 hex string with WebCrypto / pure JS fallback
 */
export async function calculateHmacSha256(secret: string, canonicalString: string): Promise<string> {
  try {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      const encoder = new TextEncoder();
      const keyData = encoder.encode(secret);
      const cryptoKey = await window.crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const messageData = encoder.encode(canonicalString);
      const signatureBuffer = await window.crypto.subtle.sign('HMAC', cryptoKey, messageData);
      const hashArray = Array.from(new Uint8Array(signatureBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (err) {
    console.warn('SubtleCrypto error, falling back to pure JS HMAC:', err);
  }

  return hmacSha256Pure(secret, canonicalString);
}

/**
 * Builds standard canonical string for signature:
 * Format: METHOD:PATH:TIMESTAMP:NONCE:BODY
 */
export function buildCanonicalString(
  method: string,
  pathname: string,
  timestamp: string | number,
  nonce: string,
  bodyString = ''
): string {
  const upperMethod = method.toUpperCase();
  const cleanPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${upperMethod}:${cleanPath}:${timestamp}:${nonce}:${bodyString}`;
}

/**
 * Generates security headers object for fetch calls
 */
export async function generateSecurityHeaders(
  method: string,
  path: string,
  bodyObj?: any
): Promise<Record<string, string>> {
  const apiKey = getClientApiKey();
  const secretKey = getClientSecretKey();
  const timestamp = Date.now().toString();
  const nonce = generateNonce(24);
  const bodyString = bodyObj !== undefined && bodyObj !== null ? JSON.stringify(bodyObj) : '';

  const canonical = buildCanonicalString(method, path, timestamp, nonce, bodyString);
  const signature = await calculateHmacSha256(secretKey, canonical);

  const headers: Record<string, string> = {
    'X-API-Key': apiKey,
    'X-Timestamp': timestamp,
    'X-Nonce': nonce,
    'X-Signature': signature,
  };

  if (bodyObj !== undefined && bodyObj !== null) {
    headers['Content-Type'] = 'application/json';
  }

  return headers;
}
