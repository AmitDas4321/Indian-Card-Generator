import React from 'react';
import { ExternalLink, Instagram, Facebook } from 'lucide-react';

export const SocialPromo: React.FC = () => {
  return (
    <a
      href="https://www.blueorbitdevs.org"
      target="_blank"
      rel="noopener noreferrer"
      className="group block w-full bg-white dark:bg-[#000000] hover:bg-slate-50 dark:hover:bg-[#080d19] border border-slate-200 dark:border-[#172238] hover:border-[#ff9800]/60 dark:hover:border-[#ff9800]/50 rounded-2xl p-5 text-center transition-all shadow-md dark:shadow-xl focus-visible:ring-2 focus-visible:ring-[#ff9800] outline-none"
    >
      <div className="flex flex-col items-center justify-center gap-2.5">
        {/* Social Icons Badge */}
        <div className="flex items-center gap-2 p-1.5 px-3 rounded-full bg-slate-100 dark:bg-[#111a2d] border border-slate-200 dark:border-[#26344d]">
          <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] flex items-center justify-center text-white shrink-0">
            <Instagram className="w-3.5 h-3.5" />
          </div>
          <div className="w-5 h-5 rounded-md bg-[#1877f2] flex items-center justify-center text-white shrink-0">
            <Facebook className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Headline */}
        <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
          Instagram & Facebook Followers, Likes, Views
        </h3>

        {/* CTA Link in Devanagari */}
        <p className="text-sm font-bold text-[#ff9800] group-hover:text-[#f57c00] dark:group-hover:text-[#ffa726] flex items-center gap-1.5 transition-colors">
          <span>बढ़ाने के लिए यहाँ जाएँ</span>
          <ExternalLink className="w-4 h-4 stroke-[2.5]" />
        </p>
      </div>
    </a>
  );
};
