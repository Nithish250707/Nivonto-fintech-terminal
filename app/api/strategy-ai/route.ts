import { NextRequest } from "next/server";
import OpenAI from "openai";
import { runBacktest, type BacktestResult, type Candle } from "@/lib/backtest";
import { getHistoricalCandles } from "@/lib/massive";
import { executeStrategy, type OHLCV } from "@/lib/strategyRunner";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are a trading strategy code generator.
The user describes a strategy in plain English.
You output ONLY a TypeScript code block that populates a signals[] array.

Available variables already in scope:
- candles: Array of {date, open, high, low, close, volume}
- closes, highs, lows: number arrays
- sma(arr, period), ema(arr, period), rsi(arr, period) - return number[]
- crossesAbove(a, b, i), crossesBelow(a, b, i) - return boolean

Signal format:
signals.push({ date: candles[i].date, type: 'BUY' | 'SELL' })

Rules:
- Output ONLY the code, no explanation, no markdown fences
- Start from index period+1 to avoid out-of-bounds
- Keep it under 30 lines
- If the strategy is unclear, make reasonable assumptions
- Strategy must generate practical BUY and SELL signals on typical 1-year daily candles
- Include at least one robust exit condition (time-based fallback is allowed)

Example output for "Buy when RSI crosses above 30, sell when RSI crosses above 70":
const r = rsi(closes, 14);
for (let i = 15; i < candles.length; i++) {
  if (crossesAbove(r, Array(r.length).fill(30), i)) signals.push({ date: candles[i].date, type: 'BUY' });
  if (crossesAbove(r, Array(r.length).fill(70), i)) signals.push({ date: candles[i].date, type: 'SELL' });
}`;

type StrategyAiBody = {
  prompt?: string;
  ticker?: string;
  code?: string;
  from?: string;
  to?: string;
};

type StreamEvent =
  | { type: "status"; step: "thinking" | "writing" | "retrying" | "running" | "done" }
  | { type: "code_delta"; delta: string }
  | { type: "code_reset"; code: string }
  | {
      type: "result";
      code: string;
      backtest: BacktestResult;
      meta: {
        requestedFrom: string;
        requestedTo: string;
        warmupFrom: string;
        from: string;
        to: string;
        windowDays: number;
        candleCount: number;
        signalCount: number;
        buySignals: number;
        sellSignals: number;
      };
    }
  | { type: "error"; message: string };

function writeEvent(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  event: StreamEvent,
): void {
  controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
}

function normalizeCode(raw: string): string {
  const trimmed = raw.trim();

  if (!trimmed.includes("```")) {
    return trimmed;
  }

  const strippedFence = trimmed
    .replace(/^```(?:ts|typescript|js|javascript)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  return strippedFence;
}

function isValidCandle(candle: OHLCV): boolean {
  return (
    typeof candle.date === "string" &&
    Number.isFinite(candle.open) &&
    Number.isFinite(candle.high) &&
    Number.isFinite(candle.low) &&
    Number.isFinite(candle.close) &&
    Number.isFinite(candle.volume)
  );
}

async function generateCode(
  openai: OpenAI,
  prompt: string,
  ticker: string,
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
): Promise<string> {
  let generated = "";

  writeEvent(controller, encoder, { type: "status", step: "thinking" });
  const stream = await openai.chat.completions.create({
    model: "gpt-4o",
    stream: true,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Generate strategy code for ${ticker}: ${prompt}` },
    ],
  });

  writeEvent(controller, encoder, { type: "status", step: "writing" });
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content ?? "";
    if (!delta) {
      continue;
    }

    generated += delta;
    writeEvent(controller, encoder, { type: "code_delta", delta });
  }

  return normalizeCode(generated);
}

