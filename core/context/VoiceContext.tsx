"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";

import { useVoice } from "@/hooks/useVoice";

type VoiceContextType = ReturnType<typeof useVoice>;

const VoiceContext = createContext<VoiceContextType | null>(null);

export function VoiceProvider({
  children,
}: {
  children: ReactNode;
}) {
  const voice = useVoice();

  return (
    <VoiceContext.Provider value={voice}>
      {children}
    </VoiceContext.Provider>
  );
}

export function useVoiceContext() {
  const context = useContext(VoiceContext);

  if (!context) {
    throw new Error(
      "useVoiceContext must be used inside VoiceProvider"
    );
  }

  return context;
}
