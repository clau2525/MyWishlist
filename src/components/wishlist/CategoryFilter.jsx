import React from "react";
import { cn } from "@/lib/utils";

export default function CategoryFilter({ categories, selected, onSelect, counts, boughtCount }) {
  return (
    <div className="flex flex-wrap gap-2">
      <FilterChip
        label="All"
        count={counts.all}
        active={selected === null}
        onClick={() => onSelect(null)}
      />
      {categories.map((cat) => (
        <FilterChip
          key={cat}
          label={cat}
          count={counts[cat] || 0}
          active={selected === cat}
          onClick={() => onSelect(cat)}
        />
      ))}
      {boughtCount > 0 && (
        <FilterChip
          label="Bought"
          count={boughtCount}
          active={selected === "__bought__"}
          onClick={() => onSelect("__bought__")}
          accent
        />
      )}
    </div>
  );
}

function FilterChip({ label, count, active, onClick, accent }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all",
        active
          ? accent
            ? "border-emerald-500 bg-emerald-500 text-white shadow-sm"
            : "border-primary bg-primary text-primary-foreground shadow-sm"
          : accent
          ? "border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
          : "border-border bg-card text-foreground hover:border-foreground/30 hover:bg-secondary"
      )}
    >
      {label}
      <span
        className={cn(
          "rounded-full px-1.5 text-[11px] tabular-nums",
          active ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground"
        )}
      >
        {count}
      </span>
    </button>
  );
}