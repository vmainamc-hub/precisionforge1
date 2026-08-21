import type { Tick } from "@/lib/deriv-ws";

function lastDigit(quote: number, pipSize: number) {
  const s = quote.toFixed(pipSize);
  return Number(s[s.length - 1]);
}

export function DigitStats({ ticks, pipSize }: { ticks: Tick[]; pipSize: number }) {
  const digits = ticks.map((t) => lastDigit(t.quote, pipSize));
  const counts = Array.from({ length: 10 }, (_, d) => digits.filter((x) => x === d).length);
  const total = digits.length || 1;
  const maxCount = Math.max(...counts, 1);
  const current = digits[digits.length - 1];

  return (
    <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
      {counts.map((c, d) => {
        const pct = (c / total) * 100;
        const isHot = c === maxCount && c > 0;
        return (
          <div
            key={d}
            className={`panel flex flex-col items-center gap-1 px-1 py-2 ${
              d === current ? "ring-2 ring-primary" : ""
            }`}
          >
            <span
              className={`tabular text-sm font-semibold ${isHot ? "text-success" : "text-foreground"}`}
            >
              {d}
            </span>
            <div className="h-14 w-2 overflow-hidden rounded-full bg-muted">
              <div
                className={`w-full rounded-full transition-all duration-500 ${
                  isHot ? "bg-success" : "bg-primary"
                }`}
                style={{
                  height: `${(c / maxCount) * 100}%`,
                  marginTop: `${100 - (c / maxCount) * 100}%`,
                }}
              />
            </div>
            <span className="tabular text-[10px] text-muted-foreground">{pct.toFixed(1)}%</span>
          </div>
        );
      })}
    </div>
  );
}
