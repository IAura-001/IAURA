import { notFound } from "next/navigation";
import { FounderAiCostAccessError, getFounderAiCostOperations } from "@/core/aiUsage/founderServer";
import styles from "../beta-usage/usage.module.css";
const money = (value: number | string | null) => value === null ? "Unavailable" : `$${Number(value).toFixed(4)}`;
const number = (value: number | string | null) => new Intl.NumberFormat("en").format(Number(value ?? 0));
const averagePricedCost = (row: { operations: number; failed_operations: number;
  unpriced_operations: number; estimated_cost_usd: number }) => {
  const priced = Number(row.operations) - Number(row.failed_operations) - Number(row.unpriced_operations);
  return priced > 0 ? money(Number(row.estimated_cost_usd) / priced) : "Unavailable";
};
export default async function UsageCostPage() {
  let data;
  try { data = await getFounderAiCostOperations(); }
  catch (error) { if (error instanceof FounderAiCostAccessError) notFound(); throw error; }
  const periods = [data.summary.today, data.summary["7d"], data.summary["30d"]].filter(Boolean);
  return <main className={styles.page}>
    <header className={styles.header}><p>VAEORA · Financial safety</p><h1>Usage & cost</h1>
      <p>Provider-reported usage with versioned internal USD estimates. No content is visible.</p></header>
    <section className={styles.summary} aria-label="AI cost summary">
      {periods.flatMap((row) => [[`${row.scope} cost`, money(row.estimated_cost_usd)],
        [`${row.scope} operations`, number(row.operations)], [`${row.scope} tokens`, number(row.total_tokens)],
        [`${row.scope} cost / active user`, money(row.cost_per_active_user)],
        [`${row.scope} unpriced`, number(row.unpriced_operations)],
        [`${row.scope} failed`, number(row.failed_operations)]])
        .map(([label,value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
    </section>
    <section className={styles.list} aria-label="Per-user AI usage">
      {data.users.map((user) => <article className={styles.user} key={user.user_id}>
        <div className={styles.identity}><div><h2>{user.email ?? "Unknown beta user"}</h2>
          <p>{number(user.operations)} operations · {number(user.failed_operations)} failed</p></div>
          <span data-status={user.anomaly_status}>{user.anomaly_status}</span></div>
        <dl><div><dt>Estimated cost</dt><dd>{money(user.estimated_cost_usd)}</dd></div>
          <div><dt>Total tokens</dt><dd>{number(user.total_tokens)}</dd></div>
          <div><dt>Input</dt><dd>{number(user.input_tokens)}</dd></div>
          <div><dt>Output</dt><dd>{number(user.output_tokens)}</dd></div>
          <div><dt>Average priced cost</dt><dd>{averagePricedCost(user)}</dd></div>
          <div><dt>Unpriced</dt><dd>{number(user.unpriced_operations)}</dd></div>
          <div><dt>Last AI operation</dt><dd>{user.last_operation_at ? new Date(user.last_operation_at).toLocaleString("en") : "—"}</dd></div>
          <div><dt>24h guardrail</dt><dd>{number(user.limit_operations_24h)} / {user.limit_max_operations_24h}</dd></div></dl>
      </article>)}
    </section>
  </main>;
}
