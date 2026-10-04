"use client";

type DoorState = "open" | "closed" | "untested";

export function Switches({
  bits,
  onToggle,
  disabled,
  small,
}: {
  bits: string;
  onToggle?: (i: number) => void;
  disabled?: boolean;
  small?: boolean;
}) {
  return (
    <div className={`flex ${small ? "gap-1.5" : "gap-2 sm:gap-3"}`} role="group" aria-label="Switches">
      {bits.split("").map((b, i) => {
        const on = b === "1";
        return (
          <button
            key={i}
            type="button"
            disabled={disabled || !onToggle}
            onClick={() => onToggle?.(i)}
            aria-pressed={on}
            aria-label={`Switch ${i + 1} ${on ? "on" : "off"}`}
            className={`flex flex-col items-center rounded-xl border transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 ${
              small ? "w-8 py-1" : "w-11 py-2 sm:w-14"
            } ${on ? "border-amber-300 bg-amber-300/15" : "border-white/15 bg-white/5"} ${
              onToggle && !disabled ? "cursor-pointer hover:border-amber-200" : "cursor-default"
            }`}
          >
            <span className={`text-[10px] ${small ? "" : "sm:text-xs"} text-white/50`}>{i + 1}</span>
            <span
              className={`mt-1 block rounded-full transition ${small ? "h-4 w-4" : "h-7 w-7"} ${
                on ? "bg-amber-300 shadow-[0_0_14px] shadow-amber-300/70" : "bg-white/15"
              }`}
            />
            <span className={`mt-1 font-mono text-[10px] ${on ? "text-amber-200" : "text-white/40"}`}>{on ? "ON" : "off"}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Door({ state, small }: { state: DoorState; small?: boolean }) {
  const label = state === "open" ? "OPEN" : state === "closed" ? "LOCKED" : "?";
  return (
    <div
      className={`relative flex items-end justify-center overflow-hidden rounded-t-[2rem] border-2 transition-colors duration-300 ${
        small ? "h-20 w-14" : "h-32 w-24"
      } ${
        state === "open"
          ? "border-emerald-400 bg-emerald-400/20"
          : state === "closed"
            ? "border-rose-400 bg-rose-500/15"
            : "border-white/20 bg-white/5"
      }`}
      aria-label={`Door: ${state === "untested" ? "not tested for this pattern" : label.toLowerCase()}`}
    >
      <div
        className={`absolute inset-1 rounded-t-[1.7rem] bg-slate-800 transition-transform duration-500 origin-left ${
          state === "open" ? "[transform:perspective(300px)_rotateY(-70deg)]" : ""
        }`}
      >
        <span className="absolute right-2 top-1/2 h-2 w-2 rounded-full bg-amber-300/80" />
      </div>
      <span
        className={`relative z-10 mb-2 font-mono text-xs font-bold ${
          state === "open" ? "text-emerald-300" : state === "closed" ? "text-rose-300" : "text-white/50"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

export function PatternChip({ bits, open, note }: { bits: string; open: boolean; note?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-lg border px-2 py-1 font-mono text-xs ${
        open ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200" : "border-rose-400/30 bg-rose-500/10 text-rose-200"
      }`}
    >
      <span className="tracking-[0.2em]">
        {bits.split("").map((b, i) => (
          <span key={i} className={b === "1" ? "text-amber-300" : "text-white/30"}>
            {b === "1" ? "●" : "○"}
          </span>
        ))}
      </span>
      <span>{open ? "open" : "locked"}</span>
      {note && <span className="text-white/40">{note}</span>}
    </span>
  );
}
