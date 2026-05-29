import type { Metadata } from "next";
import { getSettings } from "@/lib/repo";
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
        <Shell clinicName={settings.clinic.name}>{children}</Shell>
      </body>
    </html>
  );
}
