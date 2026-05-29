import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import { AccessDenied } from "./_components/AccessDenied";
import { AuthSetupMissing } from "./_components/AuthSetupMissing";
import { getSettings } from "@/lib/repo";
import { getMemberForUser } from "@/lib/auth";
import { Shell } from "./_components/Shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mimira",
  description: "Mimira admin — calm Line concierge for Thai skin clinics.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getSettings();
  const hasClerkKeys = Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY
  );

  if (!hasClerkKeys) {
    return (
      <html lang="en">
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link
            rel="preconnect"
            href="https://fonts.gstatic.com"
            crossOrigin="anonymous"
          />
          <link
            href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Sans+Thai+Looped:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
            rel="stylesheet"
          />
        </head>
        <body>
          <AuthSetupMissing />
        </body>
      </html>
    );
  }

  const user = await currentUser();
  const member = user ? await getMemberForUser(user) : null;
  const blocked = Boolean(user && !member);

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Sans+Thai+Looped:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ClerkProvider>
          {blocked ? (
            <AccessDenied />
          ) : (
            <Shell clinicName={settings.clinic.name}>{children}</Shell>
          )}
        </ClerkProvider>
      </body>
    </html>
  );
}
