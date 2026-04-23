import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import HttpBackend from "i18next-http-backend";
import LanguageDetector from "i18next-browser-languagedetector";

export type SupportedLang = "en" | "hi" | "hinglish" | "pa" | "ur" | "ta" | "mr";

export interface LangMeta {
  code: SupportedLang;
  label: string;
  nativeLabel: string;
  rtl?: boolean;
  regions: string[];
}

export const LANGUAGES: LangMeta[] = [
  { code: "en",       label: "English",   nativeLabel: "English",   regions: [] },
  { code: "hi",       label: "Hindi",     nativeLabel: "हिंदी",      regions: ["hi", "hi-IN", "bho"] },
  { code: "hinglish", label: "Hinglish",  nativeLabel: "Hinglish",  regions: [] },
  { code: "pa",       label: "Punjabi",   nativeLabel: "ਪੰਜਾਬੀ",    regions: ["pa", "pa-IN", "pa-PK"] },
  { code: "ur",       label: "Urdu",      nativeLabel: "اردو",       rtl: true, regions: ["ur", "ur-IN", "ur-PK"] },
  { code: "ta",       label: "Tamil",     nativeLabel: "தமிழ்",      regions: ["ta", "ta-IN", "ta-LK"] },
  { code: "mr",       label: "Marathi",   nativeLabel: "मराठी",     regions: ["mr", "mr-IN"] },
];

const STATE_REGION_MAP: Record<string, SupportedLang> = {
  punjab: "pa",
  haryana: "hi",
  "himachal pradesh": "hi",
  "uttar pradesh": "hi",
  uttarakhand: "hi",
  bihar: "hi",
  jharkhand: "hi",
  rajasthan: "hi",
  "madhya pradesh": "hi",
  chhattisgarh: "hi",
  delhi: "hi",
  maharashtra: "mr",
  goa: "mr",
  "tamil nadu": "ta",
  "jammu and kashmir": "ur",
};

function detectFromBrowser(): SupportedLang {
  const langs = navigator.languages ?? [navigator.language];
  for (const lang of langs) {
    const normalized = lang.toLowerCase().split("-")[0];
    const match = LANGUAGES.find((l) => l.regions.some((r) => r.startsWith(normalized)));
    if (match) return match.code;
  }
  return "en";
}

export function getSmartPriority(detected?: SupportedLang): LangMeta[] {
  const lang = detected ?? detectFromBrowser();
  const ordered: SupportedLang[] = ["en"];
  if (lang !== "en") ordered.push(lang);
  if (lang !== "hi" && lang !== "en") ordered.push("hi");
  const rest = LANGUAGES.filter((l) => !ordered.includes(l.code)).map((l) => l.code);
  return [...ordered, ...rest].map((code) => LANGUAGES.find((l) => l.code === code)!);
}

export function getLangMeta(code: string): LangMeta {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}

const STORAGE_KEY = "sevu_lang";
const storedLang = localStorage.getItem(STORAGE_KEY) as SupportedLang | null;

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    lng: storedLang ?? undefined,
    fallbackLng: "en",
    supportedLngs: LANGUAGES.map((l) => l.code),
    ns: ["translation"],
    defaultNS: "translation",
    backend: {
      loadPath: `${import.meta.env.BASE_URL}locales/{{lng}}/{{ns}}.json`,
    },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: STORAGE_KEY,
      caches: ["localStorage"],
    },
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: true,
    },
  });

export function changeLanguage(code: SupportedLang) {
  localStorage.setItem(STORAGE_KEY, code);
  i18n.changeLanguage(code);
  const meta = getLangMeta(code);
  document.documentElement.setAttribute("lang", code);
  document.documentElement.setAttribute("dir", meta.rtl ? "rtl" : "ltr");
}

const initialMeta = getLangMeta(storedLang ?? detectFromBrowser());
document.documentElement.setAttribute("lang", initialMeta.code);
document.documentElement.setAttribute("dir", initialMeta.rtl ? "rtl" : "ltr");

export default i18n;
