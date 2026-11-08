import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { getServerEnv } from "@/lib/server/env";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "ProvenAlpha — Conviction, with a record", template: "%s | ProvenAlpha" },
  description:
    "Turn market commentary into clear claims, inspect the evidence, and build a transparent record of calls logged on ProvenAlpha.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  getServerEnv();
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
