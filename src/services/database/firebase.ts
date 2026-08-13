import { CertificateRecord, DatabaseAdapter, DatabaseProvider } from './types';

export class FirebaseAdapter implements DatabaseAdapter {
  readonly name: DatabaseProvider = 'firebase';
  private memoryStore = new Map<string, CertificateRecord>();
  private memoryConfig = new Map<string, any>();

  constructor() {
    this.memoryConfig.set('digitLength', 4);
  }

  private getRtdbUrl(): string | null {
    const envUrl = process.env.FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL;
    if (!envUrl || !envUrl.trim()) return null;
    const trimmed = envUrl.trim();
    return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
  }

  private getFirebaseEndpoint(path: string): string | null {
    const baseUrl = this.getRtdbUrl();
    if (!baseUrl) return null;
    const secret = process.env.FIREBASE_DATABASE_SECRET || process.env.FIREBASE_SECRET || process.env.FIREBASE_TOKEN || '';
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    const url = new URL(`${baseUrl}${cleanPath}`);
    if (secret) {
      url.searchParams.set('auth', secret);
    }
    return url.toString();
  }

  async init(): Promise<void> {
    const url = this.getRtdbUrl();
    if (!url) {
      console.info('[Database: Firebase] FIREBASE_DATABASE_URL is not set. Running with memory cache fallback.');
    } else {
      console.info('[Database: Firebase] Connected to Firebase Realtime Database at', url);
    }
  }

  async certificateExists(id: string): Promise<boolean> {
    const cleanId = id.trim().toUpperCase();
    if (this.memoryStore.has(cleanId)) {
      return true;
    }

    const endpoint = this.getFirebaseEndpoint(`cards/${cleanId}.json`);
    if (!endpoint) return false;

    try {
      const res = await fetch(endpoint);
      if (res.ok) {
        const val = await res.json();
        return val !== null && val !== undefined;
      }
    } catch (err) {
      console.warn(`[Firebase] Error checking certificateExists for ${cleanId}:`, err);
    }
    return false;
  }

  async getCertificateById(id: string): Promise<CertificateRecord | null> {
    const cleanId = id.trim().toUpperCase();

    // 1. Check Firebase RTDB
    const endpoint = this.getFirebaseEndpoint(`cards/${cleanId}.json`);
    if (endpoint) {
      try {
        const res = await fetch(endpoint);
        if (res.ok) {
          const data = await res.json();
          if (data && typeof data === 'object' && data.id === cleanId) {
            return data as CertificateRecord;
          }
        }
      } catch (err) {
        console.warn(`[Firebase] Error fetching certificate ${cleanId}:`, err);
      }
    }

    // 2. Check in-memory store
    if (this.memoryStore.has(cleanId)) {
      return this.memoryStore.get(cleanId) || null;
    }

    return null;
  }

  async createCertificate(record: CertificateRecord): Promise<CertificateRecord> {
    const cleanId = record.id.trim().toUpperCase();
    const formattedRecord: CertificateRecord = {
      id: cleanId,
      name: record.name ? String(record.name).trim() : '',
      address: record.address ? String(record.address).trim() : '',
      phone: record.phone ? String(record.phone).trim() : '',
      photo: record.photo || null,
      createdAt: record.createdAt || new Date().toISOString(),
      status: 'verified',
    };

    // Store in memory cache
    this.memoryStore.set(cleanId, formattedRecord);

    // Save to Firebase RTDB
    const endpoint = this.getFirebaseEndpoint(`cards/${cleanId}.json`);
    if (endpoint) {
      try {
        const res = await fetch(endpoint, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formattedRecord),
        });

        if (!res.ok) {
          const errText = await res.text();
          console.warn(`[Firebase] Write failed with status ${res.status}:`, errText);
        }
      } catch (err) {
        console.warn(`[Firebase] Error saving certificate ${cleanId}:`, err);
      }
    }

    return formattedRecord;
  }

  async updateCertificate(id: string, updates: Partial<CertificateRecord>): Promise<CertificateRecord | null> {
    const existing = await this.getCertificateById(id);
    if (!existing) return null;

    const updated: CertificateRecord = {
      ...existing,
      ...updates,
      id: existing.id, // ID is immutable
    };

    this.memoryStore.set(existing.id, updated);

    const endpoint = this.getFirebaseEndpoint(`cards/${existing.id}.json`);
    if (endpoint) {
      try {
        await fetch(endpoint, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
      } catch (err) {
        console.warn(`[Firebase] Error updating certificate ${existing.id}:`, err);
      }
    }

    return updated;
  }

  async deleteCertificate(id: string): Promise<boolean> {
    const cleanId = id.trim().toUpperCase();
    this.memoryStore.delete(cleanId);

    const endpoint = this.getFirebaseEndpoint(`cards/${cleanId}.json`);
    if (endpoint) {
      try {
        const res = await fetch(endpoint, { method: 'DELETE' });
        return res.ok;
      } catch (err) {
        console.warn(`[Firebase] Error deleting certificate ${cleanId}:`, err);
        return false;
      }
    }
    return true;
  }

  async getStoredDigitLength(): Promise<number> {
    const endpoint = this.getFirebaseEndpoint('system/digitLength.json');
    if (endpoint) {
      try {
        const res = await fetch(endpoint);
        if (res.ok) {
          const val = await res.json();
          if (typeof val === 'number' && val >= 4) {
            return val;
          }
        }
      } catch (err) {
        console.warn('[Firebase] Error fetching digitLength:', err);
      }
    }
    return this.memoryConfig.get('digitLength') || 4;
  }

  async setStoredDigitLength(length: number): Promise<void> {
    this.memoryConfig.set('digitLength', length);
    const endpoint = this.getFirebaseEndpoint('system/digitLength.json');
    if (endpoint) {
      try {
        await fetch(endpoint, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(length),
        });
      } catch (err) {
        console.warn('[Firebase] Error saving digitLength:', err);
      }
    }
  }

  async fetchAllUsedSuffixesForLength(digitLength: number): Promise<Set<number>> {
    const usedSet = new Set<number>();

    const processCertId = (certId: string) => {
      const suffix = certId.replace(/^IND-2026-/, '');
      if (suffix.length === digitLength && /^\d+$/.test(suffix)) {
        usedSet.add(parseInt(suffix, 10));
      }
    };

    for (const certId of this.memoryStore.keys()) {
      processCertId(certId);
    }

    const endpoint = this.getFirebaseEndpoint('cards.json');
    if (endpoint) {
      try {
        const res = await fetch(endpoint);
        if (res.ok) {
          const data = await res.json();
          if (data && typeof data === 'object') {
            for (const certId of Object.keys(data)) {
              processCertId(certId);
            }
          }
        }
      } catch (err) {
        console.warn('[Firebase] Error fetching all cards:', err);
      }
    }

    return usedSet;
  }
}
