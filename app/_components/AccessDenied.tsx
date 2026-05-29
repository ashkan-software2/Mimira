"use client";

import { SignOutButton } from "@clerk/nextjs";
import styles from "./AccessDenied.module.css";

export function AccessDenied() {
  return (
    <main className={styles.page}>
      <section className={styles.panel} aria-labelledby="access-denied-title">
        <div className={styles.brandMark} aria-hidden="true">
          M
        </div>
        <h1 id="access-denied-title">Access not enabled</h1>
        <p>
          This account is signed in, but its email is not an active Mimira team
          member.
        </p>
        <SignOutButton>
          <button className={styles.button} type="button">
            Sign out
          </button>
        </SignOutButton>
      </section>
    </main>
  );
}
