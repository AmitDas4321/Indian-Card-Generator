import React from 'react';
import { ShieldCheck } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="w-full bg-white/80 dark:bg-[#0b1224]/80 backdrop-blur-md border-b border-slate-200/80 dark:border-[#1d2940] sticky top-0 z-30 shadow-xs dark:shadow-none transition-colors duration-200">
      {/* Decorative Top Tricolor Bar */}
      <div className="h-[4px] w-full bg-gradient-to-r from-[#ff9933] via-white dark:via-white to-[#138808]" />

      <div className="max-w-[1080px] mx-auto px-4 py-3 sm:py-4 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Left: Branding & Tagline */}
        <div className="flex items-center gap-3.5 text-center sm:text-left">
          {/* Orange Icon Badge */}
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-[#ff9800] to-[#f57c00] flex items-center justify-center text-white shadow-lg shadow-orange-500/20 shrink-0">
            {/* Ashoka Chakra Wheel Icon */}
            <svg
              className="w-7 h-7 text-white animate-spin-slow"
              viewBox="0 0 100 100"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
            >
              <circle cx="50" cy="50" r="42" />
              <circle cx="50" cy="50" r="8" fill="currentColor" />
              {Array.from({ length: 24 }).map((_, i) => (
                <line
                  key={i}
                  x1="50"
                  y1="50"
                  x2={50 + 42 * Math.cos((i * Math.PI * 2) / 24)}
                  y2={50 + 42 * Math.sin((i * Math.PI * 2) / 24)}
                />
              ))}
            </svg>
          </div>

          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center justify-center sm:justify-start gap-2">
              Indian Card Generator
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-[#dfe2e8] font-medium">
              Create your personalized card instantly <span className="text-[#ff9800]">•</span> मेरा भारत, मेरी पहचान
            </p>
          </div>
        </div>

        {/* Right: Security Badge (Desktop only) */}
        <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 text-xs sm:text-sm font-semibold shadow-xs">
          <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>100% Browser-Based Security & Privacy</span>
        </div>
      </div>
    </header>
  );
};
