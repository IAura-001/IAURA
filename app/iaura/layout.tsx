import { VoiceProvider } from "@/core/context/VoiceContext";
import AuthenticatedProjectBoundary from "@/components/projects/AuthenticatedProjectBoundary";
import { getAuthenticatedUser } from "@/core/auth/session";
import { listAuthenticatedProjects } from "@/core/project/server";
import { getAuthenticatedProfile } from "@/core/profile/server";
import { isProfileComplete } from "@/core/profile/types";
import AuthenticatedIdentityBoundary from "@/components/profile/AuthenticatedIdentityBoundary";

import styles from "./layout.module.css";

export default async function IauraLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getAuthenticatedUser();
  const profile = user ? await getAuthenticatedProfile(user.id) : null;
  const projects = user && isProfileComplete(profile)
    ? await listAuthenticatedProjects(user.id)
    : [];
  return (
    <VoiceProvider>
      <form action="/api/auth/logout" method="post" className={styles.logoutForm}>
        <button type="submit" className={styles.logoutControl}>
          <span className={styles.statusDot} aria-hidden="true" />
          <span>Cerrar sesión</span>
          <span className={styles.exitMark} aria-hidden="true">↗</span>
        </button>
      </form>
      <AuthenticatedIdentityBoundary profile={profile}>
        <AuthenticatedProjectBoundary userId={user?.id ?? "unauthenticated"} projects={projects}>
          {children}
        </AuthenticatedProjectBoundary>
      </AuthenticatedIdentityBoundary>
    </VoiceProvider>
  );
}
