import styles from "./AuthSetupMissing.module.css";

export function AuthSetupMissing() {
  return (
    <main className={styles.page}>
      <section className={styles.panel} aria-labelledby="auth-setup-title">
        <div className={styles.brandMark} aria-hidden="true">
          M
        </div>
        <h1 id="auth-setup-title">Clerk keys required</h1>
        <p>
          Add Clerk publishable and secret keys to `.env.local`, then restart
          the dev server.
        </p>
        <dl>
          <div>
            <dt>Publishable key</dt>
            <dd>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</dd>
          </div>
          <div>
            <dt>Secret key</dt>
            <dd>CLERK_SECRET_KEY</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
