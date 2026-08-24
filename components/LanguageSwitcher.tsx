"use client";
import { languageNames, languages, useI18n } from "../lib/i18n";
export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage, t } = useI18n();
  return <label className="inline-flex items-center gap-2 text-sm text-slate-600">
    {!compact && <span>{t("Sprache")}</span>}
    <select aria-label={t("Sprache")} value={language} onChange={(event) => setLanguage(event.target.value as typeof language)} className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-800">
      {languages.map((code) => <option key={code} value={code}>{languageNames[code]}</option>)}
    </select>
  </label>;
}
