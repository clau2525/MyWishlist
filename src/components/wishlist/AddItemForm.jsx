import React, { useState } from "react";
import { createItem } from "@/api/wishlist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CategorySelect from "@/components/wishlist/CategorySelect";
import ManualItemForm from "@/components/wishlist/ManualItemForm";
import { Link2, ArrowRight } from "lucide-react";

// Two steps: paste the link (and pick tags), then fill in title, price and
// picture by hand. Nothing tries to read the page — shops block that more often
// than not, so the details are always typed in.
export default function AddItemForm({ wishlistId, categories, onAdded }) {
  const [url, setUrl] = useState("");
  const [tags, setTags] = useState([]);
  const [error, setError] = useState("");
  const [details, setDetails] = useState(null);

  const normalizeUrl = (value) => {
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (!/^https?:\/\//i.test(trimmed)) return "https://" + trimmed;
    return trimmed;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    const finalUrl = normalizeUrl(url);
    if (!finalUrl) {
      setError("Paste a product link first.");
      return;
    }
    setDetails({
      title: "",
      price: "",
      image_url: "",
      source_url: finalUrl,
      category: tags,
    });
  };

  const handleDetailsSubmit = async (data) => {
    const item = await createItem(wishlistId, data);
    onAdded && onAdded(item);
    setDetails(null);
    setUrl("");
    setTags([]);
  };

  if (details) {
    return (
      <ManualItemForm
        categories={categories}
        initial={details}
        onSubmit={handleDetailsSubmit}
        onCancel={() => setDetails(null)}
        submitLabel="Add item"
      />
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
        />
      </div>
      <CategorySelect
        categories={categories}
        value={tags}
        onChange={setTags}
        placeholder="Tags (optional)"
      />
      <Button type="submit" className="w-full">
        Next
        <ArrowRight className="h-4 w-4 ml-2" />
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
