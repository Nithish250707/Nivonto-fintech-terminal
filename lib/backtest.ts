import { ema, rsi, sma } from "@/lib/indicators";

export type Rule = {
  indicator: "RSI" | "SMA" | "EMA" | "PRICE";
  period: number;
  comparator: ">" | "<" | "crosses_above" | "crosses_below";
  value: number;
};

export type Strategy = {
  buyRules: Rule[];
  sellRules: Rule[];
};

export type Signal = {
  date: string;
  type: "BUY" | "SELL";
};

export type Candle = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type Trade = {
  buyDate: string;
  buyPrice: number;
  sellDate: string;
  sellPrice: number;
  returnPct: number;
};

export type EquityPoint = {
  date: string;
  value: number;
};

export type BacktestResult = {
  trades: Trade[];
  equityCurve: EquityPoint[];
  totalReturn: number;
  maxDrawdown: number;
  winRate: number;
  sharpeRatio: number;
};

function isValidNumber(value: number): boolean {
  return Number.isFinite(value) && !Number.isNaN(value);
}

function calculateSharpeRatio(returns: number[]): number {
  if (returns.length < 2) {
    return 0;
  }

  const mean = returns.reduce((sum, item) => sum + item, 0) / returns.length;
  const variance =
    returns.reduce((sum, item) => {
      const diff = item - mean;
      return sum + diff * diff;
    }, 0) /
    (returns.length - 1);
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) {
    return 0;
  }

  return (mean / stdDev) * Math.sqrt(returns.length);
}

