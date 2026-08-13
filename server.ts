import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

// ---------------------------------------------------------------------------
// CONFIGURATION & ENVIRONMENT SECRETS
// ---------------------------------------------------------------------------
function getValidApiKeys(): string[] {
  const keys = new Set<string>();
  if (process.env.API_KEY && process.env.API_KEY.trim()) keys.add(process.env.API_KEY.trim());
  if (process.env.VITE_API_KEY && process.env.VITE_API_KEY.trim()) keys.add(process.env.VITE_API_KEY.trim());
  return Array.from(keys);
}

function getValidSecretKeys(): string[] {
  const secrets = new Set<string>();
  if (process.env.API_SECRET_KEY && process.env.API_SECRET_KEY.trim()) secrets.add(process.env.API_SECRET_KEY.trim());
  if (process.env.VITE_API_SECRET_KEY && process.env.VITE_API_SECRET_KEY.trim()) secrets.add(process.env.VITE_API_SECRET_KEY.trim());
  return Array.from(secrets);
}

// Rate Limiting constants (60 requests per minute per IP)
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 60;

// Anti-replay Nonce Cache: Map<nonce, timestamp>
const seenNonces = new Map<string, number>();

// Rate Limiter Cache: Map<ip, { count: number, resetTime: number }>
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// Periodic cleanup of expired nonces (older than 5 min) and rate limit entries
setInterval(() => {
  const now = Date.now();
  const fiveMinutesAgo = now - 5 * 60 * 1000;
  for (const [nonce, ts] of seenNonces.entries()) {
    if (ts < fiveMinutesAgo) {
      seenNonces.delete(nonce);
    }
  }
  for (const [ip, data] of rateLimitMap.entries()) {
    if (data.resetTime < now) {
      rateLimitMap.delete(ip);
    }
  }
}, 60000);

function getRtdbUrl(): string | null {
  const envUrl = process.env.FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL;
  if (!envUrl || !envUrl.trim()) return null;
  const trimmed = envUrl.trim();
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
}

// Parse JSON with rawBody preservation for exact HMAC verification
app.use(
  express.json({
    limit: '10mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf.toString('utf8');
    },
  })
);

// ---------------------------------------------------------------------------
// SECURITY MIDDLEWARES: CORS, RATE LIMITING, HMAC & TIMESTAMP/NONCE
// ---------------------------------------------------------------------------

// 1. CORS Middleware
app.use((req, res, next) => {
  const origin = req.headers.origin as string | undefined;
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, X-API-Key, X-Timestamp, X-Nonce, X-Signature, Authorization'
  );
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// 2. IP-based Rate Limiter Middleware for API endpoints
function rateLimiter(req: express.Request, res: express.Response, next: express.NextFunction) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress) || '127.0.0.1';
  const now = Date.now();

  const record = rateLimitMap.get(ip);
  if (!record || record.resetTime <= now) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS.toString());
    res.setHeader('X-RateLimit-Remaining', (RATE_LIMIT_MAX_REQUESTS - 1).toString());
    res.setHeader('X-RateLimit-Reset', Math.ceil((now + RATE_LIMIT_WINDOW_MS) / 1000).toString());
    return next();
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);
    res.setHeader('Retry-After', retryAfter.toString());
    res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS.toString());
    res.setHeader('X-RateLimit-Remaining', '0');
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000).toString());
    return res.status(429).json({
      error: 'Too many requests. Please slow down and try again later.',
      retryAfterSeconds: retryAfter,
    });
  }

  record.count += 1;
  res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS.toString());
  res.setHeader('X-RateLimit-Remaining', (RATE_LIMIT_MAX_REQUESTS - record.count).toString());
  res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000).toString());
  next();
}

