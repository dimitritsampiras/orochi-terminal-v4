"use client";
import { Icon } from "@iconify/react";
import { Button, buttonVariants } from "../ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { VariantProps } from "class-variance-authority";

type NavButtonProps = {
  /** The href to navigate to. If null/undefined, button will be disabled */
  href: string | null | undefined;
  /** Direction of navigation - affects which icon is shown */
  direction: "prev" | "next" | "up" | "down";
  /** Additional class names */
  className?: string;
  /** Button size variant */
  size?: VariantProps<typeof buttonVariants>["size"];
  /** Button variant */
  variant?: VariantProps<typeof buttonVariants>["variant"];
  /** Custom icon override */
  icon?: string;
  /** Whether the button is disabled (in addition to href being null) */
  disabled?: boolean;
};

const directionIcons: Record<NavButtonProps["direction"], string> = {
  prev: "ph:caret-left",
  next: "ph:caret-right",
  up: "ph:caret-up",
  down: "ph:caret-down",
};

/**
 * Generic navigation button for prev/next navigation.
 * 
 * Renders as a Link when href is provided, or a disabled Button otherwise.
 * Use this for order navigation, assembly navigation, product navigation, etc.
 */
export const NavButton = ({
  href,
  direction,
  className,
  size = "icon",
  variant = "outline",
  icon,
  disabled = false,
}: NavButtonProps) => {
  const iconName = icon ?? directionIcons[direction];
  const isDisabled = disabled || !href;

  if (href && !isDisabled) {
    return (
      <Link 
        href={href} 
        className={cn(buttonVariants({ variant, size }), className)}
      >
        <Icon icon={iconName} className="size-4" />
      </Link>
    );
  }

  return (
    <Button variant={variant} size={size} disabled className={className}>
      <Icon icon={iconName} className="size-4" />
    </Button>
  );
};

