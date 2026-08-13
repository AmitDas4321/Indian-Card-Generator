import React, { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, ShieldCheck, ArrowLeft, AlertCircle, Loader2 } from 'lucide-react';
import { adminLogin } from '../../services/adminService';

interface AdminLoginProps {
  onLoginSuccess: () => void;
  onNavigateHome: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLoginSuccess, onNavigateHome }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockoutSeconds, setLockoutSeconds] = useState<number | null>(null);

  useEffect(() => {
    if (lockoutSeconds === null || lockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev === null || prev <= 1) return null;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || loading || lockoutSeconds !== null) return;

    setError(null);
    setLoading(true);

    try {
      const res = await adminLogin(password);
      if (res.success) {
        onLoginSuccess();
      } else {
        setError(res.error || 'Invalid credentials');
        if (res.error && res.error.includes('Too many failed')) {
          setLockoutSeconds(900); // 15 minutes lockout fallback
        }
      }
    } catch (err: any) {
      setError('An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#040814] text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden selection:bg-[#FF9933] selection:text-black">
      {/* Background Indian Aesthetic Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#FF9933]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-96 h-96 bg-[#138808]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Navigation */}
      <div className="w-full max-w-md mb-6 flex items-center justify-between z-10">
        <button
          id="btn-admin-back-home"
          type="button"
          onClick={onNavigateHome}
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-800/60"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Card Generator</span>
        </button>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-md bg-[#0B1224] border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl relative z-10 backdrop-blur-sm">
        {/* Tiranga Top Border */}
        <div className="absolute top-0 left-0 right-0 h-1.5 rounded-t-2xl flex overflow-hidden">
          <div className="h-full flex-1 bg-[#FF9933]" />
          <div className="h-full flex-1 bg-white" />
          <div className="h-full flex-1 bg-[#138808]" />
        </div>

        {/* Icon & Title */}
        <div className="text-center mb-7 mt-2">
          <div className="w-14 h-14 mx-auto mb-3.5 bg-gradient-to-b from-[#0F1D38] to-[#080E1C] border border-slate-700/60 rounded-2xl flex items-center justify-center shadow-inner">
            <ShieldCheck className="w-7 h-7 text-[#FF9933]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
            <span>Admin Portal</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Indian Card Generator Secure Control Center
          </p>
        </div>

        {/* Error Notification */}
        {error && (
          <div
            id="admin-login-error"
            className="mb-5 p-3.5 rounded-xl bg-red-950/40 border border-red-800/60 flex items-start gap-3 text-red-200 text-sm animate-fade-in"
          >
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs sm:text-sm leading-snug">
              {error}
              {lockoutSeconds !== null && lockoutSeconds > 0 && (
                <div className="mt-1 font-semibold text-red-300">
                  Cooling down: {Math.floor(lockoutSeconds / 60)}m {lockoutSeconds % 60}s
                </div>
              )}
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="admin-password-input"
              className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2"
            >
              Admin Master Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="admin-password-input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter server admin password"
                disabled={loading || lockoutSeconds !== null}
                required
                autoFocus
                autoComplete="current-password"
                className="w-full bg-[#050B17] border border-slate-700/80 rounded-xl pl-10 pr-11 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#FF9933] focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 focus:outline-none transition-colors"
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            id="btn-admin-submit-login"
            type="submit"
            disabled={loading || !password.trim() || lockoutSeconds !== null}
            className="w-full bg-gradient-to-r from-[#FF9933] to-[#E68A00] hover:from-[#FFA742] hover:to-[#FF9933] text-slate-950 font-bold py-3 px-4 rounded-xl shadow-lg shadow-orange-950/30 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-orange-900/40 active:scale-[0.99] mt-2 text-sm"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                <span>Authenticating...</span>
              </>
            ) : (
              <span>Sign In to Dashboard</span>
            )}
          </button>
        </form>

        {/* Security Notice */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 text-center">
          <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
            <Lock className="w-3 h-3 text-[#138808]" />
            <span>Protected by server-side brute force prevention & session tokens</span>
          </p>
        </div>
      </div>
    </div>
  );
};
