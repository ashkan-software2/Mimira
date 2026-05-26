import styles from "./Placeholder.module.css";

export function Placeholder({ title, blurb }: { title: string; blurb: string }) {
  return (
    <section className={styles.wrap}>
      <header className={styles.header}>
        <h1 className={styles.title}>{title}</h1>
      </header>
      <div className={styles.body}>
        <p className={styles.blurb}>{blurb}</p>
      </div>
    </section>
  );
}
