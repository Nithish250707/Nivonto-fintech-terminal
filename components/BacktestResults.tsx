"use client";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Trade = {
  buyDate: string;
  buyPrice: number;
  sellDate: string;
  sellPrice: number;
  returnPct: number;
};

type EquityPoint = {
  date: string;
  value: number;
};

type BacktestResultsData = {
  trades: Trade[];
  equityCurve: EquityPoint[];
  totalReturn: number;
  maxDrawdown: number;
  winRate: number;
  sharpeRatio: number;
};

type BacktestResultsProps = {
  results: BacktestResultsData;
  showOnChart?: boolean;
  onToggleShowOnChart?: () => void;
};

function formatSignedPercent(value: number): string {
  const rounded = value.toFixed(1);
  return value > 0 ? `+${rounded}%` : `${rounded}%`;
}

function formatMoney(value: number): string {
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function BacktestResults({
  results,
  showOnChart,
  onToggleShowOnChart,
}: BacktestResultsProps) {
  return (
    <section className="mt-4 space-y-4">
      {typeof showOnChart === "boolean" && onToggleShowOnChart ? (
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={onToggleShowOnChart}
            className={`rounded border px-2 py-1 font-mono text-[11px] ${
              showOnChart
                ? "border-[#1f6b45] bg-[#123523] text-green-300"
                : "border-[#2a2a2a] bg-[#141414] text-zinc-300"
            }`}
          >
            {showOnChart ? "Hide on Chart" : "Show on Chart"}
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded border border-[#2a2a2a] bg-[#111] p-3 font-mono">
          <p className="text-[11px] text-zinc-500">Total Return</p>
          <p className={`text-sm ${results.totalReturn >= 0 ? "text-green-400" : "text-red-400"}`}>
            {formatSignedPercent(results.totalReturn)}
          </p>
        </div>

        <div className="rounded border border-[#2a2a2a] bg-[#111] p-3 font-mono">
          <p className="text-[11px] text-zinc-500">Win Rate</p>
          <p className="text-sm text-zinc-300">{`${Math.round(results.winRate)}%`}</p>
        </div>

        <div className="rounded border border-[#2a2a2a] bg-[#111] p-3 font-mono">
          <p className="text-[11px] text-zinc-500">Max Drawdown</p>
          <p className="text-sm text-red-400">{formatSignedPercent(results.maxDrawdown)}</p>
        </div>

        <div className="rounded border border-[#2a2a2a] bg-[#111] p-3 font-mono">
          <p className="text-[11px] text-zinc-500">Sharpe Ratio</p>
          <p className="text-sm text-zinc-300">{results.sharpeRatio.toFixed(2)}</p>
        </div>
      </div>

      <div>
        <p className="mb-2 font-mono text-xs text-zinc-500">EQUITY CURVE</p>
        <div className="rounded border border-[#2a2a2a] bg-[#111] p-2">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={results.equityCurve}>
              <XAxis dataKey="date" hide />
              <YAxis
                tickFormatter={(value: number) => `$${value.toLocaleString()}`}
                width={70}
                tick={{ fill: "#71717a", fontSize: 10 }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#22c55e"
                dot={false}
                strokeWidth={1.5}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#111",
                  border: "1px solid #2a2a2a",
                  borderRadius: "6px",
                  fontFamily: "var(--font-geist-mono)",
                  fontSize: "12px",
                }}
                itemStyle={{ color: "#22c55e" }}
                labelStyle={{ color: "#a1a1aa" }}
                formatter={(value) => {
                  const numericValue = typeof value === "number" ? value : Number(value ?? 0);
                  return [`$${numericValue.toLocaleString()}`, "Value"];
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <p className="mb-2 font-mono text-xs text-zinc-500">TRADE LOG</p>
        <div className="max-h-48 overflow-y-auto rounded border border-[#2a2a2a]">
          <table className="w-full border-collapse font-mono text-xs text-zinc-300">
            <thead className="bg-[#121212] text-zinc-500">
              <tr>
                <th className="px-2 py-2 text-left font-normal">Buy Date</th>
                <th className="px-2 py-2 text-left font-normal">Buy Price</th>
                <th className="px-2 py-2 text-left font-normal">Sell Date</th>
                <th className="px-2 py-2 text-left font-normal">Sell Price</th>
                <th className="px-2 py-2 text-left font-normal">Return</th>
              </tr>
            </thead>
            <tbody>
              {results.trades.map((trade, index) => (
                <tr key={`${trade.buyDate}-${trade.sellDate}-${index}`} className={index % 2 === 0 ? "bg-[#0d0d0d]" : "bg-[#111]"}>
                  <td className="px-2 py-1.5">{trade.buyDate}</td>
                  <td className="px-2 py-1.5">{formatMoney(trade.buyPrice)}</td>
                  <td className="px-2 py-1.5">{trade.sellDate}</td>
                  <td className="px-2 py-1.5">{formatMoney(trade.sellPrice)}</td>
                  <td
                    className={`px-2 py-1.5 ${trade.returnPct >= 0 ? "text-green-400" : "text-red-400"}`}
                  >
                    {formatSignedPercent(trade.returnPct)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
