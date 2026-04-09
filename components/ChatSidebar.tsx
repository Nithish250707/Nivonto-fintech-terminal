const CHAT_MESSAGES = [
  {
    id: "user-1",
    role: "user",
    content: "How does AAPL look into the close?",
  },
  {
    id: "assistant-1",
    role: "assistant",
    content: "Analyzing AAPL... bullish momentum on intraday trend with resistance near 216.",
  },
];

export function ChatSidebar() {
  return (
    <aside className="flex h-[420px] w-full flex-col bg-[#0b0b0b] lg:h-auto lg:min-h-0 lg:w-[320px] lg:border-l lg:border-[#1a1a1a]">
      <header className="border-b border-[#1a1a1a] px-3 py-2">
        <p className="text-xs tracking-[0.16em] text-zinc-500">AI ASSISTANT</p>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {CHAT_MESSAGES.map((message) => {
          const isAssistant = message.role === "assistant";
          return (
            <div
              key={message.id}
              className={`max-w-[90%] border px-2 py-2 text-sm leading-relaxed ${
                isAssistant
                  ? "border-[#1a1a1a] bg-[#0d0d0d] text-zinc-200"
                  : "ml-auto border-[#1f1f1f] bg-[#111111] text-zinc-100"
              }`}
            >
              {message.content}
            </div>
          );
        })}
      </div>

      <div className="border-t border-[#1a1a1a] p-3">
        <div className="border border-[#1a1a1a] bg-[#0d0d0d]">
          <textarea
            rows={3}
            placeholder="Ask AI about this chart..."
            className="w-full resize-none bg-transparent px-2 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
          />
          <div className="flex items-center justify-between border-t border-[#1a1a1a] px-2 py-1">
            <span className="font-mono text-[11px] text-zinc-600">ENTER to send</span>
            <button
              type="button"
              className="border border-[#00ff88] px-2 py-1 text-xs font-medium text-[#00ff88] hover:bg-[#00ff88] hover:text-black"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
