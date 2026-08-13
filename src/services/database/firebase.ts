import {
  CertificateQueryOptions,
  CertificateQueryResult,
  CertificateRecord,
  DashboardStats,
  DatabaseAdapter,
  DatabaseProvider,
} from './types';

export class FirebaseAdapter implements DatabaseAdapter {
  readonly name: DatabaseProvider = 'firebase';
  private memoryStore = new Map<string, CertificateRecord>();

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

    // Save to Firebase RTDB under cards/${cleanId}.json
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

  private async fetchAllRecords(): Promise<CertificateRecord[]> {
    const recordsMap = new Map<string, CertificateRecord>();

    // Add in-memory items first
    for (const [id, rec] of this.memoryStore.entries()) {
      recordsMap.set(id, rec);
    }

    const endpoint = this.getFirebaseEndpoint('cards.json');
    if (endpoint) {
      try {
        const res = await fetch(endpoint);
        if (res.ok) {
          const data = await res.json();
          if (data && typeof data === 'object') {
            for (const [id, val] of Object.entries(data)) {
              if (val && typeof val === 'object') {
                const rec = val as any;
                recordsMap.set(id, {
                  id: rec.id || id,
                  name: rec.name || '',
                  address: rec.address || '',
                  phone: rec.phone || '',
                  photo: rec.photo || null,
                  createdAt: rec.createdAt || new Date().toISOString(),
                  status: 'verified',
                });
              }
            }
          }
        }
      } catch (err) {
        console.warn('[Firebase] Error loading all records for query:', err);
      }
    }

    return Array.from(recordsMap.values()).sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  async getCertificates(options?: CertificateQueryOptions): Promise<CertificateQueryResult> {
    const all = await this.fetchAllRecords();
    const search = options?.search ? options.search.trim().toLowerCase() : '';

    let filtered = all;
    if (search) {
      filtered = all.filter(
        (c) =>
          c.id.toLowerCase().includes(search) ||
          c.name.toLowerCase().includes(search) ||
          c.phone.toLowerCase().includes(search) ||
          c.address.toLowerCase().includes(search)
      );
    }

    const total = filtered.length;
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;
    const certificates = filtered.slice(offset, offset + limit);

    return { certificates, total };
  }

  async getStats(): Promise<DashboardStats> {
    const startTime = Date.now();
    const all = await this.fetchAllRecords();
    const dbLatencyMs = Math.max(1, Date.now() - startTime);

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).getTime();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    let verified = 0;
    let today = 0;
    let thisWeek = 0;
    let thisMonth = 0;

    for (const item of all) {
      if (item.status === 'verified') verified++;
      const itemTime = new Date(item.createdAt).getTime();
      if (!isNaN(itemTime)) {
        if (itemTime >= startOfToday) today++;
        if (itemTime >= startOfWeek) thisWeek++;
        if (itemTime >= startOfMonth) thisMonth++;
      }
    }

    const latest = all.length > 0 ? all[0] : null;
    const latestVerification = latest
      ? {
          id: latest.id,
          timestamp: latest.createdAt,
          name: latest.name,
        }
      : null;

    const hasUrl = Boolean(this.getRtdbUrl());

    return {
      total: all.length,
      verified,
      today,
      thisWeek,
      thisMonth,
      latestCertificate: latest,
      latestVerification,
      dbProvider: 'firebase',
      dbStatus: hasUrl ? 'connected' : 'fallback',
      dbLatencyMs,
      apiStatus: 'healthy',
    };
  }

  async checkHealth(): Promise<{ status: 'connected' | 'degraded' | 'fallback'; latencyMs: number }> {
    const start = Date.now();
    const endpoint = this.getFirebaseEndpoint('.json?shallow=true');
    if (!endpoint) {
      return { status: 'fallback', latencyMs: 1 };
    }

    try {
      const res = await fetch(endpoint);
      const latency = Date.now() - start;
      if (res.ok) {
        return { status: 'connected', latencyMs: latency };
      }
      return { status: 'degraded', latencyMs: latency };
    } catch {
      return { status: 'fallback', latencyMs: Date.now() - start };
    }
  }
}
