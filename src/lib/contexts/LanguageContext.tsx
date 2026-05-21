"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language, translations } from '../translations';

interface LanguageContextProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, replacements?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextProps | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Read from localStorage on mount
    const savedLang = localStorage.getItem('user_language') as Language;
    if (savedLang && (savedLang === 'en' || savedLang === 'gu' || savedLang === 'hi')) {
      setLanguageState(savedLang);
    }
    setMounted(true);
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('user_language', lang);
    }
  };

  const t = (key: string, replacements?: Record<string, string | number>): string => {
    // If not mounted yet, default to 'en' dictionary
    const activeLanguage = mounted ? language : 'en';
    
    // Get translation from active language or fallback to 'en' or key itself
    let text = translations[activeLanguage]?.[key] || translations['en']?.[key] || key;
    
    // Process replacements if any (e.g. {name})
    if (replacements) {
      Object.entries(replacements).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    
    return text;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
