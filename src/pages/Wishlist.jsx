import React, { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { getWishlist, listItems } from "@/api/wishlist";
import { useOwner } from "@/lib/OwnerContext";
import PageNotFound from "@/lib/PageNotFound";
import AddItemButton from "@/components/wishlist/AddItemButton";
import WishlistCard from "@/components/wishlist/WishlistCard";
import CategoryFilter from "@/components/wishlist/CategoryFilter";
import UnlockDialog from "@/components/UnlockDialog";
import { Button } from "@/components/ui/button";
import { Gift, Loader2, Lock, LockOpen, AlertCircle } from "lucide-react";

const BOUGHT = "__bought__";

// Keyed on the slug so moving between lists starts from fresh state (filters,
// items) instead of briefly showing the previous person's list.
export default function WishlistRoute() {
  const { slug } = useParams();
  return <Wishlist key={slug} slug={slug} />;
}

function Wishlist({ slug }) {
  const { isOwnerOf, checking, lock } = useOwner();
  const [wishlist, setWishlist] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [unlockOpen, setUnlockOpen] = useState(false);

  const isOwner = isOwnerOf(wishlist);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const list = await getWishlist(slug);
        if (!active) return;
        if (!list) {
          setNotFound(true);
          return;
        }
        setWishlist(list);
        const rows = await listItems(list.id, 200);
        if (active) setItems(rows);
      } catch (e) {
        if (active) setLoadError(e.message || "Could not load this wishlist.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    if (wishlist) document.title = wishlist.name;
  }, [wishlist]);

  const boughtItems = useMemo(() => items.filter((i) => !!i.bought), [items]);
  const activeItems = useMemo(() => items.filter((i) => !i.bought), [items]);

  const tagsOf = (i) => (Array.isArray(i.category) ? i.category : i.category ? [i.category] : []);

  const categories = useMemo(() => {
    const set = new Set();
    activeItems.forEach((i) => tagsOf(i).forEach((c) => set.add(c)));
    return Array.from(set).sort();
  }, [activeItems]);

  // All tags currently in use by any item (active or bought) — drives the
  // dropdown pickers so unused tags never linger there.
  const allTags = useMemo(() => {
    const set = new Set();
    items.forEach((i) => tagsOf(i).forEach((c) => set.add(c)));
    return Array.from(set).sort();
  }, [items]);

  const counts = useMemo(() => {
    const c = { all: activeItems.length };
    activeItems.forEach((i) => {
      tagsOf(i).forEach((cat) => {
        c[cat] = (c[cat] || 0) + 1;
      });
    });
    return c;
  }, [activeItems]);

  const visibleItems = useMemo(() => {
    if (selectedCategory === BOUGHT) return boughtItems;
    if (!selectedCategory) return activeItems;
    return activeItems.filter((i) => tagsOf(i).includes(selectedCategory));
  }, [activeItems, boughtItems, selectedCategory]);

  const handleAdded = (item) => setItems((prev) => [item, ...prev]);

  if (notFound) return <PageNotFound />;

  const handleDeleted = (item) =>
    setItems((prev) => prev.filter((i) => i.id !== item.id));
  const handleSaved = (updated) =>
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 sm:py-14">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <Gift className="h-5 w-5" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              {wishlist?.name ?? "\u00a0"}
            </h1>
          </div>

          {/* Visitors get a read-only page; the owner unlocks editing once per
              browser and the session sticks around after that. */}
          <div className="flex items-center gap-2">
            {isOwner && (
              <AddItemButton wishlistId={wishlist.id} categories={allTags} onAdded={handleAdded} />
            )}
            {!checking && wishlist && (
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 rounded-2xl text-muted-foreground"
                title={isOwner ? "Lock editing" : "Unlock editing"}
                aria-label={isOwner ? "Lock editing" : "Unlock editing"}
                onClick={() => (isOwner ? lock() : setUnlockOpen(true))}
              >
                {isOwner ? <LockOpen className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </header>

        {loadError && (
          <div className="mb-8 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-medium text-destructive">Couldn't load the wishlist</p>
              <p className="text-xs text-muted-foreground">{loadError}</p>
            </div>
          </div>
        )}

        {items.length > 0 && (
          <div className="mb-8">
            <CategoryFilter
              categories={categories}
              selected={selectedCategory}
              onSelect={setSelectedCategory}
              counts={counts}
              boughtCount={boughtItems.length}
            />
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : visibleItems.length === 0 ? (
          <EmptyState
            hasItems={items.length > 0}
            viewingBought={selectedCategory === BOUGHT}
            canEdit={isOwner}
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {visibleItems.map((item) => (
              <WishlistCard
                key={item.id}
                item={item}
                categories={allTags}
                canEdit={isOwner}
                onDeleted={handleDeleted}
                onSaved={handleSaved}
              />
            ))}
          </div>
        )}
      </div>

      {wishlist && (
        <UnlockDialog
          slug={wishlist.slug}
          name={wishlist.name}
          open={unlockOpen}
          onOpenChange={setUnlockOpen}
        />
      )}
    </div>
  );
}

function EmptyState({ hasItems, viewingBought, canEdit }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border py-20 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
        <Gift className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium">
        {viewingBought
          ? "Nothing bought yet"
          : hasItems
          ? "Nothing in this category yet"
          : "Your wishlist is empty"}
      </h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {viewingBought
          ? "Mark an item as bought and it'll show up here, out of your active wishlist."
          : hasItems
          ? "Try a different category, or add a new item above."
          : canEdit
          ? "Tap \"Add item\" above to save your first want."
          : "Nothing here yet — check back soon."}
      </p>
    </div>
  );
}
