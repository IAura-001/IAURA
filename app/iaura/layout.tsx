import { VoiceProvider } from "@/core/context/VoiceContext";
import AuthenticatedProjectBoundary from "@/components/projects/AuthenticatedProjectBoundary";
import AuthenticatedMemoryBoundary from "@/components/memory/AuthenticatedMemoryBoundary";
import AuthenticatedConversationBoundary from "@/components/conversation/AuthenticatedConversationBoundary";
import { getAuthenticatedUser } from "@/core/auth/session";
import { listAuthenticatedProjects } from "@/core/project/server";
import { getAuthenticatedMemoryState } from "@/core/memory/server";
import { getAuthenticatedProjectState } from "@/core/project/server";
import { getAuthenticatedConversationSnapshot } from "@/core/conversation/server";
import { getAuthenticatedProfile } from "@/core/profile/server";
import { isProfileComplete } from "@/core/profile/types";
import AuthenticatedIdentityBoundary from "@/components/profile/AuthenticatedIdentityBoundary";
import BetaUsageEntryTracker from "@/components/betaUsage/BetaUsageEntryTracker";
import WorkspaceLogoutControl from "@/components/vaeora/WorkspaceLogoutControl";

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
  const memoryState = user && isProfileComplete(profile)
    ? await getAuthenticatedMemoryState(user.id)
    : {
        exists: false,
        memory: null,
      };
  const conversationSnapshot = user && isProfileComplete(profile)
    ? await getAuthenticatedConversationSnapshot(user.id)
    : null;
  return (
    <VoiceProvider>
      <WorkspaceLogoutControl />
      <AuthenticatedIdentityBoundary profile={profile}>
        {user ? <BetaUsageEntryTracker userId={user.id} /> : null}
        <AuthenticatedProjectBoundary
          userId={user?.id ?? "unauthenticated"}
          projects={projects}
          activeProjectId={projectState.activeProjectId}
          remoteStateExists={projectState.exists}
        >
          <AuthenticatedMemoryBoundary
            userId={user?.id ?? "unauthenticated"}
            memory={memoryState.memory}
          >
          <AuthenticatedConversationBoundary
            userId={user?.id ?? "unauthenticated"}
            snapshot={conversationSnapshot}
          >
            {children}
          </AuthenticatedConversationBoundary>
          </AuthenticatedMemoryBoundary>
        </AuthenticatedProjectBoundary>
      </AuthenticatedIdentityBoundary>
    </VoiceProvider>
  );
}
