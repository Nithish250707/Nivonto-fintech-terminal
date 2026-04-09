"use client";

import { FormEvent, useEffect, useState } from "react";
import { BacktestStatsBar, type BacktestStatsResults } from "@/components/BacktestStatsBar";
import { ChartPanel } from "@/components/ChartPanel";
import { StrategyBuilder, type SavedStrategy } from "@/components/StrategyBuilder";

type BacktestTrade = {
  buyDate: string;
  buyPrice: number;
  sellDate: string;
  sellPrice: number;
};

export default function StrategiesPage() {
  const [activeTicker, setActiveTicker] = useState("AAPL");
  const [tickerInput, setTickerInput] = useState("AAPL");
  const [backtestTrades, setBacktestTrades] = useState<BacktestTrade[]>([]);
  const [backtestResults, setBacktestResults] = useState<BacktestStatsResults | null>(null);
  const [savedStrategies, setSavedStrategies] = useState<SavedStrategy[]>([]);
  const [loadedStrategy, setLoadedStrategy] = useState<SavedStrategy | null>(null);
  const [strategiesLoading, setStrategiesLoading] = useState(false);
  const [strategiesError, setStrategiesError] = useState<string | null>(null);

  const fetchSavedStrategies = async (): Promise<SavedStrategy[]> => {
    setStrategiesLoading(true);
    setStrategiesError(null);

    const response = await fetch("/api/strategies", { cache: "no-store" });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      const message = payload.error ?? "Failed to load strategies";
      setStrategiesError(message);
      setStrategiesLoading(false);
      return [];
    }

    const data = (await response.json()) as SavedStrategy[];
    setStrategiesLoading(false);
    return data;
  };

  useEffect(() => {
    let cancelled = false;

    const loadOnMount = async () => {
      const data = await fetchSavedStrategies();
      if (!cancelled) {
        setSavedStrategies(data);
      }
    };

    void loadOnMount();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextTicker = tickerInput.trim().toUpperCase();
    if (!nextTicker) {
      return;
    }

    setActiveTicker(nextTicker);
    setTickerInput(nextTicker);
    setBacktestTrades([]);
    setBacktestResults(null);
    setLoadedStrategy(null);
  };

  const handleSelectStrategy = (strategy: SavedStrategy) => {
    setLoadedStrategy(strategy);
    setActiveTicker(strategy.ticker);
    setTickerInput(strategy.ticker);
    setBacktestTrades([]);
    setBacktestResults(null);
  };

  const handleNewStrategy = () => {
    setLoadedStrategy(null);
    setBacktestTrades([]);
    setBacktestResults(null);
  };

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-zinc-100">
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 p-4 lg:p-6">
        <header className="border border-[#1f1f1f] bg-[#0b0b0b] p-4">
          <p className="font-mono text-sm tracking-[0.12em] text-zinc-300">STRATEGY BUILDER</p>
          <p className="mt-1 text-sm text-zinc-500">
            Build and backtest rule-based trading strategies
          </p>

          <form onSubmit={handleSubmit} className="mt-4 flex flex-wrap items-center gap-2">
            <label htmlFor="strategy-ticker" className="font-mono text-xs text-zinc-500">
              TICKER
            </label>
            <input
              id="strategy-ticker"
              type="text"
              value={tickerInput}
              onChange={(event) => setTickerInput(event.target.value)}
              placeholder="AAPL"
              className="h-9 w-[180px] border border-[#2a2a2a] bg-[#0d0d0d] px-2 font-mono text-sm text-zinc-300 placeholder:text-zinc-600 focus:border-[#22c55e] focus:outline-none"
            />
            <span className="font-mono text-xs text-zinc-500">Press Enter to apply</span>
          </form>
        </header>

        <div className="border border-[#1f1f1f] bg-[#0b0b0b]">
          <ChartPanel selectedTicker={activeTicker} trades={backtestTrades} />
          <BacktestStatsBar results={backtestResults} />
        </div>

        <div className="flex min-h-[420px] gap-4">
          <aside className="w-64 border border-[#1f1f1f] bg-[#0b0b0b]">
            <div className="border-b border-[#1e1e1e] p-3">
              <button
                type="button"
                onClick={handleNewStrategy}
                className="w-full rounded border border-[#1f6b45] bg-[#123523] px-3 py-2 font-mono text-xs text-green-300 hover:bg-[#184b30]"
              >
                NEW STRATEGY
              </button>
            </div>

            <div className="max-h-[520px] space-y-2 overflow-y-auto p-3">
              {strategiesLoading ? (
                <p className="font-mono text-xs text-zinc-500">Loading strategies...</p>
              ) : null}
              {strategiesError ? (
                <p className="font-mono text-xs text-red-400">{strategiesError}</p>
              ) : null}

              {savedStrategies.map((strategy) => {
                const isActive = loadedStrategy?.id === strategy.id;
                return (
                  <button
                    key={strategy.id}
                    type="button"
                    onClick={() => handleSelectStrategy(strategy)}
                    className={`w-full border p-2 text-left ${
                      isActive
                        ? "border-[#22c55e] bg-[#111]"
                        : "border-[#2a2a2a] bg-[#0d0d0d] hover:bg-[#101010]"
                    }`}
                  >
                    <p className="truncate font-mono text-xs text-zinc-200">{strategy.name}</p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="rounded border border-[#2a2a2a] bg-[#141414] px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                        {strategy.ticker}
                      </span>
                      <span className="font-mono text-[10px] text-zinc-500">
                        {new Date(strategy.createdAt).toISOString().split("T")[0]}
                      </span>
                    </div>
                  </button>
                );
              })}

              {!strategiesLoading && !strategiesError && savedStrategies.length === 0 ? (
                <p className="font-mono text-xs text-zinc-500">No saved strategies yet.</p>
              ) : null}
            </div>
          </aside>

          <div className="flex-1">
            <StrategyBuilder
              ticker={activeTicker}
              loadedStrategy={loadedStrategy}
              onStrategySaved={() => {
                void fetchSavedStrategies().then((data) => {
                  setSavedStrategies(data);
                });
              }}
              onStrategyDeleted={(strategyId) => {
                setSavedStrategies((prev) => prev.filter((item) => item.id !== strategyId));
                setLoadedStrategy(null);
                setBacktestTrades([]);
                setBacktestResults(null);
              }}
              onBacktestResults={(results) => {
                setBacktestTrades(results.trades);
                setBacktestResults({
                  totalReturn: results.totalReturn,
                  maxDrawdown: results.maxDrawdown,
                  winRate: results.winRate,
                  sharpeRatio: results.sharpeRatio,
                  trades: results.trades,
                });
              }}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
