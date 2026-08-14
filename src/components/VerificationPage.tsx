import React, { useState, useEffect, useRef } from 'react';
import {
  CheckCircle2,
  XCircle,
  Search,
  Copy,
  Check,
  Calendar,
  Phone,
  MapPin,
  User,
  ShieldCheck,
  ArrowLeft,
  Loader2,
  Download,
} from 'lucide-react';
import { Header } from './Header';
import { Footer } from './Footer';
import {
  getCertificateById,
  isValidCertificateId,
  CertificateRecord,
} from '../services/firebaseCertificate';
import { CardData } from '../types';
import { renderCardToCanvas, getCertificateVerificationUrl } from '../utils/cardRenderer';
import { triggerSuccessConfetti } from '../utils/confetti';

interface VerificationPageProps {
  initialId?: string;
  fromAdmin?: boolean;
  onNavigateHome: () => void;
  onNavigateAdmin?: () => void;
  onNavigateVerify: (id: string) => void;
}

export const VerificationPage: React.FC<VerificationPageProps> = ({
  initialId = '',
  fromAdmin = false,
  onNavigateHome,
  onNavigateAdmin,
  onNavigateVerify,
}) => {
  const [searchInput, setSearchInput] = useState(initialId);
  const [activeId, setActiveId] = useState(initialId);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(initialId));
  const [certRecord, setCertRecord] = useState<CertificateRecord | null>(null);
  const [hasSearched, setHasSearched] = useState<boolean>(Boolean(initialId));
  const [copied, setCopied] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setSearchInput(initialId);
    setActiveId(initialId);

    if (initialId && initialId.trim()) {
      setIsLoading(true);
      setHasSearched(true);
      getCertificateById(initialId.trim())
        .then((record) => {
          setCertRecord(record);
        })
        .catch((err) => {
          console.error('Failed to verify certificate:', err);
          setCertRecord(null);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
      setCertRecord(null);
      setHasSearched(false);
    }
  }, [initialId]);

  useEffect(() => {
    if (canvasRef.current) {
      const cardData: CardData = certRecord
        ? {
            photoUrl: certRecord.photo,
            name: certRecord.name,
            idNumber: certRecord.id,
            phoneNumber: certRecord.phone,
            address: certRecord.address,
          }
        : {
            photoUrl: '',
            name: 'INDIAN CITIZEN',
            idNumber: activeId || 'IND-2026-XXXX',
            phoneNumber: '+91 98765 43210',
            address: 'NEW DELHI, INDIA',
          };
      renderCardToCanvas(canvasRef.current, cardData);
    }
  }, [certRecord, activeId]);

  const handleVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = searchInput.trim().toUpperCase();
    if (!cleanId) return;

    onNavigateVerify(cleanId);
  };

  const handleCopyUrl = () => {
    if (!activeId) return;
    const url = getCertificateVerificationUrl(activeId);
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadCard = async () => {
    if (!certRecord) return;
    setIsDownloading(true);

    try {
      let targetCanvas = canvasRef.current;
      const cardData: CardData = {
        photoUrl: certRecord.photo,
        name: certRecord.name,
        idNumber: certRecord.id,
        phoneNumber: certRecord.phone,
        address: certRecord.address,
      };

      if (!targetCanvas) {
        targetCanvas = document.createElement('canvas');
        targetCanvas.width = 1600;
        targetCanvas.height = 1000;
      }

      await renderCardToCanvas(targetCanvas, cardData);

      const dataUrl = targetCanvas.toDataURL('image/png', 1.0);

      const cleanName = (certRecord.name || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

      const fileName = `indian-card-${cleanName || 'verified'}-${certRecord.id}.png`;

      const link = document.createElement('a');
      link.download = fileName;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      triggerSuccessConfetti(targetCanvas);
    } catch (err) {
      console.error('Failed to download certificate card:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleBack = () => {
    if (fromAdmin && onNavigateAdmin) {
      onNavigateAdmin();
    } else {
      onNavigateHome();
    }
  };

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return 'N/A';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#020817] text-slate-800 dark:text-[#dfe2e8] flex flex-col font-sans selection:bg-[#ff9800] selection:text-black transition-colors duration-200">
      {/* Top Header */}
      <Header />

      {/* Main Verification Container */}
      <main className="flex-1 w-full max-w-[1080px] mx-auto px-4 py-6 sm:py-8 space-y-6">
        {/* Two-Column Grid matching Generator Page */}
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start">
          {/* Left Column: Verification Search & Details */}
          <div className="w-full space-y-5">
            {/* Verification Search Box */}
            <div className="bg-white dark:bg-[#0b1224] border border-slate-200 dark:border-[#1d2940] rounded-2xl p-5 shadow-lg dark:shadow-xl space-y-4 transition-colors duration-200">
              <div className="flex items-start justify-between border-b border-slate-100 dark:border-[#1d2940] pb-3.5">
                <div>
                  <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#ff9800] inline-block shrink-0 shadow-sm shadow-orange-500/50" />
                    Certificate Verification
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-[#9aa3b5] mt-0.5">
                    Enter an Indian ID Certificate number to verify
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleBack}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-[#dfe2e8] hover:text-[#ff9800] dark:hover:text-[#ff9800] bg-slate-100 hover:bg-slate-200 dark:bg-[#172238] dark:hover:bg-[#26344d] border border-slate-200 dark:border-[#26344d] rounded-lg transition-all focus-visible:ring-2 focus-visible:ring-[#ff9800] outline-none cursor-pointer shrink-0"
                  title="Back"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
              </div>

              <form onSubmit={handleVerifySubmit} className="space-y-3">
                <div>
                  <label htmlFor="verify-id-input" className="block text-xs font-semibold text-slate-700 dark:text-[#dfe2e8] mb-1.5">
                    Enter ID Number
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      id="verify-id-input"
                      type="text"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="IND-2026-1234"
                      className="w-full h-11 px-3.5 bg-slate-50 dark:bg-[#0a1020] text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#9aa3b5]/60 rounded-xl border border-slate-200 dark:border-[#26344d] hover:border-slate-300 dark:hover:border-[#37496d] outline-none focus:border-[#ff9800] focus:ring-1 focus:ring-[#ff9800] uppercase tracking-wider"
                    />
                    <button
                      type="submit"
                      disabled={isLoading || !searchInput.trim()}
                      className="h-11 px-5 w-full sm:w-28 min-w-[112px] rounded-xl font-bold text-white text-xs sm:text-sm bg-gradient-to-r from-[#ff9800] via-[#f57c00] to-[#e65100] hover:from-[#ffa726] hover:via-[#fb8c00] hover:to-[#f57c00] active:scale-[0.99] shadow-md shadow-orange-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                          <span className="shrink-0">Verifying...</span>
                        </>
                      ) : (
                        <>
                          <Search className="w-4 h-4 shrink-0" />
                          <span className="shrink-0">Verify</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 dark:text-[#9aa3b5]/70">
                  Format: <code className="text-[#ff9800] font-mono font-semibold">IND-2026-XXXX</code>
                </p>
              </form>
            </div>

            {/* Verified Details Card (Shown on Left when verified) */}
            {hasSearched && certRecord && !isLoading && (
              <div className="bg-white dark:bg-[#0b1224] border border-emerald-500/30 dark:border-emerald-500/30 rounded-2xl p-5 shadow-xl space-y-4 animate-fadeIn">
                {/* Verified Header Badge */}
                <div className="flex items-center justify-between gap-2 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400">
                        ✓ Record Verified
                      </h2>
                      <p className="text-[11px] text-emerald-800 dark:text-emerald-300 font-medium">
                        Official Identity Entry
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/30 rounded-md text-emerald-700 dark:text-emerald-300 text-[10px] font-bold font-mono">
                    VERIFIED
                  </span>
                </div>

                {/* Photo & Info */}
                <div className="flex items-start gap-4 pt-1">
                  <div className="w-24 h-32 rounded-xl overflow-hidden border-2 border-[#ff9800] bg-slate-100 dark:bg-[#0a1020] shadow-md shrink-0">
                    {certRecord.photo ? (
                      <img
                        src={certRecord.photo}
                        alt={`Photo of ${certRecord.name || certRecord.id}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-2 text-center">
                        <User className="w-8 h-8 mb-1" />
                        <span className="text-[9px]">No Photo</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2.5 min-w-0 flex-1">
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">ID Number</p>
                      <p className="text-sm font-black text-[#ff9800] font-mono">{certRecord.id}</p>
                    </div>

                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Full Name / नाम</p>
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {certRecord.name || 'N/A'}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Phone / फोन</p>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 font-mono">
                        {certRecord.phone || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Address & Date */}
                <div className="border-t border-slate-100 dark:border-[#1d2940] pt-3 space-y-2 text-xs">
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Address / पता</p>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 line-clamp-2">
                      {certRecord.address || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Registered Date / जारी तिथि</p>
                    <p className="text-xs font-medium text-slate-600 dark:text-[#9aa3b5]">
                      {formatDate(certRecord.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Always rendered with fixed size container */}
          <div className="w-full space-y-5">
            <div className="bg-white dark:bg-[#0b1224] border border-slate-200 dark:border-[#1d2940] rounded-2xl p-4 sm:p-5 shadow-lg dark:shadow-xl space-y-4 transition-colors duration-200 relative">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#1d2940] pb-3 gap-1 sm:gap-2 overflow-hidden">
                <h2 className="text-[12px] min-[360px]:text-[13.5px] sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-1.5 sm:gap-2 whitespace-nowrap min-w-0">
                  <span className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full inline-block shrink-0 shadow-sm ${certRecord ? 'bg-[#00c389] shadow-emerald-500/50' : 'bg-[#ff9800] shadow-orange-500/50'}`} />
                  <span className="truncate sm:overflow-visible">कार्ड प्रीव्यू / Preview</span>
                </h2>
                <span className="px-1.5 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-xs font-semibold text-slate-600 dark:text-[#9aa3b5] bg-slate-100 dark:bg-[#0a1020] border border-slate-200 dark:border-[#26344d] rounded-lg shrink-0 whitespace-nowrap">
                  1600 × 1000 px
                </span>
              </div>

              {/* Canvas Container with Fixed Aspect Ratio */}
              <div className="relative w-full bg-slate-100/80 dark:bg-[#0a1020] p-2 sm:p-3 rounded-xl border border-slate-200 dark:border-[#172238] overflow-hidden flex items-center justify-center">
                <canvas
                  ref={canvasRef}
                  width={1600}
                  height={1000}
                  className="w-full h-auto aspect-[16/10] rounded-lg shadow-xl dark:shadow-2xl block object-contain transition-all"
                />

                {/* Loading State Overlay */}
                {isLoading && (
                  <div className="absolute inset-0 bg-white/85 dark:bg-[#0b1224]/85 backdrop-blur-xs flex flex-col items-center justify-center space-y-3 z-10 transition-all rounded-xl p-4 text-center">
                    <Loader2 className="w-10 h-10 animate-spin text-[#ff9800]" />
                    <div>
                      <p className="text-base font-bold text-slate-900 dark:text-white">
                        Verifying certificate...
                      </p>
                      <p className="text-xs text-slate-500 dark:text-[#9aa3b5] mt-0.5">
                        Connecting to secure database record
                      </p>
                    </div>
                  </div>
                )}

                {/* Invalid Certificate Overlay */}
                {hasSearched && !isLoading && !certRecord && (
                  <div className="absolute inset-0 bg-white/95 dark:bg-[#0b1224]/95 backdrop-blur-xs flex flex-col items-center justify-center space-y-3 z-10 transition-all rounded-xl p-6 text-center">
                    <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center shadow-sm">
                      <XCircle className="w-7 h-7" />
                    </div>
                    <div className="space-y-1 max-w-xs">
                      <h3 className="text-base font-bold text-red-600 dark:text-red-400">
                        ✕ Certificate Not Found
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-[#9aa3b5]">
                        The ID <code className="text-[#ff9800] font-mono">{activeId}</code> could not be verified.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={onNavigateHome}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#ff9800] via-[#f57c00] to-[#e65100] hover:from-[#ffa726] hover:via-[#fb8c00] shadow-md transition-all inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Generate Card</span>
                    </button>
                  </div>
                )}

                {/* Initial Search Prompt Overlay */}
                {!hasSearched && !isLoading && !certRecord && (
                  <div className="absolute inset-0 bg-white/90 dark:bg-[#0b1224]/90 backdrop-blur-xs flex flex-col items-center justify-center space-y-2 z-10 transition-all rounded-xl p-6 text-center">
                    <Search className="w-9 h-9 text-[#ff9800] opacity-80" />
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      Enter a Certificate ID to Verify
                    </p>
                    <p className="text-xs text-slate-500 dark:text-[#9aa3b5] max-w-xs">
                      Enter any official ID number on the left and click Verify.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Download Button */}
            <button
              type="button"
              onClick={handleDownloadCard}
              disabled={isDownloading || !certRecord || isLoading}
              className="w-full h-12 px-6 rounded-xl font-bold text-white text-sm bg-gradient-to-r from-[#ff9800] via-[#f57c00] to-[#e65100] hover:from-[#ffa726] hover:via-[#fb8c00] hover:to-[#f57c00] active:scale-[0.99] shadow-lg shadow-orange-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin shrink-0" />
                  <span>Generating Card...</span>
                </>
              ) : (
                <>
                  <Download className="w-5 h-5 stroke-[2.5] shrink-0" />
                  <span>Download Card</span>
                </>
              )}
            </button>

            {/* Verification URL Box */}
            <div className="bg-white dark:bg-[#0b1224] border border-slate-200 dark:border-[#1d2940] rounded-2xl p-4 shadow-lg space-y-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-[#dfe2e8]">
                Verification URL
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 bg-slate-50 dark:bg-[#0a1020] border border-slate-200 dark:border-[#26344d] rounded-xl px-3.5 py-2 text-xs font-mono text-slate-800 dark:text-slate-200 truncate flex items-center min-h-[36px]">
                  <span className="truncate">{getCertificateVerificationUrl(activeId || 'IND-2026-XXXX')}</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  disabled={!activeId}
                  className="w-full sm:w-28 h-9 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-[#172238] dark:hover:bg-[#26344d] border border-slate-200 dark:border-[#26344d] rounded-xl text-xs font-semibold text-slate-900 dark:text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 min-w-[112px] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span className="text-emerald-500 shrink-0">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-[#ff9800] shrink-0" />
                      <span className="shrink-0">Copy URL</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
};
