import { ru } from './ru.js';
import { en } from './en.js';
import type { Translations } from './types.js';

export type Locale = 'ru' | 'en';

export const translations: Record<Locale, Translations> = {
  ru,
  en,
};

export const DEFAULT_LOCALE: Locale = 'ru';

/**
 * Get the translations object for a given locale, falling back to the default.
 */
export function getT(locale: Locale | null | undefined): Translations {
  if (locale && translations[locale]) return translations[locale];
  return translations[DEFAULT_LOCALE];
}

export type { Translations } from './types.js';