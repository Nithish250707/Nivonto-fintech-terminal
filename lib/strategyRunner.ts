import { runInNewContext } from "node:vm";
import { ema, rsi, sma } from "@/lib/indicators";

export type OHLCV = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type Signal = {
  date: string;
  type: "BUY" | "SELL";
};

type ExecutionResult = {
  success: boolean;
  signals: Signal[];
  error?: string;
};

function isFiniteNumber(value: number | undefined): value is number {
  return Number.isFinite(value) && !Number.isNaN(value);
}

function crossesAbove(a: number[], b: number[], i: number): boolean {
  if (i <= 0 || i >= a.length || i >= b.length) {
    return false;
  }

  const prevA = a[i - 1];
  const prevB = b[i - 1];
  const currA = a[i];
  const currB = b[i];

  if (
    !isFiniteNumber(prevA) ||
    !isFiniteNumber(prevB) ||
    !isFiniteNumber(currA) ||
    !isFiniteNumber(currB)
  ) {
    return false;
  }

  return prevA <= prevB && currA > currB;
}

function crossesBelow(a: number[], b: number[], i: number): boolean {
  if (i <= 0 || i >= a.length || i >= b.length) {
    return false;
  }

  const prevA = a[i - 1];
  const prevB = b[i - 1];
  const currA = a[i];
  const currB = b[i];

  if (
    !isFiniteNumber(prevA) ||
    !isFiniteNumber(prevB) ||
    !isFiniteNumber(currA) ||
    !isFiniteNumber(currB)
  ) {
    return false;
  }

  return prevA >= prevB && currA < currB;
}

const BLOCKED_TOKENS = [
  /\brequire\s*\(/,
  /\bimport\b/,
  /\bfetch\s*\(/,
  /\bprocess\b/,
  /\bglobalThis\b/,
  /\bFunction\b/,
  /\beval\s*\(/,
  /\bfs\b/,
];

function validateSignal(value: unknown): value is Signal {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<Signal>;
  return (
    typeof candidate.date === "string" &&
    (candidate.type === "BUY" || candidate.type === "SELL")
  );
}

export function executeStrategy(code: string, candles: OHLCV[]): ExecutionResult {
  if (!code.trim()) {
    return { success: false, signals: [], error: "Strategy code is empty" };
  }

  for (const pattern of BLOCKED_TOKENS) {
    if (pattern.test(code)) {
      return { success: false, signals: [], error: "Strategy contains blocked APIs" };
    }
  }

  const closes = candles.map((candle) => candle.close);
  const highs = candles.map((candle) => candle.high);
  const lows = candles.map((candle) => candle.low);
  const volumes = candles.map((candle) => candle.volume);

  const context = {
    Math,
    Array,
    Object,
    Number,
    candles,
    closes,
    highs,
    lows,
    volumes,
    signals: [] as Signal[],
    sma,
    ema,
    rsi,
    crossesAbove,
    crossesBelow,
  };

  const wrapped = `"use strict";\n${code}\n;signals;`;

  try {
    const result = runInNewContext(wrapped, context, { timeout: 3000 });
    if (!Array.isArray(result)) {
      return { success: false, signals: [], error: "Strategy must produce signals[]" };
    }

    const validSignals: Signal[] = [];
    for (const item of result) {
      if (!validateSignal(item)) {
        return { success: false, signals: [], error: "Invalid signal format returned" };
      }
      validSignals.push(item);
    }

    return { success: true, signals: validSignals };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Strategy execution failed";
    return { success: false, signals: [], error: message };
  }
}
