"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { accountStateSchema, type AccountState } from "./contracts";

export function notifyAccountChanged() {
  window.dispatchEvent(new Event("provenalpha:account-changed"));
}

export function useAccount() {
  const [account, setAccount] = useState<AccountState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pendingRequest = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    pendingRequest.current?.abort();
    const controller = new AbortController();
    pendingRequest.current = controller;
    try {
      const response = await fetch("/api/account", {
        cache: "no-store",
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Your account could not be loaded.");
      if (controller.signal.aborted) return;
      setAccount(accountStateSchema.parse(data));
      setError(null);
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(cause instanceof Error ? cause.message : "Your account could not be loaded.");
    }
  }, []);
  useEffect(() => {
    let active = true;
    const load = () => {
      if (active) void refresh();
    };
    load();
    window.addEventListener("provenalpha:account-changed", load);
    return () => {
      active = false;
      pendingRequest.current?.abort();
      window.removeEventListener("provenalpha:account-changed", load);
    };
  }, [refresh]);
  return { account, error, refresh };
}
