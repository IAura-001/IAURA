import Link from "next/link";

import { safeIauraNextPath } from "@/core/auth/redirects";
import styles from "../session.module.css";

interface LoginPageProps {
  searchParams: Promise<{ error?: string; next?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = safeIauraNextPath(params.next);

  return (
    <main className={styles.page}>
      <div className={styles.atmosphere} aria-hidden="true" /><div className={styles.horizon} aria-hidden="true" />
      <div className={styles.frame}>
        <header className={styles.brandRow}><Link className={styles.wordmark} href="/">IAURA</Link><span className={styles.privateSignal}><span />Identity channel · 02</span></header>
        <section className={styles.chamber} aria-labelledby="login-title">
          <div className={styles.presence} aria-hidden="true"><span className={styles.orbitOuter} /><span className={styles.orbitInner} /><span className={styles.presenceAxis} /><span className={styles.presenceCore}><i /></span></div>
          <div className={styles.introduction}><p className={styles.eyebrow}>Continuidad privada · Identidad reconocida</p><h1 id="login-title">Volver a<br /><span>tu espacio.</span></h1><p className={styles.lede}>Tu inteligencia personal permanece al otro lado de esta señal.</p></div>
          <div className={styles.panel}>
            <p className={styles.panelSignal}><span>02</span> Verificación de identidad</p><p className={styles.panelIntro}>Inicia sesión con el correo asociado a tu identidad IAURA.</p>
            {params.error ? <p className={styles.error} role="alert">No pudimos iniciar sesión con esos datos.</p> : null}
            <form action="/api/auth/login" method="post" className={styles.form}>
              <input type="hidden" name="next" value={nextPath} /><label htmlFor="login-email">Correo</label><div className={styles.field}><input id="login-email" name="email" type="email" autoComplete="email" required maxLength={320} placeholder="tu@identidad.com" /><span /></div>
              <label htmlFor="login-password">Contraseña</label><div className={styles.field}><input id="login-password" name="password" type="password" autoComplete="current-password" required minLength={8} maxLength={128} placeholder="Tu señal personal" /><span /></div>
              <button type="submit"><span>Entrar a IAURA</span><i aria-hidden="true" /><svg aria-hidden="true" viewBox="0 0 16 16"><path d="M3 13 13 3M6 3h7v7" /></svg></button>
            </form>
            <p className={styles.switch}><Link href="/forgot-password">¿Olvidaste tu contraseña?</Link></p>
            <p className={styles.switch}>¿Primera vez aquí? <Link href={`/signup?next=${encodeURIComponent(nextPath)}`}>Crear identidad</Link></p>
          </div>
        </section>
        <footer className={styles.footer}><span>IAURA / Private intelligence system</span><span>Identity channel active</span></footer>
      </div>
    </main>
  );
}
