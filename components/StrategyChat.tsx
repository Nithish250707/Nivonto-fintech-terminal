"use client";

import { FormEvent, useMemo, useState } from "react";
import { BacktestResults } from "@/components/BacktestResults";
import type { BacktestResult } from "@/lib/backtest";

type StrategyChatProps = {
  ticker: string;
  showTradesOnChart: boolean;
  onToggleShowTradesOnChart: () => void;
  onBacktestRunStart?: () => void;
  onBacktestResults?: (result: BacktestResult, meta?: StrategyMeta) => void;
};

type StrategyMeta = {
  requestedFrom: string;
  requestedTo: string;
  warmupFrom: string;
  from: string;
  to: string;
  windowDays: number;
  candleCount: number;
  signalCount: number;
  buySignals: number;
  sellSignals: number;
};

type StreamEvent =
  | { type: "status"; step: "thinking" | "writing" | "retrying" | "running" | "done" }
  | { type: "code_delta"; delta: string }
  | { type: "code_reset"; code: string }
  | {
      type: "result";
      code: string;
      backtest: BacktestResult;
      meta: StrategyMeta;
    }
  | { type: "error"; message: string };

function statusLabel(step: string): string {
  if (step === "thinking") {
    return "Thinking...";
  }
  if (step === "writing") {
    return "Writing strategy code...";
  }
  if (step === "retrying") {
    return "Fixing strategy code...";
  }
  if (step === "running") {
    return "Running backtest...";
  }
  if (step === "done") {
    return "Completed";
  }
  return "Idle";
}

const DEFAULT_RANGE_DAYS = 365;

