export function formatNumber(value: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(value);
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}
