"use client";

import { toTradingViewSymbol } from "@/lib/tickers";

type Trade = {
  buyDate: string;
  buyPrice: number;
  sellDate: string;
  sellPrice: number;
};

type ChartPanelProps = {
  selectedTicker: string;
  // kept for strategies/backtest wiring; TradingView iframe currently ignores markers
  trades?: Trade[];
};
export function ChartPanel({ selectedTicker, trades }: ChartPanelProps) {
  void trades;
  const tradingViewSymbol = toTradingViewSymbol(selectedTicker);
  const frameId = selectedTicker.toLowerCase().replace(/[^a-z0-9]/g, "_");
  const tradingViewUrl = `https://s.tradingview.com/widgetembed/?frameElementId=tradingview_${frameId}&symbol=${encodeURIComponent(tradingViewSymbol)}&interval=D&hidesidetoolbar=1&hidetoptoolbar=1&symboledit=1&saveimage=0&toolbarbg=0a0a0a&theme=dark&style=1&timezone=Etc%2FUTC&withdateranges=1&hidevolume=0&allow_symbol_change=1`;

  return (
    <section className="flex min-h-[480px] flex-1 flex-col border-b border-[#1a1a1a] lg:border-b-0">
      <div className="flex items-center justify-between border-b border-[#1a1a1a] px-3 py-2">
        <span className="font-mono text-xs tracking-[0.12em] text-zinc-300">{selectedTicker}</span>
        <span className="font-mono text-xs tracking-[0.12em] text-zinc-500">{tradingViewSymbol}</span>
      </div>
      <div className="flex-1 p-3">
        <iframe
          key={tradingViewSymbol}
          title={`TradingView ${selectedTicker} chart`}
          src={tradingViewUrl}
          className="h-full min-h-[420px] w-full border border-[#1a1a1a] bg-black"
          allowFullScreen
          loading="lazy"
        />
      </div>
    </section>
  );
}
