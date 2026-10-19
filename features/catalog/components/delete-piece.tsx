'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { deleteItemAction } from '../actions';

/** Deleting also removes the photos from storage, so it asks first. */
export function DeletePiece({ id, title }: { id: string; title: string }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="destructive" />}>Delete</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {title}?</DialogTitle>
          <DialogDescription>
            The piece comes off the storefront and its photos are deleted. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <form action={deleteItemAction}>
          <input type="hidden" name="id" value={id} />
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Keep it</DialogClose>
            <Button type="submit" variant="destructive">Delete piece</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
