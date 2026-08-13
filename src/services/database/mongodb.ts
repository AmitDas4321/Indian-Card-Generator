import { MongoClient, Db, Collection } from 'mongodb';
import {
  CertificateQueryOptions,
  CertificateQueryResult,
  CertificateRecord,
  DashboardStats,
  DatabaseAdapter,
  DatabaseProvider,
} from './types';

export class MongoDBAdapter implements DatabaseAdapter {
  readonly name: DatabaseProvider = 'mongodb';
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private isInitialized = false;

  private async getDb(): Promise<Db> {
    if (this.db) return this.db;

    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    const dbName = process.env.MONGODB_DATABASE || 'tiranga_cards';

    this.client = new MongoClient(uri);
    await this.client.connect();
    this.db = this.client.db(dbName);
    return this.db;
  }

  private async getCardsCollection(): Promise<Collection<CertificateRecord>> {
    const db = await this.getDb();
    return db.collection<CertificateRecord>('cards');
  }

  async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const cardsCol = await this.getCardsCollection();
      // Ensure unique index on `id`
      await cardsCol.createIndex({ id: 1 }, { unique: true });

      this.isInitialized = true;
      console.info('[Database: MongoDB] Connected and initialized `cards` collection.');
    } catch (err) {
      console.warn('[Database: MongoDB] Could not connect or initialize MongoDB `cards` collection:', err);
    }
  }

  async certificateExists(id: string): Promise<boolean> {
    try {
      const cleanId = id.trim().toUpperCase();
      const collection = await this.getCardsCollection();
      const doc = await collection.findOne({ id: cleanId }, { projection: { id: 1 } });
      return doc !== null;
    } catch (err) {
      console.error(`[MongoDB] Error checking certificateExists for ${id}:`, err);
      return false;
    }
  }

  async getCertificateById(id: string): Promise<CertificateRecord | null> {
    try {
      const cleanId = id.trim().toUpperCase();
      const collection = await this.getCardsCollection();
      const doc = await collection.findOne({ id: cleanId }, { projection: { _id: 0 } });
      if (doc) {
        return {
          id: doc.id,
          name: doc.name || '',
          address: doc.address || '',
          phone: doc.phone || '',
          photo: doc.photo || null,
          createdAt: doc.createdAt,
          status: 'verified',
        };
      }
    } catch (err) {
      console.error(`[MongoDB] Error fetching card ${id}:`, err);
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

    try {
      const collection = await this.getCardsCollection();
      await collection.insertOne({ ...formattedRecord } as any);
    } catch (err: any) {
      // MongoDB duplicate key error code 11000
      if (err && (err.code === 11000 || (err.message && err.message.includes('E11000')))) {
        const conflictErr = new Error('ID already exists');
        (conflictErr as any).statusCode = 409;
        throw conflictErr;
      }
      throw err;
    }

    return formattedRecord;
  }

  async updateCertificate(id: string, updates: Partial<CertificateRecord>): Promise<CertificateRecord | null> {
    const cleanId = id.trim().toUpperCase();
    try {
      const collection = await this.getCardsCollection();
      const safeUpdates = { ...updates };
      delete (safeUpdates as any)._id;
      delete safeUpdates.id; // Preserve ID

      const result = await collection.findOneAndUpdate(
        { id: cleanId },
        { $set: safeUpdates },
        { returnDocument: 'after', projection: { _id: 0 } }
      );
      return result ? (result as CertificateRecord) : null;
    } catch (err) {
      console.error(`[MongoDB] Error updating card ${cleanId}:`, err);
      return null;
    }
  }

  async deleteCertificate(id: string): Promise<boolean> {
    const cleanId = id.trim().toUpperCase();
    try {
      const collection = await this.getCardsCollection();
      const result = await collection.deleteOne({ id: cleanId });
      return result.deletedCount > 0;
    } catch (err) {
      console.error(`[MongoDB] Error deleting card ${cleanId}:`, err);
      return false;
    }
  }

  async fetchAllUsedSuffixesForLength(digitLength: number): Promise<Set<number>> {
    const usedSet = new Set<number>();
    try {
      const collection = await this.getCardsCollection();
      const cursor = collection.find({}, { projection: { id: 1, _id: 0 } });
      const docs = await cursor.toArray();
      for (const doc of docs) {
        const certId = String(doc.id || '');
        const suffix = certId.replace(/^IND-2026-/, '');
        if (suffix.length === digitLength && /^\d+$/.test(suffix)) {
          usedSet.add(parseInt(suffix, 10));
        }
      }
    } catch (err) {
      console.warn('[MongoDB] Error fetching card IDs:', err);
    }
    return usedSet;
  }

  async getCertificates(options?: CertificateQueryOptions): Promise<CertificateQueryResult> {
    try {
      const collection = await this.getCardsCollection();
      const limit = Math.max(1, Math.min(options?.limit ?? 50, 200));
      const offset = Math.max(0, options?.offset ?? 0);
      const search = options?.search ? options.search.trim() : '';

      let filter: any = {};
      if (search) {
        filter = {
          $or: [
            { id: { $regex: search, $options: 'i' } },
            { name: { $regex: search, $options: 'i' } },
            { phone: { $regex: search, $options: 'i' } },
            { address: { $regex: search, $options: 'i' } },
          ],
        };
      }

      const total = await collection.countDocuments(filter);
      const docs = await collection
        .find(filter, { projection: { _id: 0 } })
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .toArray();

      const certificates: CertificateRecord[] = docs.map((doc: any) => ({
        id: doc.id,
        name: doc.name || '',
        address: doc.address || '',
        phone: doc.phone || '',
        photo: doc.photo || null,
        createdAt: doc.createdAt,
        status: 'verified',
      }));

      return { certificates, total };
    } catch (err) {
      console.error('[MongoDB] Error querying certificates:', err);
      return { certificates: [], total: 0 };
    }
  }

  async getStats(): Promise<DashboardStats> {
    const startTime = Date.now();
    try {
      const collection = await this.getCardsCollection();

      const now = new Date();
      const startOfTodayIso = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const startOfWeekIso = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).toISOString();
      const startOfMonthIso = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [total, verified, today, thisWeek, thisMonth, latestDoc] = await Promise.all([
        collection.countDocuments({}),
        collection.countDocuments({ status: 'verified' }),
        collection.countDocuments({ createdAt: { $gte: startOfTodayIso } }),
        collection.countDocuments({ createdAt: { $gte: startOfWeekIso } }),
        collection.countDocuments({ createdAt: { $gte: startOfMonthIso } }),
        collection.findOne({}, { sort: { createdAt: -1 }, projection: { _id: 0 } }),
      ]);

      const dbLatencyMs = Math.max(1, Date.now() - startTime);

      const latestCertificate: CertificateRecord | null = latestDoc
        ? {
            id: latestDoc.id,
            name: latestDoc.name || '',
            address: latestDoc.address || '',
            phone: latestDoc.phone || '',
            photo: latestDoc.photo || null,
            createdAt: latestDoc.createdAt,
            status: 'verified',
          }
        : null;

      const latestVerification = latestCertificate
        ? {
            id: latestCertificate.id,
            timestamp: latestCertificate.createdAt,
            name: latestCertificate.name,
          }
        : null;

      return {
        total,
        verified,
        today,
        thisWeek,
        thisMonth,
        latestCertificate,
        latestVerification,
        dbProvider: 'mongodb',
        dbStatus: 'connected',
        dbLatencyMs,
        apiStatus: 'healthy',
      };
    } catch (err) {
      console.error('[MongoDB] Error fetching stats:', err);
      const dbLatencyMs = Math.max(1, Date.now() - startTime);
      return {
        total: 0,
        verified: 0,
        today: 0,
        thisWeek: 0,
        thisMonth: 0,
        latestCertificate: null,
        latestVerification: null,
        dbProvider: 'mongodb',
        dbStatus: 'degraded',
        dbLatencyMs,
        apiStatus: 'healthy',
      };
    }
  }

  async checkHealth(): Promise<{ status: 'connected' | 'degraded' | 'fallback'; latencyMs: number }> {
    const start = Date.now();
    try {
      const db = await this.getDb();
      await db.command({ ping: 1 });
      return { status: 'connected', latencyMs: Date.now() - start };
    } catch {
      return { status: 'degraded', latencyMs: Date.now() - start };
    }
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      this.isInitialized = false;
    }
  }
}
