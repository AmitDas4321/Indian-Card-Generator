import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  RefreshCw,
  LogOut,
  Search,
  Users,
  CheckCircle2,
  Calendar,
  Clock,
  Database,
  Activity,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  Eye,
  X,
  AlertCircle,
  TrendingUp,
  FileCheck2,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { DashboardStats, CertificateRecord } from '../../services/database/types';
import {
  fetchDashboardStats,
  fetchAdminCertificates,
  deleteAdminCertificate,
} from '../../services/adminService';
import { getCertificateVerificationUrl } from '../../utils/cardRenderer';

interface AdminDashboardProps {
  onLogout: () => void;
  onNavigateHome: () => void;
  onNavigateVerify: (id: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onLogout,
  onNavigateHome,
  onNavigateVerify,
}) => {
  // State
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [certificates, setCertificates] = useState<CertificateRecord[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize] = useState<number>(15);

  const [loadingStats, setLoadingStats] = useState<boolean>(true);
  const [loadingList, setLoadingList] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Modal / Action state
  const [selectedCard, setSelectedCard] = useState<CertificateRecord | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedVerifyId, setCopiedVerifyId] = useState<string | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Load Dashboard Statistics
  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const data = await fetchDashboardStats();
      setStats(data);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching dashboard stats:', err);
      setError(err.message || 'Failed to load dashboard statistics.');
    } finally {
      setLoadingStats(false);
    }
  }, []);

  // Load Certificates list
  const loadCertificates = useCallback(async () => {
    setLoadingList(true);
    try {
      const offset = (currentPage - 1) * pageSize;
      const data = await fetchAdminCertificates({
        search: debouncedSearch,
        limit: pageSize,
        offset,
      });
      setCertificates(data.certificates);
      setTotalCount(data.total);
    } catch (err: any) {
      console.error('Error loading certificates list:', err);
    } finally {
      setLoadingList(false);
    }
  }, [debouncedSearch, currentPage, pageSize]);

  // Initial load
  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadCertificates();
  }, [loadCertificates]);

  const handleRefreshAll = () => {
    loadStats();
    loadCertificates();
  };

  const handleCopyId = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyVerifyLink = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const url = getCertificateVerificationUrl(id);
    navigator.clipboard.writeText(url);
    setCopiedVerifyId(id);
    setTimeout(() => setCopiedVerifyId(null), 2000);
    setActionSuccess(`Verification link for ${id} copied!`);
    setTimeout(() => setActionSuccess(null), 3000);
  };

  const handleDeleteCertificate = async (id: string) => {
    setIsDeleting(true);
    try {
      await deleteAdminCertificate(id);
      setActionSuccess(`Certificate ${id} removed successfully.`);
      setDeletingId(null);
      if (selectedCard?.id === id) {
        setSelectedCard(null);
      }
      loadStats();
      loadCertificates();
    } catch (err: any) {
      setError(err.message || 'Failed to delete certificate.');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return isoString;
      return date.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return isoString;
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="min-h-screen bg-[#040814] text-slate-100 font-sans selection:bg-[#FF9933] selection:text-black">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-[#080E1E]/90 backdrop-blur-md border-b border-slate-800">
        {/* Patriotic subtle gradient accent */}
        <div className="h-1 w-full flex overflow-hidden">
          <div className="h-full flex-1 bg-[#FF9933]" />
          <div className="h-full flex-1 bg-white" />
          <div className="h-full flex-1 bg-[#138808]" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo & Admin Branding */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0F1D38] to-[#080E1C] border border-slate-700/80 flex items-center justify-center text-[#FF9933] shadow-md">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-white">
                  Indian Card Generator
                </span>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-md bg-[#FF9933]/15 text-[#FF9933] border border-[#FF9933]/30">
                  Admin Portal
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Multi-Database Management & Real-Time Insights
              </p>
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Active Database Badge */}
            {stats && (
              <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#0B1426] border border-slate-800 text-xs">
                <Database className="w-3.5 h-3.5 text-[#FF9933]" />
                <span className="text-slate-400 font-medium">DB:</span>
                <span className="text-white font-bold uppercase tracking-wider">
                  {stats.dbProvider}
                </span>
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-1" />
              </div>
            )}

            {/* Refresh Button */}
            <button
              id="btn-admin-refresh"
              type="button"
              onClick={handleRefreshAll}
              disabled={loadingStats || loadingList}
              className="p-2 sm:px-3 sm:py-1.5 rounded-lg bg-[#0B1426] hover:bg-slate-800 text-slate-300 hover:text-white transition-all text-xs font-medium flex items-center gap-1.5 border border-slate-800 disabled:opacity-50"
              title="Refresh database records"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#FF9933] ${loadingStats || loadingList ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {/* Logout Button */}
            <button
              id="btn-admin-logout"
              type="button"
              onClick={onLogout}
              className="p-2 sm:px-3 sm:py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-300 hover:text-red-100 transition-all text-xs font-medium flex items-center gap-1.5 border border-red-800/50"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Banner Alert for Action Feedback */}
        {actionSuccess && (
          <div
            id="admin-action-success"
            className="p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-800/60 text-emerald-200 text-sm flex items-center justify-between gap-3 animate-fade-in"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
            <button
              onClick={() => setActionSuccess(null)}
              className="text-emerald-400 hover:text-emerald-200 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {error && (
          <div
            id="admin-dashboard-error"
            className="p-3.5 rounded-xl bg-red-950/50 border border-red-800/60 text-red-200 text-sm flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200 p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TOP METRICS & STATS SECTION */}
        {/* ------------------------------------------------------------- */}
        <section className="relative">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#FF9933]" />
              <span>Real-Time System Overview</span>
            </h2>
            <span className="text-xs text-slate-400">
              Active Provider:{' '}
              <strong className="text-[#FF9933] uppercase">
                {stats?.dbProvider || 'firebase'}
              </strong>
            </span>
          </div>

          {/* Container with smooth blur effect when loading */}
          <div className="relative">
            <div className={`grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 transition-all duration-300 ${loadingStats ? 'filter blur-[3px] opacity-60 pointer-events-none' : 'filter blur-0 opacity-100'}`}>
              {/* Total Cards */}
              <div className="bg-[#0B1224] border border-slate-800 rounded-2xl p-4 sm:p-5 relative overflow-hidden shadow-lg">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Users className="w-16 h-16 text-[#FF9933]" />
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  <Users className="w-4 h-4 text-[#FF9933]" />
                  <span>Total Cards</span>
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-white">
                  {(stats?.total ?? 0).toLocaleString()}
                </div>
                <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                  <span className="text-emerald-400 font-medium">
                    {stats?.verified !== undefined ? `${stats.verified}` : '0'}
                  </span>{' '}
                  verified in database
                </p>
              </div>

              {/* Generated Today */}
              <div className="bg-[#0B1224] border border-slate-800 rounded-2xl p-4 sm:p-5 relative overflow-hidden shadow-lg">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <TrendingUp className="w-16 h-16 text-emerald-400" />
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  <span>Generated Today</span>
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-white">
                  {(stats?.today ?? 0).toLocaleString()}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Active current calendar day</p>
              </div>

              {/* This Week */}
              <div className="bg-[#0B1224] border border-slate-800 rounded-2xl p-4 sm:p-5 relative overflow-hidden shadow-lg">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Calendar className="w-16 h-16 text-sky-400" />
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  <Calendar className="w-4 h-4 text-sky-400" />
                  <span>This Week</span>
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-white">
                  {(stats?.thisWeek ?? 0).toLocaleString()}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Past 7 days volume</p>
              </div>

              {/* This Month */}
              <div className="bg-[#0B1224] border border-slate-800 rounded-2xl p-4 sm:p-5 relative overflow-hidden shadow-lg">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <FileCheck2 className="w-16 h-16 text-amber-400" />
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  <FileCheck2 className="w-4 h-4 text-amber-400" />
                  <span>This Month</span>
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-white">
                  {(stats?.thisMonth ?? 0).toLocaleString()}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Current monthly tally</p>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------- */}
        {/* SYSTEM STATUS & RECENT ACTIVITY DUAL CARDS */}
        {/* ------------------------------------------------------------- */}
        <div className="relative">
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 transition-all duration-300 ${loadingStats ? 'filter blur-[3px] opacity-60 pointer-events-none' : 'filter blur-0 opacity-100'}`}>
            {/* Database & Infrastructure Status */}
            <div className="bg-[#0B1224] border border-slate-800 rounded-2xl p-5 shadow-lg">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 mb-3">
                <Database className="w-4 h-4 text-[#FF9933]" />
                <span>Database Connection & Status</span>
              </h3>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#060B17] border border-slate-800/80">
                  <span className="text-slate-400">Database Engine:</span>
                  <span className="font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    {stats?.dbProvider || 'firebase'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#060B17] border border-slate-800/80">
                  <span className="text-slate-400">Connection State:</span>
                  <span className="font-semibold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {stats?.dbStatus === 'fallback' ? 'Memory Fallback' : 'Operational'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#060B17] border border-slate-800/80">
                  <span className="text-slate-400">Response Latency:</span>
                  <span className="font-mono text-slate-200">
                    {stats?.dbLatencyMs !== undefined ? `${stats.dbLatencyMs} ms` : '1 ms'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#060B17] border border-slate-800/80">
                  <span className="text-slate-400">API Endpoint Security:</span>
                  <span className="font-semibold text-sky-400">HMAC-SHA256 Signed</span>
                </div>
              </div>
            </div>

            {/* Latest Generated Certificate */}
            <div className="bg-[#0B1224] border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  <span>Latest Certificate Activity</span>
                </h3>

                {stats?.latestCertificate ? (
                  <div className="p-3 rounded-xl bg-[#060B17] border border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-[#FF9933] bg-[#FF9933]/10 px-2 py-0.5 rounded border border-[#FF9933]/20">
                        {stats.latestCertificate.id}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {formatDate(stats.latestCertificate.createdAt)}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-white truncate">
                      {stats.latestCertificate.name || 'Unnamed Card'}
                    </div>
                    <div className="text-xs text-slate-400 truncate">
                      {stats.latestCertificate.address || 'No address specified'}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-[#060B17] border border-slate-800 text-center text-xs text-slate-500">
                    No certificate records in active database.
                  </div>
                )}
              </div>

              {stats?.latestCertificate && (
                <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                  <button
                    onClick={() => setSelectedCard(stats.latestCertificate)}
                    className="text-xs text-slate-300 hover:text-white px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 transition-colors flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Details</span>
                  </button>
                  <button
                    onClick={() => onNavigateVerify(stats.latestCertificate!.id)}
                    className="text-xs text-[#FF9933] hover:text-orange-300 px-2.5 py-1 rounded bg-[#FF9933]/10 hover:bg-[#FF9933]/20 transition-colors flex items-center gap-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Verify Portal</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* CERTIFICATES RECENT RECORDS & SEARCH TABLE */}
        {/* ------------------------------------------------------------- */}
        <section className="bg-[#0B1224] border border-slate-800 rounded-2xl shadow-xl overflow-hidden relative">
          {/* Table Header Controls */}
          <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-[#FF9933]" />
                <span>Certificate Records</span>
                <span className="text-xs text-slate-400 font-normal">
                  ({totalCount} {totalCount === 1 ? 'record' : 'records'})
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Browse, search, and manage issued identity cards
              </p>
            </div>

            {/* Search Input */}
            <div className="w-full sm:w-80 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                id="admin-search-input"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by ID or Name..."
                className="w-full bg-[#050B17] border border-slate-700/80 rounded-xl pl-9 pr-8 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#FF9933] focus:border-transparent transition-all"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Table Container with blur loading effect */}
          <div className="relative">
            <div className={`overflow-x-auto transition-all duration-300 ${loadingList ? 'filter blur-[3px] opacity-60 pointer-events-none select-none' : 'filter blur-0 opacity-100'}`}>
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-[#070D1B] text-slate-400 border-b border-slate-800 text-[11px] uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-3 px-4">Certificate ID</th>
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-4">Issue Timestamp</th>
                    <th className="py-3 px-4">Verification</th>
                    <th className="py-3 px-4">Storage</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {certificates.length === 0 && loadingList ? (
                    Array.from({ length: 5 }).map((_, idx) => (
                      <tr key={`blur-skel-${idx}`}>
                        <td className="py-3.5 px-4"><div className="h-4 w-24 bg-slate-800/80 rounded" /></td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-slate-800/80 shrink-0" />
                            <div className="space-y-1">
                              <div className="h-3.5 w-28 bg-slate-800/80 rounded" />
                              <div className="h-2.5 w-20 bg-slate-800/50 rounded" />
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4"><div className="h-3.5 w-28 bg-slate-800/80 rounded" /></td>
                        <td className="py-3.5 px-4"><div className="h-5 w-20 bg-emerald-950/40 rounded-full" /></td>
                        <td className="py-3.5 px-4"><div className="h-4 w-16 bg-slate-800/80 rounded" /></td>
                        <td className="py-3.5 px-4 text-right"><div className="h-4 w-24 bg-slate-800/60 rounded ml-auto" /></td>
                      </tr>
                    ))
                  ) : certificates.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Users className="w-8 h-8 text-slate-600" />
                          <span className="text-sm font-semibold text-slate-300">
                            {debouncedSearch
                              ? `No records found matching "${debouncedSearch}"`
                              : 'No certificates generated yet in the database.'}
                          </span>
                          {debouncedSearch && (
                            <button
                              onClick={() => setSearchTerm('')}
                              className="text-xs text-[#FF9933] hover:underline"
                            >
                              Clear search filter
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    certificates.map((cert) => (
                      <tr
                        key={cert.id}
                        className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                        onClick={() => setSelectedCard(cert)}
                      >
                        {/* ID */}
                        <td className="py-3.5 px-4 font-mono font-bold text-white whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[#FF9933] group-hover:underline">{cert.id}</span>
                            <button
                              type="button"
                              onClick={(e) => handleCopyId(cert.id, e)}
                              title="Copy ID"
                              className="p-1 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-700/60 transition-colors"
                            >
                              {copiedId === cert.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* Name */}
                        <td className="py-3.5 px-4 font-medium text-slate-200 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            {cert.photo ? (
                              <img
                                src={cert.photo}
                                alt=""
                                className="w-7 h-7 rounded-full object-cover border border-slate-700 shrink-0"
                              />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300 shrink-0">
                                {cert.name ? cert.name.charAt(0).toUpperCase() : '?'}
                              </div>
                            )}
                            <div className="truncate max-w-[180px] sm:max-w-[220px]">
                              <div className="font-semibold text-white truncate">
                                {cert.name || 'Unnamed'}
                              </div>
                              {cert.phone && (
                                <div className="text-[11px] text-slate-400">{cert.phone}</div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Created At */}
                        <td className="py-3.5 px-4 text-slate-300 text-xs whitespace-nowrap">
                          {formatDate(cert.createdAt)}
                        </td>

                        {/* Verification Status */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span>Verified</span>
                          </span>
                        </td>

                        {/* Database Status */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800/80 text-slate-300 border border-slate-700/50">
                            <Database className="w-3 h-3 text-sky-400" />
                            <span>Active</span>
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            {/* View Modal */}
                            <button
                              type="button"
                              onClick={() => setSelectedCard(cert)}
                              title="View Full Details"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Verify Link */}
                            <button
                              type="button"
                              onClick={() => onNavigateVerify(cert.id)}
                              title="Open Online Verification"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-[#FF9933] hover:bg-slate-700/60 transition-colors"
                            >
                              <ArrowUpRight className="w-4 h-4" />
                            </button>

                            {/* Copy Verify URL */}
                            <button
                              type="button"
                              onClick={(e) => handleCopyVerifyLink(cert.id, e)}
                              title="Copy Verification Link"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-sky-300 hover:bg-slate-700/60 transition-colors"
                            >
                              {copiedVerifyId === cert.id ? (
                                <Check className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>

                            {/* Delete Card */}
                            <button
                              type="button"
                              onClick={() => setDeletingId(cert.id)}
                              title="Delete Certificate Record"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/40 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination Footer */}
          <div className="p-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
            <div>
              Showing{' '}
              <span className="font-semibold text-white">
                {totalCount > 0 ? (currentPage - 1) * pageSize + 1 : 0}
              </span>{' '}
              to{' '}
              <span className="font-semibold text-white">
                {Math.min(currentPage * pageSize, totalCount)}
              </span>{' '}
              of <span className="font-semibold text-white">{totalCount}</span> entries
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage <= 1 || loadingList}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1 font-medium text-slate-300">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages || loadingList}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* ------------------------------------------------------------- */}
      {/* CARD DETAILS MODAL */}
      {/* ------------------------------------------------------------- */}
      {selectedCard && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setSelectedCard(null)}
        >
          <div
            className="w-full max-w-lg bg-[#0B1224] border border-slate-700/80 rounded-2xl p-6 shadow-2xl relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Accent Strip */}
            <div className="absolute top-0 left-0 right-0 h-1.5 flex overflow-hidden">
              <div className="h-full flex-1 bg-[#FF9933]" />
              <div className="h-full flex-1 bg-white" />
              <div className="h-full flex-1 bg-[#138808]" />
            </div>

            <div className="flex items-center justify-between mb-4 mt-1">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-[#FF9933]" />
                <h3 className="font-bold text-lg text-white">Certificate Details</h3>
              </div>
              <button
                onClick={() => setSelectedCard(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Photo & Basic Info */}
              <div className="flex items-center gap-4 p-4 rounded-xl bg-[#060B17] border border-slate-800">
                {selectedCard.photo ? (
                  <img
                    src={selectedCard.photo}
                    alt="Card Photo"
                    className="w-16 h-16 rounded-xl object-cover border border-slate-700 shadow-md shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xl text-slate-400 shrink-0">
                    {selectedCard.name ? selectedCard.name.charAt(0).toUpperCase() : '?'}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-slate-400 uppercase font-semibold">Holder Name</div>
                  <div className="text-base font-bold text-white truncate">
                    {selectedCard.name || 'Unnamed'}
                  </div>
                  <div className="text-xs font-mono font-bold text-[#FF9933] mt-0.5">
                    {selectedCard.id}
                  </div>
                </div>
              </div>

              {/* Data Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-[#060B17] border border-slate-800">
                  <div className="text-slate-400 mb-0.5">Phone Number</div>
                  <div className="font-semibold text-white truncate">
                    {selectedCard.phone || 'N/A'}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#060B17] border border-slate-800">
                  <div className="text-slate-400 mb-0.5">Issued Date</div>
                  <div className="font-semibold text-white truncate">
                    {formatDate(selectedCard.createdAt)}
                  </div>
                </div>
                <div className="col-span-2 p-3 rounded-xl bg-[#060B17] border border-slate-800">
                  <div className="text-slate-400 mb-0.5">Address</div>
                  <div className="font-medium text-white break-words">
                    {selectedCard.address || 'No address provided'}
                  </div>
                </div>
              </div>

              {/* Verification & Action Links */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyVerifyLink(selectedCard.id)}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Verification URL</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateVerify(selectedCard.id)}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#FF9933] to-[#E68A00] text-slate-950 text-xs font-bold transition-all flex items-center gap-1.5 hover:shadow-lg shadow-orange-950/20"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Verification Portal</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* DELETE CONFIRMATION MODAL */}
      {/* ------------------------------------------------------------- */}
      {deletingId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setDeletingId(null)}
        >
          <div
            className="w-full max-w-sm bg-[#0B1224] border border-red-900/60 rounded-2xl p-6 shadow-2xl text-center relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 mx-auto mb-3 bg-red-950/60 border border-red-800/80 rounded-2xl flex items-center justify-center text-red-400">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-white mb-1">Delete Certificate?</h3>
            <p className="text-xs text-slate-400 mb-5">
              Are you sure you want to permanently remove certificate{' '}
              <strong className="font-mono text-red-300">{deletingId}</strong> from the active
              database? This action cannot be undone.
            </p>

            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingId(null)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => handleDeleteCertificate(deletingId)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-red-950/40"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
