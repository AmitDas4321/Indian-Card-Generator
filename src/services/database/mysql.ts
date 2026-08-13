import mysql, { Pool, RowDataPacket } from 'mysql2/promise';
import { CertificateRecord, DatabaseAdapter, DatabaseProvider } from './types';

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
        port,
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

      // Test connection
      const connection = await pool.getConnection();
      try {
        // Create certificates table with LONGTEXT for Base64 photo storage
        await connection.execute(`
          CREATE TABLE IF NOT EXISTS certificates (
            id VARCHAR(64) PRIMARY KEY,
            name VARCHAR(255) NOT NULL DEFAULT '',
            address VARCHAR(500) NOT NULL DEFAULT '',
            phone VARCHAR(50) NOT NULL DEFAULT '',
            photo LONGTEXT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'verified',
            createdAt VARCHAR(64) NOT NULL
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // Create system configuration table for dynamic metadata (e.g. digitLength)
        await connection.execute(`
          CREATE TABLE IF NOT EXISTS system_config (
            config_key VARCHAR(64) PRIMARY KEY,
            config_value VARCHAR(255) NOT NULL
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // Initialize default digitLength if not exists
        await connection.execute(`
          INSERT IGNORE INTO system_config (config_key, config_value)
          VALUES ('digitLength', '4');
        `);

        this.isInitialized = true;
        console.info('[Database: MySQL] Successfully connected and initialized database schema.');
      } finally {
        connection.release();
      }
    } catch (err) {
      console.warn('[Database: MySQL] Could not initialize MySQL database schema:', err);
    }
  }

  async certificateExists(id: string): Promise<boolean> {
    await this.init();
    const cleanId = id.trim().toUpperCase();

    try {
      const pool = this.getPool();
      const [rows] = await pool.execute<RowDataPacket[]>(
        'SELECT id FROM certificates WHERE id = ? LIMIT 1',
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
        'SELECT id, name, address, phone, photo, status, createdAt FROM certificates WHERE id = ? LIMIT 1',
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
      console.error(`[MySQL] Error fetching certificate ${cleanId}:`, err);
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
        `INSERT INTO certificates (id, name, address, phone, photo, status, createdAt)
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
      `UPDATE certificates
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
      const [result]: any = await pool.execute('DELETE FROM certificates WHERE id = ?', [cleanId]);
      return result.affectedRows > 0;
    } catch (err) {
      console.error(`[MySQL] Error deleting certificate ${cleanId}:`, err);
      return false;
    }
  }

  async getStoredDigitLength(): Promise<number> {
    await this.init();
    try {
      const pool = this.getPool();
      const [rows] = await pool.execute<RowDataPacket[]>(
        "SELECT config_value FROM system_config WHERE config_key = 'digitLength' LIMIT 1"
      );
      if (Array.isArray(rows) && rows.length > 0) {
        const val = parseInt(rows[0].config_value, 10);
        if (!isNaN(val) && val >= 4) return val;
      }
    } catch (err) {
      console.warn('[MySQL] Error reading digitLength:', err);
    }
    return 4;
  }

  async setStoredDigitLength(length: number): Promise<void> {
    await this.init();
    try {
      const pool = this.getPool();
      await pool.execute(
        `INSERT INTO system_config (config_key, config_value)
         VALUES ('digitLength', ?)
         ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)`,
        [String(length)]
      );
    } catch (err) {
      console.warn('[MySQL] Error saving digitLength:', err);
    }
  }

  async fetchAllUsedSuffixesForLength(digitLength: number): Promise<Set<number>> {
    await this.init();
    const usedSet = new Set<number>();
    try {
      const pool = this.getPool();
      const [rows] = await pool.execute<RowDataPacket[]>('SELECT id FROM certificates');
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
      console.warn('[MySQL] Error fetching all certificate IDs:', err);
    }
    return usedSet;
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.isInitialized = false;
    }
  }
}
