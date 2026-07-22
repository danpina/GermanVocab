// Kept in sync by hand with languages.js at the project root (server-side).
const LANGUAGES = [
  { code: 'DE', label: 'German', speechLocale: 'de-DE' },
  { code: 'EN', label: 'English', speechLocale: 'en-US' },
  { code: 'ES', label: 'Spanish', speechLocale: 'es-ES' },
  { code: 'FR', label: 'French', speechLocale: 'fr-FR' },
  { code: 'IT', label: 'Italian', speechLocale: 'it-IT' },
  { code: 'PT', label: 'Portuguese', speechLocale: 'pt-PT' },
  { code: 'NL', label: 'Dutch', speechLocale: 'nl-NL' },
];

function getLanguage(code) {
  return LANGUAGES.find((l) => l.code === code) || LANGUAGES[0];
}
