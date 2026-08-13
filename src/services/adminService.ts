import { CertificateRecord, DashboardStats } from './database/types';

export interface AdminAuthResponse {
  success: boolean;
  token?: string;
  expiresAt?: number;
  user?: string;
  error?: string;
}

export interface CertificatesListResponse {
  certificates: CertificateRecord[];
  total: number;
}

// Token holder in memory for dual-mode support (Bearer + Cookie)
let inMemoryAdminToken: string | null = null;

export function setAdminToken(token: string | null) {
  inMemoryAdminToken = token;
}

export function getAdminToken(): string | null {
  return inMemoryAdminToken;
}

function getAuthHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (inMemoryAdminToken) {
    headers['Authorization'] = `Bearer ${inMemoryAdminToken}`;
  }
  return headers;
}

/**
 * Check if the admin is currently authenticated.
 */
export async function checkAdminAuth(): Promise<{ authenticated: boolean; user?: string; databaseProvider?: string }> {
  try {
    const res = await fetch('/api/admin/check-auth', {
      method: 'GET',
      credentials: 'include',
      headers: getAuthHeaders(),
    });

    if (res.ok) {
      const data = await res.json();
      return { authenticated: Boolean(data.authenticated), user: data.user, databaseProvider: data.databaseProvider };
    }
    return { authenticated: false };
  } catch (err) {
    console.warn('[AdminService] Check auth error:', err);
    return { authenticated: false };
  }
}

/**
 * Log in to the admin panel with password.
 */
export async function adminLogin(password: string): Promise<AdminAuthResponse> {
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    const data = await res.json();

    if (!res.ok) {
      return {
        success: false,
        error: data.error || 'Invalid credentials',
      };
    }

    if (data.token) {
      setAdminToken(data.token);
    }

    return {
      success: true,
      token: data.token,
      expiresAt: data.expiresAt,
      user: data.user,
    };
  } catch (err: any) {
    console.error('[AdminService] Login error:', err);
    return {
      success: false,
      error: 'Network connection failed. Please check your internet.',
    };
  }
}

/**
 * Log out from the admin panel.
 */
export async function adminLogout(): Promise<boolean> {
  try {
    await fetch('/api/admin/logout', {
      method: 'POST',
      credentials: 'include',
      headers: getAuthHeaders(),
    });
  } catch (err) {
    console.warn('[AdminService] Logout error:', err);
  } finally {
    setAdminToken(null);
  }
  return true;
}

/**
 * Fetch dashboard statistics from the server.
 */
export async function fetchDashboardStats(): Promise<DashboardStats> {
  const res = await fetch('/api/admin/stats', {
    method: 'GET',
    credentials: 'include',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Failed to fetch stats (HTTP ${res.status})`);
  }

  return res.json();
}

/**
 * Fetch certificates list with search and pagination.
 */
export async function fetchAdminCertificates(options?: {
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<CertificatesListResponse> {
  const params = new URLSearchParams();
  if (options?.search) params.set('search', options.search);
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.offset) params.set('offset', String(options.offset));

  const url = `/api/admin/certificates${params.toString() ? `?${params.toString()}` : ''}`;
  const res = await fetch(url, {
    method: 'GET',
    credentials: 'include',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Failed to fetch certificates (HTTP ${res.status})`);
  }

  return res.json();
}

/**
 * Fetch a single certificate details.
 */
export async function fetchCertificateDetails(id: string): Promise<CertificateRecord> {
  const res = await fetch(`/api/admin/certificates/${encodeURIComponent(id)}`, {
    method: 'GET',
    credentials: 'include',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Certificate not found (HTTP ${res.status})`);
  }

  return res.json();
}

/**
 * Delete a certificate by ID.
 */
export async function deleteAdminCertificate(id: string): Promise<boolean> {
  const res = await fetch(`/api/admin/certificates/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Failed to delete certificate (HTTP ${res.status})`);
  }

  return true;
}