// 3. API Key, Timestamp/Nonce, and HMAC-SHA256 Signature Verification Middleware
function validateApiSecurity(req: any, res: express.Response, next: express.NextFunction) {
  const apiKey = req.headers['x-api-key'] as string | undefined;
  const timestampHeader = req.headers['x-timestamp'] as string | undefined;
  const nonce = req.headers['x-nonce'] as string | undefined;
  const signature = req.headers['x-signature'] as string | undefined;

  // A. Check presence of security headers
  if (!apiKey || !timestampHeader || !nonce || !signature) {
    return res.status(401).json({
      error: 'Unauthorized: Missing required security headers (X-API-Key, X-Timestamp, X-Nonce, X-Signature).',
    });
  }

  // B. Validate API Key
  const validApiKeys = getValidApiKeys();
  if (!validApiKeys.includes(apiKey)) {
    return res.status(401).json({
      error: 'Unauthorized: Invalid X-API-Key.',
    });
  }

  // C. Validate Timestamp (tolerance window: 5 minutes)
  const timestamp = parseInt(timestampHeader, 10);
  const now = Date.now();
  if (isNaN(timestamp) || Math.abs(now - timestamp) > 5 * 60 * 1000) {
    return res.status(401).json({
      error: 'Unauthorized: Request timestamp is invalid or expired (maximum 5 minutes clock drift allowed).',
    });
  }

  // D. Validate Nonce (anti-replay check)
  if (typeof nonce !== 'string' || nonce.length < 8 || nonce.length > 128) {
    return res.status(401).json({
      error: 'Unauthorized: Invalid X-Nonce header format.',
    });
  }

  if (seenNonces.has(nonce)) {
    return res.status(401).json({
      error: 'Unauthorized: Replay attack detected. Nonce has already been used.',
    });
  }
  seenNonces.set(nonce, timestamp);

  // E. Verify HMAC-SHA256 Signature
  const canonicalMethod = req.method.toUpperCase();
  const canonicalPath = req.originalUrl ? req.originalUrl.split('?')[0] : req.path;
  const bodyString = req.rawBody !== undefined && req.rawBody !== null
    ? req.rawBody
    : (req.body && Object.keys(req.body).length > 0 ? JSON.stringify(req.body) : '');

  const canonicalString = `${canonicalMethod}:${canonicalPath}:${timestampHeader}:${nonce}:${bodyString}`;
  const validSecretKeys = getValidSecretKeys();
  const sigBuffer = Buffer.from(signature, 'hex');

  let isSignatureValid = false;
  for (const secret of validSecretKeys) {
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(canonicalString)
      .digest('hex');
    const expectedBuf = Buffer.from(expectedSig, 'hex');

    if (sigBuffer.length === expectedBuf.length && crypto.timingSafeEqual(sigBuffer, expectedBuf)) {
      isSignatureValid = true;
      break;
    }
  }

  if (!isSignatureValid) {
    return res.status(403).json({
      error: 'Forbidden: Invalid request signature (HMAC-SHA256 mismatch).',
    });
  }

  next();
}

// Apply rate limiter and security validation to all API routes
app.use('/api', rateLimiter, validateApiSecurity);

// Server-side fallback storage when Firebase secret is missing or database is locked
const memoryStore = new Map<string, any>();

// In-memory Mutex lock to prevent race conditions during ID generation & card creation
let sequenceLock: Promise<void> = Promise.resolve();


function getFirebaseUrl(path: string): string | null {
  const baseUrl = getRtdbUrl();
  if (!baseUrl) return null;
  const secret = process.env.FIREBASE_DATABASE_SECRET || process.env.FIREBASE_SECRET || process.env.FIREBASE_TOKEN || '';
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  const url = new URL(`${baseUrl}${cleanPath}`);
  if (secret) {
    url.searchParams.set('auth', secret);
  }
  return url.toString();
}

/**
 * Validates certificate ID format IND-2026-#### (4 or more digits)
 */
function isValidCertId(id: string): boolean {
  if (!id) return false;
  return /^IND-2026-\d{4,}$/.test(id.trim());
}

/**
 * Checks if a certificate ID already exists in cards node (Firebase or memory cache)
 */
async function isIdTaken(certId: string): Promise<boolean> {
  if (memoryStore.has(certId)) {
    return true;
  }
  try {
    const cardUrl = getFirebaseUrl(`cards/${certId}.json`);
    if (!cardUrl) return false;
    const cardRes = await fetch(cardUrl);
    if (cardRes.ok) {
      const val = await cardRes.json();
      if (val !== null && val !== undefined) return true;
    }
  } catch (err) {
    console.warn(`Error checking if card ID ${certId} exists in Firebase:`, err);
  }
  return false;
}

/**
 * Gets current digit length suffix requirement from Firebase (default 4)
 */
async function getStoredDigitLength(): Promise<number> {
  try {
    const url = getFirebaseUrl('system/digitLength.json');
    if (!url) return 4;
    const res = await fetch(url);
    if (res.ok) {
      const val = await res.json();
      if (typeof val === 'number' && val >= 4) {
        return val;
      }
    }
  } catch (err) {
    console.warn('Could not fetch digitLength from Firebase:', err);
  }
  return 4;
}

