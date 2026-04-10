const MASSIVE_BASE_URL = "https://api.massive.com";

type MassiveNewsItem = {
  title: string;
  published_utc: string;
  article_url: string;
  description: string;
};

type MassiveAggResult = {
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  t: number;
};

type MassiveAggsResponse = {
  status?: string;
  error?: string;
  message?: string;
  results?: MassiveAggResult[];
};

function getApiKey(): string {
  const apiKey = process.env.MASSIVE_API_KEY;

  if (!apiKey) {
    throw new Error("MASSIVE_API_KEY is not set");
  }

  return apiKey;
}

export async function getLatestPrice(ticker: string) {
  const apiKey = getApiKey();
  const url = `${MASSIVE_BASE_URL}/v2/aggs/ticker/${encodeURIComponent(ticker)}/prev?adjusted=true&apiKey=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url);
  const data = (await response.json()) as {
    results?: Array<{
      o: number;
      h: number;
      l: number;
      c: number;
      v: number;
      t: number;
    }>;
  };

  const latest = data.results?.[0];

  if (!latest) {
    throw new Error(`No previous close data found for ${ticker}`);
  }

  const change = latest.c - latest.o;
  const changePct = ((latest.c - latest.o) / latest.o) * 100;

  return {
    open: latest.o,
    high: latest.h,
    low: latest.l,
    close: latest.c,
    volume: latest.v,
    change,
    changePct,
  };
}

export async function getHistoricalCandles(ticker: string, from: string, to: string) {
  const normalizedTicker = ticker.trim().toUpperCase();
  if (!normalizedTicker) {
    throw new Error("ticker is required");
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    throw new Error("from and to must be in YYYY-MM-DD format");
  }

  if (from > to) {
    throw new Error("from date must be before to date");
  }

  const apiKey = getApiKey();
  const url = `${MASSIVE_BASE_URL}/v2/aggs/ticker/${encodeURIComponent(normalizedTicker)}/range/1/day/${encodeURIComponent(from)}/${encodeURIComponent(to)}?adjusted=true&sort=asc&limit=5000&apiKey=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, { cache: "no-store" });
  const data = (await response.json().catch(() => ({}))) as MassiveAggsResponse;

  if (!response.ok) {
    const errorMessage = data.error ?? data.message ?? `Massive request failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  if (data.status === "ERROR") {
    throw new Error(data.error ?? data.message ?? "Massive returned an error for historical candles");
  }

  const rawResults = data.results ?? [];

  return rawResults
    .filter(
      (result) =>
        Number.isFinite(result.t) &&
        Number.isFinite(result.o) &&
        Number.isFinite(result.h) &&
        Number.isFinite(result.l) &&
        Number.isFinite(result.c) &&
        Number.isFinite(result.v),
    )
    .map((result) => ({
      date: new Date(result.t).toISOString().split("T")[0],
      open: result.o,
      high: result.h,
      low: result.l,
      close: result.c,
      volume: result.v,
    }));
}

export async function getTickerNews(ticker: string) {
  const apiKey = getApiKey();
  const url = `${MASSIVE_BASE_URL}/v2/reference/news?ticker=${encodeURIComponent(ticker)}&limit=5&apiKey=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url);
  const data = (await response.json()) as { results: MassiveNewsItem[] };

  return data.results;
}

export async function getTickerDetails(ticker: string) {
  const apiKey = getApiKey();
  const url = `${MASSIVE_BASE_URL}/v3/reference/tickers/${encodeURIComponent(ticker)}?apiKey=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url);
  const data = await response.json();

  return data.results;
}
