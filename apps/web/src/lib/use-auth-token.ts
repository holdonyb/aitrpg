"use client";

import { useSyncExternalStore } from "react";

const TOKEN_KEY = "aitrpg-token";
const TOKEN_EVENT = "aitrpg-token-change";

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent) => {
    if (!event.key || event.key === TOKEN_KEY) {
      onStoreChange();
    }
  };
  const handleTokenEvent = () => onStoreChange();

  window.addEventListener("storage", handleStorage);
  window.addEventListener(TOKEN_EVENT, handleTokenEvent);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(TOKEN_EVENT, handleTokenEvent);
  };
}

function getSnapshot() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(TOKEN_KEY) ?? "";
}

function getServerSnapshot() {
  return "";
}

export function useAuthToken() {
  const token = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setToken = (value: string) => {
    if (typeof window === "undefined") {
      return;
    }

    if (value) {
      window.localStorage.setItem(TOKEN_KEY, value);
    } else {
      window.localStorage.removeItem(TOKEN_KEY);
    }

    window.dispatchEvent(new Event(TOKEN_EVENT));
  };

  return {
    token,
    ready: typeof window !== "undefined",
    setToken,
  };
}
