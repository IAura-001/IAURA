export interface AuthenticatedProfile {
  id: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  onboardingCompleted: boolean;
}

export function isProfileComplete(profile: AuthenticatedProfile | null): boolean {
  return Boolean(profile?.onboardingCompleted && profile.firstName?.trim() && profile.displayName?.trim());
}
