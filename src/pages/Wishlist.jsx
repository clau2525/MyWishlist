import React, { useEffect, useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import AddItemButton from "@/components/wishlist/AddItemButton";
import WishlistCard from "@/components/wishlist/WishlistCard";
import CategoryFilter from "@/components/wishlist/CategoryFilter";
import { Gift, Loader2 } from "lucide-react";

const BOUGHT = "__bought__";

export default function Wishlist() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);

  const loadItems = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.WishlistItem.list("-created_date", 200);
      setItems(list);
    } catch (e) {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

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
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">My Wishlist</h1>
          </div>
          <AddItemButton categories={allTags} onAdded={handleAdded} />
        </header>

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
          <EmptyState hasItems={items.length > 0} viewingBought={selectedCategory === BOUGHT} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {visibleItems.map((item) => (
              <WishlistCard
                key={item.id}
                item={item}
                categories={allTags}
                onDeleted={handleDeleted}
                onSaved={handleSaved}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ hasItems, viewingBought }) {
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
          : "Paste a link above to save your first want — we'll pull the picture, price and details automatically."}
      </p>
    </div>
  );
}