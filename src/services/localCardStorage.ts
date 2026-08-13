import { CardData } from '../types';

const STORAGE_KEY = 'tiranga_registered_card_data';
const LOCK_KEY = 'tiranga_card_is_locked';

export interface SavedCardData extends CardData {
  savedAt?: number;
  isLocked?: boolean;
}

/**
 * Save generated card data and lock state to browser localStorage
 */
export function saveCardLocally(card: CardData): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const payload: SavedCardData = {
      ...card,
      savedAt: Date.now(),
      isLocked: true,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    localStorage.setItem(LOCK_KEY, 'true');
    return true;
  } catch (err) {
    console.warn('Failed to save card data to localStorage:', err);
    try {
      // If full payload failed due to quota (e.g. huge photo), try saving without photo or with compressed flag
      localStorage.setItem(LOCK_KEY, 'true');
    } catch {
      // ignore
    }
    return false;
  }
}

/**
 * Retrieve locally saved card data from browser localStorage
 */
export function getLocallySavedCard(): SavedCardData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedCardData;
    if (parsed && parsed.idNumber && parsed.name) {
      return parsed;
    }
  } catch (err) {
    console.warn('Failed to read card data from localStorage:', err);
  }
  return null;
}

/**
 * Check if card inputs should be locked
 */
export function isCardLocallyLocked(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const isLocked = localStorage.getItem(LOCK_KEY) === 'true';
    if (isLocked) return true;
    const saved = getLocallySavedCard();
    return Boolean(saved && saved.isLocked);
  } catch {
    return false;
  }
}
