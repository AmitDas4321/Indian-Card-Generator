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

export interface DatabaseAdapter {
  readonly name: DatabaseProvider;
  init(): Promise<void>;
  certificateExists(id: string): Promise<boolean>;
  getCertificateById(id: string): Promise<CertificateRecord | null>;
  createCertificate(record: CertificateRecord): Promise<CertificateRecord>;
  updateCertificate(id: string, updates: Partial<CertificateRecord>): Promise<CertificateRecord | null>;
  deleteCertificate(id: string): Promise<boolean>;
  fetchAllUsedSuffixesForLength(digitLength: number): Promise<Set<number>>;
  close?(): Promise<void>;
}
