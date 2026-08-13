import { MongoClient, Db, Collection } from 'mongodb';
import { CertificateRecord, DatabaseAdapter, DatabaseProvider } from './types';

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

  private async getCertificatesCollection(): Promise<Collection<CertificateRecord>> {
    const db = await this.getDb();
    return db.collection<CertificateRecord>('certificates');
  }

  private async getSystemConfigCollection(): Promise<Collection<{ _id: string; value: any }>> {
    const db = await this.getDb();
    return db.collection<{ _id: string; value: any }>('system_config');
  }

  async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const certificatesCol = await this.getCertificatesCollection();
      // Ensure unique index on `id`
      await certificatesCol.createIndex({ id: 1 }, { unique: true });

      const configCol = await this.getSystemConfigCollection();
      const existingConfig = await configCol.findOne({ _id: 'digitLength' });
      if (!existingConfig) {
        await configCol.insertOne({ _id: 'digitLength', value: 4 });
      }

      this.isInitialized = true;
      console.info('[Database: MongoDB] Successfully connected and initialized MongoDB collections & indexes.');
    } catch (err) {
      console.warn('[Database: MongoDB] Could not connect or initialize MongoDB collections:', err);
    }
  }

  async certificateExists(id: string): Promise<boolean> {
    try {
      const cleanId = id.trim().toUpperCase();
      const collection = await this.getCertificatesCollection();
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
      const collection = await this.getCertificatesCollection();
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
      console.error(`[MongoDB] Error fetching certificate ${id}:`, err);
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
      const collection = await this.getCertificatesCollection();
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
      const collection = await this.getCertificatesCollection();
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
      console.error(`[MongoDB] Error updating certificate ${cleanId}:`, err);
      return null;
    }
  }

  async deleteCertificate(id: string): Promise<boolean> {
    const cleanId = id.trim().toUpperCase();
    try {
      const collection = await this.getCertificatesCollection();
      const result = await collection.deleteOne({ id: cleanId });
      return result.deletedCount > 0;
    } catch (err) {
      console.error(`[MongoDB] Error deleting certificate ${cleanId}:`, err);
      return false;
    }
  }

  async getStoredDigitLength(): Promise<number> {
    try {
      const configCol = await this.getSystemConfigCollection();
      const doc = await configCol.findOne({ _id: 'digitLength' });
      if (doc && typeof doc.value === 'number' && doc.value >= 4) {
        return doc.value;
      }
    } catch (err) {
      console.warn('[MongoDB] Error reading digitLength:', err);
    }
    return 4;
  }

  async setStoredDigitLength(length: number): Promise<void> {
    try {
      const configCol = await this.getSystemConfigCollection();
      await configCol.updateOne(
        { _id: 'digitLength' },
        { $set: { value: length } },
        { upsert: true }
      );
    } catch (err) {
      console.warn('[MongoDB] Error saving digitLength:', err);
    }
  }

  async fetchAllUsedSuffixesForLength(digitLength: number): Promise<Set<number>> {
    const usedSet = new Set<number>();
    try {
      const collection = await this.getCertificatesCollection();
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
      console.warn('[MongoDB] Error fetching certificate IDs:', err);
    }
    return usedSet;
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
