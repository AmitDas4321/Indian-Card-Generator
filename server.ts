import express from 'express';
import path from 'path';
import crypto from 'crypto';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import {
  initDatabase,
  getDatabaseProvider,
  createCertificate,
  getCertificateById,
  updateCertificate,
  deleteCertificate,
  getCertificates,
  getDashboardStats,
  generatePreviewCandidateId,
  isValidCertificateId,
} from './src/services/database/index';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

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

function getAdminPassword(): string {
  return (process.env.ADMIN_PASSWORD || '').trim();
}

// ---------------------------------------------------------------------------
// IN-MEMORY SECURITY STATE (Nonces, Rate Limits, Admin Sessions)
// ---------------------------------------------------------------------------
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 60;

// Anti-replay Nonce Cache: Map<nonce, timestamp>
const seenNonces = new Map<string, number>();

// Rate Limiter Cache: Map<ip, { count: number, resetTime: number }>
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// Admin Login Brute-Force Tracker: Map<ip, { count: number, lockUntil: number, firstFail: number }>
const adminLoginAttempts = new Map<string, { count: number; lockUntil: number; firstFail: number }>();

// Admin Active Sessions: Map<token, { createdAt: number, expiresAt: number, ip: string }>
const adminSessions = new Map<string, { createdAt: number; expiresAt: number; ip: string }>();

// Periodic garbage collection for expired sessions, nonces, and rate limits
setInterval(() => {
  const now = Date.now();
  const fiveMinutesAgo = now - 5 * 60 * 1000;

  for (const [nonce, ts] of seenNonces.entries()) {
    if (ts < fiveMinutesAgo) seenNonces.delete(nonce);
  }

  for (const [ip, data] of rateLimitMap.entries()) {
    if (data.resetTime < now) rateLimitMap.delete(ip);
  }

  for (const [ip, data] of adminLoginAttempts.entries()) {
    if (data.lockUntil < now && now - data.firstFail > 15 * 60 * 1000) {
      adminLoginAttempts.delete(ip);
    }
  }

  for (const [token, session] of adminSessions.entries()) {
    if (session.expiresAt < now) {
      adminSessions.delete(token);
    }
  }
}, 60000);

// Parse cookies
app.use(cookieParser());

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
// CORS MIDDLEWARE
// ---------------------------------------------------------------------------
app.use((req, res, next) => {
  const origin = req.headers.origin as string | undefined;
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, X-API-Key, X-Timestamp, X-Nonce, X-Signature, Authorization, Cookie'
  );
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// ---------------------------------------------------------------------------
// HELPER: Client IP Extraction
// ---------------------------------------------------------------------------
function getClientIp(req: express.Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

// ---------------------------------------------------------------------------
// PUBLIC HEALTH CHECK
// ---------------------------------------------------------------------------
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    databaseProvider: getDatabaseProvider(),
    timestamp: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// ADMIN AUTHENTICATION & ADMIN ENDPOINTS
// ---------------------------------------------------------------------------

// Admin Session Extraction Helper (supports HttpOnly cookie and Bearer header)
function extractAdminToken(req: express.Request): string | null {
  // 1. From Cookie
  if (req.cookies && req.cookies.admin_session) {
    return req.cookies.admin_session;
  }
  // 2. From Authorization: Bearer <token> header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return null;
}

// Admin Authentication Middleware
function requireAdminAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = extractAdminToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Admin authentication required.' });
  }

  const session = adminSessions.get(token);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired session.' });
  }

  if (session.expiresAt < Date.now()) {
    adminSessions.delete(token);
    return res.status(401).json({ error: 'Unauthorized: Session has expired. Please log in again.' });
  }

  // Extend session lifetime on activity (rolling session up to 24h)
  session.expiresAt = Date.now() + 24 * 60 * 60 * 1000;
  (req as any).adminSession = session;
  next();
}

