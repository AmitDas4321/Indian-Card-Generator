export type DatabaseProvider = 'firebase' | 'mysql' | 'mongodb';

export interface CertificateRecord {
  id: string;
  name: string;
  address: string;
  phone: string;
  photo: string | null;
  createdAt: string;
  status: 'verified';
}

export interface DashboardStats {
  total: number;
  verified: number;
  today: number;
  thisWeek: number;
  thisMonth: number;
  latestCertificate: CertificateRecord | null;
  latestVerification: { id: string; timestamp: string; name: string } | null;
  dbProvider: DatabaseProvider;
  dbStatus: 'connected' | 'degraded' | 'fallback';
  dbLatencyMs: number;
  apiStatus: 'healthy';
}

export interface CertificateQueryOptions {
  search?: string;
  limit?: number;
  offset?: number;
}

export interface CertificateQueryResult {
  certificates: CertificateRecord[];
  total: number;
}

export interface DatabaseAdapter {
  readonly name: DatabaseProvider;
  init(): Promise<void>;
  certificateExists(id: string): Promise<boolean>;
  getCertificateById(id: string): Promise<CertificateRecord | null>;
  createCertificate(record: CertificateRecord): Promise<CertificateRecord>;
  updateCertificate(id: string, updates: Partial<CertificateRecord>): Promise<CertificateRecord | null>;
  deleteCertificate(id: string): Promise<boolean>;
  fetchAllUsedSuffixesForLength(digitLength: number): Promise<Set<number>>;
  getCertificates(options?: CertificateQueryOptions): Promise<CertificateQueryResult>;
  getStats(): Promise<DashboardStats>;
  checkHealth(): Promise<{ status: 'connected' | 'degraded' | 'fallback'; latencyMs: number }>;
  close?(): Promise<void>;
}