function calculateMaxDrawdown(equityCurve: EquityPoint[]): number {
  if (equityCurve.length === 0) {
    return 0;
  }

  let peak = equityCurve[0].value;
  let maxDrawdown = 0;

  for (const point of equityCurve) {
    if (point.value > peak) {
      peak = point.value;
    }

    const drawdown = ((point.value - peak) / peak) * 100;
    if (drawdown < maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  return maxDrawdown;
}

function finalizeBacktest(
  trades: Trade[],
  equityCurve: EquityPoint[],
  initialEquity: number,
  finalEquity: number,
): BacktestResult {
  const tradeReturns = trades.map((trade) => trade.returnPct / 100);
  const wins = trades.filter((trade) => trade.returnPct > 0).length;
  const totalReturn = ((finalEquity - initialEquity) / initialEquity) * 100;

  return {
    trades,
    equityCurve,
    totalReturn,
    maxDrawdown: calculateMaxDrawdown(equityCurve),
    winRate: trades.length > 0 ? (wins / trades.length) * 100 : 0,
    sharpeRatio: calculateSharpeRatio(tradeReturns),
  };
}

function runSignalsBacktest(candles: Candle[], signals: Signal[]): BacktestResult {
  const initialEquity = 10000;
  let equity = initialEquity;
  let inPosition = false;
  let buyPrice = 0;
  let buyDate = "";

  const trades: Trade[] = [];
  const equityCurve: EquityPoint[] = [];

  const signalsByDate = new Map<string, Signal["type"][]>();
  for (const signal of signals) {
    const current = signalsByDate.get(signal.date) ?? [];
    current.push(signal.type);
    signalsByDate.set(signal.date, current);
  }

  for (const candle of candles) {
    const dailySignals = signalsByDate.get(candle.date) ?? [];

    if (!inPosition && dailySignals.includes("BUY")) {
      inPosition = true;
      buyPrice = candle.close;
      buyDate = candle.date;
    } else if (inPosition && dailySignals.includes("SELL")) {
      const tradeReturn = (candle.close - buyPrice) / buyPrice;
      equity *= 1 + tradeReturn;
      trades.push({
        buyDate,
        buyPrice,
        sellDate: candle.date,
        sellPrice: candle.close,
        returnPct: tradeReturn * 100,
      });
      inPosition = false;
      buyPrice = 0;
      buyDate = "";
    }

    equityCurve.push({ date: candle.date, value: equity });
  }

  if (inPosition && candles.length > 0) {
    const lastCandle = candles[candles.length - 1];
    const tradeReturn = (lastCandle.close - buyPrice) / buyPrice;
    equity *= 1 + tradeReturn;
    trades.push({
      buyDate,
      buyPrice,
      sellDate: lastCandle.date,
      sellPrice: lastCandle.close,
      returnPct: tradeReturn * 100,
    });

    const lastPoint = equityCurve[equityCurve.length - 1];
    if (lastPoint && lastPoint.date === lastCandle.date) {
      lastPoint.value = equity;
    } else {
      equityCurve.push({ date: lastCandle.date, value: equity });
    }
  }

  return finalizeBacktest(trades, equityCurve, initialEquity, equity);
}

export function runBacktest(candles: Candle[], strategyOrSignals: Strategy | Signal[]): BacktestResult {
  if (Array.isArray(strategyOrSignals)) {
    return runSignalsBacktest(candles, strategyOrSignals);
  }

  const strategy = strategyOrSignals;
  const closes = candles.map((candle) => candle.close);

  const rsi14 = rsi(closes, 14);
  const sma20 = sma(closes, 20);
  const ema20 = ema(closes, 20);

  const rsiCache = new Map<number, number[]>([[14, rsi14]]);
  const smaCache = new Map<number, number[]>([[20, sma20]]);
  const emaCache = new Map<number, number[]>([[20, ema20]]);

  const resolveSeries = (rule: Rule): number[] => {
    if (rule.indicator === "PRICE") {
      return closes;
    }

    if (rule.indicator === "RSI") {
      if (!rsiCache.has(rule.period)) {
        rsiCache.set(rule.period, rsi(closes, rule.period));
      }
      return rsiCache.get(rule.period) ?? rsi14;
    }

    if (rule.indicator === "SMA") {
      if (!smaCache.has(rule.period)) {
        smaCache.set(rule.period, sma(closes, rule.period));
      }
      return smaCache.get(rule.period) ?? sma20;
    }

    if (!emaCache.has(rule.period)) {
      emaCache.set(rule.period, ema(closes, rule.period));
    }
    return emaCache.get(rule.period) ?? ema20;
  };

  const evaluateRule = (rule: Rule, index: number): boolean => {
    const series = resolveSeries(rule);
    const currentVal = series[index];

    if (!isValidNumber(currentVal)) {
      return false;
    }

    if (rule.comparator === ">") {
      return currentVal > rule.value;
    }

    if (rule.comparator === "<") {
      return currentVal < rule.value;
    }

    if (index === 0) {
      return false;
    }

    const prevVal = series[index - 1];
    if (!isValidNumber(prevVal)) {
      return false;
    }

    if (rule.comparator === "crosses_above") {
      return prevVal <= rule.value && currentVal > rule.value;
    }

    return prevVal >= rule.value && currentVal < rule.value;
  };

  const allRulesPass = (rules: Rule[], index: number): boolean =>
    rules.every((rule) => evaluateRule(rule, index));

  const initialEquity = 10000;
  let equity = initialEquity;
  let inPosition = false;
  let buyPrice = 0;
  let buyDate = "";

  const trades: Trade[] = [];
  const equityCurve: EquityPoint[] = [];

  for (let i = 20; i < candles.length; i += 1) {
    const candle = candles[i];
    const price = closes[i];

    if (!inPosition) {
      if (allRulesPass(strategy.buyRules, i)) {
        inPosition = true;
        buyPrice = price;
        buyDate = candle.date;
      }
    } else if (allRulesPass(strategy.sellRules, i)) {
      const tradeReturn = (price - buyPrice) / buyPrice;
      equity *= 1 + tradeReturn;

      trades.push({
        buyDate,
        buyPrice,
        sellDate: candle.date,
        sellPrice: price,
        returnPct: tradeReturn * 100,
      });

      inPosition = false;
      buyPrice = 0;
      buyDate = "";
    }

    equityCurve.push({ date: candle.date, value: equity });
  }

  if (inPosition && candles.length > 0) {
    const lastCandle = candles[candles.length - 1];
    const sellPrice = lastCandle.close;
    const tradeReturn = (sellPrice - buyPrice) / buyPrice;
    equity *= 1 + tradeReturn;

    trades.push({
      buyDate,
      buyPrice,
      sellDate: lastCandle.date,
      sellPrice,
      returnPct: tradeReturn * 100,
    });

    const lastPoint = equityCurve[equityCurve.length - 1];
    if (lastPoint && lastPoint.date === lastCandle.date) {
      lastPoint.value = equity;
    } else {
      equityCurve.push({ date: lastCandle.date, value: equity });
    }
  }

  return finalizeBacktest(trades, equityCurve, initialEquity, equity);
}
