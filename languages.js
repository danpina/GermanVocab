// Shared language config. Duplicated (not imported) into public/languages.js for the
// browser, since there's no build step to bundle a single shared module for ~7 entries.
export const LANGUAGES = [
  { code: 'DE', label: 'German', deeplSource: 'DE', deeplTarget: 'DE', speechLocale: 'de-DE' },
  { code: 'EN', label: 'English', deeplSource: 'EN', deeplTarget: 'EN-US', speechLocale: 'en-US' },
  { code: 'ES', label: 'Spanish', deeplSource: 'ES', deeplTarget: 'ES', speechLocale: 'es-ES' },
  { code: 'FR', label: 'French', deeplSource: 'FR', deeplTarget: 'FR', speechLocale: 'fr-FR' },
  { code: 'IT', label: 'Italian', deeplSource: 'IT', deeplTarget: 'IT', speechLocale: 'it-IT' },
  { code: 'PT', label: 'Portuguese', deeplSource: 'PT', deeplTarget: 'PT-PT', speechLocale: 'pt-PT' },
  { code: 'NL', label: 'Dutch', deeplSource: 'NL', deeplTarget: 'NL', speechLocale: 'nl-NL' },
];

export function getLanguage(code) {
  return LANGUAGES.find((l) => l.code === code) || LANGUAGES[0];
}
