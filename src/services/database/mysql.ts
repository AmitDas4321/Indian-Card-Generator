import mysql, { Pool, RowDataPacket } from 'mysql2/promise';
import {
  CertificateQueryOptions,
  CertificateQueryResult,
  CertificateRecord,
  DashboardStats,
  DatabaseAdapter,
  DatabaseProvider,
} from './types';

export class MySQLAdapter implements DatabaseAdapter {
  readonly name: DatabaseProvider = 'mysql';
  private pool: Pool | null = null;
  private isInitialized = false;

  private getPool(): Pool {
    if (!this.pool) {
      const host = process.env.MYSQL_HOST || 'localhost';
      const port = parseInt(process.env.MYSQL_PORT || '3306', 10);
      const user = process.env.MYSQL_USER || 'root';
      const password = process.env.MYSQL_PASSWORD || '';
      const database = process.env.MYSQL_DATABASE || 'tiranga_cards';

      this.pool = mysql.createPool({
        host,
        port: isNaN(port) ? 3306 : port,
        user,
        password,
        database,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
      });
    }
    return this.pool;
  }

  async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const pool = this.getPool();

      // Test connection and ensure cards table exists
      const connection = await pool.getConnection();
      try {
        await connection.execute(`
          CREATE TABLE IF NOT EXISTS cards (
            id VARCHAR(64) PRIMARY KEY,
            name VARCHAR(255) NOT NULL DEFAULT '',
            address VARCHAR(500) NOT NULL DEFAULT '',
            phone VARCHAR(50) NOT NULL DEFAULT '',
            photo LONGTEXT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'verified',
            createdAt VARCHAR(64) NOT NULL
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        this.isInitialized = true;
        console.info('[Database: MySQL] Connected and initialized `cards` table.');
      } finally {
        connection.release();
      }
    } catch (err) {
      console.warn('[Database: MySQL] Could not connect or initialize `cards` table:', err);
    }
  }

  async certificateExists(id: string): Promise<boolean> {
    await this.init();
    const cleanId = id.trim().toUpperCase();

    try {
      const pool = this.getPool();
      const [rows] = await pool.execute<RowDataPacket[]>(
        'SELECT id FROM cards WHERE id = ? LIMIT 1',
        [cleanId]
      );
      return Array.isArray(rows) && rows.length > 0;
    } catch (err) {
      console.error(`[MySQL] Error checking certificateExists for ${cleanId}:`, err);
      return false;
    }
  }

  async getCertificateById(id: string): Promise<CertificateRecord | null> {
    await this.init();
    const cleanId = id.trim().toUpperCase();

    try {
      const pool = this.getPool();
      const [rows] = await pool.execute<RowDataPacket[]>(
        'SELECT id, name, address, phone, photo, status, createdAt FROM cards WHERE id = ? LIMIT 1',
        [cleanId]
      );

      if (Array.isArray(rows) && rows.length > 0) {
        const row = rows[0] as any;
        return {
          id: row.id,
          name: row.name || '',
          address: row.address || '',
          phone: row.phone || '',
          photo: row.photo || null,
          createdAt: row.createdAt,
          status: 'verified',
        };
      }
    } catch (err) {
      console.error(`[MySQL] Error fetching card ${cleanId}:`, err);
    }

    return null;
  }

  async createCertificate(record: CertificateRecord): Promise<CertificateRecord> {
    await this.init();
    const cleanId = record.id.trim().toUpperCase();
    const pool = this.getPool();

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
      await pool.execute(
        `INSERT INTO cards (id, name, address, phone, photo, status, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          formattedRecord.id,
          formattedRecord.name,
          formattedRecord.address,
          formattedRecord.phone,
          formattedRecord.photo,
          formattedRecord.status,
          formattedRecord.createdAt,
        ]
      );
    } catch (err: any) {
      if (err && (err.code === 'ER_DUP_ENTRY' || err.errno === 1062)) {
        const conflictErr = new Error('ID already exists');
        (conflictErr as any).statusCode = 409;
        throw conflictErr;
      }
      throw err;
    }

