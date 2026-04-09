export type WatchItem = {
  symbol: string;
  name: string;
  price: string;
  change: string;
  positive: boolean;
  tradingViewSymbol: string;
};

export const WATCHLIST_ITEMS: WatchItem[] = [
  {
    symbol: "AAPL",
    name: "Apple",
    price: "$214.25",
    change: "+1.34%",
    positive: true,
    tradingViewSymbol: "NASDAQ:AAPL",
  },
  {
    symbol: "NVDA",
    name: "NVIDIA",
    price: "$982.40",
    change: "-0.62%",
    positive: false,
    tradingViewSymbol: "NASDAQ:NVDA",
  },
  {
    symbol: "RELIANCE.NS",
    name: "Reliance",
    price: "INR 2,958.10",
    change: "+0.91%",
    positive: true,
    tradingViewSymbol: "NSE:RELIANCE",
  },
  {
    symbol: "INFY.NS",
    name: "Infosys",
    price: "INR 1,488.45",
    change: "-0.38%",
    positive: false,
    tradingViewSymbol: "NSE:INFY",
  },
  {
    symbol: "BTC-USD",
    name: "Bitcoin",
    price: "$68,421.12",
    change: "+2.07%",
    positive: true,
    tradingViewSymbol: "BITSTAMP:BTCUSD",
  },
];

export function toTradingViewSymbol(symbol: string): string {
  const normalized = symbol.trim().toUpperCase();

  const known = WATCHLIST_ITEMS.find((item) => item.symbol === normalized);
  if (known) {
    return known.tradingViewSymbol;
  }

  if (normalized.endsWith(".NS")) {
    return `NSE:${normalized.replace(".NS", "")}`;
  }

  if (normalized === "BTC-USD") {
    return "BITSTAMP:BTCUSD";
  }

  if (normalized.includes(":")) {
    return normalized;
  }

  return `NASDAQ:${normalized}`;
}

export function marketLabelFromSymbol(symbol: string): string {
  const normalized = symbol.toUpperCase();

  if (normalized.endsWith(".NS") || normalized.startsWith("NSE:")) {
    return "NSE";
  }

  if (normalized === "BTC-USD" || normalized.includes("BTC")) {
    return "CRYPTO";
  }

  return "NASDAQ";
}
