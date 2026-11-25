"use client";

/** The access code (THEA_SHARE_TOKEN) is kept in this browser after the first share or entry. */
export const TOKEN_KEY = "thea_token";

export function readToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {}
}

/** fetch() with the access code attached. */
export function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = readToken();
  return fetch(input, {
    ...init,
    headers: { ...(init.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
}
