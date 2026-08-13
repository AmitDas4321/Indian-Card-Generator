import React, { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { CardData } from '../types';
import { validateCardData } from '../utils/validation';
import { triggerSuccessConfetti } from '../utils/confetti';

interface DownloadButtonProps {
  data: CardData;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onValidationError: (errors: ReturnType<typeof validateCardData>['errors']) => void;
}

export const DownloadButton: React.FC<DownloadButtonProps> = ({
  data,
  canvasRef,
  onValidationError,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownload = async () => {
    // Validate required fields
    const { isValid, errors } = validateCardData(data);
    if (!isValid) {
      onValidationError(errors);
      return;
    }

    if (!canvasRef.current) return;

    setIsGenerating(true);

    try {
      // Short timeout to show loading state smoothly
      await new Promise((resolve) => setTimeout(resolve, 300));

      const canvas = canvasRef.current;
      const dataUrl = canvas.toDataURL('image/png', 1.0);

      // Sanitize user name for filename
      const cleanName = (data.name || 'personalized-card')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

      const fileName = `indian-card-${cleanName || 'identity'}.png`;

      // Trigger automatic browser download
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Trigger download-success celebration confetti effect from top of card
      triggerSuccessConfetti(canvasRef.current);
    } catch (err) {
      console.error('Failed to generate PNG:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={isGenerating}
      className="w-full py-3.5 px-6 rounded-xl font-bold text-white text-base sm:text-lg bg-gradient-to-r from-[#ff9800] via-[#f57c00] to-[#e65100] hover:from-[#ffa726] hover:via-[#fb8c00] hover:to-[#f57c00] active:scale-[0.99] shadow-lg shadow-orange-500/25 transition-all flex items-center justify-center gap-2.5 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 dark:focus-visible:ring-offset-[#020817] focus-visible:ring-[#ff9800] outline-none disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer"
    >
      {isGenerating ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Generating Card...</span>
        </>
      ) : (
        <>
          <Download className="w-5 h-5 stroke-[2.5]" />
          <span>Download Card</span>
        </>
      )}
    </button>
  );
};
