"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { useFetcher } from "@/lib/hooks/use-fetcher";
import { parseGid } from "@/lib/utils";
import dayjs from "dayjs";
import { Icon } from "@iconify/react";

type OrderNote = {
  id: string;
  createdAt: Date;
  note: string;
  profile: {
    id: string;
    username: string;
  } | null;
};

type OrderNotesCardProps = {
  orderId: string;
  shopifyNote: string | null | undefined;
  databaseNotes: OrderNote[];
  currentUsername: string;
};

export const OrderNotesCard = ({ orderId, shopifyNote, databaseNotes, currentUsername }: OrderNotesCardProps) => {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");

  const { trigger, isLoading } = useFetcher<{ note: string }>({
    path: `/api/orders/${parseGid(orderId)}/notes`,
    method: "POST",
    successMessage: "Note added",
    onSuccess: () => {
      setOpen(false);
      setNote("");
    },
  });

  const handleSubmit = () => {
    if (note.trim()) {
      trigger({ note: note.trim() });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notes</CardTitle>
      </CardHeader>
      <CardContent className="text-sm">
        {shopifyNote ? (
          <div className="mb-2">
            <div className="text-muted-foreground text-xs mb-1">Customer Note</div>
            <div className="bg-muted/50 rounded-md p-3">{shopifyNote}</div>
          </div>
        ) : (
          <div className="text-muted-foreground mb-4">No customer notes</div>
        )}
      </CardContent>

      <CardHeader>
        <CardTitle>Warehouse Notes</CardTitle>
      </CardHeader>
      <CardContent className="text-sm">
        {databaseNotes.length > 0 ? (
          <div className="space-y-3 mb-4">
            {databaseNotes.map((note) => (
              <div key={note.id} className="flex flex-col">
                <div className="text-xs text-muted-foreground">
                  {dayjs(note.createdAt).format("MMM D, YYYY h:mm A")} • {note.profile?.username || "Unknown"}
                </div>
                <div className="mt-0.5">{note.note}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-muted-foreground mb-4">No warehouse notes</div>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full mt-4">
              <Icon icon="ph:plus" className="size-4" />
              Add Note
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Note To Order</DialogTitle>
              <DialogDescription>Add a note to this order as {currentUsername}</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Textarea
                placeholder="Type your message here..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
              />
            </div>
            <DialogFooter>
              <Button onClick={handleSubmit} disabled={!note.trim() || isLoading} loading={isLoading}>
                Add Note
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

