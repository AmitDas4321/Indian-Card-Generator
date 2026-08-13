import React, { useEffect, useRef } from 'react';
import { CardData } from '../types';
import { renderCardToCanvas } from '../utils/cardRenderer';

interface CardPreviewProps {
  data: CardData;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

export const CardPreview: React.FC<CardPreviewProps> = ({ data, canvasRef }) => {
  useEffect(() => {
    if (canvasRef.current) {
      renderCardToCanvas(canvasRef.current, data);
    }
  }, [data, canvasRef]);

  return (
    <div className="bg-[#0b1224] border border-[#1d2940] rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-[#1d2940] pb-3 gap-1 sm:gap-2 overflow-hidden">
        <h2 className="text-[12px] min-[360px]:text-[13.5px] sm:text-lg font-bold text-white flex items-center gap-1.5 sm:gap-2 whitespace-nowrap min-w-0">
          <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-[#00c389] inline-block shrink-0 shadow-sm shadow-emerald-500/50" />
          <span className="truncate sm:overflow-visible">लाइव कार्ड प्रीव्यू / Live Preview</span>
        </h2>

        <span className="px-1.5 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-xs font-semibold text-[#9aa3b5] bg-[#0a1020] border border-[#26344d] rounded-lg shrink-0 whitespace-nowrap">
          1600 × 1000 px
        </span>
      </div>

      {/* Canvas preview card container */}
      <div className="relative w-full bg-[#0a1020] p-2 sm:p-3 rounded-xl border border-[#172238] overflow-hidden flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={1600}
          height={1000}
          className="w-full h-auto aspect-[16/10] rounded-lg shadow-2xl block object-contain transition-all"
        />
      </div>
    </div>
  );
};
