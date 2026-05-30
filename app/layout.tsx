import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { AuthSetupMissing } from "./_components/AuthSetupMissing";
import "./globals.css";
import TopLoader from "./TopLoader";

export const metadata: Metadata = {
  title: "Mimira",
  description: "Mimira admin — calm Line concierge for Thai skin clinics.",
  icons: {
    icon: [
      {
        url: "/favicon-48.png",
        sizes: "48x48",
        type: "image/png",
      },
    ],
    shortcut: "/favicon-48.png",
    apple: "/mimira-logo.png",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
          <TopLoader />
          <AuthSetupMissing />
        </body>
      </html>
    );
  }

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
        <TopLoader />
        <ClerkProvider>{children}</ClerkProvider>
      </body>
    </html>
  );
}
