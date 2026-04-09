"use client";

import { useEffect, useRef, useState } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatPanelProps = {
  ticker: string;
};

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

    const userMsg: ChatMessage = { role: "user", content: input };
    const newMessages = [...messages, userMsg];

    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, ticker }),
      });

      if (!res.body) {
        throw new Error("Missing response body");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        const text = decoder.decode(value, { stream: true });
        if (!text) {
          continue;
        }

        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];

          if (last?.role === "assistant") {
            next[next.length - 1] = {
              ...last,
              content: `${last.content}${text}`,
            };
          }

          return next;
        });
      }

      const trailing = decoder.decode();
      if (trailing) {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];

          if (last?.role === "assistant") {
            next[next.length - 1] = {
              ...last,
              content: `${last.content}${trailing}`,
            };
          }

          return next;
        });
      }
    } finally {
      setLoading(false);
    }
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
            <p
              key={`${message.role}-${index}`}
              className={message.role === "user" ? "text-green-400" : "text-zinc-200"}
            >
              {message.content}
            </p>
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
