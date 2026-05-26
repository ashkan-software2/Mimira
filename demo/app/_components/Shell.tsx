"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Shell.module.css";

type NavItem = { href: string; label: string; count?: number };

const NAV: NavItem[] = [
  { href: "/inbox", label: "Inbox", count: 7 },
  { href: "/knowledge", label: "Knowledge" },
  { href: "/bookings", label: "Bookings", count: 3 },
  { href: "/broadcasts", label: "Broadcasts" },
  { href: "/settings", label: "Settings" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className={styles.app}>
      <header className={styles.topbar} role="banner">
        <Link href="/inbox" className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">Y</span>
          <span>
            <span className={styles.brandName}>Yuna</span>
            <span className={styles.brandSep}> · </span>
            <span className={styles.brandClinic}>Sukhumvit Skin &amp; Laser</span>
          </span>
        </Link>

        <nav className={styles.tabs} aria-label="Primary">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={styles.tab}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
                {item.count !== undefined && (
                  <span className={styles.count}>{item.count}</span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className={styles.topbarRight}>
          <div className={styles.avatar} title="Pim · staff">ภ</div>
        </div>
      </header>

      <main className={styles.main}>{children}</main>
    </div>
  );
}
