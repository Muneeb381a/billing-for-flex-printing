import { createContext, useContext, useState, useEffect } from 'react';
import en from './en.json';
import ur from './ur.json';

const TRANSLATIONS = { en, ur };

export const LanguageContext = createContext(null);

export const LanguageProvider = ({ children }) => {
  const [lang, setLangState] = useState(() => localStorage.getItem('lang') || 'en');

  const setLang = (next) => {
    setLangState(next);
    localStorage.setItem('lang', next);
  };

  useEffect(() => {
    const isRTL = lang === 'ur';
    document.documentElement.lang = lang;
    document.documentElement.dir  = isRTL ? 'rtl' : 'ltr';
  }, [lang]);

  const t = (key) => TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS.en[key] ?? key;

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, isRTL: lang === 'ur' }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be inside LanguageProvider');
  return ctx;
};
