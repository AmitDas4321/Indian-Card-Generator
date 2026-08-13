import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-[#060b18] border-t border-[#1d2940] py-4 px-4 mt-8">
      <div className="max-w-[1080px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#9aa3b5]">
        {/* Left */}
        <div className="flex items-center justify-center gap-1 font-medium text-center">
          Made with <span className="text-red-500 animate-pulse">❤️</span> for India • जय हिंद <span className="font-bold text-white">IN</span>
        </div>

        {/* Right */}
        <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 font-medium text-center">
          <span className="whitespace-nowrap">Pure Client Side</span>
          <span>•</span>
          <a
            href="https://www.blueorbitdevs.org"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[#ff9800] hover:underline font-bold transition-colors whitespace-nowrap"
          >
            <img
              src="./assets/brand-logo.png"
              alt="BlueOrbit Devs Logo"
              className="w-4 h-4 object-contain shrink-0"
              referrerPolicy="no-referrer"
            />
            <span>BlueOrbit Devs (www.blueorbitdevs.org)</span>
          </a>
        </div>
      </div>
    </footer>
  );
};

