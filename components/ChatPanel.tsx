"use client";

import { useEffect, useRef, useState } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  kind?: "text" | "strategy";
};

type ChatPanelProps = {
  ticker: string;
};

type StrategyEvent =
  | { type: "status"; step: string }
  | { type: "code_delta"; delta: string }
  | { type: "code_reset"; code: string }
  | { type: "result"; code: string }
  | { type: "error"; message: string };

const STRATEGY_KEYWORDS = [
  "buy when",
  "sell when",
  "strategy",
  "backtest",
  "crosses",
  "above",
  "below",
  "moving average",
  "rsi",
  "macd",
  "breakout",
  "support",
  "resistance",
];

function isStrategyRequest(message: string): boolean {
  const normalized = message.toLowerCase();
  return STRATEGY_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

async function fetchCandles(ticker: string) {
  const response = await fetch(`/api/candles?ticker=${encodeURIComponent(ticker)}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to load candles (${response.status})`);
  }

  return response.json();
}

export function ChatPanel({ ticker }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) {
      return;
    }

    const prompt = input.trim();
    const strategyMode = isStrategyRequest(prompt);
    const userMsg: ChatMessage = { role: "user", content: prompt, kind: "text" };
    const newMessages = [...messages, userMsg];

    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const endpoint = strategyMode ? "/api/strategy-ai" : "/api/chat";
      const payload = strategyMode
        ? { prompt, ticker, candles: await fetchCandles(ticker) }
        : {
            messages: newMessages.map((message) => ({
              role: message.role,
              content: message.content,
            })),
            ticker,
          };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Request failed: ${res.status}`);
      }

      if (!res.body) {
        throw new Error("Missing response body");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "", kind: strategyMode ? "strategy" : "text" },
      ]);

      const appendToLastAssistant = (chunk: string) => {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];

          if (last?.role === "assistant") {
            next[next.length - 1] = {
              ...last,
              content: `${last.content}${chunk}`,
            };
          }

          return next;
        });
      };

      const replaceLastAssistant = (content: string) => {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];

          if (last?.role === "assistant") {
            next[next.length - 1] = {
              ...last,
              content,
            };
          }

          return next;
        });
      };

      if (strategyMode) {
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

            const event = JSON.parse(trimmed) as StrategyEvent;
            if (event.type === "code_delta") {
              appendToLastAssistant(event.delta);
            } else if (event.type === "code_reset") {
              replaceLastAssistant(event.code);
            } else if (event.type === "result") {
              replaceLastAssistant(event.code);
            } else if (event.type === "error") {
              appendToLastAssistant(`\n\nError: ${event.message}`);
            }
          }

          if (done) {
            break;
          }
        }

        return;
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        const text = decoder.decode(value, { stream: true });
        if (!text) {
          continue;
        }

        appendToLastAssistant(text);
      }

      const trailing = decoder.decode();
      if (trailing) {
        appendToLastAssistant(trailing);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Request failed";
      setMessages((prev) => [...prev, { role: "assistant", content: message, kind: "text" }]);
    } finally {
      setLoading(false);
    }
  };

  const handleRunBacktest = (code: string) => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem("strategy:generatedCode", code);
    window.localStorage.setItem("strategy:generatedTicker", ticker);
    window.location.href = `/strategies?ticker=${encodeURIComponent(ticker)}`;
  };

  const prompts = [
    `→ Analyze ${ticker} support and resistance`,
    `→ What is the sentiment on ${ticker} today?`,
    `→ Is ${ticker} overbought or oversold?`,
  ];

  return (
    <div className="flex h-full flex-col border-l border-[#1e1e1e] bg-[#0d0d0d]">
      <header className="border-b border-[#1e1e1e] px-3 py-2 font-mono text-xs text-zinc-400">
        AI ANALYST -- {ticker}
      </header>

      <div className="flex-1 overflow-y-auto p-3 font-mono text-sm">
        {messages.length === 0 ? (
          <div className="space-y-2 text-zinc-500">
            {prompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => setInput(prompt)}
                className="block w-full text-left hover:text-zinc-300"
              >
                {prompt}
              </button>
            ))}
          </div>
        ) : null}

        <div className="space-y-2">
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`}>
              {message.role === "assistant" && message.kind === "strategy" ? (
                <div className="space-y-2 rounded border border-[#1f1f1f] bg-[#101010] p-2">
                  <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs text-zinc-200">
                    {message.content}
                  </pre>
                  <button
                    type="button"
                    onClick={() => handleRunBacktest(message.content)}
                    className="rounded border border-[#1f6b45] bg-[#123523] px-2 py-1 font-mono text-[11px] text-green-300 hover:bg-[#184b30]"
                  >
                    Run Backtest
                  </button>
                </div>
              ) : (
                <p className={message.role === "user" ? "text-green-400" : "text-zinc-200"}>
                  {message.content}
                </p>
              )}
            </div>
          ))}
          {loading ? <p className="animate-pulse text-zinc-500">~ thinking...</p> : null}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-[#1e1e1e] px-3 py-2">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void sendMessage();
            }
          }}
          placeholder={`Ask about ${ticker}...`}
          className="h-9 flex-1 bg-transparent px-2 font-mono text-sm text-green-400 placeholder:text-zinc-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => void sendMessage()}
          disabled={loading}
          className="h-9 border border-[#1e1e1e] px-3 font-mono text-xs text-zinc-300 hover:border-[#00ff88] hover:text-[#00ff88] disabled:opacity-50"
        >
          [SEND]
        </button>
      </div>
    </div>
  );
}
