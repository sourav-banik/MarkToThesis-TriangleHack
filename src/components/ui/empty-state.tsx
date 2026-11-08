import type { ReactNode } from "react";
import { FileText } from "lucide-react";

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <FileText size={23} aria-hidden="true" />
      </div>
      <h2>{title}</h2>
      <div className="muted">{children}</div>
      {action}
    </div>
  );
}
