import { CardData, FormErrors } from '../types';

export function validateCardData(data: CardData): { isValid: boolean; errors: FormErrors } {
  const errors: FormErrors = {};

  if (!data.photoUrl) {
    errors.photo = 'Please upload a passport photo.';
  }

  if (!data.name || !data.name.trim()) {
    errors.name = 'Please enter your name.';
  }

  if (!data.idNumber || !data.idNumber.trim()) {
    errors.idNumber = 'Please enter an ID number.';
  }

  if (!data.address || !data.address.trim()) {
    errors.address = 'Please enter an address.';
  }

  if (data.phoneNumber && data.phoneNumber.trim().length > 0) {
    const cleanPhone = data.phoneNumber.replace(/[\s\-\(\)]/g, '');
    if (!/^\d{10}$/.test(cleanPhone)) {
      errors.phoneNumber = 'Phone number must contain exactly 10 digits.';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validatePhotoFile(file: File): { isValid: boolean; error?: string } {
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  if (!validTypes.includes(file.type)) {
    return { isValid: false, error: 'Invalid file type. Please upload JPG, PNG, or WEBP.' };
  }

  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    return { isValid: false, error: 'File size exceeds 10MB limit.' };
  }

  return { isValid: true };
}
