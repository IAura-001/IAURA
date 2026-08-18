import { VoiceProvider } from "@/core/context/VoiceContext";
import AuthenticatedProjectBoundary from "@/components/projects/AuthenticatedProjectBoundary";
import AuthenticatedConversationBoundary from "@/components/conversation/AuthenticatedConversationBoundary";
import { getAuthenticatedUser } from "@/core/auth/session";
import { listAuthenticatedProjects } from "@/core/project/server";
import { getAuthenticatedProjectState } from "@/core/project/server";
import { getAuthenticatedConversationSnapshot } from "@/core/conversation/server";
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
  const projectState = user && isProfileComplete(profile)
    ? await getAuthenticatedProjectState(user.id)
    : {
        exists: false,
        activeProjectId: null,
      };
  const conversationSnapshot = user && isProfileComplete(profile)
    ? await getAuthenticatedConversationSnapshot(user.id)
    : null;
  return (
    <VoiceProvider>
      <form action="/api/auth/logout" method="post" className={styles.logoutForm}>
        <button type="submit" className={styles.logoutControl}>
          <span className={styles.statusDot} aria-hidden="true" />
          <span>Cerrar sesiÃ³n</span>
          <span className={styles.exitMark} aria-hidden="true">â†—</span>
        </button>
      </form>
      <AuthenticatedIdentityBoundary profile={profile}>
        <AuthenticatedProjectBoundary
          userId={user?.id ?? "unauthenticated"}
          projects={projects}
          activeProjectId={projectState.activeProjectId}
          remoteStateExists={projectState.exists}
        >
          <AuthenticatedConversationBoundary
            userId={user?.id ?? "unauthenticated"}
            snapshot={conversationSnapshot}
          >
            {children}
          </AuthenticatedConversationBoundary>
        </AuthenticatedProjectBoundary>
      </AuthenticatedIdentityBoundary>
    </VoiceProvider>
  );
}
