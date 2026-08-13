import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;
const DEFAULT_RTDB_URL = 'https://indian-card-generator-default-rtdb.asia-southeast1.firebasedatabase.app/';

function getRtdbUrl(): string {
  const envUrl = process.env.FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL;
  if (!envUrl || !envUrl.trim()) return DEFAULT_RTDB_URL;
  const trimmed = envUrl.trim();
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
}

app.use(express.json({ limit: '10mb' }));

// Server-side fallback storage when Firebase secret is missing or database is locked
const memoryStore = new Map<string, any>();
const reservedIds = new Set<string>();

// In-memory Mutex lock to prevent race conditions during ID generation & reservation
let sequenceLock: Promise<void> = Promise.resolve();

function getFirebaseUrl(path: string): string {
  const baseUrl = getRtdbUrl();
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
 * Checks if a candidate certificate ID is already taken in Firebase or memory
 */
async function isIdTaken(certId: string): Promise<boolean> {
  if (memoryStore.has(certId) || reservedIds.has(certId)) {
    return true;
  }
  try {
    const usedUrl = getFirebaseUrl(`usedIds/${certId}.json`);
    const usedRes = await fetch(usedUrl);
    if (usedRes.ok) {
      const val = await usedRes.json();
      if (val !== null && val !== undefined) return true;
    }

    const cardUrl = getFirebaseUrl(`cards/${certId}.json`);
    const cardRes = await fetch(cardUrl);
    if (cardRes.ok) {
      const val = await cardRes.json();
      if (val !== null && val !== undefined) return true;
    }
  } catch (err) {
    console.warn(`Error checking if ID ${certId} is taken in Firebase:`, err);
  }
  return false;
}

/**
 * Gets current digit length suffix requirement from Firebase (default 4)
 */
async function getStoredDigitLength(): Promise<number> {
  try {
    const url = getFirebaseUrl('system/digitLength.json');
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
 * Collects all used numeric suffixes for a given digit length from Firebase & memory
 */
async function fetchAllUsedSuffixesForLength(digitLength: number): Promise<Set<number>> {
  const usedSet = new Set<number>();

  const processCertId = (certId: string) => {
    const suffix = certId.replace(/^IND-2026-/, '');
    if (suffix.length === digitLength && /^\d+$/.test(suffix)) {
      usedSet.add(parseInt(suffix, 10));
    }
  };

  for (const certId of reservedIds) processCertId(certId);
  for (const certId of memoryStore.keys()) processCertId(certId);

  try {
    const url = getFirebaseUrl('usedIds.json');
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object') {
        for (const certId of Object.keys(data)) {
          processCertId(certId);
        }
      }
    }
  } catch (err) {
    console.warn('Error fetching usedIds from Firebase:', err);
  }

  try {
    const url = getFirebaseUrl('cards.json');
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object') {
        for (const certId of Object.keys(data)) {
          processCertId(certId);
        }
      }
    }
  } catch (err) {
    console.warn('Error fetching cards from Firebase:', err);
  }

  return usedSet;
}

/**
 * Marks an ID as reserved in memory and Firebase
 */
async function markIdAsReserved(certId: string): Promise<void> {
  reservedIds.add(certId);
  try {
    const usedUrl = getFirebaseUrl(`usedIds/${certId}.json`);
    await fetch(usedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(true),
    });
  } catch (err) {
    console.warn(`Could not mark ID ${certId} as reserved in Firebase:`, err);
  }
}

/**
 * Atomically generates and reserves a unique random certificate ID
 */
async function generateAndReserveUniqueId(): Promise<string> {
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
        await markIdAsReserved(candidateId);
        return candidateId;
      }
    }

    // High collision frequency: fetch all used suffixes to check if current digit length is exhausted
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

    await markIdAsReserved(candidateId);
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
  // Acquire lock to guarantee atomic ID generation & reservation
  let releaseLock: () => void = () => {};
  const currentLock = sequenceLock;
  sequenceLock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });

  try {
    await currentLock;

    const { name, address, phoneNumber, photoUrl } = req.body || {};

    if (photoUrl && photoUrl.length > 7000000) {
      releaseLock();
      return res.status(400).json({ error: 'Uploaded photo file size is too large (must be under 5MB).' });
    }

    // Atomically generate and reserve unique random ID
    const certId = await generateAndReserveUniqueId();

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
    const cardRes = await fetch(cardUrl);

    if (cardRes.ok) {
      const data = await cardRes.json();
      if (data && typeof data === 'object' && data.id === certId) {
        return res.json(data);
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
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
