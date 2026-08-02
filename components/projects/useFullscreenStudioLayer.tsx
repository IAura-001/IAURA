"use client";

import {
  type ReactNode,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";

function subscribeToClient(): () => void {
  return () => undefined;
}

function getClientSnapshot(): boolean {
  return true;
}

function getServerSnapshot(): boolean {
  return false;
}

export function useFullscreenStudioLayer(
  onClose: () => void,
  isReady: boolean,
) {
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const canUsePortal = useSyncExternalStore(
    subscribeToClient,
    getClientSnapshot,
    getServerSnapshot,
  );

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [onClose]);

  useEffect(() => {
    if (!isReady) return;

    backButtonRef.current?.focus({ preventScroll: true });
  }, [isReady]);

  function renderFullscreenStudio(content: ReactNode): ReactNode {
    return canUsePortal ? createPortal(content, document.body) : content;
  }

  return { backButtonRef, renderFullscreenStudio };
}
