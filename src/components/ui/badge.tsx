import type { ReactNode } from "react";

export function Badge({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "purple" | "green" | "amber";
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
