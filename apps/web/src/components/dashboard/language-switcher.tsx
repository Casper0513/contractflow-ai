"use client";

import { Languages } from "lucide-react";

import type { SupportedLocale } from "@/i18n/config";

type LanguageSwitcherProps = {
  locale: SupportedLocale;
};

const languageOptions: Array<{
  locale: SupportedLocale;
  label: string;
}> = [
  { locale: "en", label: "English" },
  { locale: "fr", label: "Français" },
  { locale: "es", label: "Español" },
  { locale: "de", label: "Deutsch" },
  { locale: "pt", label: "Português" },
  { locale: "it", label: "Italiano" },
  { locale: "nl", label: "Nederlands" },
  { locale: "pl", label: "Polski" },
  { locale: "ja", label: "日本語" },
  { locale: "ko", label: "한국어" },
  { locale: "zh-CN", label: "简体中文" },
  { locale: "zh-TW", label: "繁體中文" },
  { locale: "ar", label: "العربية" },
  { locale: "hi", label: "हिन्दी" },
];

export function LanguageSwitcher({ locale }: LanguageSwitcherProps) {
  function handleChange(value: string) {
    document.cookie = [
      `contractflow-locale=${encodeURIComponent(value)}`,
      "Path=/",
      "Max-Age=31536000",
      "SameSite=Lax",
    ].join("; ");

    window.location.reload();
  }

  return (
    <label className="relative flex items-center" title="Language">
      <Languages className="pointer-events-none absolute left-2.5 h-4 w-4 text-muted-foreground" />

      <select
        aria-label="Language"
        value={locale}
        onChange={(event) => handleChange(event.target.value)}
        className="h-9 max-w-36 appearance-none rounded-md border bg-background py-1 pl-8 pr-7 text-sm text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
      >
        {languageOptions.map((option) => (
          <option key={option.locale} value={option.locale}>
            {option.label}
          </option>
        ))}
      </select>

      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-2 text-xs text-muted-foreground"
      >
        ▾
      </span>
    </label>
  );
}
