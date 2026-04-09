export function sma(values: number[], period: number): number[] {
  if (!Number.isInteger(period) || period <= 0) {
    throw new Error("period must be a positive integer");
  }

  const result = new Array<number>(values.length).fill(Number.NaN);

  if (values.length < period) {
    return result;
  }

  let windowSum = 0;

  for (let i = 0; i < values.length; i += 1) {
    windowSum += values[i];

    if (i >= period) {
      windowSum -= values[i - period];
    }

    if (i >= period - 1) {
      result[i] = windowSum / period;
    }
  }

  return result;
}

export function ema(values: number[], period: number): number[] {
  if (!Number.isInteger(period) || period <= 0) {
    throw new Error("period must be a positive integer");
  }

  const result = new Array<number>(values.length).fill(Number.NaN);

  if (values.length < period) {
    return result;
  }

  const seedIndex = period - 1;
  const multiplier = 2 / (period + 1);
  const seededSma = sma(values, period)[seedIndex];

  result[seedIndex] = seededSma;

  for (let i = seedIndex + 1; i < values.length; i += 1) {
    const prevEma = result[i - 1];
    result[i] = (values[i] - prevEma) * multiplier + prevEma;
  }

  return result;
}

function calculateRsi(avgGain: number, avgLoss: number): number {
  if (avgLoss === 0 && avgGain === 0) {
    return 50;
  }

  if (avgLoss === 0) {
    return 100;
  }

  const relativeStrength = avgGain / avgLoss;
  return 100 - 100 / (1 + relativeStrength);
}

export function rsi(values: number[], period: number = 14): number[] {
  if (!Number.isInteger(period) || period <= 0) {
    throw new Error("period must be a positive integer");
  }

  const result = new Array<number>(values.length).fill(Number.NaN);

  if (values.length <= period) {
    return result;
  }

  let gainsSum = 0;
  let lossesSum = 0;

  for (let i = 1; i <= period; i += 1) {
    const change = values[i] - values[i - 1];
    if (change >= 0) {
      gainsSum += change;
    } else {
      lossesSum += -change;
    }
  }

  let avgGain = gainsSum / period;
  let avgLoss = lossesSum / period;

  result[period] = calculateRsi(avgGain, avgLoss);

  for (let i = period + 1; i < values.length; i += 1) {
    const change = values[i] - values[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    result[i] = calculateRsi(avgGain, avgLoss);
  }

  return result;
}
