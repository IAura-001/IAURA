import Link from "next/link";

import { safeIauraNextPath } from "@/core/auth/redirects";
import styles from "../session.module.css";

interface SignupPageProps {
  searchParams: Promise<{ confirmation?: string; error?: string; next?: string }>;
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = await searchParams;
  const nextPath = safeIauraNextPath(params.next);
  const confirmationRequired = params.confirmation === "required";
  const loginHref = `/login?next=${encodeURIComponent(nextPath)}`;

  return (
    <main className={styles.page}>
      <div className={styles.atmosphere} aria-hidden="true" /><div className={styles.horizon} aria-hidden="true" />
      <div className={styles.frame}>
        <header className={styles.brandRow}><Link className={styles.wordmark} href="/">IAURA</Link><span className={styles.privateSignal}><span />Identity channel · 02</span></header>
        <section className={styles.chamber} aria-labelledby="signup-title">
          <div className={styles.presence} aria-hidden="true"><span className={styles.orbitOuter} /><span className={styles.orbitInner} /><span className={styles.presenceAxis} /><span className={styles.presenceCore}><i /></span></div>
          <div className={styles.introduction}><p className={styles.eyebrow}>Presencia privada · Nueva identidad</p><h1 id="signup-title">Crear tu<br /><span>identidad.</span></h1><p className={styles.lede}>Una presencia propia para continuar dentro de IAURA.</p></div>
          <div className={styles.panel}>
            <p className={styles.panelSignal}><span>02</span> Registro de identidad</p><p className={styles.panelIntro}>Tu sesión personal vive dentro del umbral privado de IAURA.</p>
            {confirmationRequired ? (
              <div className={styles.confirmation} role="status">
                <h2>Revisa tu correo.</h2>
                <p>Enviamos un enlace para confirmar tu identidad y continuar a IAURA.</p>
                <p className={styles.confirmationSecondary}>Después de confirmar tu correo, vuelve aquí e inicia sesión.</p>
                <Link className={styles.confirmationCta} href={loginHref}><span>Iniciar sesión</span><i aria-hidden="true" /><svg aria-hidden="true" viewBox="0 0 16 16"><path d="M3 13 13 3M6 3h7v7" /></svg></Link>
              </div>
            ) : (
              <>
                {params.error ? <p className={styles.error} role="alert">No pudimos crear la cuenta con esos datos.</p> : null}
                <form action="/api/auth/signup" method="post" className={styles.form}>
                  <input type="hidden" name="next" value={nextPath} /><label htmlFor="signup-email">Correo</label><div className={styles.field}><input id="signup-email" name="email" type="email" autoComplete="email" required maxLength={320} placeholder="tu@identidad.com" /><span /></div>
                  <label htmlFor="signup-password">Contraseña</label><div className={styles.field}><input id="signup-password" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} placeholder="Crea tu señal personal" /><span /></div>
                  <button type="submit"><span>Crear identidad</span><i aria-hidden="true" /><svg aria-hidden="true" viewBox="0 0 16 16"><path d="M3 13 13 3M6 3h7v7" /></svg></button>
                </form>
                <p className={styles.switch}>¿Tu identidad ya existe? <Link href={loginHref}>Iniciar sesión</Link></p>
              </>
            )}
          </div>
        </section>
        <footer className={styles.footer}><span>IAURA / Private intelligence system</span><span>Awaiting identity</span></footer>
      </div>
    </main>
  );
}
