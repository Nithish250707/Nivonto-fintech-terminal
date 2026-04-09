"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChartPanel } from "@/components/ChartPanel";
import { ChatPanel } from "@/components/ChatPanel";
import { TopNavbar } from "@/components/TopNavbar";
import { Watchlist } from "@/components/Watchlist";
import { WATCHLIST_ITEMS, marketLabelFromSymbol } from "@/lib/tickers";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName;
  return (
    target.isContentEditable ||
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT"
  );
}

export function TerminalShell() {
  const [activeTicker, setActiveTicker] = useState("AAPL");
  const [searchQuery, setSearchQuery] = useState("AAPL");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const availableTickers = useMemo(
    () => WATCHLIST_ITEMS.map((item) => item.symbol),
    [],
  );
  const marketLabel = marketLabelFromSymbol(activeTicker);

  const commitSearch = () => {
    const nextTicker = searchQuery.trim().toUpperCase();
    if (!nextTicker) {
      return;
    }
    setActiveTicker(nextTicker);
    setSearchQuery(nextTicker);
  };

  const handleSelectTicker = (ticker: string) => {
    setActiveTicker(ticker);
    setSearchQuery(ticker);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isTyping = isTypingTarget(event.target);

      if (event.key === "/" && !isTyping) {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (event.key === "Escape" && document.activeElement === searchInputRef.current) {
        searchInputRef.current?.blur();
        return;
      }

      if ((event.key === "ArrowDown" || event.key === "ArrowUp") && !isTyping) {
        event.preventDefault();
        const currentIndex = availableTickers.indexOf(activeTicker);
        const offset = event.key === "ArrowDown" ? 1 : -1;
        const baseIndex = currentIndex === -1 ? 0 : currentIndex;
        const nextIndex =
          (baseIndex + offset + availableTickers.length) % availableTickers.length;

        const nextTicker = availableTickers[nextIndex];
        setActiveTicker(nextTicker);
        setSearchQuery(nextTicker);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeTicker, availableTickers]);

  return (
    <div className="flex min-h-screen flex-col bg-[#0a0a0a] text-zinc-100">
      <TopNavbar
        selectedTicker={activeTicker}
        marketLabel={marketLabel}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onSubmitSearch={commitSearch}
        searchInputRef={searchInputRef}
      />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <Watchlist selectedTicker={activeTicker} onSelectTicker={handleSelectTicker} />
        <ChartPanel selectedTicker={activeTicker} />
        <div className="h-[420px] w-full lg:h-auto lg:min-h-0 lg:w-[320px]">
          <ChatPanel ticker={activeTicker} />
        </div>
      </div>
    </div>
  );
}
