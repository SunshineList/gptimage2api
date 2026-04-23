"use client";

import localforage from "localforage";

export const AUTH_KEY_STORAGE_KEY = "chatgpt2api_auth_key";
export const SESSION_ID_STORAGE_KEY = "chatgpt2api_session_id";

const authStorage = localforage.createInstance({
  name: "chatgpt2api",
  storeName: "auth",
});

export async function getStoredAuthKey() {
  if (typeof window === "undefined") {
    return "";
  }
  const value = await authStorage.getItem<string>(AUTH_KEY_STORAGE_KEY);
  return String(value || "").trim();
}

export async function setStoredAuthKey(authKey: string) {
  const normalizedAuthKey = String(authKey || "").trim();
  if (!normalizedAuthKey) {
    await clearStoredAuthKey();
    return;
  }
  await authStorage.setItem(AUTH_KEY_STORAGE_KEY, normalizedAuthKey);
}

export async function clearStoredAuthKey() {
  if (typeof window === "undefined") {
    return;
  }
  await authStorage.removeItem(AUTH_KEY_STORAGE_KEY);
  await authStorage.removeItem(SESSION_ID_STORAGE_KEY);
}

export async function getStoredSessionId() {
  if (typeof window === "undefined") {
    return "";
  }
  const value = await authStorage.getItem<string>(SESSION_ID_STORAGE_KEY);
  return String(value || "").trim();
}

export async function setStoredSessionId(sessionId: string) {
  const normalized = String(sessionId || "").trim();
  if (!normalized) {
    await authStorage.removeItem(SESSION_ID_STORAGE_KEY);
    return;
  }
  await authStorage.setItem(SESSION_ID_STORAGE_KEY, normalized);
}
