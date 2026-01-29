"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";

type ProgressProps = React.ComponentProps<typeof ProgressPrimitive.Root> & {
  color?: "emerald" | "black" | "blue";
};

function Progress({ className, value, color = "black", ...props }: ProgressProps) {
  const isCompleted = value === 100;
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "bg-primary/20 relative h-2 w-full overflow-hidden rounded-full",
        isCompleted && color === "emerald" && "shadow-xs shadow-emerald-200",
        isCompleted && color === "blue" && "shadow-xs shadow-blue-200",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(
          "h-full w-full flex-1 transition-all",
          color === "emerald" && (isCompleted ? "bg-emerald-500" : "bg-emerald-700"),
          color === "black" && "bg-black",
          color === "blue" && (isCompleted ? "bg-blue-600" : "bg-blue-700")
        )}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
