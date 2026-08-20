import React from "react";
import { Image } from "@/components/ui/image";
import { cn } from "@/lib/utils";
import { Tag, ArrowUpRight, Check } from "lucide-react";
import EditItemDialog from "@/components/wishlist/EditItemDialog";

export default function WishlistCard({ item, categories, onSaved, onDeleted }) {
  const bought =
    !!item.bought ||
    (Array.isArray(item.category) ? item.category : []).some(
      (c) => c.toLowerCase() === "bought"
    );

  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all duration-200 hover:shadow-md",
        bought && "ring-1 ring-emerald-500/50"
      )}
    >
      <a
        href={item.source_url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-1 flex-col"
      >
        <div className="relative aspect-square overflow-hidden bg-muted">
          {item.image_url ? (
            <Image
              src={item.image_url}
              alt={item.title}
              fittingType="fit"
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
              <Tag className="h-7 w-7" />
            </div>
          )}
          {item.price ? (
            <span className="absolute left-2 top-2 rounded-full bg-background/90 px-2 py-0.5 text-xs font-semibold shadow-sm backdrop-blur">
              {item.price}
            </span>
          ) : null}
          {bought && (
            <span className="absolute bottom-2 left-2 inline-flex items-center gap-0.5 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
              <Check className="h-2.5 w-2.5" /> Bought
            </span>
          )}
          <span className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-background/90 text-muted-foreground opacity-0 shadow-sm backdrop-blur transition-opacity group-hover:opacity-100">
            <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </div>

        <div className="p-2.5">
          <h3 className="line-clamp-2 text-xs font-medium leading-snug tracking-tight">
            {item.title}
          </h3>
        </div>
      </a>

      <div className="absolute right-2 top-2 z-10">
        <EditItemDialog
          item={item}
          categories={categories}
          onSaved={onSaved}
          onDeleted={onDeleted}
        />
      </div>
    </div>
  );
}