    return formattedRecord;
  }

  async updateCertificate(id: string, updates: Partial<CertificateRecord>): Promise<CertificateRecord | null> {
    await this.init();
    const existing = await this.getCertificateById(id);
    if (!existing) return null;

    const updated: CertificateRecord = {
      ...existing,
      ...updates,
      id: existing.id,
    };

    const pool = this.getPool();
    await pool.execute(
      `UPDATE cards
       SET name = ?, address = ?, phone = ?, photo = ?, status = ?
       WHERE id = ?`,
      [
        updated.name,
        updated.address,
        updated.phone,
        updated.photo,
        updated.status,
        existing.id,
      ]
    );

    return updated;
  }

  async deleteCertificate(id: string): Promise<boolean> {
    await this.init();
    const cleanId = id.trim().toUpperCase();
    try {
      const pool = this.getPool();
      const [result]: any = await pool.execute('DELETE FROM cards WHERE id = ?', [cleanId]);
      return result.affectedRows > 0;
    } catch (err) {
      console.error(`[MySQL] Error deleting card ${cleanId}:`, err);
      return false;
    }
  }

  async fetchAllUsedSuffixesForLength(digitLength: number): Promise<Set<number>> {
    await this.init();
    const usedSet = new Set<number>();
    try {
      const pool = this.getPool();
      const [rows] = await pool.execute<RowDataPacket[]>('SELECT id FROM cards');
      if (Array.isArray(rows)) {
        for (const row of rows) {
          const certId = String(row.id || '');
          const suffix = certId.replace(/^IND-2026-/, '');
          if (suffix.length === digitLength && /^\d+$/.test(suffix)) {
            usedSet.add(parseInt(suffix, 10));
          }
        }
      }
    } catch (err) {
      console.warn('[MySQL] Error fetching card IDs:', err);
    }
    return usedSet;
  }

  async getCertificates(options?: CertificateQueryOptions): Promise<CertificateQueryResult> {
    await this.init();
    const pool = this.getPool();
    const limit = Math.max(1, Math.min(options?.limit ?? 50, 200));
    const offset = Math.max(0, options?.offset ?? 0);
    const search = options?.search ? options.search.trim() : '';

    try {
      if (search) {
        const searchPattern = `%${search}%`;
        const [rows] = await pool.execute<RowDataPacket[]>(
          `SELECT id, name, address, phone, photo, status, createdAt
           FROM cards
           WHERE id LIKE ? OR name LIKE ? OR phone LIKE ? OR address LIKE ?
           ORDER BY createdAt DESC
           LIMIT ? OFFSET ?`,
          [searchPattern, searchPattern, searchPattern, searchPattern, String(limit), String(offset)]
        );

        const [countRows] = await pool.execute<RowDataPacket[]>(
          `SELECT COUNT(*) as total
           FROM cards
           WHERE id LIKE ? OR name LIKE ? OR phone LIKE ? OR address LIKE ?`,
          [searchPattern, searchPattern, searchPattern, searchPattern]
        );

        const total = (countRows as any)[0]?.total || 0;
        const certificates = (rows as any[]).map((r) => ({
          id: r.id,
          name: r.name || '',
          address: r.address || '',
          phone: r.phone || '',
          photo: r.photo || null,
          createdAt: r.createdAt,
          status: 'verified' as const,
        }));

        return { certificates, total };
      } else {
        const [rows] = await pool.execute<RowDataPacket[]>(
          `SELECT id, name, address, phone, photo, status, createdAt
           FROM cards
           ORDER BY createdAt DESC
           LIMIT ? OFFSET ?`,
          [String(limit), String(offset)]
        );

        const [countRows] = await pool.execute<RowDataPacket[]>('SELECT COUNT(*) as total FROM cards');
        const total = (countRows as any)[0]?.total || 0;
        const certificates = (rows as any[]).map((r) => ({
          id: r.id,
          name: r.name || '',
          address: r.address || '',
          phone: r.phone || '',
          photo: r.photo || null,
          createdAt: r.createdAt,
          status: 'verified' as const,
        }));

        return { certificates, total };
      }
    } catch (err) {
      console.error('[MySQL] Error querying certificates:', err);
      return { certificates: [], total: 0 };
    }
  }

  async getStats(): Promise<DashboardStats> {
    await this.init();
    const startTime = Date.now();
    const pool = this.getPool();

    const now = new Date();
    const startOfTodayIso = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const startOfWeekIso = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).toISOString();
    const startOfMonthIso = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    try {
      const [statsRows] = await pool.execute<RowDataPacket[]>(
        `SELECT
           COUNT(*) as total,
           SUM(CASE WHEN status = 'verified' THEN 1 ELSE 0 END) as verified,
           SUM(CASE WHEN createdAt >= ? THEN 1 ELSE 0 END) as today,
           SUM(CASE WHEN createdAt >= ? THEN 1 ELSE 0 END) as thisWeek,
           SUM(CASE WHEN createdAt >= ? THEN 1 ELSE 0 END) as thisMonth
         FROM cards`,
        [startOfTodayIso, startOfWeekIso, startOfMonthIso]
      );

      const [latestRows] = await pool.execute<RowDataPacket[]>(
        `SELECT id, name, address, phone, photo, status, createdAt
         FROM cards
         ORDER BY createdAt DESC
         LIMIT 1`
      );

      const dbLatencyMs = Math.max(1, Date.now() - startTime);
      const row = (statsRows as any[])[0] || {};
      const latestRow = (latestRows as any[])[0] || null;

      const latestCertificate: CertificateRecord | null = latestRow
        ? {
            id: latestRow.id,
            name: latestRow.name || '',
            address: latestRow.address || '',
            phone: latestRow.phone || '',
            photo: latestRow.photo || null,
            createdAt: latestRow.createdAt,
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
        total: Number(row.total || 0),
        verified: Number(row.verified || 0),
        today: Number(row.today || 0),
        thisWeek: Number(row.thisWeek || 0),
        thisMonth: Number(row.thisMonth || 0),
        latestCertificate,
        latestVerification,
        dbProvider: 'mysql',
        dbStatus: 'connected',
        dbLatencyMs,
        apiStatus: 'healthy',
      };
    } catch (err) {
      console.error('[MySQL] Error getting stats:', err);
      const dbLatencyMs = Math.max(1, Date.now() - startTime);
      return {
        total: 0,
        verified: 0,
        today: 0,
        thisWeek: 0,
        thisMonth: 0,
        latestCertificate: null,
        latestVerification: null,
        dbProvider: 'mysql',
        dbStatus: 'degraded',
        dbLatencyMs,
        apiStatus: 'healthy',
      };
    }
  }

  async checkHealth(): Promise<{ status: 'connected' | 'degraded' | 'fallback'; latencyMs: number }> {
    const start = Date.now();
    try {
      const pool = this.getPool();
      await pool.query('SELECT 1');
      return { status: 'connected', latencyMs: Date.now() - start };
    } catch {
      return { status: 'degraded', latencyMs: Date.now() - start };
    }
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.isInitialized = false;
    }
  }
}
