import React, { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { CardData } from '../types';
import { validateCardData } from '../utils/validation';
import { triggerSuccessConfetti } from '../utils/confetti';
import {
  generateAndSaveCertificate,
  getNextSequencePreview,
  CertificateRecord,
} from '../services/firebaseCertificate';
import { renderCardToCanvas } from '../utils/cardRenderer';

interface DownloadButtonProps {
  data: CardData;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onValidationError: (errors: ReturnType<typeof validateCardData>['errors']) => void;
  onCertificateGenerated?: (assignedId: string, nextPreviewId: string) => void;
}

export const DownloadButton: React.FC<DownloadButtonProps> = ({
  data,
  canvasRef,
  onValidationError,
  onCertificateGenerated,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleDownload = async () => {
    setErrorMessage(null);

    // Validate required fields
    const { isValid, errors } = validateCardData(data);
    if (!isValid) {
      onValidationError(errors);
      return;
    }

    if (!canvasRef.current) return;

    setIsGenerating(true);

    try {
      // 1. Atomically register certificate in Firebase
      const certRecord: CertificateRecord = await generateAndSaveCertificate(data);
      const assignedId = certRecord.id;

      // 2. Prepare final card data with assigned ID
      const finalCardData: CardData = {
        ...data,
        idNumber: assignedId,
      };

      // 3. Render canvas with assigned ID and matching QR code
      const canvas = canvasRef.current;
      await renderCardToCanvas(canvas, finalCardData);

      // 4. Generate high-res PNG
      const dataUrl = canvas.toDataURL('image/png', 1.0);

      // Sanitize user name for filename
      const cleanName = (data.name || 'personalized-card')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

      const fileName = `indian-card-${cleanName || 'identity'}-${assignedId}.png`;

      // Trigger automatic browser download
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Trigger download-success celebration confetti effect
      triggerSuccessConfetti(canvasRef.current);

      // 5. Fetch next preview sequence ID for form
      const nextId = await getNextSequencePreview();
      if (onCertificateGenerated) {
        onCertificateGenerated(assignedId, nextId);
      }
    } catch (err) {
      console.error('Certificate registration/download failed:', err);
      const userErr = err instanceof Error ? err.message : 'Failed to generate certificate. Please try again.';
      setErrorMessage(userErr);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleDownload}
        disabled={isGenerating}
        className="w-full py-3.5 px-6 rounded-xl font-bold text-white text-base sm:text-lg bg-gradient-to-r from-[#ff9800] via-[#f57c00] to-[#e65100] hover:from-[#ffa726] hover:via-[#fb8c00] hover:to-[#f57c00] active:scale-[0.99] shadow-lg shadow-orange-500/25 transition-all flex items-center justify-center gap-2.5 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 dark:focus-visible:ring-offset-[#020817] focus-visible:ring-[#ff9800] outline-none disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Generating & Registering Certificate...</span>
          </>
        ) : (
          <>
            <Download className="w-5 h-5 stroke-[2.5]" />
            <span>Download Card</span>
          </>
        )}
      </button>

      {errorMessage && (
        <p className="text-xs text-red-600 dark:text-red-400 font-medium text-center">
          {errorMessage}
        </p>
      )}
    </div>
  );
};
