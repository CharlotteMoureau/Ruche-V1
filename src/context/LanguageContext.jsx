/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  CARD_CATEGORIES,
  DATE_LOCALES,
  DEFAULT_LANGUAGE,
  ROLE_LABELS,
  STORAGE_KEY,
  SUPPORTED_LANGUAGES,
  USER_ROLES,
  messages,
} from "./languageData";
import {
  getInitialLanguage,
  getMessageByPath,
  interpolate,
  resolveCanonicalRole,
} from "./languageUtils";

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(getInitialLanguage);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo(() => {
    const t = (path, params) => {
      const current = getMessageByPath(messages[language], path);
      const fallback = getMessageByPath(messages[DEFAULT_LANGUAGE], path);
      const resolved = current ?? fallback;

      if (typeof resolved !== "string") {
        return path;
      }

      return interpolate(resolved, params);
    };

    const translateRole = (roleLabel) => {
      const canonical = resolveCanonicalRole(roleLabel);
      return ROLE_LABELS[language][canonical] || canonical;
    };

    return {
      language,
      setLanguage,
      supportedLanguages: SUPPORTED_LANGUAGES,
      t,
      dateLocale: DATE_LOCALES[language],
      roleOptions: USER_ROLES.map((value) => ({
        value,
        label: ROLE_LABELS[language][value] || value,
      })),
      translateRole,
      cardCategories: CARD_CATEGORIES[language],
    };
  }, [language]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }
  return context;
}
