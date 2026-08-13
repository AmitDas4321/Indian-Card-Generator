import { CardData } from '../types';
import { generateSecurityHeaders } from '../utils/apiSigner';

export interface CertificateRecord {
  id: string;
  name: string;
  address: string;
  phone: string;
  photo: string | null;
  createdAt: string;
  status: 'verified';
}

/**
 * Validates whether an ID matches the IND-2026-#### format (4 or more digits).
 */
export function isValidCertificateId(id: string): boolean {
  if (!id) return false;
  return /^IND-2026-\d{4,}$/.test(id.trim());
}

/**
 * Gets the next available sequence number string for previewing in the form.
 * Default starting sequence number is 7890.
 */
export async function getNextSequencePreview(): Promise<string> {
  try {
    const path = '/api/next-id';
    const headers = await generateSecurityHeaders('GET', path);
    const res = await fetch(path, { headers });
    if (res.ok) {
      const data = await res.json();
      if (data && data.id) {
        return data.id;
      }
    }
  } catch (err) {
    console.warn('Could not fetch next sequence preview from server:', err);
  }
  return 'IND-2026-7890';
}

/**
 * Atomically increments sequence in Firebase via server API and saves certificate record.
 */
export async function generateAndSaveCertificate(cardData: CardData): Promise<CertificateRecord> {
  if (cardData.photoUrl && cardData.photoUrl.length > 7000000) {
    throw new Error('Uploaded photo file size is too large for registration. Please upload a smaller photo (under 5MB).');
  }

  const payload = {
    id: cardData.idNumber,
    name: cardData.name,
    address: cardData.address,
    phoneNumber: cardData.phoneNumber,
    photoUrl: cardData.photoUrl,
  };

  try {
    const path = '/api/certificates';
    const headers = await generateSecurityHeaders('POST', path, payload);

    const res = await fetch(path, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to save certificate. Please try again.');
    }

    const data = await res.json();
    if (data && data.record) {
      return data.record as CertificateRecord;
    }

    throw new Error('Invalid response received from certificate server.');
  } catch (err) {
    console.error('generateAndSaveCertificate error:', err);
    throw err instanceof Error ? err : new Error('Failed to save certificate. Please try again.');
  }
}

/**
 * Fetches certificate record by ID via server API.
 */
export async function getCertificateById(id: string): Promise<CertificateRecord | null> {
  const cleanId = id ? id.trim().toUpperCase() : '';
  if (!isValidCertificateId(cleanId)) {
    return null;
  }

  try {
    const path = `/api/certificates/${encodeURIComponent(cleanId)}`;
    const headers = await generateSecurityHeaders('GET', path);
    const res = await fetch(path, { headers });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object' && data.id === cleanId) {
        return data as CertificateRecord;
      }
    }
  } catch (err) {
    console.error('getCertificateById error:', err);
  }

  return null;
}

