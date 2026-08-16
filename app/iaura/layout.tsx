import { VoiceProvider } from "@/core/context/VoiceContext";
import AuthenticatedProjectBoundary from "@/components/projects/AuthenticatedProjectBoundary";
import { getAuthenticatedUser } from "@/core/auth/session";
import { listAuthenticatedProjects } from "@/core/project/server";

import styles from "./layout.module.css";

export default async function IauraLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getAuthenticatedUser();
  const projects = user ? await listAuthenticatedProjects(user.id) : [];
  return (
    <AuthenticatedProjectBoundary userId={user?.id ?? "unauthenticated"} projects={projects}>
    <VoiceProvider>
      <form action="/api/auth/logout" method="post" className={styles.logoutForm}>
        <button type="submit" className={styles.logoutControl}>
          <span className={styles.statusDot} aria-hidden="true" />
          <span>Cerrar sesión</span>
          <span className={styles.exitMark} aria-hidden="true">↗</span>
        </button>
      </form>
      {children}
    </VoiceProvider>
    </AuthenticatedProjectBoundary>
  );
}
