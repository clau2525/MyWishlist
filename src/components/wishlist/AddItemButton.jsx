import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import AddItemForm from "@/components/wishlist/AddItemForm";
import { Plus } from "lucide-react";

export default function AddItemButton({ wishlistId, categories, onAdded }) {
  const [open, setOpen] = useState(false);

  const handleAdded = (item) => {
    onAdded && onAdded(item);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-11 rounded-2xl px-5 text-sm font-medium shadow-sm">
          <Plus className="h-4 w-4 mr-2" />
          Add item
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add to wishlist</DialogTitle>
        </DialogHeader>
        <AddItemForm wishlistId={wishlistId} categories={categories} onAdded={handleAdded} />
      </DialogContent>
    </Dialog>
  );
}