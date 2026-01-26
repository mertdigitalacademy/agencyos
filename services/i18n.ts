import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { readOnboardingState, writeOnboardingState, type Language } from './onboarding';

type I18nContextValue = {
  language: Language;
  setLanguage: (next: Language) => void;
  tt: (en: string, tr: string) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider(props: { children: React.ReactNode }) {
  const initial = useMemo(() => {
    try {
      return readOnboardingState().language;
    } catch {
      return 'tr' as Language;
    }
  }, []);

  const [language, setLanguageState] = useState<Language>(initial);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    writeOnboardingState({ language: next });
  }, []);

  const tt = useCallback(
    (en: string, tr: string) => (language === 'tr' ? tr : en),
    [language],
  );

  const value = useMemo(() => ({ language, setLanguage, tt }), [language, setLanguage, tt]);

  return React.createElement(I18nContext.Provider, { value }, props.children);
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}
