const STORAGE_KEY = "keywordmoney_anonymous_visitor_id";
const COOKIE_NAME = "keywordmoney_anonymous_visitor_id";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function readCookie(name: string) {
  if (typeof document === "undefined") return undefined;

  const prefix = `${name}=`;
  const cookie = document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix));

  if (!cookie) return undefined;

  return decodeURIComponent(cookie.slice(prefix.length));
}

function writeCookie(name: string, value: string) {
  if (typeof document === "undefined") return;

  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

function readStorage(key: string) {
  if (typeof window === "undefined") return undefined;

  try {
    return window.localStorage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

function writeStorage(key: string, value: string) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, value);
  } catch {}
}

function createAnonymousVisitorId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getOrCreateAnonymousVisitorId() {
  if (typeof window === "undefined") return undefined;

  const storedValue = readStorage(STORAGE_KEY);
  const cookieValue = readCookie(COOKIE_NAME);
  const value = storedValue ?? cookieValue ?? createAnonymousVisitorId();

  if (storedValue !== value) {
    writeStorage(STORAGE_KEY, value);
  }

  if (cookieValue !== value) {
    writeCookie(COOKIE_NAME, value);
  }

  return value;
}
