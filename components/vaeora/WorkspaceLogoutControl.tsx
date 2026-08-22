import styles from "./WorkspaceLogoutControl.module.css";

export default function WorkspaceLogoutControl() {
  return (
    <form action="/api/auth/logout" method="post" className={styles.logoutForm}>
      <button type="submit" className={styles.logoutControl}>
        <span className={styles.statusDot} aria-hidden="true" />
        <span className={styles.logoutLabel}>Cerrar sesión</span>
        <span className={styles.exitMark} aria-hidden="true">↗</span>
      </button>
    </form>
  );
}
