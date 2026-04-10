"use client";

import { useEffect, useState } from "react";
import { BacktestResults } from "@/components/BacktestResults";
import { RuleRow } from "@/components/RuleRow";

export type Rule = {
  indicator: "RSI" | "SMA" | "EMA" | "PRICE";
  comparator: ">" | "<" | "crosses_above" | "crosses_below";
  value: number;
  period: number;
};

export type StrategyRules = {
  buyRules: Rule[];
  sellRules: Rule[];
};

export type SavedStrategy = {
  id: string;
  name: string;
  ticker: string;
  rules: StrategyRules;
  createdAt: string;
};

type BacktestTrade = {
  buyDate: string;
  buyPrice: number;
  sellDate: string;
  sellPrice: number;
  returnPct: number;
};

type BacktestEquityPoint = {
  date: string;
  value: number;
};

type BacktestResult = {
  trades: BacktestTrade[];
  equityCurve: BacktestEquityPoint[];
  totalReturn: number;
  maxDrawdown: number;
  winRate: number;
  sharpeRatio: number;
};

type StrategyBuilderProps = {
  ticker: string;
  onBacktestResults?: (results: BacktestResult) => void;
  onBacktestRunStart?: () => void;
  loadedStrategy?: SavedStrategy | null;
  onStrategySaved?: () => void;
  onStrategyDeleted?: (strategyId: string) => void;
  showTradesOnChart?: boolean;
  onToggleShowTradesOnChart?: () => void;
};

type RuleType = "buy" | "sell";

const defaultRule: Rule = {
  indicator: "RSI",
  comparator: "<",
  value: 30,
  period: 14,
};

