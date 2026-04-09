type BacktestTrade = {
  buyDate: string;
  buyPrice: number;
  sellDate: string;
  sellPrice: number;
};

export type BacktestStatsResults = {
  totalReturn: number;
  maxDrawdown: number;
  winRate: number;
  sharpeRatio: number;
  trades: BacktestTrade[];
};

type BacktestStatsBarProps = {
  results: BacktestStatsResults | null;
};

function formatSignedPercent(value: number): string {
  const fixed = value.toFixed(1);
  return value > 0 ? `+${fixed}%` : `${fixed}%`;
}

export function BacktestStatsBar({ results }: BacktestStatsBarProps) {
  if (!results) {
    return null;
  }

  const annualReturn = results.totalReturn / 1;

  return (
    <div className="border-t border-[#1e1e1e] bg-[#0d0d0d] px-4 py-2">
      <div className="flex flex-wrap items-center gap-4 font-mono text-xs">
        <span className="rounded border border-[#1f6b45] bg-[#123523] px-2 py-0.5 text-green-300">
          ● BACKTEST
        </span>

        <span className="text-zinc-500">STRATEGY:</span>
        <span className={results.totalReturn >= 0 ? "text-green-400" : "text-red-400"}>
          {formatSignedPercent(results.totalReturn)}
        </span>

        <span className="text-zinc-500">ANNUAL RETURN:</span>
        <span className={annualReturn >= 0 ? "text-green-400" : "text-red-400"}>
          {formatSignedPercent(annualReturn)}
        </span>

        <span className="text-zinc-500">MAX DRAWDOWN:</span>
        <span className="text-red-400">{formatSignedPercent(results.maxDrawdown)}</span>

        <span className="text-zinc-500">WIN RATE:</span>
        <span className="text-zinc-300">{`${Math.round(results.winRate)}%`}</span>

        <span className="text-zinc-500"># OF TRADES:</span>
        <span className="text-zinc-300">{results.trades.length}</span>
      </div>
    </div>
  );
}
