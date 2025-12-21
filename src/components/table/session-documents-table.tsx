"use client";
import { batchDocuments } from "@drizzle/schema";
import { Table, TableHead, TableHeader, TableRow, TableBody, TableCell } from "../ui/table";
import dayjs from "dayjs";
import { Button, buttonVariants } from "../ui/button";
import Link from "next/link";

type BatchDocument = typeof batchDocuments.$inferSelect;

const STORAGE_BASE_URL = "https://muihkdbhpgfkahlyyhmo.supabase.co/storage/v1/object/public/packing-slips";

export function SessionDocumentsTable({ documents, className }: { documents: BatchDocument[]; className?: string }) {
  return (
    <div className="overflow-clip rounded-md border bg-zinc-100">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Document</TableHead>
            <TableHead>Created At</TableHead>
            <TableHead>Path</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((document) => (
            <TableRow key={document.documentPath} className="text-sm">
              <TableCell className="font-semibold">{document.name}</TableCell>
              <TableCell className="text-muted-foreground">
                {dayjs(document.createdAt).format("MMM D, YYYY h:mm A")}
              </TableCell>
              <TableCell>{document.documentPath}</TableCell>
              <TableCell>
                <Link
                  href={`${STORAGE_BASE_URL}/${document.documentPath}`}
                  target="_blank"
                  className={buttonVariants({ size: "sm", variant: "fill" })}
                >
                  View
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
