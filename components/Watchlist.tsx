import { WATCHLIST_ITEMS } from "@/lib/tickers";

type WatchlistProps = {
  selectedTicker: string;
  onSelectTicker: (ticker: string) => void;
};

export function Watchlist({ selectedTicker, onSelectTicker }: WatchlistProps) {
  return (
    <aside className="w-full border-b border-[#1a1a1a] bg-[#0b0b0b] lg:w-[200px] lg:border-b-0 lg:border-r">
      <div className="border-b border-[#1a1a1a] px-3 py-2">
        <p className="text-xs tracking-[0.16em] text-zinc-500">WATCHLIST</p>
      </div>
      <ul>
        {WATCHLIST_ITEMS.map((item) => (
          <li
            key={item.symbol}
            className={`border-b border-[#1a1a1a] px-3 py-2 last:border-b-0 ${
              selectedTicker === item.symbol ? "bg-[#101010]" : "bg-transparent hover:bg-[#0e0e0e]"
            }`}
          >
            <button
              type="button"
              onClick={() => onSelectTicker(item.symbol)}
              className="w-full text-left"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-semibold text-zinc-100">{item.symbol}</span>
                <span
                  className={`font-mono text-xs ${item.positive ? "text-[#00ff88]" : "text-[#ff4d4f]"}`}
                >
                  {item.change}
                </span>
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-2">
                <span className="truncate text-[11px] text-zinc-500">{item.name}</span>
                <span className="font-mono text-[11px] text-zinc-300">{item.price}</span>
              </div>
              <span
                className={`mt-1 block h-[1px] w-full ${
                  selectedTicker === item.symbol ? "bg-[#00ff88]" : "bg-transparent"
                }`}
              >
                {" "}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