async function correctCode(
  openai: OpenAI,
  prompt: string,
  ticker: string,
  previousCode: string,
  feedback: string,
): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Generate strategy code for ${ticker}: ${prompt}` },
      { role: "assistant", content: previousCode },
      {
        role: "user",
        content: `The code needs correction: ${feedback}. Return corrected TypeScript code only.`,
      },
    ],
  });

  return normalizeCode(completion.choices[0]?.message?.content ?? "");
}

function summarizeSignals(signals: { type: "BUY" | "SELL" }[]): string {
  let buyCount = 0;
  let sellCount = 0;

  for (const signal of signals) {
    if (signal.type === "BUY") {
      buyCount += 1;
    } else {
      sellCount += 1;
    }
  }

  return `BUY=${buyCount}, SELL=${sellCount}`;
}

function countSignalTypes(signals: { type: "BUY" | "SELL" }[]): {
  buySignals: number;
  sellSignals: number;
} {
  let buySignals = 0;
  let sellSignals = 0;

  for (const signal of signals) {
    if (signal.type === "BUY") {
      buySignals += 1;
    } else {
      sellSignals += 1;
    }
  }

  return { buySignals, sellSignals };
}

function isIsoDate(value: string | undefined): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function shiftIsoDate(date: string, dayOffset: number): string {
  const utcDate = new Date(`${date}T00:00:00.000Z`);
  utcDate.setUTCDate(utcDate.getUTCDate() + dayOffset);
  return utcDate.toISOString().split("T")[0];
}

function minTradesForPrompt(prompt?: string): number {
  if (!prompt) {
    return 2;
  }

  const normalized = prompt.toLowerCase();

  const longTermKeywords = ["invest", "long term", "position", "monthly", "quarter", "year"];
  if (longTermKeywords.some((keyword) => normalized.includes(keyword))) {
    return 1;
  }

  const activeKeywords = [
    "day",
    "week",
    "hold",
    "swing",
    "bounce",
    "rebound",
    "dip",
    "mean reversion",
    "scalp",
    "cross",
  ];
  if (activeKeywords.some((keyword) => normalized.includes(keyword))) {
    return 3;
  }

  return 2;
}

function shouldRetryForLowActivity(
  backtest: BacktestResult,
  signals: { type: "BUY" | "SELL" }[],
  prompt?: string,
): boolean {
  const minimumTrades = minTradesForPrompt(prompt);
  if (backtest.trades.length < minimumTrades) {
    return true;
  }

  const minimumSignals = Math.max(3, minimumTrades * 2 - 1);
  return signals.length < minimumSignals;
}

function hasBetterActivity(
  currentBacktest: BacktestResult,
  currentSignals: { type: "BUY" | "SELL" }[],
  candidateBacktest: BacktestResult,
  candidateSignals: { type: "BUY" | "SELL" }[],
): boolean {
  if (candidateBacktest.trades.length !== currentBacktest.trades.length) {
    return candidateBacktest.trades.length > currentBacktest.trades.length;
  }

  if (candidateSignals.length !== currentSignals.length) {
    return candidateSignals.length > currentSignals.length;
  }

  return Math.abs(candidateBacktest.totalReturn) > Math.abs(currentBacktest.totalReturn);
}

function inferHoldBars(prompt?: string): number {
  if (!prompt) {
    return 10;
  }

  const normalized = prompt.toLowerCase();
  const weekMatch = normalized.match(/(\d+)\s*week/);
  if (weekMatch) {
    const weeks = Number(weekMatch[1]);
    if (Number.isFinite(weeks) && weeks > 0) {
      return Math.max(5, Math.min(60, Math.round(weeks * 5)));
    }
  }

  const dayMatch = normalized.match(/(\d+)\s*day/);
  if (dayMatch) {
    const days = Number(dayMatch[1]);
    if (Number.isFinite(days) && days > 0) {
      return Math.max(3, Math.min(60, Math.round(days)));
    }
  }

  if (normalized.includes("2 weeks") || normalized.includes("two weeks")) {
    return 10;
  }

  return 10;
}

function buildDropBounceFallbackCode(holdBars: number): string {
  return `const dailyReturn = closes.map((value, index) => {
  if (index === 0 || closes[index - 1] <= 0) return 0;
  return (value - closes[index - 1]) / closes[index - 1];
});
const sma20 = sma(closes, 20);
const ema8 = ema(closes, 8);
let inPosition = false;
let entryIndex = -1;
let entryPrice = 0;
for (let i = 21; i < candles.length; i++) {
  const oneDayDrop = dailyReturn[i];
  const pullback5d = closes[i - 5] > 0 ? (closes[i] - closes[i - 5]) / closes[i - 5] : 0;
  const droppedALot = oneDayDrop <= -0.0208 || pullback5d <= -0.04 || closes[i] < sma20[i] * 0.985;
  if (!inPosition && droppedALot) {
    signals.push({ date: candles[i].date, type: 'BUY' });
    inPosition = true;
    entryIndex = i;
    entryPrice = closes[i];
    continue;
  }
  if (!inPosition) continue;
  const heldBars = i - entryIndex;
  const pnl = entryPrice > 0 ? (closes[i] - entryPrice) / entryPrice : 0;
  const bounced = dailyReturn[i] >= 0.01 || (pnl >= 0.015 && closes[i] > ema8[i]);
  const meanRevertExit = closes[i] >= sma20[i] * 0.998;
  const timeExit = heldBars >= ${holdBars + 8};
  const stopExit = pnl <= -0.08;
  if ((heldBars >= ${holdBars} && (bounced || meanRevertExit)) || timeExit || stopExit) {
    signals.push({ date: candles[i].date, type: 'SELL' });
    inPosition = false;
  }
}`;
}

function fallbackCodeForPrompt(prompt?: string): string | null {
  if (!prompt) {
    return null;
  }

  const normalized = prompt.toLowerCase();
  const looksLikeDropBounce =
    (normalized.includes("drop") || normalized.includes("falls") || normalized.includes("dip")) &&
    (normalized.includes("bounce") || normalized.includes("recover") || normalized.includes("rebound"));

  if (!looksLikeDropBounce) {
    return null;
  }

  return buildDropBounceFallbackCode(inferHoldBars(prompt));
}

export async function POST(request: NextRequest) {
  try {
    const { prompt, ticker, code, from, to } = (await request.json()) as StrategyAiBody;

    const strategyPrompt = prompt?.trim();
    const strategyTicker = ticker?.trim().toUpperCase();
    const strategyCode = code?.trim();

    if ((!strategyPrompt && !strategyCode) || !strategyTicker) {
      return new Response("prompt/code and ticker are required", { status: 400 });
    }

    const defaultTo = new Date().toISOString().split("T")[0];
    const toDate = isIsoDate(to) ? to : defaultTo;
    const fromDate = shiftIsoDate(toDate, -365);
    const warmupFrom = shiftIsoDate(fromDate, -365);

    const allCandles = (await getHistoricalCandles(strategyTicker, warmupFrom, toDate)) as OHLCV[];
    const candles = allCandles.filter((candle) => candle.date >= fromDate && candle.date <= toDate);

    if (
      allCandles.length < 60 ||
      candles.length < 30 ||
      allCandles.some((candle) => !isValidCandle(candle))
    ) {
      return new Response("invalid candle payload", { status: 400 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const encoder = new TextEncoder();

    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          const normalizedCandles = candles as Candle[];
          let finalCode = strategyCode ?? "";

          if (!finalCode) {
            finalCode = await generateCode(
              openai,
              strategyPrompt ?? "",
              strategyTicker,
              controller,
              encoder,
            );
          } else {
            writeEvent(controller, encoder, { type: "code_reset", code: finalCode });
          }

          for (let attempt = 0; attempt < 3; attempt += 1) {
            const execution = executeStrategy(finalCode, allCandles);
            if (execution.success) {
              const scopedSignals = execution.signals.filter(
                (signal) => signal.date >= fromDate && signal.date <= toDate,
              );

              if (scopedSignals.length === 0 && attempt < 2 && strategyPrompt) {
                writeEvent(controller, encoder, { type: "status", step: "retrying" });
                finalCode = await correctCode(
                  openai,
                  strategyPrompt,
                  strategyTicker,
                  finalCode,
                  "Code ran successfully but generated zero in-window signals on the last 1-year candles",
                );
                writeEvent(controller, encoder, { type: "code_reset", code: finalCode });
                continue;
              }

              if (scopedSignals.length === 0 && attempt < 2 && !strategyPrompt) {
                writeEvent(controller, encoder, { type: "status", step: "retrying" });
                finalCode = await correctCode(
                  openai,
                  "Fix this strategy to produce practical BUY and SELL signals",
                  strategyTicker,
                  finalCode,
                  "Code ran successfully but generated zero in-window signals on the last 1-year candles",
                );
                writeEvent(controller, encoder, { type: "code_reset", code: finalCode });
                continue;
              }

              if (scopedSignals.length === 0 && attempt === 2) {
                const fallbackCode = fallbackCodeForPrompt(strategyPrompt);
                if (fallbackCode && fallbackCode !== finalCode) {
                  writeEvent(controller, encoder, { type: "status", step: "retrying" });
                  finalCode = fallbackCode;
                  writeEvent(controller, encoder, { type: "code_reset", code: finalCode });
                  const fallbackExecution = executeStrategy(finalCode, allCandles);
                  if (fallbackExecution.success) {
                    const scopedFallbackSignals = fallbackExecution.signals.filter(
                      (signal) => signal.date >= fromDate && signal.date <= toDate,
                    );
                    const fallbackBacktest = runBacktest(normalizedCandles, scopedFallbackSignals);
                    if (fallbackBacktest.trades.length > 0) {
                      writeEvent(controller, encoder, {
                        type: "result",
                        code: finalCode,
                        backtest: fallbackBacktest,
                        meta: {
                          requestedFrom: from ?? fromDate,
                          requestedTo: to ?? toDate,
                          warmupFrom,
                          from: candles[0]?.date ?? fromDate,
                          to: candles[candles.length - 1]?.date ?? toDate,
                          windowDays: 365,
                          candleCount: candles.length,
                          signalCount: scopedFallbackSignals.length,
                          ...countSignalTypes(scopedFallbackSignals),
                        },
                      });
                      writeEvent(controller, encoder, { type: "status", step: "done" });
                      controller.close();
                      return;
                    }
                  }
                }
              }

              writeEvent(controller, encoder, { type: "status", step: "running" });
              const backtest = runBacktest(normalizedCandles, scopedSignals);

              if (backtest.trades.length === 0 && attempt < 2 && strategyPrompt) {
                writeEvent(controller, encoder, { type: "status", step: "retrying" });
                finalCode = await correctCode(
                  openai,
                  strategyPrompt,
                  strategyTicker,
                  finalCode,
                  `Code produced in-window signals (${summarizeSignals(scopedSignals)}) but zero completed trades in backtest; make entry/exit logic practical`,
                );
                writeEvent(controller, encoder, { type: "code_reset", code: finalCode });
                continue;
              }

              if (backtest.trades.length === 0 && attempt < 2 && !strategyPrompt) {
                writeEvent(controller, encoder, { type: "status", step: "retrying" });
                finalCode = await correctCode(
                  openai,
                  "Fix this strategy to produce completed trades",
                  strategyTicker,
                  finalCode,
                  `Code produced in-window signals (${summarizeSignals(scopedSignals)}) but zero completed trades in backtest; make entry/exit logic practical`,
                );
                writeEvent(controller, encoder, { type: "code_reset", code: finalCode });
                continue;
              }

              if (shouldRetryForLowActivity(backtest, scopedSignals, strategyPrompt) && attempt < 2) {
                writeEvent(controller, encoder, { type: "status", step: "retrying" });
                finalCode = await correctCode(
                  openai,
                  strategyPrompt ?? "Fix this strategy to produce practical trade frequency",
                  strategyTicker,
                  finalCode,
                  `Backtest is too sparse on 1-year window (${backtest.trades.length} trades, ${scopedSignals.length} signals). Relax thresholds and add robust exits to produce practical frequency without overtrading.`,
                );
                writeEvent(controller, encoder, { type: "code_reset", code: finalCode });
                continue;
              }

              if (shouldRetryForLowActivity(backtest, scopedSignals, strategyPrompt) && attempt === 2) {
                const fallbackCode = fallbackCodeForPrompt(strategyPrompt);
                if (fallbackCode && fallbackCode !== finalCode) {
                  writeEvent(controller, encoder, { type: "status", step: "retrying" });
                  finalCode = fallbackCode;
                  writeEvent(controller, encoder, { type: "code_reset", code: finalCode });
                  const fallbackExecution = executeStrategy(finalCode, allCandles);
                  if (fallbackExecution.success) {
                    const scopedFallbackSignals = fallbackExecution.signals.filter(
                      (signal) => signal.date >= fromDate && signal.date <= toDate,
                    );
                    const fallbackBacktest = runBacktest(normalizedCandles, scopedFallbackSignals);
                    if (
                      fallbackBacktest.trades.length > 0 &&
                      (!shouldRetryForLowActivity(
                        fallbackBacktest,
                        scopedFallbackSignals,
                        strategyPrompt,
                      ) ||
                        hasBetterActivity(backtest, scopedSignals, fallbackBacktest, scopedFallbackSignals))
                    ) {
                      writeEvent(controller, encoder, {
                        type: "result",
                        code: finalCode,
                        backtest: fallbackBacktest,
                        meta: {
                          requestedFrom: from ?? fromDate,
                          requestedTo: to ?? toDate,
                          warmupFrom,
                          from: candles[0]?.date ?? fromDate,
                          to: candles[candles.length - 1]?.date ?? toDate,
                          windowDays: 365,
                          candleCount: candles.length,
                          signalCount: scopedFallbackSignals.length,
                          ...countSignalTypes(scopedFallbackSignals),
                        },
                      });
                      writeEvent(controller, encoder, { type: "status", step: "done" });
                      controller.close();
                      return;
                    }
                  }
                }
              }

              writeEvent(controller, encoder, {
                type: "result",
                code: finalCode,
                backtest,
                meta: {
                  requestedFrom: from ?? fromDate,
                  requestedTo: to ?? toDate,
                  warmupFrom,
                  from: candles[0]?.date ?? fromDate,
                  to: candles[candles.length - 1]?.date ?? toDate,
                  windowDays: 365,
                  candleCount: candles.length,
                  signalCount: scopedSignals.length,
                  ...countSignalTypes(scopedSignals),
                },
              });
              writeEvent(controller, encoder, { type: "status", step: "done" });
              controller.close();
              return;
            }

            if (attempt === 2) {
              writeEvent(controller, encoder, {
                type: "error",
                message: execution.error ?? "Strategy execution failed",
              });
              controller.close();
              return;
            }

            writeEvent(controller, encoder, { type: "status", step: "retrying" });
            finalCode = await correctCode(
              openai,
              strategyPrompt ?? "Fix this strategy code",
              strategyTicker,
              finalCode,
              execution.error ?? "unknown error",
            );
            writeEvent(controller, encoder, { type: "code_reset", code: finalCode });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "internal server error";
          writeEvent(controller, encoder, { type: "error", message });
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("internal server error", { status: 500 });
  }
}
