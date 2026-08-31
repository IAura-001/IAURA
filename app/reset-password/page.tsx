import Link from "next/link";
import styles from "../session.module.css";
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const invalid = Boolean((await searchParams).error);
  return <main className={styles.page}><section className={styles.chamber} aria-labelledby="new-password-title"><div className={styles.panel}>
    <h1 id="new-password-title">Set a new password.</h1>
    {invalid ? <><p role="alert">This recovery link is invalid or expired.</p><p className={styles.switch}><Link href="/forgot-password">Request another link</Link></p></> :
      <form className={styles.form} action="/api/auth/password/update" method="post">
        <label htmlFor="new-password">New password</label><div className={styles.field}><input id="new-password" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} /></div>
        <button type="submit"><span>Update password</span></button>
      </form>}
  </div></section></main>;
}
