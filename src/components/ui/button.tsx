import type { ButtonHTMLAttributes } from "react";

export function buttonClass(variant: "primary" | "secondary" | "quiet" = "primary") {
  return `button button-${variant}`;
}

export function Button({
  className = "",
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "quiet";
}) {
  return <button className={`${buttonClass(variant)} ${className}`} {...props} />;
}
