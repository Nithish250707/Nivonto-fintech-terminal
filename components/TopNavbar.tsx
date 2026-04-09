import Link from "next/link";
import type { FormEvent, RefObject } from "react";

type TopNavbarProps = {
  selectedTicker: string;
  marketLabel: string;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onSubmitSearch: () => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
};

export function TopNavbar({
  selectedTicker,
  marketLabel,
  searchQuery,
  onSearchQueryChange,
  onSubmitSearch,
  searchInputRef,
}: TopNavbarProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmitSearch();
  };

  return (
    <header className="border-b border-[#1a1a1a] bg-[#0b0b0b]">
      <div className="flex h-12 items-center gap-3 px-3">
        <div className="hidden min-w-[160px] items-center gap-2 lg:flex">
          <span className="text-xs tracking-[0.16em] text-zinc-500">TERMINAL</span>
          <span className="font-mono text-xs text-[#00ff88]">{selectedTicker}</span>
          <span className="font-mono text-[11px] text-zinc-500">{marketLabel}</span>
        </div>

        <nav className="hidden items-center gap-2 md:flex">
          <NavItem href="/">MARKET</NavItem>
          <NavItem href="/strategies">STRATEGIES</NavItem>
        </nav>

        <form onSubmit={handleSubmit} className="flex flex-1 items-center gap-2">
          <label htmlFor="ticker-search" className="sr-only">
            Search ticker
          </label>
          <input
            id="ticker-search"
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="Search ticker (AAPL, RELIANCE.NS, BTC-USD)"
            className="h-8 w-full border border-[#1a1a1a] bg-[#0d0d0d] px-2 font-mono text-sm text-zinc-100 placeholder:font-sans placeholder:text-zinc-600 focus:border-[#00ff88] focus:outline-none"
          />
          <button
            type="submit"
            className="h-8 border border-[#1a1a1a] bg-[#101010] px-3 text-xs text-zinc-300 hover:border-[#00ff88] hover:text-[#00ff88]"
          >
            Load
          </button>
        </form>

        <div className="hidden items-center gap-2 xl:flex">
          <ShortcutHint keys="/" label="Focus" />
          <ShortcutHint keys="Esc" label="Blur" />
          <ShortcutHint keys="↑ ↓" label="Cycle" />
          <ShortcutHint keys="Enter" label="Load" />
        </div>
      </div>
    </header>
  );
}

type NavItemProps = {
  href: string;
  children: string;
};

function NavItem({ href, children }: NavItemProps) {
  return (
    <Link
      href={href}
      className="border border-[#1a1a1a] bg-[#0f0f0f] px-2 py-1 text-[11px] tracking-[0.12em] text-zinc-400 hover:border-[#2a2a2a] hover:text-zinc-200"
    >
      {children}
    </Link>
  );
}

type ShortcutHintProps = {
  keys: string;
  label: string;
};

function ShortcutHint({ keys, label }: ShortcutHintProps) {
  return (
    <div className="flex items-center gap-1 border border-[#1a1a1a] bg-[#0f0f0f] px-1.5 py-1">
      <span className="font-mono text-[11px] text-zinc-300">{keys}</span>
      <span className="text-[11px] text-zinc-500">{label}</span>
    </div>
  );
}
