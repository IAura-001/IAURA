import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FounderUsageAccessError, getFounderBetaUsage } from "@/core/betaUsage/server";

import styles from "./usage.module.css";

export const metadata: Metadata = { title: "Beta Usage | VAEORA" };

const statusLabels = {
  joined: "Joined · no product activity",
  entered: "Entered",
  started: "Started using IAURA",
  active: "Active",
  returned: "Returned",
} as const;

function date(value: string | null): string {
  return value ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" })
    .format(new Date(value)) : "—";
}

export default async function BetaUsagePage() {
  let users;
  try {
    users = await getFounderBetaUsage();
  } catch (error) {
    if (error instanceof FounderUsageAccessError) notFound();
    throw error;
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p>VAEORA · Private beta</p>
        <h1>Usage visibility</h1>
        <p>Persisted evidence only. Explicit events are separated from inferred history.</p>
      </header>

      <section className={styles.list} aria-label="Beta users">
        {users.length === 0 ? <p className={styles.empty}>No beta memberships found.</p> : users.map((user) => (
          <article className={styles.user} key={user.userId}>
            <div className={styles.identity}>
              <div>
                <h2>{user.displayName || user.email || "Unnamed beta user"}</h2>
                {user.displayName && user.email ? <p>{user.email}</p> : null}
              </div>
              <span data-status={user.usageStatus}>{statusLabels[user.usageStatus]}</span>
            </div>
            <dl>
              <div><dt>Joined</dt><dd>{date(user.joinedAt)}</dd></div>
              <div><dt>Last active</dt><dd>{date(user.lastActiveAt)}</dd></div>
              <div><dt>Projects</dt><dd>{user.projectCount}</dd></div>
              <div><dt>Conversations</dt><dd>{user.conversationCount}</dd></div>
              <div><dt>User messages</dt><dd>{user.userMessageCount}</dd></div>
              <div><dt>Latest milestone</dt><dd>{user.latestMilestone || "—"}</dd></div>
            </dl>
            <p className={styles.evidence}>Evidence · {user.evidenceSource}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
