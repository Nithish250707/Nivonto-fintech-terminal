const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";

type FinnhubQuoteResponse = {
  c: number;
  h: number;
  l: number;
  o: number;
  pc: number;
  dp: number;
  t: number;
};

type FinnhubEarningsItem = {
  date: string;
  epsActual: number | null;
  epsEstimate: number | null;
  hour: string;
  quarter: number;
  revenueActual: number | null;
  revenueEstimate: number | null;
  symbol: string;
  year: number;
};

type FinnhubEarningsResponse = {
  earningsCalendar?: FinnhubEarningsItem[];
  error?: string;
};

function getApiKey(): string {
  const apiKey = process.env.FINNHUB_API_KEY;

  if (!apiKey) {
    throw new Error("FINNHUB_API_KEY is not set");
  }

  return apiKey;
}

function normalizeTicker(ticker: string): string {
  const normalizedTicker = ticker.trim().toUpperCase();

  if (!normalizedTicker) {
    throw new Error("ticker is required");
  }

  return normalizedTicker;
}

function isValidQuotePayload(data: Partial<FinnhubQuoteResponse>): data is FinnhubQuoteResponse {
  return (
    Number.isFinite(data.c) &&
    Number.isFinite(data.h) &&
    Number.isFinite(data.l) &&
    Number.isFinite(data.o) &&
    Number.isFinite(data.pc) &&
    Number.isFinite(data.dp) &&
    Number.isFinite(data.t)
  );
}

export type FinnhubQuote = {
  current: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
  change: number;
  changePercent: number;
  updatedAt: number;
};

export async function getQuote(ticker: string): Promise<FinnhubQuote> {
  const symbol = normalizeTicker(ticker);
  const apiKey = getApiKey();
  const url = `${FINNHUB_BASE_URL}/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, { cache: "no-store" });
  const data = (await response.json().catch(() => ({}))) as Partial<FinnhubQuoteResponse> & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error ?? `Finnhub quote request failed with status ${response.status}`);
  }

  if (!isValidQuotePayload(data)) {
    throw new Error(`Invalid Finnhub quote response for ${symbol}`);
  }

  return {
    current: data.c,
    high: data.h,
    low: data.l,
    open: data.o,
    prevClose: data.pc,
    change: data.c - data.pc,
    changePercent: data.dp,
    updatedAt: data.t * 1000,
  };
}

export async function getEarningsCalendar(ticker: string): Promise<FinnhubEarningsItem[]> {
  const symbol = normalizeTicker(ticker);
  const apiKey = getApiKey();

  const from = new Date();
  const to = new Date();
  to.setDate(to.getDate() + 90);

  const fromDate = from.toISOString().split("T")[0];
  const toDate = to.toISOString().split("T")[0];

  const url = `${FINNHUB_BASE_URL}/calendar/earnings?symbol=${encodeURIComponent(symbol)}&from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}&token=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, { cache: "no-store" });
  const data = (await response.json().catch(() => ({}))) as FinnhubEarningsResponse;

  if (!response.ok) {
    throw new Error(data.error ?? `Finnhub earnings request failed with status ${response.status}`);
  }

  return data.earningsCalendar ?? [];
}
