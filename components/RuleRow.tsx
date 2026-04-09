"use client";

type Rule = {
  indicator: "RSI" | "SMA" | "EMA" | "PRICE";
  comparator: ">" | "<" | "crosses_above" | "crosses_below";
  value: number;
  period: number;
};

type RuleRowProps = {
  rule: Rule;
  onChange: (rule: Rule) => void;
  onDelete: () => void;
};

const inputClassName =
  "rounded border border-[#2a2a2a] bg-[#0d0d0d] px-2 py-1 text-zinc-300";

export function RuleRow({ rule, onChange, onDelete }: RuleRowProps) {
  const updateRule = (updates: Partial<Rule>) => {
    onChange({ ...rule, ...updates });
  };

  return (
    <div className="flex items-center gap-2 border border-[#2a2a2a] bg-[#111] p-2 font-mono text-sm">
      <select
        value={rule.indicator}
        onChange={(event) => {
          const indicator = event.target.value as Rule["indicator"];
          updateRule({
            indicator,
            period: indicator === "PRICE" ? rule.period : rule.period || 14,
          });
        }}
        className={inputClassName}
      >
        <option value="RSI">RSI</option>
        <option value="SMA">SMA</option>
        <option value="EMA">EMA</option>
        <option value="PRICE">PRICE</option>
      </select>

      {rule.indicator !== "PRICE" ? (
        <input
          type="number"
          value={Number.isFinite(rule.period) ? rule.period : 14}
          onChange={(event) => updateRule({ period: Number(event.target.value) || 14 })}
          className={`${inputClassName} w-20`}
        />
      ) : null}

      <select
        value={rule.comparator}
        onChange={(event) => updateRule({ comparator: event.target.value as Rule["comparator"] })}
        className={inputClassName}
      >
        <option value=">">is above</option>
        <option value="<">is below</option>
        <option value="crosses_above">crosses above</option>
        <option value="crosses_below">crosses below</option>
      </select>

      <input
        type="number"
        value={Number.isFinite(rule.value) ? rule.value : 0}
        onChange={(event) => updateRule({ value: Number(event.target.value) || 0 })}
        className={`${inputClassName} w-24`}
      />

      <button
        type="button"
        onClick={onDelete}
        className="ml-auto rounded border border-[#5a2323] px-2 py-1 text-red-400 hover:bg-[#2a1111]"
        aria-label="Delete rule"
      >
        ×
      </button>
    </div>
  );
}
