import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CategorySelect from "@/components/wishlist/CategorySelect";
import ManualItemForm from "@/components/wishlist/ManualItemForm";
import { Loader2, Link2, Plus, AlertCircle } from "lucide-react";

export default function AddItemForm({ categories, onAdded }) {
  const [url, setUrl] = useState("");
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [manual, setManual] = useState(null);

  const normalizeUrl = (value) => {
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (!/^https?:\/\//i.test(trimmed)) return "https://" + trimmed;
    return trimmed;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const finalUrl = normalizeUrl(url);
    if (!finalUrl) {
      setError("Paste a product link first.");
      return;
    }
    setLoading(true);
    try {
      const res = await base44.functions.invoke("scrapeUrl", { url: finalUrl });
      const data = res.data;
      if (data && data.error) throw new Error(data.error);
      const item = await base44.entities.WishlistItem.create({
        title: data.title || finalUrl,
        price: data.price || "€",
        image_url: data.image_url || "",
        source_url: data.source_url || finalUrl,
        category: tags,
        bought: tags.some((c) => c.toLowerCase() === "bought"),
      });
      onAdded && onAdded(item);
      setUrl("");
      setTags([]);
    } catch (err) {
      setManual({
        title: "",
        price: "",
        image_url: "",
        source_url: finalUrl,
        category: tags,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = async (data) => {
    const item = await base44.entities.WishlistItem.create(data);
    onAdded && onAdded(item);
    setManual(null);
    setUrl("");
    setTags([]);
  };

  if (manual) {
    return (
      <div>
        <div className="mb-4 flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <div>
            <p className="text-sm font-medium">Couldn't read that link automatically</p>
            <p className="text-xs text-muted-foreground">
              No worries — add the details yourself and upload a picture.
            </p>
          </div>
        </div>
        <ManualItemForm
          categories={categories}
          initial={manual}
          onSubmit={handleManualSubmit}
          onCancel={() => setManual(null)}
          submitLabel="Add item"
        />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="relative">
        <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a product link"
          className="pl-9"
          disabled={loading}
        />
      </div>
      <CategorySelect
        categories={categories}
        value={tags}
        onChange={setTags}
        disabled={loading}
        placeholder="Tags (optional)"
      />
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Fetching…
          </>
        ) : (
          <>
            <Plus className="h-4 w-4 mr-2" />
            Add to wishlist
          </>
        )}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}