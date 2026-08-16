"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { AuthenticatedProfile } from "./types";

const IdentityContext = createContext<AuthenticatedProfile | null>(null);

export function AuthenticatedIdentityProvider({ profile, children }: { profile: AuthenticatedProfile; children: ReactNode }) {
  return <IdentityContext.Provider key={profile.id} value={profile}>{children}</IdentityContext.Provider>;
}

export function useAuthenticatedIdentity(): AuthenticatedProfile | null {
  return useContext(IdentityContext);
}