export function StrategyBuilder({
  ticker,
  onBacktestResults,
  onBacktestRunStart,
  loadedStrategy,
  onStrategySaved,
  onStrategyDeleted,
  showTradesOnChart = true,
  onToggleShowTradesOnChart,
}: StrategyBuilderProps) {
  const [name, setName] = useState("My Strategy");
  const [buyRules, setBuyRules] = useState<Rule[]>([{ ...defaultRule }]);
  const [sellRules, setSellRules] = useState<Rule[]>([
    { indicator: "RSI", comparator: ">", value: 70, period: 14 },
  ]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BacktestResult | null>(null);
  const [backtestError, setBacktestError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!loadedStrategy) {
      setName("My Strategy");
      setBuyRules([{ ...defaultRule }]);
      setSellRules([{ indicator: "RSI", comparator: ">", value: 70, period: 14 }]);
      setResults(null);
      setDeleteError(null);
      return;
    }

    setName(loadedStrategy.name);
    setBuyRules(
      loadedStrategy.rules.buyRules.length > 0
        ? loadedStrategy.rules.buyRules.map((rule) => ({ ...rule }))
        : [{ ...defaultRule }],
    );
    setSellRules(
      loadedStrategy.rules.sellRules.length > 0
        ? loadedStrategy.rules.sellRules.map((rule) => ({ ...rule }))
        : [{ indicator: "RSI", comparator: ">", value: 70, period: 14 }],
    );
    setResults(null);
    setDeleteError(null);
  }, [loadedStrategy]);

  const addRule = (type: RuleType) => {
    if (type === "buy") {
      setBuyRules((prev) => [...prev, { ...defaultRule }]);
      return;
    }

    setSellRules((prev) => [...prev, { ...defaultRule }]);
  };

  const updateRule = (type: RuleType, index: number, rule: Rule) => {
    if (type === "buy") {
      setBuyRules((prev) => prev.map((item, i) => (i === index ? rule : item)));
      return;
    }

    setSellRules((prev) => prev.map((item, i) => (i === index ? rule : item)));
  };

  const deleteRule = (type: RuleType, index: number) => {
    if (type === "buy") {
      setBuyRules((prev) => prev.filter((_, i) => i !== index));
      return;
    }

    setSellRules((prev) => prev.filter((_, i) => i !== index));
  };

  const runBacktest = async () => {
    setLoading(true);
    setBacktestError(null);
    onBacktestRunStart?.();

    try {
      const response = await fetch("/api/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, rules: { buyRules, sellRules } }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Backtest failed");
      }

      const data = (await response.json()) as BacktestResult;
      setResults(data);
      onBacktestResults?.(data);
    } catch (error) {
      setBacktestError(error instanceof Error ? error.message : "Backtest failed");
    } finally {
      setLoading(false);
    }
  };

  const saveStrategy = async () => {
    setSaving(true);
    setSaveError(null);

    try {
      const response = await fetch("/api/strategies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          ticker,
          rules: { buyRules, sellRules },
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Failed to save strategy");
      }

      onStrategySaved?.();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to save strategy");
    } finally {
      setSaving(false);
    }
  };

  const deleteStrategy = async () => {
    if (!loadedStrategy) {
      return;
    }

    setDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch(`/api/strategies/${loadedStrategy.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Failed to delete strategy");
      }

      onStrategyDeleted?.(loadedStrategy.id);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Failed to delete strategy");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="w-full border border-[#232323] bg-[#0b0b0b] p-4">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#1e1e1e] pb-3">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="h-9 min-w-[220px] flex-1 bg-transparent px-2 font-mono text-sm text-green-400 focus:outline-none"
          placeholder="Strategy name"
        />
        <span className="rounded border border-[#2a2a2a] bg-[#111] px-2 py-1 font-mono text-xs text-zinc-400">
          {ticker}
        </span>
        <button
          type="button"
          onClick={() => void runBacktest()}
          disabled={loading || saving || deleting}
          className="rounded border border-[#1f6b45] bg-[#123523] px-3 py-2 font-mono text-xs text-green-300 hover:bg-[#184b30] disabled:opacity-60"
        >
          {loading ? "Running..." : "▶ Run Backtest"}
        </button>
        <button
          type="button"
          onClick={() => void saveStrategy()}
          disabled={loading || saving || deleting}
          className="rounded border border-[#2a2a2a] bg-[#141414] px-3 py-2 font-mono text-xs text-zinc-300 hover:bg-[#1c1c1c] disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        {loadedStrategy ? (
          <button
            type="button"
            onClick={() => void deleteStrategy()}
            disabled={loading || saving || deleting}
            className="rounded border border-[#5a2323] bg-[#221111] px-3 py-2 font-mono text-xs text-red-300 hover:bg-[#2a1515] disabled:opacity-60"
          >
            {deleting ? "Deleting..." : "Delete Strategy"}
          </button>
        ) : null}
      </div>

      {backtestError ? <p className="mt-2 font-mono text-xs text-red-400">{backtestError}</p> : null}
      {saveError ? <p className="mt-2 font-mono text-xs text-red-400">{saveError}</p> : null}
      {deleteError ? <p className="mt-2 font-mono text-xs text-red-400">{deleteError}</p> : null}

      <div className="mt-4 space-y-6">
        <div className="space-y-2">
          <p className="font-mono text-xs text-green-400">BUY WHEN</p>
          {buyRules.map((rule, index) => (
            <RuleRow
              key={`buy-${index}`}
              rule={rule}
              onChange={(nextRule) => updateRule("buy", index, nextRule)}
              onDelete={() => deleteRule("buy", index)}
            />
          ))}
          <button
            type="button"
            onClick={() => addRule("buy")}
            className="font-mono text-xs text-zinc-500 hover:text-zinc-300"
          >
            + Add Condition
          </button>
        </div>

        <div className="space-y-2">
          <p className="font-mono text-xs text-red-400">SELL WHEN</p>
          {sellRules.map((rule, index) => (
            <RuleRow
              key={`sell-${index}`}
              rule={rule}
              onChange={(nextRule) => updateRule("sell", index, nextRule)}
              onDelete={() => deleteRule("sell", index)}
            />
          ))}
          <button
            type="button"
            onClick={() => addRule("sell")}
            className="font-mono text-xs text-zinc-500 hover:text-zinc-300"
          >
            + Add Condition
          </button>
        </div>
      </div>

      {loading ? (
        <p className="mt-4 animate-pulse font-mono text-sm text-zinc-500">⟳ Running backtest...</p>
      ) : null}

      {results ? (
        <BacktestResults
          results={results}
          showOnChart={showTradesOnChart}
          onToggleShowOnChart={onToggleShowTradesOnChart ?? (() => {})}
        />
      ) : null}
    </section>
  );
}
