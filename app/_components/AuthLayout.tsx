import type { ReactNode } from "react";
import styles from "./AuthLayout.module.css";

// Shared wrapper for the sign-in / sign-up pages so they share the calm, centered,
// branded frame used by AccessDenied and AuthSetupMissing — the rest of the auth flow.
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className={styles.page}>
      <div className={styles.panel}>
        <div className={styles.brand}>
          <img
            className={styles.brandMark}
            src="/mimira-logo.png"
            alt=""
            aria-hidden="true"
          />
          <span className={styles.wordmark}>Mimira</span>
        </div>
        <p className={styles.tagline}>
          Calm Line concierge for Thai skin clinics.
        </p>
        {children}
      </div>
    </main>
  );
}
