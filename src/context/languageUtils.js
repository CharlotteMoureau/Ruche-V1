import { DEFAULT_LANGUAGE, STORAGE_KEY, SUPPORTED_LANGUAGES, USER_ROLES } from "./languageData";

export function normalizeText(value) {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

const roleLookupByNormalized = new Map(
  USER_ROLES.map((role) => [normalizeText(role), role]),
);

export function resolveCanonicalRole(value) {
  if (!value) return "";
  return roleLookupByNormalized.get(normalizeText(value)) || String(value);
}

export function getMessageByPath(obj, path) {
  return path.split(".").reduce((acc, key) => {
    if (!acc || typeof acc !== "object") return undefined;
    return acc[key];
  }, obj);
}

export function interpolate(template, params) {
  if (!params) return template;
  return Object.entries(params).reduce(
    (result, [key, value]) =>
      result.replace(new RegExp(`\\{${key}\\}`, "g"), String(value)),
    template,
  );
}

export function getInitialLanguage() {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (SUPPORTED_LANGUAGES.includes(stored)) return stored;

  const browserLang = (navigator.language || "").slice(0, 2).toLowerCase();
  return SUPPORTED_LANGUAGES.includes(browserLang)
    ? browserLang
    : DEFAULT_LANGUAGE;
}
