// Locale helpers shared by visibility providers ("en-IN" → country IN / India, language English).

const COUNTRY_NAMES: Record<string, string> = {
  IN: "India", US: "the United States", GB: "the United Kingdom", AE: "the United Arab Emirates", SG: "Singapore",
  AU: "Australia", CA: "Canada", DE: "Germany", FR: "France", NZ: "New Zealand", IE: "Ireland", ZA: "South Africa",
  MY: "Malaysia", PH: "the Philippines", ID: "Indonesia", SA: "Saudi Arabia", NG: "Nigeria", KE: "Kenya", BD: "Bangladesh",
  PK: "Pakistan", LK: "Sri Lanka", NP: "Nepal", ES: "Spain", IT: "Italy", NL: "the Netherlands", BR: "Brazil", MX: "Mexico", JP: "Japan",
};
const LANGUAGE_NAMES: Record<string, string> = {
  en: "English", hi: "Hindi", ta: "Tamil", te: "Telugu", mr: "Marathi", bn: "Bengali", gu: "Gujarati", kn: "Kannada", ml: "Malayalam",
  de: "German", fr: "French", es: "Spanish", it: "Italian", pt: "Portuguese", nl: "Dutch", ar: "Arabic", ja: "Japanese",
};

export function describeLocale(locale: string | undefined): { country?: string; countryName?: string; language?: string; languageName?: string } {
  const m = /^([a-zA-Z]{2,3})(?:[-_]([a-zA-Z]{2}))?$/.exec((locale ?? "").trim());
  if (!m) return {};
  const language = m[1].toLowerCase();
  const country = m[2]?.toUpperCase();
  return {
    language,
    languageName: LANGUAGE_NAMES[language],
    country,
    countryName: country ? (COUNTRY_NAMES[country] ?? country) : undefined,
  };
}
