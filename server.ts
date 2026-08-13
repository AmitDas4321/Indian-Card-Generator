import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import {
  initDatabase,
  getDatabaseProvider,
  createCertificate,
  getCertificateById,
  updateCertificate,
  deleteCertificate,
  generatePreviewCandidateId,
  isValidCertificateId,
} from './src/services/database/index';

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
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

// Health check endpoint (public, unauthenticated)
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    databaseProvider: getDatabaseProvider(),
    timestamp: new Date().toISOString(),
  });
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

// ---------------------------------------------------------------------------
// API ROUTES (Backed by Common Database Abstraction Layer)
// ---------------------------------------------------------------------------

// GET /api/next-id - Returns a random unique preview ID
app.get('/api/next-id', async (req, res) => {
  try {
    const previewId = await generatePreviewCandidateId();
    return res.json({ id: previewId });
  } catch (err) {
    console.warn('Next-id preview generation error:', err);
    const fallbackNum = Math.floor(1000 + Math.random() * 9000);
    return res.json({ id: `IND-2026-${fallbackNum}` });
  }
});

// POST /api/certificates - Atomically generates unique random ID & saves certificate to active database provider
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
  if (candidateCustomId && !isValidCertificateId(candidateCustomId)) {
    return res.status(400).json({ error: 'Invalid ID format: Must follow IND-2026-#### format.' });
  }

  try {
    const result = await createCertificate({
      id: candidateCustomId || undefined,
      name,
      address,
      phoneNumber,
      photoUrl,
    });

    return res.json({
      success: true,
      record: result.record,
      nextPreviewId: result.nextPreviewId,
    });
  } catch (err: any) {
    if (err && (err.statusCode === 409 || err.message === 'ID already exists')) {
      return res.status(409).json({ error: 'ID already exists' });
    }
    console.error('Certificate generation error:', err);
    return res.status(err?.statusCode || 500).json({
      error: err?.message || 'Failed to generate certificate. Please try again.',
    });
  }
});

// GET /api/certificates/:id - Fetches certificate record by ID from active database provider
app.get('/api/certificates/:id', async (req, res) => {
  const certId = req.params.id ? req.params.id.trim().toUpperCase() : '';

  if (!isValidCertificateId(certId)) {
    return res.status(400).json({ error: 'Invalid certificate ID format. Expected IND-2026-XXXX' });
  }

  try {
    const record = await getCertificateById(certId);
    if (record) {
      return res.json(record);
    }
  } catch (err) {
    console.warn(`Error fetching certificate ${certId}:`, err);
  }

  return res.status(404).json({ error: 'Certificate Not Found' });
});

// PUT /api/certificates/:id - Updates certificate record
app.put('/api/certificates/:id', async (req, res) => {
  const certId = req.params.id ? req.params.id.trim().toUpperCase() : '';

  if (!isValidCertificateId(certId)) {
    return res.status(400).json({ error: 'Invalid certificate ID format. Expected IND-2026-XXXX' });
  }

  try {
    const updated = await updateCertificate(certId, req.body || {});
    if (updated) {
      return res.json({ success: true, record: updated });
    }
    return res.status(404).json({ error: 'Certificate Not Found' });
  } catch (err) {
    console.error(`Error updating certificate ${certId}:`, err);
    return res.status(500).json({ error: 'Failed to update certificate.' });
  }
});

// DELETE /api/certificates/:id - Deletes certificate record
app.delete('/api/certificates/:id', async (req, res) => {
  const certId = req.params.id ? req.params.id.trim().toUpperCase() : '';

  if (!isValidCertificateId(certId)) {
    return res.status(400).json({ error: 'Invalid certificate ID format. Expected IND-2026-XXXX' });
  }

  try {
    const deleted = await deleteCertificate(certId);
    if (deleted) {
      return res.json({ success: true, message: 'Certificate deleted successfully.' });
    }
    return res.status(404).json({ error: 'Certificate Not Found' });
  } catch (err) {
    console.error(`Error deleting certificate ${certId}:`, err);
    return res.status(500).json({ error: 'Failed to delete certificate.' });
  }
});

// ---------------------------------------------------------------------------
// VITE / STATIC SERVING & SPA FALLBACK
// ---------------------------------------------------------------------------

async function startServer() {
  // Initialize configured database provider
  try {
    await initDatabase();
  } catch (dbErr) {
    console.warn('Database initialization warning:', dbErr);
  }

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
    console.log(`Server running on http://localhost:${PORT} with [${getDatabaseProvider().toUpperCase()}] provider`);
  });
}

startServer();
