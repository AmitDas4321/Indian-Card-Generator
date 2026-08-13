import { DatabaseAdapter, DatabaseProvider, CertificateRecord } from './types';
import { FirebaseAdapter } from './firebase';
import { MySQLAdapter } from './mysql';
import { MongoDBAdapter } from './mongodb';

export * from './types';
export { FirebaseAdapter } from './firebase';
export { MySQLAdapter } from './mysql';
export { MongoDBAdapter } from './mongodb';

let currentAdapter: DatabaseAdapter | null = null;
let sequenceLock: Promise<void> = Promise.resolve();

/**
 * Validates whether an ID matches the IND-2026-#### format (4 or more digits).
 */
export function isValidCertificateId(id: string): boolean {
  if (!id) return false;
  return /^IND-2026-\d{4,}$/.test(id.trim().toUpperCase());
}

/**
 * Resolves the configured database provider from environment variables.
 * Defaults to 'firebase'.
 */
export function getDatabaseProvider(): DatabaseProvider {
  const provider = (process.env.DATABASE_PROVIDER || '').trim().toLowerCase();
  if (provider === 'mysql') return 'mysql';
  if (provider === 'mongodb') return 'mongodb';
  return 'firebase';
}

/**
 * Returns the singleton database adapter for the current database provider.
 */
export function getDatabase(): DatabaseAdapter {
  const provider = getDatabaseProvider();

  if (currentAdapter && currentAdapter.name === provider) {
    return currentAdapter;
  }

  // Create new adapter instance based on provider
  switch (provider) {
    case 'mysql':
      currentAdapter = new MySQLAdapter();
      break;
    case 'mongodb':
      currentAdapter = new MongoDBAdapter();
      break;
    case 'firebase':
    default:
      currentAdapter = new FirebaseAdapter();
      break;
  }

  return currentAdapter;
}

/**
 * Initializes the current database connection and schema.
 */
export async function initDatabase(): Promise<void> {
  const db = getDatabase();
  await db.init();
}

/**
 * Checks if a certificate ID already exists in the selected database.
 */
export async function certificateExists(id: string): Promise<boolean> {
  const db = getDatabase();
  return db.certificateExists(id);
}

/**
 * Retrieves a certificate record by ID from the selected database.
 */
export async function getCertificateById(id: string): Promise<CertificateRecord | null> {
  const db = getDatabase();
  return db.getCertificateById(id);
}

/**
 * Updates a certificate record by ID in the selected database.
 */
export async function updateCertificate(
  id: string,
  updates: Partial<CertificateRecord>
): Promise<CertificateRecord | null> {
  const db = getDatabase();
  return db.updateCertificate(id, updates);
}

/**
 * Deletes a certificate record by ID from the selected database.
 */
export async function deleteCertificate(id: string): Promise<boolean> {
  const db = getDatabase();
  return db.deleteCertificate(id);
}

/**
 * Atomically generates a unique random certificate ID that does not exist in the database.
 * Starts with 4 digits (IND-2026-####) and seamlessly scales if needed without external config tables.
 */
export async function generateUniqueCertificateId(): Promise<string> {
  const db = getDatabase();
  let digitLength = 4;

  while (true) {
    const maxCapacity = Math.pow(10, digitLength);

    // Try up to 30 random picks first for rapid allocation
    for (let attempt = 0; attempt < 30; attempt++) {
      const randNum = Math.floor(Math.random() * maxCapacity);
      const suffix = String(randNum).padStart(digitLength, '0');
      const candidateId = `IND-2026-${suffix}`;

      const taken = await db.certificateExists(candidateId);
      if (!taken) {
        return candidateId;
      }
    }

    // High collision frequency: fetch all existing cards for this digit length to check if exhausted
    const usedSuffixes = await db.fetchAllUsedSuffixesForLength(digitLength);

    if (usedSuffixes.size >= maxCapacity) {
      // All combinations for current digit length are exhausted! Switch to next digit length.
      digitLength++;
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
 * Generates an unreserved random preview candidate ID for the frontend form.
 */
export async function generatePreviewCandidateId(): Promise<string> {
  const db = getDatabase();
  const digitLength = 4;
  const maxCapacity = Math.pow(10, digitLength);

  for (let attempt = 0; attempt < 20; attempt++) {
    const randNum = Math.floor(Math.random() * maxCapacity);
    const suffix = String(randNum).padStart(digitLength, '0');
    const candidateId = `IND-2026-${suffix}`;

    const taken = await db.certificateExists(candidateId);
    if (!taken) {
      return candidateId;
    }
  }

  const fallbackNum = Math.floor(Math.random() * maxCapacity);
  return `IND-2026-${String(fallbackNum).padStart(digitLength, '0')}`;
}

/**
 * Atomically creates and claims a certificate record in the selected database.
 * If candidate ID already exists, throws a 409 conflict error.
 */
export async function createCertificate(recordData: {
  id?: string;
  name?: string;
  address?: string;
  phoneNumber?: string;
  photoUrl?: string | null;
}): Promise<{ record: CertificateRecord; nextPreviewId: string }> {
  const db = getDatabase();

  const candidateCustomId = recordData.id ? String(recordData.id).trim().toUpperCase() : '';
  if (candidateCustomId && !isValidCertificateId(candidateCustomId)) {
    const err = new Error('Invalid ID format: Must follow IND-2026-#### format.');
    (err as any).statusCode = 400;
    throw err;
  }

  // Mutex lock to serialize certificate creation and prevent simultaneous collisions
  let releaseLock: () => void = () => {};
  const currentLock = sequenceLock;
  sequenceLock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });

  try {
    await currentLock;

    let certId: string;

    if (candidateCustomId) {
      const taken = await db.certificateExists(candidateCustomId);
      if (taken) {
        const conflictErr = new Error('ID already exists');
        (conflictErr as any).statusCode = 409;
        throw conflictErr;
      }
      certId = candidateCustomId;
    } else {
      certId = await generateUniqueCertificateId();
    }

    const newRecord: CertificateRecord = {
      id: certId,
      name: recordData.name ? String(recordData.name).trim() : '',
      address: recordData.address ? String(recordData.address).trim() : '',
      phone: recordData.phoneNumber ? String(recordData.phoneNumber).trim() : '',
      photo: recordData.photoUrl || null,
      createdAt: new Date().toISOString(),
      status: 'verified',
    };

    const savedRecord = await db.createCertificate(newRecord);
    const nextPreviewId = await generatePreviewCandidateId();

    releaseLock();
    return { record: savedRecord, nextPreviewId };
  } catch (err) {
    releaseLock();
    throw err;
  }
}
