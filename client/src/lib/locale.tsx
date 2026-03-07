import { createContext, useContext, useMemo, useState, type ReactNode } from "react"
import { translations } from "./translations"

const STORAGE_KEY = "roberto-locale"

export type Locale = "en" | "tl"

type LocaleContextType = {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: string) => string
}

const LocaleContext = createContext<LocaleContextType | null>(null)

const isLocale = (value: string | null): value is Locale => value === "en" || value === "tl"

const getInitialLocale = (): Locale => {
  const stored = localStorage.getItem(STORAGE_KEY)
  return isLocale(stored) ? stored : "en"
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale)

  const setLocale = (next: Locale) => {
    setLocaleState(next)
    localStorage.setItem(STORAGE_KEY, next)
  }

  const value = useMemo<LocaleContextType>(() => {
    const dict = translations[locale] as Record<string, string>
    const fallback = translations.en as Record<string, string>
    const t = (key: string): string => dict[key] ?? fallback[key] ?? key
    return { locale, setLocale, t }
  }, [locale])

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale(): LocaleContextType {
  const context = useContext(LocaleContext)
  if (!context) {
    throw new Error("useLocale must be used within LocaleProvider")
  }
  return context
}
