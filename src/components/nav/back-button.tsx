"use client";
import { Icon } from "@iconify/react";
import { Button, buttonVariants } from "../ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";

type BackButtonProps = {
  href: string;
  className?: string;
};

export const BackButton = ({ href, className }: BackButtonProps) => {
  return (
    <Link href={href} className={cn(buttonVariants({ variant: "outline", size: "icon-md" }), className)}>
      <Icon icon="ph:arrow-left" className="w-4 h-4" />
    </Link>
  );
};
