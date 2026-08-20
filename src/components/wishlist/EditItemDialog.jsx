import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import ManualItemForm from "@/components/wishlist/ManualItemForm";
import { Pencil, Trash2, Loader2 } from "lucide-react";

export default function EditItemDialog({ item, categories, onSaved, onDeleted }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSubmit = async (data) => {
    const updated = await base44.entities.WishlistItem.update(item.id, data);
    onSaved && onSaved(updated);
    setOpen(false);
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await base44.entities.WishlistItem.delete(item.id);
      onDeleted && onDeleted(item);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setConfirmDelete(false); }}>
      <DialogTrigger asChild>
        <button
          type="button"
          title="Edit"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm backdrop-blur transition-colors hover:bg-background"
        >
          <Pencil className="h-3 w-3" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{confirmDelete ? "Remove this item?" : "Edit item"}</DialogTitle>
        </DialogHeader>
        {confirmDelete ? (
          <div className="space-y-5 py-1">
            <p className="text-sm text-muted-foreground">
              “{item.title}” will be removed from your wishlist. This can't be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={busy}
              >
                {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                Remove
              </Button>
            </div>
          </div>
        ) : (
          <ManualItemForm
            categories={categories}
            initial={item}
            onSubmit={handleSubmit}
            submitLabel="Save changes"
            submitVariant="outline"
            footerLeading={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete item
              </Button>
            }
          />
        )}
      </DialogContent>
    </Dialog>
  );
}