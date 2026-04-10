"use client";

import { useEffect, useRef, useState } from "react";
import {
  ColorType,
  CrosshairMode,
  createChart,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type SeriesMarker,
  type Time,
} from "lightweight-charts";
import { toTradingViewSymbol } from "@/lib/tickers";

type Trade = {
  buyDate: string;
  buyPrice: number;
  sellDate: string;
  sellPrice: number;
  returnPct: number;
};

type CandleResponseItem = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

type ChartPanelProps = {
  selectedTicker: string;
  trades?: Trade[];
  showTradeMarkers?: boolean;
};

type QuoteResponse = {
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
  updatedAt: number;
  isMarketOpen: boolean;
};

const QUOTE_REFRESH_INTERVAL_MS = 30_000;
const LIVE_FRESHNESS_THRESHOLD_MS = 60_000;

function formatPrice(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatSigned(value: number, fractionDigits: number): string {
  const prefix = value >= 0 ? "+" : "";
  return `${prefix}${value.toFixed(fractionDigits)}`;
}

function buildTradeMarkers(trades: Trade[]): SeriesMarker<Time>[] {
  const markers = trades.flatMap((trade) => {
    const pnlText = `${trade.returnPct >= 0 ? "+" : ""}${trade.returnPct.toFixed(1)}%`;

    return [
      {
        time: trade.buyDate,
        position: "belowBar" as const,
        shape: "arrowUp" as const,
        color: "#00ff88",
        text: `BUY $${trade.buyPrice.toFixed(2)}`,
      },
      {
        time: trade.sellDate,
        position: "aboveBar" as const,
        shape: "arrowDown" as const,
        color: "#ff4466",
        text: `SELL $${trade.sellPrice.toFixed(2)} (${pnlText})`,
      },
    ];
  });

  return markers.sort((a, b) => {
    const left = String(a.time);
    const right = String(b.time);
    if (left === right) {
      if (a.shape === b.shape) {
        return 0;
      }
      return a.shape === "arrowUp" ? -1 : 1;
    }
    return left.localeCompare(right);
  });
}

export function ChartPanel({
  selectedTicker,
  trades = [],
  showTradeMarkers = true,
}: ChartPanelProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [chartError, setChartError] = useState<string | null>(null);
  const [candlesLoadedAt, setCandlesLoadedAt] = useState(0);
  const [candleWindow, setCandleWindow] = useState<{ from: string; to: string; count: number } | null>(
    null,
  );

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) {
      return;
    }

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: "#000000" },
        textColor: "#a1a1aa",
      },
      grid: {
        vertLines: { color: "#1a1a1a" },
        horzLines: { color: "#1a1a1a" },
      },
      rightPriceScale: {
        borderColor: "#1a1a1a",
      },
      timeScale: {
        borderColor: "#1a1a1a",
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      width: container.clientWidth,
      height: container.clientHeight || 420,
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#00ff88",
      downColor: "#ff4466",
      borderVisible: false,
      wickUpColor: "#00ff88",
      wickDownColor: "#ff4466",
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;

    const resizeChart = () => {
      if (!chartContainerRef.current) {
        return;
      }

      chart.applyOptions({
        width: chartContainerRef.current.clientWidth,
        height: chartContainerRef.current.clientHeight || 420,
      });
    };

    window.addEventListener("resize", resizeChart);

    return () => {
      window.removeEventListener("resize", resizeChart);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    if (!candleSeries) {
      return;
    }

    let active = true;

    const fetchCandles = async () => {
      try {
        setChartError(null);
        setCandleWindow(null);
        candleSeries.setData([]);
        candleSeries.setMarkers([]);

        const response = await fetch(`/api/candles?ticker=${encodeURIComponent(selectedTicker)}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Candles request failed: ${response.status}`);
        }

        const payload = (await response.json()) as CandleResponseItem[];

        if (!active) {
          return;
        }

        const candles: CandlestickData[] = payload.map((item) => ({
          time: item.date,
          open: item.open,
          high: item.high,
          low: item.low,
          close: item.close,
        }));

        if (payload.length > 0) {
          setCandleWindow({
            from: payload[0].date,
            to: payload[payload.length - 1].date,
            count: payload.length,
          });
        }

        candleSeries.setData(candles);
        candleSeries.setMarkers([]);
        chartRef.current?.timeScale().fitContent();
        setCandlesLoadedAt(Date.now());
      } catch {
        if (!active) {
          return;
        }

        setChartError("Chart data unavailable");
      }
    };

    void fetchCandles();

    return () => {
      active = false;
    };
  }, [selectedTicker]);

  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    if (!candleSeries) {
      return;
    }

    if (!showTradeMarkers || trades.length === 0) {
      candleSeries.setMarkers([]);
      return;
    }

    const markers = buildTradeMarkers(trades);
    candleSeries.setMarkers(markers);
  }, [candlesLoadedAt, showTradeMarkers, trades]);

  useEffect(() => {
    let active = true;

    const fetchQuote = async () => {
      try {
        const response = await fetch(`/api/quote/${encodeURIComponent(selectedTicker)}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Quote request failed: ${response.status}`);
        }

        const payload = (await response.json()) as QuoteResponse;

        if (!active) {
          return;
        }

        setQuote(payload);
        setQuoteError(null);
      } catch {
        if (!active) {
          return;
        }

        setQuoteError("Quote unavailable");
      }
    };

    void fetchQuote();
    const intervalId = window.setInterval(() => {
      void fetchQuote();
    }, QUOTE_REFRESH_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [selectedTicker]);

  const tradingViewSymbol = toTradingViewSymbol(selectedTicker);

  const isMarketClosed = quote ? !quote.isMarketOpen : false;
  const isFreshLive = quote
    ? Date.now() - quote.updatedAt < LIVE_FRESHNESS_THRESHOLD_MS
    : false;
  const displayPrice = quote
    ? isMarketClosed
      ? quote.prevClose
      : quote.price
    : null;
  const changeColor = quote
    ? quote.change >= 0
      ? "text-green-400"
      : "text-red-400"
    : "text-zinc-500";

  return (
    <section className="flex min-h-[480px] flex-1 flex-col border-b border-[#1a1a1a] lg:border-b-0">
      <div className="flex items-center justify-between border-b border-[#1a1a1a] px-3 py-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs tracking-[0.12em] text-zinc-300">{selectedTicker}</span>
            <span className="font-mono text-xs tracking-[0.12em] text-zinc-500">{tradingViewSymbol}</span>
          </div>
          {candleWindow ? (
            <span className="font-mono text-[10px] text-zinc-600">
              RANGE {candleWindow.from} → {candleWindow.to} ({candleWindow.count} candles)
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          {displayPrice !== null && quote ? (
            <>
              <span className="text-zinc-100">{formatPrice(displayPrice)}</span>
              <span className={changeColor}>
                {formatSigned(quote.change, 2)} ({formatSigned(quote.changePercent, 2)}%)
              </span>
              {isMarketClosed ? (
                <span className="rounded border border-[#3a3a3a] bg-[#171717] px-1.5 py-0.5 text-[10px] text-zinc-300">
                  CLOSED
                </span>
              ) : null}
              {!isMarketClosed && isFreshLive ? (
                <span className="inline-flex items-center gap-1 rounded border border-[#1f6b45] bg-[#123523] px-1.5 py-0.5 text-[10px] text-green-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                  LIVE
                </span>
              ) : null}
            </>
          ) : (
            <span className="text-zinc-500">Loading quote...</span>
          )}
          {quoteError ? <span className="text-red-400">{quoteError}</span> : null}
        </div>
      </div>
      <div className="flex-1 p-3">
        <div
          ref={chartContainerRef}
          className="h-full min-h-[420px] w-full border border-[#1a1a1a] bg-black"
        />
        {chartError ? (
          <p className="mt-2 font-mono text-xs text-red-400">{chartError}</p>
        ) : null}
      </div>
    </section>
  );
}
