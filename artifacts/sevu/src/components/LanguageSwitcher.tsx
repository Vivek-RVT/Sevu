import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Globe, ChevronDown, ChevronUp, Check } from "lucide-react";
import { LANGUAGES, getSmartPriority, changeLanguage, type SupportedLang } from "@/lib/i18n";

interface LanguageSwitcherProps {
  compact?: boolean;
}

export function LanguageSwitcher({ compact = false }: LanguageSwitcherProps) {
  const { t, i18n } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  const [saved, setSaved] = useState(false);

  const current = i18n.language as SupportedLang;
  const prioritized = getSmartPriority(current);
  const visible = showAll ? LANGUAGES : prioritized.slice(0, 3);

  const handleSelect = (code: SupportedLang) => {
    changeLanguage(code);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  if (compact) {
    return (
      <div className="relative inline-block">
        <select
          value={current}
          onChange={(e) => handleSelect(e.target.value as SupportedLang)}
          className="appearance-none bg-muted border border-border rounded-lg pl-8 pr-6 py-1.5 text-sm text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.nativeLabel}
            </option>
          ))}
        </select>
        <Globe className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Globe className="w-4 h-4 text-muted-foreground" />
        <p className="text-sm font-medium text-muted-foreground">{t("language.switch_prompt")}</p>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {visible.map((lang) => {
          const isActive = current === lang.code;
          return (
            <button
              key={lang.code}
              onClick={() => handleSelect(lang.code)}
              className={[
                "flex items-center justify-between w-full px-4 py-3 rounded-xl border text-left transition-all duration-150",
                isActive
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted",
              ].join(" ")}
            >
              <div className="flex items-center gap-3">
                <span
                  className="text-base font-medium leading-none"
                  style={{ fontFamily: lang.code === "ur" ? "serif" : undefined }}
                >
                  {lang.nativeLabel}
                </span>
                {lang.label !== lang.nativeLabel && (
                  <span className="text-xs text-muted-foreground">{lang.label}</span>
                )}
              </div>
              {isActive && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => setShowAll((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
      >
        {showAll ? (
          <>
            <ChevronUp className="w-3.5 h-3.5" />
            {t("settings.fewer_languages")}
          </>
        ) : (
          <>
            <ChevronDown className="w-3.5 h-3.5" />
            {t("settings.more_languages")} ({LANGUAGES.length - 3})
          </>
        )}
      </button>

      {saved && (
        <p className="text-xs text-secondary font-medium animate-pulse">
          {t("settings.language_saved")}
        </p>
      )}
    </div>
  );
}
