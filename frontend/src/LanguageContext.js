import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from './translations';

const LanguageContext = createContext();

export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within LanguageProvider');
  }
  return context;
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    // Get language from localStorage or default to English
    return localStorage.getItem('appLanguage') || 'en';
  });

  const changeLanguage = (newLanguage) => {
    setLanguage(newLanguage);
    localStorage.setItem('appLanguage', newLanguage);
  };

  const t = (key) => {
    return translations[language]?.[key] || translations['en'][key] || key;
  };

  // Function to translate checklist items
  const tItem = (itemText) => {
    if (!itemText) return itemText;
    
    // Try to find exact match in checklist items
    const translated = translations[language]?.checklistItems?.[itemText];
    if (translated) return translated;
    
    // If no translation found, return original text
    return itemText;
  };

  useEffect(() => {
    // Save language preference
    localStorage.setItem('appLanguage', language);
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, changeLanguage, t, tItem }}>
      {children}
    </LanguageContext.Provider>
  );
};
