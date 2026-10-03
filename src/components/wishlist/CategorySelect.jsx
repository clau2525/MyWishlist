import React, { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, Plus } from "lucide-react";

const toArr = (v) => (Array.isArray(v) ? v : v ? [v] : []);

export default function CategorySelect({
  categories,
  value,
  onChange,
  disabled,
  placeholder = "Select tags",
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const selected = toArr(value);

  const toggle = (cat) => {
    if (selected.includes(cat)) {
      onChange(selected.filter((c) => c !== cat));
    } else {
      onChange([...selected, cat]);
    }
    setOpen(false);
  };

  const commitNew = (val) => {
    const v = val.trim();
    if (!v) return;
    if (!selected.includes(v)) onChange([...selected, v]);
    setDraft("");
    setOpen(false);
  };

  const isBoughtSelected = selected.some((c) => c.toLowerCase() === "bought");
  const toggleBought = () => {
    if (isBoughtSelected) {
      onChange(selected.filter((c) => c.toLowerCase() !== "bought"));
    } else {
      onChange([...selected, "bought"]);
    }
    setOpen(false);
  };
  // Show every tag in use plus any just-typed (selected) one, excluding the
  // reserved "bought" status which is rendered separately above.
  const options = Array.from(new Set([...categories, ...selected])).filter(
    (c) => c.toLowerCase() !== "bought"
  );

  const display =
    selected.length === 0 ? "" : selected.length === 1 ? selected[0] : `${selected.length} tags`;

  return (
    // modal: the list is portaled outside the surrounding Dialog, whose scroll
    // lock otherwise swallows wheel and touch scrolling inside it (only arrow
    // keys got through). A modal popover takes over the lock and lets its own
    // content scroll.
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-1 text-left text-sm shadow-sm transition-colors hover:border-foreground/30 focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className={cn("truncate", !display && "text-muted-foreground")}>
            {display || placeholder}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="p-1"
        style={{ width: "var(--radix-popover-trigger-width)" }}
      >
        <div className="max-h-56 overflow-y-auto p-1">
          <button
            type="button"
            onClick={toggleBought}
            className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left text-sm transition-colors hover:bg-secondary"
          >
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Bought
            </span>
            {isBoughtSelected && <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />}
          </button>
          {options.length > 0 && <div className="my-1 h-px bg-border" />}
          {options.map((c) => {
            const on = selected.includes(c);
            return (
              <button
                key={c}
                type="button"
                onClick={() => toggle(c)}
                className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left text-sm transition-colors hover:bg-secondary"
              >
                <span className="truncate">{c}</span>
                {on && <Check className="h-3.5 w-3.5 shrink-0 opacity-70" />}
              </button>
            );
          })}
        </div>
        <div className="border-t border-border p-1">
          <div className="flex items-center gap-2 rounded-md px-2 py-1 focus-within:ring-1 focus-within:ring-ring">
            <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  e.stopPropagation();
                  commitNew(draft);
                }
              }}
              onBlur={() => commitNew(draft)}
              placeholder="Type new tag"
              className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}