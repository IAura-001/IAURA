import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FounderUsageAccessError, getFounderBetaUsage } from "@/core/betaUsage/server";
import styles from "./usage.module.css";

export const metadata: Metadata = { title: "Beta Operations | VAEORA" };
const statusLabels = {
  NEVER_ACTIVATED: "Never activated", ACTIVE: "Active",
  AT_RISK: "At risk", DORMANT: "Dormant",
} as const;

function date(value: string | null): string {
  return value ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" })
    .format(new Date(value)) : "—";
}

export default async function BetaUsagePage() {
  let operations;
  try {
    operations = await getFounderBetaUsage();
  } catch (error) {
    if (error instanceof FounderUsageAccessError) notFound();
    throw error;
  }
  const cards = [
    ["Registered", operations.summary.totalRegistered], ["Activated", operations.summary.activated],
    ["Never activated", operations.summary.neverActivated], ["Active", operations.summary.active],
    ["At risk", operations.summary.atRisk], ["Dormant", operations.summary.dormant],
    ["Meaningful interactions", operations.summary.totalMeaningfulInteractions],
    ["Data issues", operations.summary.usersWithDataQualityIssues],
  ] as const;

  return <main className={styles.page}>
    <header className={styles.header}>
      <p>VAEORA · Private beta</p><h1>Founder operations</h1>
      <p>Persisted operational metadata only. No project, conversation, message, or memory contents.</p>
    </header>
    <section className={styles.summary} aria-label="Beta summary">
      {cards.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
    </section>
    <section className={styles.list} aria-label="Beta users">
      {operations.users.length === 0 ? <p className={styles.empty}>No beta memberships found.</p>
        : operations.users.map((user) => <article className={styles.user} key={user.userId}>
          <div className={styles.identity}><div>
            <h2>{user.displayName || user.email || "Unnamed beta user"}</h2>
            {user.displayName && user.email ? <p>{user.email}</p> : null}
          </div><span data-status={user.lifecycleStatus}>{statusLabels[user.lifecycleStatus]}</span></div>
          <dl>
            <div><dt>Registered</dt><dd>{date(user.registeredAt)}</dd></div>
            <div><dt>Last active</dt><dd>{date(user.lastActiveAt)}</dd></div>
            <div><dt>Projects</dt><dd>{user.projectCount}</dd></div>
            <div><dt>Conversations</dt><dd>{user.conversationCount}</dd></div>
            <div><dt>Messages / meaningful</dt><dd>{user.messageCount} / {user.meaningfulInteractionCount}</dd></div>
            <div><dt>Activation</dt><dd>{user.activationStatus === "ACTIVATED" ? "Activated" : "Registered only"}</dd></div>
          </dl>
          <p className={styles.evidence}>Evidence · {user.evidenceSource}</p>
          {user.dataQualityIssues.length > 0
            ? <p className={styles.issues}>Data quality · {user.dataQualityIssues.join(", ")}</p> : null}
        </article>)}
    </section>
  </main>;
}
