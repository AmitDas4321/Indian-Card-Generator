import React, { useEffect, useRef } from 'react';
import { Trash2 } from 'lucide-react';
import { CardData, FormErrors } from '../types';
import { PhotoUploader } from './PhotoUploader';

interface CardFormProps {
  data: CardData;
  onChange: (newData: CardData) => void;
  onClear: () => void;
  errors: FormErrors;
}

export const CardForm: React.FC<CardFormProps> = ({
  data,
  onChange,
  onClear,
  errors,
}) => {
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const idInputRef = useRef<HTMLInputElement | null>(null);
  const phoneInputRef = useRef<HTMLInputElement | null>(null);
  const addressInputRef = useRef<HTMLTextAreaElement | null>(null);

  const dataRef = useRef(data);
  dataRef.current = data;

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Sync autofill values seamlessly when browser autofills inputs without triggering React synthetic events
  useEffect(() => {
    const checkAndSync = () => {
      const currentData = dataRef.current;
      let nextData: CardData | null = null;

      const checkField = (
        ref: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>,
        field: keyof CardData,
        sanitize?: (val: string) => string
      ) => {
        if (ref.current) {
          let domValue = ref.current.value;
          if (sanitize) {
            domValue = sanitize(domValue);
          }
          const reactValue = (currentData[field] as string) || '';
          if (domValue !== reactValue) {
            if (!nextData) {
              nextData = { ...currentData };
            }
            (nextData[field] as string) = domValue;
          }
        }
      };

      checkField(nameInputRef, 'name');
      checkField(idInputRef, 'idNumber');
      checkField(phoneInputRef, 'phoneNumber', (v) => v.replace(/\D/g, '').slice(0, 10));
      checkField(addressInputRef, 'address');

      if (nextData) {
        onChangeRef.current(nextData);
      }
    };

    // Immediate sync check on mount
    checkAndSync();

    const elements = [
      nameInputRef.current,
      idInputRef.current,
      phoneInputRef.current,
      addressInputRef.current,
    ].filter(Boolean) as (HTMLInputElement | HTMLTextAreaElement)[];

    const handleEvent = () => checkAndSync();

    elements.forEach((el) => {
      el.addEventListener('animationstart', handleEvent);
      el.addEventListener('input', handleEvent);
      el.addEventListener('change', handleEvent);
      el.addEventListener('blur', handleEvent);
      el.addEventListener('focus', handleEvent);
    });

    // Fallback polling interval to catch silent browser DOM updates during autofill
    const intervalId = setInterval(checkAndSync, 200);

    return () => {
      clearInterval(intervalId);
      elements.forEach((el) => {
        el.removeEventListener('animationstart', handleEvent);
        el.removeEventListener('input', handleEvent);
        el.removeEventListener('change', handleEvent);
        el.removeEventListener('blur', handleEvent);
        el.removeEventListener('focus', handleEvent);
      });
    };
  }, []);

  const handleChange = (
    field: keyof CardData,
    value: string | null
  ) => {
    onChange({
      ...data,
      [field]: value,
    });
  };

  return (
    <div className="bg-[#0b1224] border border-[#1d2940] rounded-2xl p-5 shadow-xl space-y-4">
      {/* Header with Title & Clear Button */}
      <div className="flex items-start justify-between border-b border-[#1d2940] pb-3.5">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff9800] inline-block shrink-0 shadow-sm shadow-orange-500/50" />
            Enter Details
          </h2>
          <p className="text-xs text-[#9aa3b5] mt-0.5">
            Fill in your details below to see live card preview
          </p>
        </div>

        <button
          type="button"
          onClick={onClear}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#dfe2e8] hover:text-white bg-[#172238] hover:bg-[#26344d] border border-[#26344d] rounded-lg transition-all focus-visible:ring-2 focus-visible:ring-[#ff9800] outline-none"
          title="Clear form inputs"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear</span>
        </button>
      </div>

      <div className="space-y-4">
        {/* Photo Upload */}
        <PhotoUploader
          photoUrl={data.photoUrl}
          onPhotoChange={(url) => handleChange('photoUrl', url)}
          error={errors.photo}
        />

        {/* Name Input */}
        <div className="space-y-1">
          <label htmlFor="name-input" className="block text-xs font-semibold text-[#dfe2e8]">
            Name <span className="text-[#ff9800]">*</span>
          </label>
          <input
            ref={nameInputRef}
            id="name-input"
            name="name"
            autoComplete="name"
            type="text"
            value={data.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="e.g. Rahul Sharma"
            className={`w-full h-10 px-3 bg-[#0a1020] text-sm text-white placeholder-[#9aa3b5]/60 rounded-xl border transition-all outline-none focus:border-[#ff9800] focus:ring-1 focus:ring-[#ff9800] ${
              errors.name ? 'border-red-500/80 bg-red-950/10' : 'border-[#26344d] hover:border-[#37496d]'
            }`}
          />
          {errors.name && (
            <p className="text-xs text-red-400 mt-1 font-medium">{errors.name}</p>
          )}
        </div>

        {/* ID Number Input */}
        <div className="space-y-1">
          <label htmlFor="id-input" className="block text-xs font-semibold text-[#dfe2e8]">
            ID No. <span className="text-[#ff9800]">*</span>
          </label>
          <input
            ref={idInputRef}
            id="id-input"
            name="idNumber"
            autoComplete="off"
            type="text"
            value={data.idNumber}
            onChange={(e) => handleChange('idNumber', e.target.value)}
            placeholder="IND-2026-7890"
            className={`w-full h-10 px-3 bg-[#0a1020] text-sm text-white placeholder-[#9aa3b5]/60 rounded-xl border transition-all outline-none focus:border-[#ff9800] focus:ring-1 focus:ring-[#ff9800] ${
              errors.idNumber ? 'border-red-500/80 bg-red-950/10' : 'border-[#26344d] hover:border-[#37496d]'
            }`}
          />
          {errors.idNumber && (
            <p className="text-xs text-red-400 mt-1 font-medium">{errors.idNumber}</p>
          )}
        </div>

        {/* Phone Number Input */}
        <div className="space-y-1">
          <label htmlFor="phone-input" className="block text-xs font-semibold text-[#dfe2e8]">
            Phone Number <span className="text-[#9aa3b5] font-normal">(Optional / 10 Digits)</span>
          </label>
          <input
            ref={phoneInputRef}
            id="phone-input"
            name="phoneNumber"
            autoComplete="tel"
            type="tel"
            maxLength={10}
            value={data.phoneNumber}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '');
              handleChange('phoneNumber', val);
            }}
            placeholder="e.g. 9876543210 (10 digits)"
            className={`w-full h-10 px-3 bg-[#0a1020] text-sm text-white placeholder-[#9aa3b5]/60 rounded-xl border transition-all outline-none focus:border-[#ff9800] focus:ring-1 focus:ring-[#ff9800] ${
              errors.phoneNumber ? 'border-red-500/80 bg-red-950/10' : 'border-[#26344d] hover:border-[#37496d]'
            }`}
          />
          {errors.phoneNumber && (
            <p className="text-xs text-red-400 mt-1 font-medium">{errors.phoneNumber}</p>
          )}
        </div>

        {/* Address Input */}
        <div className="space-y-1">
          <label htmlFor="address-input" className="block text-xs font-semibold text-[#dfe2e8]">
            Address <span className="text-[#ff9800]">*</span>
          </label>
          <textarea
            ref={addressInputRef}
            id="address-input"
            name="address"
            autoComplete="street-address"
            rows={3}
            value={data.address}
            onChange={(e) => handleChange('address', e.target.value)}
            placeholder="e.g. New Delhi, Delhi"
            className={`w-full p-3 bg-[#0a1020] text-sm text-white placeholder-[#9aa3b5]/60 rounded-xl border transition-all outline-none resize-none focus:border-[#ff9800] focus:ring-1 focus:ring-[#ff9800] ${
              errors.address ? 'border-red-500/80 bg-red-950/10' : 'border-[#26344d] hover:border-[#37496d]'
            }`}
          />
          {errors.address && (
            <p className="text-xs text-red-400 mt-1 font-medium">{errors.address}</p>
          )}
        </div>
      </div>
    </div>
  );
};

