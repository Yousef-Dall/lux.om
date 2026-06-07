import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import { type Language, translations } from './translations';

type TranslationDictionary = (typeof translations)[Language];

type LanguageContextValue = {
  language: Language;
  direction: 'ltr' | 'rtl';
  isRtl: boolean;
  t: TranslationDictionary;
  toggleLanguage: () => void;
  setLanguage: (language: Language) => void;
};

const STORAGE_KEY = 'lux-language';

const LanguageContext = createContext<LanguageContextValue | null>(null);

function isSupportedLanguage(value: string | null): value is Language {
  return value === 'en' || value === 'ar';
}

function safelyGetStoredLanguage(): Language | null {
  try {
    const savedLanguage = window.localStorage.getItem(STORAGE_KEY);
    return isSupportedLanguage(savedLanguage) ? savedLanguage : null;
  } catch {
    return null;
  }
}

function safelySetStoredLanguage(language: Language) {
  try {
    window.localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Ignore storage errors. The app should still work even if storage is unavailable.
  }
}

function getInitialLanguage(): Language {
  if (typeof window === 'undefined') {
    return 'en';
  }

  const storedLanguage = safelyGetStoredLanguage();

  if (storedLanguage) {
    return storedLanguage;
  }

  const browserLanguage = window.navigator.language.toLowerCase();

  return browserLanguage.startsWith('ar') ? 'ar' : 'en';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  const isRtl = language === 'ar';
  const direction: 'ltr' | 'rtl' = isRtl ? 'rtl' : 'ltr';

  const setLanguage = useCallback((nextLanguage: Language) => {
    setLanguageState(nextLanguage);
    safelySetStoredLanguage(nextLanguage);
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguageState((currentLanguage) => {
      const nextLanguage: Language = currentLanguage === 'en' ? 'ar' : 'en';
      safelySetStoredLanguage(nextLanguage);
      return nextLanguage;
    });
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = direction;
    document.documentElement.dataset.language = language;
    document.documentElement.classList.toggle('is-rtl', isRtl);
    document.documentElement.classList.toggle('is-ltr', !isRtl);
  }, [language, direction, isRtl]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      direction,
      isRtl,
      t: translations[language],
      toggleLanguage,
      setLanguage
    }),
    [language, direction, isRtl, toggleLanguage, setLanguage]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error('useLanguage must be used inside LanguageProvider');
  }

  return context;
}