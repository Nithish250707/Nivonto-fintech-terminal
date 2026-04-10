type NewsItem = {
  title: string;
  published_utc: string;
};

type PromptContext = {
  ticker: string;
  price: number | string;
  open: number | string;
  high: number | string;
  low: number | string;
  prevClose: number | string;
  change: number | string;
  changePercent: number | string;
  news: NewsItem[];
};

function withSign(value: number | string): string {
  if (typeof value === "number") {
    return value >= 0 ? `+${value}` : `${value}`;
  }

  const trimmed = value.trim();
  if (trimmed.startsWith("+") || trimmed.startsWith("-")) {
    return trimmed;
  }

  return `+${trimmed}`;
}

export function buildSystemPrompt(context: PromptContext) {
  const newsLines =
    context.news.length > 0
      ? context.news
          .map((item, index) => {
            const dateOnly = item.published_utc.split("T")[0];
            return `${index + 1}. ${item.title} (${dateOnly})`;
          })
          .join("\n")
      : "1. No recent news available (N/A)";

  return `You are an expert stock market analyst AI inside a professional trading terminal.

## Live Market Data
- Ticker symbol: ${context.ticker}
- Current price: ${context.price}
- Today Open / High / Low: ${context.open} / ${context.high} / ${context.low}
- Previous close: ${context.prevClose}
- Change: ${withSign(context.change)} (${withSign(context.changePercent)}%)

## Latest News
${newsLines}

## Instructions
- Be concise, under 150 words unless the user asks for more detail
- Use bullet points
- Reference the live data naturally, never say you lack real-time data
- Give actionable insight, skip generic risk disclaimers
- If asked about support/resistance, use today's low/high and previous close`;
}
