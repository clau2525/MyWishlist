import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Image } from "@/components/ui/image";
import CategorySelect from "@/components/wishlist/CategorySelect";
import { cn } from "@/lib/utils";
import { Loader2, Upload, ImagePlus } from "lucide-react";

const normalizeUrl = (value) => {
  const trimmed = (value || "").trim();
  if (!trimmed) return "";
  if (!/^https?:\/\//i.test(trimmed)) return "https://" + trimmed;
  return trimmed;
};

const toArr = (v) => (Array.isArray(v) ? v : v ? [v] : []);

export default function ManualItemForm({
  categories,
  initial,
  onSubmit,
  onCancel,
  submitLabel = "Save item",
  submitVariant = "default",
  footerLeading = null,
}) {
  const [title, setTitle] = useState(initial?.title || "");
  const [price, setPrice] = useState(initial?.price || "");
  const [sourceUrl, setSourceUrl] = useState(initial?.source_url || "");
  const [tags, setTags] = useState(() => {
    const t = toArr(initial?.category);
    return initial?.bought && !t.some((c) => c.toLowerCase() === "bought")
      ? [...t, "bought"]
      : t;
  });
  const [imageUrl, setImageUrl] = useState(initial?.image_url || "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setImageUrl(file_url);
    } catch (e) {
      setError("Image upload failed. Try a different file.");
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const finalUrl = normalizeUrl(sourceUrl);
    if (!title.trim()) {
      setError("Add a title.");
      return;
    }
    if (!finalUrl) {
      setError("Add a link.");
      return;
    }
    setSaving(true);
    try {
      const bought = tags.some((c) => c.toLowerCase() === "bought");
      await onSubmit({
        title: title.trim(),
        price: price.trim(),
        source_url: finalUrl,
        image_url: imageUrl,
        category: tags,
        bought,
      });
    } catch (err) {
      setError(err.message || "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="mi-title">Title</Label>
        <Input
          id="mi-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What is it?"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="mi-price">Price</Label>
          <Input
            id="mi-price"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="CHF 760.00"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Tags</Label>
          <CategorySelect
            categories={categories}
            value={tags}
            onChange={setTags}
            placeholder="Optional"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="mi-link">Link</Label>
        <Input
          id="mi-link"
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          placeholder="https://…"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Picture</Label>
        <div className="flex items-center gap-3">
          <label className="flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-input bg-secondary/30 transition-colors hover:bg-secondary/60">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt="preview"
                fittingType="fit"
                className="h-full w-full object-contain"
              />
            ) : uploading ? (
              <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
            ) : (
              <ImagePlus className="h-4 w-4 text-muted-foreground" />
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </label>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">
              {imageUrl ? "Picture added" : "Click to upload"}
            </span>
            {imageUrl && (
              <button
                type="button"
                onClick={() => setImageUrl("")}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className={cn("flex gap-2 pt-1", footerLeading ? "justify-between" : "justify-end")}>
        {footerLeading}
        <div className="flex gap-2">
          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" variant={submitVariant} disabled={saving || uploading}>
            {saving || uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {uploading ? "Uploading…" : "Saving…"}
              </>
            ) : (
              submitLabel
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}