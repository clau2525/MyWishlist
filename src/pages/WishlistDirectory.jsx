import React, { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { listWishlists } from "@/api/wishlist";
import { Gift, Loader2, AlertCircle, ChevronRight } from "lucide-react";

// The bare site URL (/#/). Each list really lives at /#/<slug>; this just
// points people there. With a single list it goes straight to it, so links
// shared before lists had their own URLs keep working.
export default function WishlistDirectory() {
  const [lists, setLists] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "Wishlists";
    listWishlists()
      .then(setLists)
      .catch((e) => setError(e.message || "Could not load the wishlists."));
  }, []);

  if (lists?.length === 1) return <Navigate to={`/${lists[0].slug}`} replace />;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-4 sm:px-6 py-10 sm:py-14">
        <header className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Gift className="h-5 w-5" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Wishlists</h1>
        </header>

        {error ? (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-medium text-destructive">Couldn't load the wishlists</p>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
          </div>
        ) : !lists ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : lists.length === 0 ? (
          <p className="text-sm text-muted-foreground">No wishlists yet.</p>
        ) : (
          <ul className="space-y-2">
            {lists.map((list) => (
              <li key={list.id}>
                <Link
                  to={`/${list.slug}`}
                  className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-sm font-medium transition-colors hover:bg-secondary"
                >
                  {list.name}
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
