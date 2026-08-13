import React, { useRef, useState } from 'react';
import { Upload, Trash2, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { validatePhotoFile } from '../utils/validation';

interface PhotoUploaderProps {
  photoUrl: string | null;
  onPhotoChange: (url: string | null) => void;
  error?: string;
}

export const PhotoUploader: React.FC<PhotoUploaderProps> = ({
  photoUrl,
  onPhotoChange,
  error: externalError,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);

  const handleFileSelect = (file: File) => {
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
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
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
      <label className="block text-xs font-semibold text-[#dfe2e8]">
        पासपोर्ट फोटो / Upload Photo <span className="text-[#ff9800]">*</span>
      </label>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleChange}
        className="hidden"
        id="photo-upload-input"
        aria-label="Upload Passport Photo"
      />

      {!photoUrl ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          tabIndex={0}
          role="button"
          aria-label="Click or drag and drop photo here"
          className={`group relative flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#ff9800] ${
            isDragging
              ? 'border-[#ff9800] bg-[#ff9800]/10 scale-[0.99]'
              : displayError
              ? 'border-red-500/80 bg-red-950/10'
              : 'border-[#26344d] bg-[#0a1020] hover:border-[#ff9800] hover:bg-[#111a2d]'
          }`}
        >
          {/* Orange Circle Icon */}
          <div className="w-12 h-12 rounded-full bg-[#1e293b] group-hover:bg-[#ff9800] flex items-center justify-center text-[#ff9800] group-hover:text-white transition-all shadow-md mb-2">
            <Upload className="w-5 h-5" />
          </div>

          <p className="text-sm font-semibold text-white text-center">
            Click or drag & drop photo here
          </p>
          <p className="text-xs text-[#9aa3b5] mt-0.5">
            JPG, PNG, WEBP (Max 10MB)
          </p>
        </div>
      ) : (
        /* Preview uploaded photo */
        <div className="relative flex items-center justify-between p-3 rounded-xl bg-[#0a1020] border border-[#26344d]">
          <div className="flex items-center gap-3">
            <div className="w-14 h-16 rounded-lg overflow-hidden border border-[#ff9800] bg-black shrink-0">
              <img
                src={photoUrl}
                alt="Passport preview"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <p className="text-xs font-semibold text-white flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-[#00c389]" /> Photo Uploaded
              </p>
              <p className="text-[11px] text-[#9aa3b5] mt-0.5">
                Ready for identity card
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-2.5 py-1 text-xs font-medium text-[#dfe2e8] bg-[#172238] hover:bg-[#26344d] rounded-lg transition-colors border border-[#26344d]"
            >
              Change
            </button>
            <button
              type="button"
              onClick={handleRemove}
              aria-label="Remove photo"
              className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {displayError && (
        <p className="text-xs text-red-400 flex items-center gap-1 mt-1 font-medium">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {displayError}
        </p>
      )}
    </div>
  );
};