/**
 * Saves updated digit length suffix requirement to Firebase
 */
async function setStoredDigitLength(length: number): Promise<void> {
  try {
    const url = getFirebaseUrl('system/digitLength.json');
    if (!url) return;
    await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(length),
    });
  } catch (err) {
    console.warn('Could not save digitLength to Firebase:', err);
  }
}

/**
 * Collects all existing card numeric suffixes for a given digit length from cards node in Firebase & memory
 */
async function fetchAllUsedSuffixesForLength(digitLength: number): Promise<Set<number>> {
  const usedSet = new Set<number>();

  const processCertId = (certId: string) => {
    const suffix = certId.replace(/^IND-2026-/, '');
    if (suffix.length === digitLength && /^\d+$/.test(suffix)) {
      usedSet.add(parseInt(suffix, 10));
    }
  };

  for (const certId of memoryStore.keys()) processCertId(certId);

  try {
    const url = getFirebaseUrl('cards.json');
    if (url) {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === 'object') {
          for (const certId of Object.keys(data)) {
            processCertId(certId);
          }
        }
      }
    }
  } catch (err) {
    console.warn('Error fetching cards from Firebase:', err);
  }

  return usedSet;
}

/**
 * Atomically generates a unique random certificate ID that does not exist in cards
 */
async function generateUniqueId(): Promise<string> {
  let digitLength = await getStoredDigitLength();

  while (true) {
    const maxCapacity = Math.pow(10, digitLength);

    // Try up to 30 random picks first for speed
    for (let attempt = 0; attempt < 30; attempt++) {
      const randNum = Math.floor(Math.random() * maxCapacity);
      const suffix = String(randNum).padStart(digitLength, '0');
      const candidateId = `IND-2026-${suffix}`;

      const taken = await isIdTaken(candidateId);
      if (!taken) {
        return candidateId;
      }
    }

    // High collision frequency: fetch all existing cards to check if current digit length is exhausted
    const usedSuffixes = await fetchAllUsedSuffixesForLength(digitLength);

    if (usedSuffixes.size >= maxCapacity) {
      // All combinations for current digit length are exhausted! Switch to next digit length.
      digitLength++;
      await setStoredDigitLength(digitLength);
      continue;
    }

    // Collect all remaining unused numbers
    const unusedNums: number[] = [];
    for (let i = 0; i < maxCapacity; i++) {
      if (!usedSuffixes.has(i)) {
        unusedNums.push(i);
      }
    }

    if (unusedNums.length === 0) {
      digitLength++;
      await setStoredDigitLength(digitLength);
      continue;
    }

    // Pick a random number from remaining unused numbers
    const pickedNum = unusedNums[Math.floor(Math.random() * unusedNums.length)];
    const suffix = String(pickedNum).padStart(digitLength, '0');
    const candidateId = `IND-2026-${suffix}`;

    return candidateId;
  }
}

/**
 * Generates an unreserved random preview candidate ID
 */
async function generatePreviewCandidateId(): Promise<string> {
  let digitLength = await getStoredDigitLength();
  const maxCapacity = Math.pow(10, digitLength);

  for (let attempt = 0; attempt < 20; attempt++) {
    const randNum = Math.floor(Math.random() * maxCapacity);
    const suffix = String(randNum).padStart(digitLength, '0');
    const candidateId = `IND-2026-${suffix}`;

    const taken = await isIdTaken(candidateId);
    if (!taken) {
      return candidateId;
    }
  }

  const fallbackNum = Math.floor(Math.random() * maxCapacity);
  return `IND-2026-${String(fallbackNum).padStart(digitLength, '0')}`;
}

// ---------------------------------------------------------------------------
// API ROUTES
// ---------------------------------------------------------------------------

// GET /api/next-id - Returns a random unique preview ID
app.get('/api/next-id', async (req, res) => {
  try {
    const previewId = await generatePreviewCandidateId();
    return res.json({ id: previewId });
  } catch (err) {
    console.warn('Firebase next-id fetch error:', err);
    const fallbackNum = Math.floor(1000 + Math.random() * 9000);
    return res.json({ id: `IND-2026-${fallbackNum}` });
  }
});

