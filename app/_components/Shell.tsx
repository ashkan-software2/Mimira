"use client";

import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Shell.module.css";

type NavItem = { href: string; label: string; count?: number };

function navItems(args: {
  inboxCount: number;
  bookingCount: number;
}): NavItem[] {
  return [
    { href: "/inbox", label: "Inbox", count: args.inboxCount || undefined },
    { href: "/knowledge", label: "Knowledge" },
    {
      href: "/bookings",
      label: "Bookings",
      count: args.bookingCount || undefined,
    },
    { href: "/broadcasts", label: "Broadcasts" },
    { href: "/settings", label: "Settings" },
  ];
}

export function Shell({
  children,
  clinicName,
  inboxCount,
  bookingCount,
}: {
  children: React.ReactNode;
  clinicName: string;
  inboxCount: number;
  bookingCount: number;
}) {
  const pathname = usePathname();
  const nav = navItems({ inboxCount, bookingCount });

  return (
    <div className={styles.app}>
      <header className={styles.topbar} role="banner">
        <Link href="/inbox" className={styles.brand}>
          <img
            className={styles.brandMark}
            src="/mimira-logo.png"
            alt=""
            aria-hidden="true"
          />
          <span>
            <span className={styles.brandName}>Mimira</span>
            <span className={styles.brandSep}> · </span>
            <span className={styles.brandClinic}>{clinicName}</span>
          </span>
        </Link>

        <nav className={styles.tabs} aria-label="Primary">
          {nav.map((item) => {
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
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button className={styles.authButton} type="button">
                Log in
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className={styles.authButtonPrimary} type="button">
                Sign up
              </button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <UserButton
              appearance={{
                elements: {
                  userButtonAvatarBox: styles.clerkAvatar,
                },
              }}
            />
          </Show>
        </div>
      </header>

      <main className={styles.main}>{children}</main>
    </div>
  );
}