export function StrategyChat({
  ticker,
  showTradesOnChart,
  onToggleShowTradesOnChart,
  onBacktestRunStart,
  onBacktestResults,
}: StrategyChatProps) {
  const [prompt, setPrompt] = useState("");
  const [lastPrompt, setLastPrompt] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");
  const [editingCode, setEditingCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusStep, setStatusStep] = useState("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [meta, setMeta] = useState<StrategyMeta | null>(null);

  const statusText = useMemo(() => statusLabel(statusStep), [statusStep]);

  const runStrategyPipeline = async (payload: { prompt?: string; code?: string }) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setMeta(null);
    onBacktestRunStart?.();

    if (payload.prompt && !payload.code) {
      setGeneratedCode("");
      setStatusStep("thinking");
    } else {
      setStatusStep("running");
    }

    try {
      const from = new Date(Date.now() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      const to = new Date().toISOString().split("T")[0];

      const response = await fetch("/api/strategy-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: payload.prompt,
          code: payload.code,
          ticker,
          from,
          to,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Strategy request failed (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) {
            continue;
          }

          const event = JSON.parse(trimmed) as StreamEvent;
          if (event.type === "status") {
            setStatusStep(event.step);
            continue;
          }

          if (event.type === "code_delta") {
            setGeneratedCode((prev) => `${prev}${event.delta}`);
            continue;
          }

          if (event.type === "code_reset") {
            setGeneratedCode(event.code);
            continue;
          }

          if (event.type === "result") {
            setGeneratedCode(event.code);
            setResult(event.backtest);
            setMeta(event.meta);
            if (event.backtest.trades.length === 0) {
              setError("No completed trades generated. Try Regenerate or edit exit logic.");
            }
            onBacktestResults?.(event.backtest, event.meta);
            continue;
          }

          if (event.type === "error") {
            setError(event.message);
            setStatusStep("error");
          }
        }

        if (done) {
          break;
        }
      }
    } catch (pipelineError) {
      const message = pipelineError instanceof Error ? pipelineError.message : "Request failed";
      setError(message);
      setStatusStep("error");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async (event: FormEvent) => {
    event.preventDefault();
    const nextPrompt = prompt.trim();
    if (!nextPrompt) {
      return;
    }

    setLastPrompt(nextPrompt);
    await runStrategyPipeline({ prompt: nextPrompt });
  };

  const handleRunBacktest = async () => {
    const code = generatedCode.trim();
    if (!code) {
      return;
    }

    await runStrategyPipeline({
      code,
      prompt: prompt.trim() || lastPrompt || undefined,
    });
  };

  const handleRegenerate = async () => {
    const nextPrompt = prompt.trim();
    if (!nextPrompt) {
      return;
    }

    setLastPrompt(nextPrompt);
    await runStrategyPipeline({ prompt: nextPrompt });
  };

  return (
    <section className="border border-[#1f1f1f] bg-[#0b0b0b] p-4">
      <form onSubmit={handleGenerate} className="space-y-3">
        <label htmlFor="strategy-prompt" className="font-mono text-xs text-zinc-500">
          Describe your strategy in plain English...
        </label>
        <div className="flex gap-2">
          <input
            id="strategy-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Buy when RSI crosses above 30 and price is above 200-day SMA..."
            className="h-10 flex-1 border border-[#2a2a2a] bg-[#0d0d0d] px-3 font-mono text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-[#22c55e] focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="h-10 rounded border border-[#1f6b45] bg-[#123523] px-3 font-mono text-xs text-green-300 hover:bg-[#184b30] disabled:opacity-60"
          >
            Generate
          </button>
        </div>
      </form>

      <div className="mt-4 space-y-2">
        <p className="font-mono text-xs text-zinc-500">{statusText}</p>
        {meta ? (
          <p className="font-mono text-xs text-zinc-500">
            Window: {meta.from} to {meta.to} ({meta.windowDays}d, {meta.candleCount} candles) · Warmup:
            from {meta.warmupFrom} · Signals: {meta.signalCount} (B{meta.buySignals}/S{meta.sellSignals})
          </p>
        ) : null}
        {meta ? (
          <p className="font-mono text-[11px] text-zinc-600">
            Requested: {meta.requestedFrom} to {meta.requestedTo}
          </p>
        ) : null}
        {error ? <p className="font-mono text-xs text-red-400">{error}</p> : null}
      </div>

      <div className="mt-4 rounded border border-[#1f1f1f] bg-[#101010] p-3">
        {editingCode ? (
          <textarea
            value={generatedCode}
            onChange={(event) => setGeneratedCode(event.target.value)}
            className="h-64 w-full resize-y border border-[#2a2a2a] bg-[#0c0c0c] p-2 font-mono text-xs text-zinc-200 focus:border-[#22c55e] focus:outline-none"
          />
        ) : (
          <pre className="min-h-32 overflow-x-auto whitespace-pre-wrap font-mono text-xs text-zinc-200">
            {generatedCode || "// Generated strategy code will appear here"}
          </pre>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void handleRunBacktest()}
          disabled={loading || !generatedCode.trim()}
          className="rounded border border-[#1f6b45] bg-[#123523] px-3 py-1.5 font-mono text-xs text-green-300 hover:bg-[#184b30] disabled:opacity-60"
        >
          Run Backtest
        </button>
        <button
          type="button"
          onClick={() => setEditingCode((prev) => !prev)}
          disabled={loading || !generatedCode.trim()}
          className="rounded border border-[#2a2a2a] bg-[#141414] px-3 py-1.5 font-mono text-xs text-zinc-300 hover:bg-[#1c1c1c] disabled:opacity-60"
        >
          {editingCode ? "Done Editing" : "Edit Code"}
        </button>
        <button
          type="button"
          onClick={() => void handleRegenerate()}
          disabled={loading || !prompt.trim()}
          className="rounded border border-[#2a2a2a] bg-[#141414] px-3 py-1.5 font-mono text-xs text-zinc-300 hover:bg-[#1c1c1c] disabled:opacity-60"
        >
          Regenerate
        </button>
      </div>

      {result ? (
        <BacktestResults
          results={result}
          showOnChart={showTradesOnChart}
          onToggleShowOnChart={onToggleShowTradesOnChart}
        />
      ) : null}
    </section>
  );
}
