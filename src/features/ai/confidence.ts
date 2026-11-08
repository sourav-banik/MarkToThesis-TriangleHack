// Check the model's confidence against the author's exact supporting quote.
const words: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};
function asNumber(text: string): number | null {
  const trimmed = text.trim();
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
  const parts = trimmed
    .replace(/-/g, " ")
    .split(/\s+/)
    .filter((part) => part !== "and");
  if (parts.length === 1) return words[parts[0]] ?? null;
  if (parts.join(" ") === "one hundred") return 100;
  if (
    parts.length === 2 &&
    words[parts[0]] >= 20 &&
    words[parts[0]] % 10 === 0 &&
    words[parts[1]] > 0 &&
    words[parts[1]] < 10
  )
    return words[parts[0]] + words[parts[1]];
  return null;
}
export function confidenceMatchesQuote(candidate: number, quote: string) {
  const normalized = quote.toLowerCase().replace(/,/g, "");
  const tokens = normalized.match(/-?\d+(?:\.\d+)?|[a-z]+|\/|%/g) ?? [];
  const near = (value: number) => Math.abs(value - candidate) < 1e-8;
  for (let start = 0; start < tokens.length; start++) {
    for (let width = 1; width <= 3 && start + width <= tokens.length; width++) {
      const number = asNumber(tokens.slice(start, start + width).join(" "));
      if (number === null) continue;
      const rest = tokens.slice(start + width);
      if (rest[0] === "%" || rest[0] === "percent") {
        if (near(number)) return true;
        continue;
      }
      const ratioWords =
        rest[0] === "/" ? 1 : rest[0] === "out" && rest[1] === "of" ? 2 : rest[0] === "in" ? 1 : 0;
      if (ratioWords) {
        for (let denominatorWidth = 1; denominatorWidth <= 3; denominatorWidth++) {
          const denominator = asNumber(
            rest.slice(ratioWords, ratioWords + denominatorWidth).join(" "),
          );
          if (
            denominator !== null &&
            denominator > 0 &&
            number <= denominator &&
            near((number / denominator) * 100)
          )
            return true;
        }
        continue;
      }
      // Preserve bare explicit numbers and decimal probabilities supported by v2.
      if (
        !["/", "of", "in"].includes(tokens[start - 1]) &&
        /^\d+(?:\.\d+)?$/.test(tokens.slice(start, start + width).join(" ")) &&
        (near(number) || (number <= 1 && near(number * 100)))
      )
        return true;
    }
  }
  return false;
}
