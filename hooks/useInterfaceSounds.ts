"use client";

import { useSyncExternalStore } from "react";
import { interfaceSoundsEnabled, setInterfaceSoundsEnabled, SONIC_PREFERENCE_EVENT, SONIC_PREFERENCE_KEY } from "@/core/sonic/SonicDNA";

function subscribe(listener: () => void) {
  const storage = (event: StorageEvent) => { if (!event.key || event.key === SONIC_PREFERENCE_KEY) listener(); };
  window.addEventListener("storage", storage);
  window.addEventListener(SONIC_PREFERENCE_EVENT, listener);
  return () => { window.removeEventListener("storage", storage); window.removeEventListener(SONIC_PREFERENCE_EVENT, listener); };
}

export function useInterfaceSounds() {
  const enabled = useSyncExternalStore(subscribe, interfaceSoundsEnabled, () => true);
  return { enabled, setEnabled: setInterfaceSoundsEnabled };
}
