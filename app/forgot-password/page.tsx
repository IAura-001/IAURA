import Link from "next/link";
import styles from "../session.module.css";
export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const sent = (await searchParams).sent === "1";
  return <main className={styles.page}><section className={styles.chamber} aria-labelledby="reset-request-title">
    <div className={styles.panel}><h1 id="reset-request-title">Recover your access.</h1>
      <p className={styles.panelIntro}>Enter your account email. If it exists, VAEORA will send a secure recovery link.</p>
      {sent ? <p role="status">If an account matches that address, recovery instructions have been sent.</p> :
        <form className={styles.form} action="/api/auth/password/request" method="post">
          <label htmlFor="recovery-email">Email</label><div className={styles.field}><input id="recovery-email" name="email" type="email" autoComplete="email" required maxLength={320} /></div>
          <button type="submit"><span>Send recovery link</span></button>
        </form>}
      <p className={styles.switch}><Link href="/login">Return to sign in</Link></p>
    </div></section></main>;
}