// POST /api/admin/login - Authenticate admin with rate limiting & brute-force protection
app.post('/api/admin/login', (req, res) => {
  const ip = getClientIp(req);
  const now = Date.now();

  // 1. Check Brute-Force Lockout
  const attemptRecord = adminLoginAttempts.get(ip);
  if (attemptRecord && attemptRecord.lockUntil > now) {
    const waitSeconds = Math.ceil((attemptRecord.lockUntil - now) / 1000);
    return res.status(429).json({
      error: `Too many failed login attempts. Please try again after ${Math.ceil(waitSeconds / 60)} minutes.`,
      retryAfterSeconds: waitSeconds,
    });
  }

  const { password } = req.body || {};
  const serverPassword = getAdminPassword();

  if (!serverPassword) {
    console.warn('[Admin Auth] ADMIN_PASSWORD environment variable is not set. Admin login is unavailable.');
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (typeof password !== 'string' || !password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // 2. Constant-time password comparison using SHA-256 hash digests
  const inputHash = crypto.createHash('sha256').update(password).digest();
  const targetHash = crypto.createHash('sha256').update(serverPassword).digest();

  const isPasswordCorrect = crypto.timingSafeEqual(inputHash, targetHash);

  if (!isPasswordCorrect) {
    // Record failed attempt
    const current = adminLoginAttempts.get(ip) || { count: 0, lockUntil: 0, firstFail: now };
    current.count += 1;
    if (now - current.firstFail > 15 * 60 * 1000) {
      current.firstFail = now;
      current.count = 1;
    }

    if (current.count >= 5) {
      current.lockUntil = now + 15 * 60 * 1000; // 15-minute lockout
    }
    adminLoginAttempts.set(ip, current);

    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // 3. Reset failed attempts on success
  adminLoginAttempts.delete(ip);

  // 4. Create cryptographically random session token
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = now + 24 * 60 * 60 * 1000; // 24 hours

  adminSessions.set(sessionToken, {
    createdAt: now,
    expiresAt,
    ip,
  });

  // 5. Set secure HttpOnly cookie
  res.cookie('admin_session', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
    path: '/',
  });

  return res.json({
    success: true,
    token: sessionToken,
    expiresAt,
    user: 'admin',
  });
});

// POST /api/admin/logout - Invalidate admin session & clear cookie
app.post('/api/admin/logout', (req, res) => {
  const token = extractAdminToken(req);
  if (token) {
    adminSessions.delete(token);
  }

  res.clearCookie('admin_session', { path: '/' });
  return res.json({ success: true, message: 'Logged out successfully.' });
});

// GET /api/admin/check-auth - Verify if current session is active
app.get('/api/admin/check-auth', (req, res) => {
  const token = extractAdminToken(req);
  if (!token) {
    return res.status(401).json({ authenticated: false });
  }

  const session = adminSessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    if (session) adminSessions.delete(token);
    return res.status(401).json({ authenticated: false });
  }

  return res.json({
    authenticated: true,
    user: 'admin',
    expiresAt: session.expiresAt,
    databaseProvider: getDatabaseProvider(),
  });
});

// GET /api/admin/stats - Retrieve real-time dashboard stats from active DB
app.get('/api/admin/stats', requireAdminAuth, async (_req, res) => {
  try {
    const stats = await getDashboardStats();
    return res.json(stats);
  } catch (err: any) {
    console.error('[Admin API] Error fetching dashboard stats:', err);
    return res.status(500).json({ error: 'Failed to retrieve dashboard statistics.' });
  }
});

// GET /api/admin/certificates - Paginated certificates query with search
app.get('/api/admin/certificates', requireAdminAuth, async (req, res) => {
  try {
    const search = req.query.search ? String(req.query.search).trim() : undefined;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
    const offset = req.query.offset ? parseInt(String(req.query.offset), 10) : 0;

    const result = await getCertificates({
      search,
      limit: isNaN(limit) ? 50 : limit,
      offset: isNaN(offset) ? 0 : offset,
    });

    return res.json(result);
  } catch (err: any) {
    console.error('[Admin API] Error querying certificates:', err);
    return res.status(500).json({ error: 'Failed to query certificates.' });
  }
});

// GET /api/admin/certificates/:id - Retrieve full certificate details
app.get('/api/admin/certificates/:id', requireAdminAuth, async (req, res) => {
  const certId = req.params.id ? req.params.id.trim().toUpperCase() : '';
  if (!isValidCertificateId(certId)) {
    return res.status(400).json({ error: 'Invalid certificate ID format.' });
  }

  try {
    const cert = await getCertificateById(certId);
    if (cert) {
      return res.json(cert);
    }
    return res.status(404).json({ error: 'Certificate Not Found' });
  } catch (err: any) {
    console.error(`[Admin API] Error fetching certificate ${certId}:`, err);
    return res.status(500).json({ error: 'Failed to fetch certificate details.' });
  }
});

// DELETE /api/admin/certificates/:id - Delete a certificate record
app.delete('/api/admin/certificates/:id', requireAdminAuth, async (req, res) => {
  const certId = req.params.id ? req.params.id.trim().toUpperCase() : '';
  if (!isValidCertificateId(certId)) {
    return res.status(400).json({ error: 'Invalid certificate ID format.' });
  }

  try {
    const deleted = await deleteCertificate(certId);
    if (deleted) {
      return res.json({ success: true, message: `Certificate ${certId} deleted successfully.` });
    }
    return res.status(404).json({ error: 'Certificate Not Found' });
  } catch (err: any) {
    console.error(`[Admin API] Error deleting certificate ${certId}:`, err);
    return res.status(500).json({ error: 'Failed to delete certificate.' });
  }
});

// ---------------------------------------------------------------------------
// PUBLIC GENERATOR API (HMAC-SHA256 & Rate Limiting Protected)
// ---------------------------------------------------------------------------

// 1. IP-based Rate Limiter Middleware for public API endpoints
function rateLimiter(req: express.Request, res: express.Response, next: express.NextFunction) {
  const ip = getClientIp(req);
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

// 2. API Key, Timestamp/Nonce, and HMAC-SHA256 Signature Verification Middleware
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
  const bodyString =
    req.rawBody !== undefined && req.rawBody !== null
      ? req.rawBody
      : req.body && Object.keys(req.body).length > 0
      ? JSON.stringify(req.body)
      : '';

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

// Router for public certificate endpoints
const certificateRouter = express.Router();
certificateRouter.use(rateLimiter, validateApiSecurity);

// GET /api/next-id - Returns a random unique preview ID
certificateRouter.get('/next-id', async (_req, res) => {
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
certificateRouter.post('/certificates', async (req, res) => {
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Invalid request body: Expected JSON object.' });
  }

  const { id, idNumber, name, address, phoneNumber, photoUrl } = req.body;

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

  const candidateCustomId = id || idNumber ? String(id || idNumber).trim() : '';
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

// GET /api/certificates/:id - Fetches certificate record by ID for public verification
certificateRouter.get('/certificates/:id', async (req, res) => {
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
certificateRouter.put('/certificates/:id', async (req, res) => {
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
certificateRouter.delete('/certificates/:id', async (req, res) => {
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

// Mount public certificates router under /api
app.use('/api', certificateRouter);

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
