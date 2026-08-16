"use client";

import type { ReactNode } from "react";
import IdentityOnboarding from "./IdentityOnboarding";
import { AuthenticatedIdentityProvider } from "@/core/profile/AuthenticatedIdentityContext";
import { isProfileComplete, type AuthenticatedProfile } from "@/core/profile/types";

export default function AuthenticatedIdentityBoundary({ profile, children }: { profile: AuthenticatedProfile | null; children: ReactNode }) {
  if (!isProfileComplete(profile) || !profile) return <IdentityOnboarding />;
  return <AuthenticatedIdentityProvider profile={profile}>{children}</AuthenticatedIdentityProvider>;
}
