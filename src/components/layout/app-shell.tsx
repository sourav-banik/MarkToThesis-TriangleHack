"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  BookOpen,
  Compass,
  Globe2,
  PenLine,
  Play,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import type { ReactNode } from "react";
import { AccountLink } from "@/features/auth/components/account-link";

const navigation = [
  { href: "/", label: "Claim feed", icon: Compass },
  { href: "/new", label: "New claim", icon: PenLine },
  { href: "/markets", label: "Markets", icon: Globe2 },
  { href: "/replay", label: "Replay", icon: Play },
  { href: "/profile", label: "Your record", icon: UserRound },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const title = pathname.startsWith("/new")
    ? "Shape your next call"
    : pathname.startsWith("/markets")
      ? "Explore the universe"
      : pathname.startsWith("/profile")
        ? "A record, over time"
        : pathname.startsWith("/replay")
          ? "A call, measured in replay"
          : pathname.startsWith("/claims/")
            ? "Behind the claim"
            : "The public record";
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link href="/" className="brand" aria-label="ProvenAlpha home">
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span>
            Proven<span className="brand-light">Alpha</span>
            <small>CONVICTION. ACCOUNTABILITY.</small>
          </span>
        </Link>
        <div className="nav-caption">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/"
                ? pathname === "/" || pathname.startsWith("/claims/")
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`nav-item ${active ? "is-active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={19} aria-hidden="true" />
                {label}
                {active && <span className="active-dot" />}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-note">
          <ShieldCheck size={23} strokeWidth={1.5} aria-hidden="true" />
          <p>
            A call is a beginning.
            <br />
            <strong>The record is the story.</strong>
          </p>
          <span>
            Clear terms. Visible misses.
            <br />
            Evidence you can inspect.
          </span>
        </div>
        <div className="sidebar-bottom">
          <BookOpen size={16} aria-hidden="true" />
          <span>Built for considered conviction</span>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span className="topbar-title">{title}</span>
          <div className="topbar-actions">
            <span className="preview-dot" />
            Workspace
            <Link href="/new" className="topbar-link">
              Explore a claim <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
            <AccountLink />
          </div>
        </header>
        <div className="preview-banner">
          <span>{pathname.startsWith("/replay") ? "SYNTHETIC REPLAY" : "ILLUSTRATIVE DATA"}</span>
          {pathname.startsWith("/replay")
            ? "Fabricated prices. Tab-local confirmation. No public publication or verified historical prediction."
            : "Synthetic examples use fabricated prices and do not enter a live performance record. Live claims are marked separately."}
        </div>
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
        <footer className="app-footer">
          <span>
            ProvenAlpha <span className="footer-divider">/</span> Every call has a context.
          </span>
          <span>Claims are not verified trades.</span>
        </footer>
      </div>
    </div>
  );
}
