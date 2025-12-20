import { Icon } from "@iconify/react";
import { Button, buttonVariants } from "../ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";

type BackButtonProps = {
  href: string;
};

export const BackButton = ({ href }: BackButtonProps) => {
  return (
    <Link href={href} className={cn(buttonVariants({ variant: "outline", size: "icon-md" }))}>
      <Icon icon="ph:arrow-left" className="w-4 h-4" />
    </Link>
  );
};