// POST /api/certificates - Atomically generates unique random ID & saves certificate to Firebase
app.post('/api/certificates', async (req, res) => {
  // Strict request body validation
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Invalid request body: Expected JSON object.' });
  }

  const { id, idNumber, name, address, phoneNumber, photoUrl } = req.body;

  // Strict Field Validation
  if (name !== undefined && name !== null) {
    if (typeof name !== 'string' || name.length > 100) {
      return res.status(400).json({ error: 'Invalid name: Must be a string with maximum 100 characters.' });
    }
  }

  if (address !== undefined && address !== null) {
    if (typeof address !== 'string' || address.length > 300) {
      return res.status(400).json({ error: 'Invalid address: Must be a string with maximum 300 characters.' });
    }
  }

  if (phoneNumber !== undefined && phoneNumber !== null) {
    if (typeof phoneNumber !== 'string' || phoneNumber.length > 20) {
      return res.status(400).json({ error: 'Invalid phone number: Must be a string with maximum 20 characters.' });
    }
  }

  if (photoUrl !== undefined && photoUrl !== null) {
    if (typeof photoUrl !== 'string' || photoUrl.length > 7000000) {
      return res.status(400).json({ error: 'Uploaded photo file size is too large (must be under 5MB).' });
    }
  }

  const candidateCustomId = (id || idNumber) ? String(id || idNumber).trim() : '';
  if (candidateCustomId && !isValidCertId(candidateCustomId)) {
    return res.status(400).json({ error: 'Invalid ID format: Must follow IND-2026-#### format.' });
  }

  // Acquire lock to guarantee atomic ID generation & reservation
  let releaseLock: () => void = () => {};
  const currentLock = sequenceLock;
  sequenceLock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });

  try {
    await currentLock;

    // If a specific ID is submitted, verify it does not already exist
    let certId: string;

    if (candidateCustomId) {
      const taken = await isIdTaken(candidateCustomId);
      if (taken) {
        releaseLock();
        return res.status(409).json({ error: 'ID already exists' });
      }
      certId = candidateCustomId;
    } else {
      certId = await generateUniqueId();
    }

    const record = {
      id: certId,
      name: name ? String(name).trim() : '',
      address: address ? String(address).trim() : '',
      phone: phoneNumber ? String(phoneNumber).trim() : '',
      photo: photoUrl || null,
      createdAt: new Date().toISOString(),
      status: 'verified',
    };

    // Store in memory cache as immediate fallback
    memoryStore.set(certId, record);

    // Store record in Firebase RTDB /cards/IND-2026-####
    let savedToFirebase = false;
    try {
      const cardUrl = getFirebaseUrl(`cards/${certId}.json`);
      if (cardUrl) {
        const cardRes = await fetch(cardUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(record),
        });

        if (cardRes.ok) {
          savedToFirebase = true;
        } else {
          const errText = await cardRes.text();
          console.warn(`Firebase write response status ${cardRes.status}:`, errText);
        }
      }
    } catch (saveErr) {
      console.warn('Firebase store error:', saveErr);
    }

    // Generate next preview candidate ID for frontend form
    const nextPreviewId = await generatePreviewCandidateId();

    releaseLock();
    return res.json({
      success: true,
      record,
      savedToFirebase,
      nextPreviewId,
    });
  } catch (err) {
    releaseLock();
    console.error('Certificate generation error:', err);
    return res.status(500).json({ error: 'Failed to generate certificate. Please try again.' });
  }
});


// GET /api/certificates/:id - Fetches certificate record by ID
app.get('/api/certificates/:id', async (req, res) => {
  const certId = req.params.id ? req.params.id.trim().toUpperCase() : '';

  if (!isValidCertId(certId)) {
    return res.status(400).json({ error: 'Invalid certificate ID format. Expected IND-2026-XXXX' });
  }

  // 1. Try Firebase RTDB
  try {
    const cardUrl = getFirebaseUrl(`cards/${certId}.json`);
    if (cardUrl) {
      const cardRes = await fetch(cardUrl);

      if (cardRes.ok) {
        const data = await cardRes.json();
        if (data && typeof data === 'object' && data.id === certId) {
          return res.json(data);
        }
      }
    }
  } catch (err) {
    console.warn('Firebase fetch error for ID', certId, err);
  }

  // 2. Check memory cache fallback
  if (memoryStore.has(certId)) {
    return res.json(memoryStore.get(certId));
  }

  return res.status(404).json({ error: 'Certificate Not Found' });
});

// ---------------------------------------------------------------------------
// VITE / STATIC SERVING & SPA FALLBACK
// ---------------------------------------------------------------------------

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
