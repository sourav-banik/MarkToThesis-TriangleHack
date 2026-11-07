import { instrumentSchema, type Instrument } from "./contracts";

const equity = (
  symbol: string,
  name: string,
  assetClass: "stock" | "etf",
  venue = "NASDAQ",
): Instrument =>
  instrumentSchema.parse({
    id: `us:${venue.toLowerCase()}:${symbol.toLowerCase()}`,
    symbol,
    name,
    assetClass,
    venue,
    definition: `${name}, U.S. ${assetClass === "stock" ? "common stock" : "ETF"} listing on ${venue}.`,
    quote: { kind: "price", currency: "USD", unit: "share" },
    observation: {
      calendar: "exchange_sessions",
      timeZone: "America/New_York",
      fixing: "Regular-session closing price",
    },
  });

const crypto = (symbol: string, name: string): Instrument =>
  instrumentSchema.parse({
    id: `crypto:${symbol.toLowerCase()}:usd`,
    symbol: `${symbol}/USD`,
    name,
    assetClass: "crypto",
    venue: "Reference spot series",
    definition: `${name} spot in USD. A specific exchange or reference-price provider must be bound before live commitment.`,
    quote: { kind: "price", currency: "USD", unit: symbol },
    observation: {
      calendar: "utc_daily",
      timeZone: "UTC",
      fixing: "UTC daily close; reference provider not yet connected",
    },
  });

export const instruments = {
  aapl: equity("AAPL", "Apple", "stock"),
  msft: equity("MSFT", "Microsoft", "stock"),
  nvda: equity("NVDA", "NVIDIA", "stock"),
  spy: equity("SPY", "SPDR S&P 500 ETF", "etf", "NYSE ARCA"),
  qqq: equity("QQQ", "Invesco QQQ", "etf"),
  gld: equity("GLD", "SPDR Gold Shares", "etf", "NYSE ARCA"),
  treasury5y: instrumentSchema.parse({
    id: "us:treasury:constant-maturity:5y",
    symbol: "US5Y",
    name: "U.S. 5-year Treasury yield",
    assetClass: "sovereign_yield",
    venue: "Federal Reserve H.15 / FRED DGS5",
    definition:
      "U.S. Treasury 5-year constant-maturity market yield, quoted on an investment basis. A yield series, not a bond or ETF return.",
    quote: { kind: "yield", unit: "percent", tenorYears: 5 },
    observation: {
      calendar: "publisher_daily",
      timeZone: "America/New_York",
      fixing: "Dated H.15 observation; publication time must be retained",
    },
  }),
  treasury10y: instrumentSchema.parse({
    id: "us:treasury:constant-maturity:10y",
    symbol: "US10Y",
    name: "U.S. 10-year Treasury yield",
    assetClass: "sovereign_yield",
    venue: "Federal Reserve H.15 / FRED DGS10",
    definition:
      "U.S. Treasury 10-year constant-maturity market yield, quoted on an investment basis. A yield benchmark, not a bond or ETF return.",
    quote: { kind: "yield", unit: "percent", tenorYears: 10 },
    observation: {
      calendar: "publisher_daily",
      timeZone: "America/New_York",
      fixing: "Dated H.15 observation; publication time must be retained",
    },
  }),
  gold: instrumentSchema.parse({
    id: "commodity:gold:spot:usd",
    symbol: "XAU/USD",
    name: "Gold spot",
    assetClass: "commodity",
    venue: "Reference spot series",
    definition:
      "Gold spot price in USD per troy ounce. Not GLD or a futures contract; a reference fixing must be bound before live commitment.",
    quote: { kind: "price", currency: "USD", unit: "troy oz" },
    observation: {
      calendar: "publisher_daily",
      timeZone: "UTC",
      fixing: "Provider daily fixing; reference provider not yet connected",
    },
  }),
  wti: instrumentSchema.parse({
    id: "commodity:wti:cushing:spot:usd",
    symbol: "WTI",
    name: "WTI crude oil",
    assetClass: "commodity",
    venue: "Cushing spot reference",
    definition:
      "WTI Cushing spot price in USD per barrel. Not a front-month or continuous futures series.",
    quote: { kind: "price", currency: "USD", unit: "barrel", allowNonPositive: true },
    observation: {
      calendar: "publisher_daily",
      timeZone: "America/New_York",
      fixing: "Published spot observation; reference provider not yet connected",
    },
  }),
  btc: crypto("BTC", "Bitcoin"),
  eth: crypto("ETH", "Ethereum"),
  eurusd: instrumentSchema.parse({
    id: "fx:eur:usd:spot",
    symbol: "EUR/USD",
    name: "Euro / U.S. dollar",
    assetClass: "fx",
    venue: "Reference spot series",
    definition:
      "U.S. dollars per euro at a specified provider daily fixing; provider must be bound before live commitment.",
    quote: { kind: "price", currency: "USD", unit: "EUR" },
    observation: {
      calendar: "publisher_daily",
      timeZone: "UTC",
      fixing: "Provider daily FX fixing; reference provider not yet connected",
    },
  }),
} satisfies Record<string, Instrument>;

// A starter discovery catalog, not a hard-coded validation allowlist or a coverage guarantee.
export const instrumentCatalog = Object.values(instruments);

export const assetClassLabels = {
  stock: "Stock",
  etf: "ETF",
  index: "Index",
  crypto: "Crypto",
  commodity: "Commodity",
  fx: "FX",
  sovereign_yield: "Treasury yield",
} as const;
