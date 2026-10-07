export const USERS = ["JK", "HE"] as const;
export type User = (typeof USERS)[number];

export function isUser(value: unknown): value is User {
  return value === "JK" || value === "HE";
}

const STORAGE_KEY = "mockly:user";

// A device preference only. The route decides which dashboard is displayed.
export function getRememberedUser(): User | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return isUser(value) ? value : null;
  } catch {
    return null;
  }
}

export function rememberUser(user: User): void {
  // A shared-device preference, not authentication. Server routes read the same choice.
  try {
    document.cookie = `mockly_user=${user}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  } catch { /* The picker still works if cookies are blocked; exams require the preference. */ }
  try {
    window.localStorage.setItem(STORAGE_KEY, user);
  } catch {
    // Navigation still works when browser storage is unavailable.
  }
}

export function forgetUser(): void {
  try { document.cookie = "mockly_user=; Path=/; Max-Age=0; SameSite=Lax"; } catch { /* Cookies may be blocked. */ }
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage may be disabled in this browser.
  }
}
