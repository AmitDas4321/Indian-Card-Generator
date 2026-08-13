import React, { useRef, useState } from 'react';
import { Upload, Trash2, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { validatePhotoFile } from '../utils/validation';

interface PhotoUploaderProps {
  photoUrl: string | null;
  onPhotoChange: (url: string | null) => void;
  error?: string;
  disabled?: boolean;
}

export const PhotoUploader: React.FC<PhotoUploaderProps> = ({
  photoUrl,
  onPhotoChange,
  error: externalError,
  disabled = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);

  const handleFileSelect = (file: File) => {
    if (disabled) return;
    setInternalError(null);
    const validation = validatePhotoFile(file);
    if (!validation.isValid) {
      setInternalError(validation.error || 'Invalid file');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onPhotoChange(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    if (disabled) return;
    e.stopPropagation();
    onPhotoChange(null);
    setInternalError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const displayError = externalError || internalError;

  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-slate-700 dark:text-[#dfe2e8]">
        पासपोर्ट फोटो / Upload Photo <span className="text-[#ff9800]">*</span>
      </label>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleChange}
        disabled={disabled}
        className="hidden"
        id="photo-upload-input"
        aria-label="Upload Passport Photo"
      />

      {!photoUrl ? (
        <div
          onClick={() => {
            if (!disabled) fileInputRef.current?.click();
          }}
          onKeyDown={(e) => {
            if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          tabIndex={disabled ? -1 : 0}
          role="button"
          aria-label="Click or drag and drop photo here"
          className={`group relative flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed transition-all outline-none ${
            disabled
              ? 'opacity-60 cursor-not-allowed border-slate-300 dark:border-[#26344d] bg-slate-100/60 dark:bg-[#0a1020]/60'
              : isDragging
              ? 'border-[#ff9800] bg-[#ff9800]/10 scale-[0.99] cursor-pointer focus-visible:ring-2 focus-visible:ring-[#ff9800]'
              : displayError
              ? 'border-red-500/80 bg-red-50/50 dark:bg-red-950/10 cursor-pointer focus-visible:ring-2 focus-visible:ring-[#ff9800]'
              : 'border-slate-300 dark:border-[#26344d] bg-slate-50 dark:bg-[#0a1020] hover:border-[#ff9800] hover:bg-orange-50/50 dark:hover:bg-[#111a2d] cursor-pointer focus-visible:ring-2 focus-visible:ring-[#ff9800]'
          }`}
        >
          {/* Orange Circle Icon */}
          <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-[#1e293b] group-hover:bg-[#ff9800] flex items-center justify-center text-[#ff9800] group-hover:text-white transition-all shadow-md mb-2">
            <Upload className="w-5 h-5" />
          </div>

          <p className="text-sm font-semibold text-slate-900 dark:text-white text-center">
            Click or drag & drop photo here
          </p>
          <p className="text-xs text-slate-500 dark:text-[#9aa3b5] mt-0.5">
            JPG, PNG, WEBP (Max 10MB)
          </p>
        </div>
      ) : (
        /* Preview uploaded photo */
        <div className="relative flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-[#0a1020] border border-slate-200 dark:border-[#26344d]">
          <div className="flex items-center gap-3">
            <div className="w-14 h-16 rounded-lg overflow-hidden border border-[#ff9800] bg-black shrink-0">
              <img
                src={photoUrl}
                alt="Passport preview"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-[#00c389]" /> Photo Uploaded
              </p>
              <p className="text-[11px] text-slate-500 dark:text-[#9aa3b5] mt-0.5">
                {disabled ? 'Card Photo Locked' : 'Ready for identity card'}
              </p>
            </div>
          </div>

          {!disabled && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-[#dfe2e8] bg-slate-200 hover:bg-slate-300 dark:bg-[#172238] dark:hover:bg-[#26344d] rounded-lg transition-colors border border-slate-300 dark:border-[#26344d] cursor-pointer"
              >
                Change
              </button>
              <button
                type="button"
                onClick={handleRemove}
                aria-label="Remove photo"
                className="p-1.5 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-100 dark:hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {displayError && (
        <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1 mt-1 font-medium">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {displayError}
        </p>
      )}
    </div>
  );
};
