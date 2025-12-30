"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "../ui/label";
import { cn } from "@/lib/utils";

function formatDate(date: Date | undefined) {
  if (!date) {
    return "";
  }
  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function isValidDate(date: Date | undefined) {
  if (!date) {
    return false;
  }
  return !Number.isNaN(date.getTime());
}

interface DatePickerProps {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
  label?: string;
  disabled?: boolean;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "June 01, 2025",
  className,
  label,
  disabled = false,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [month, setMonth] = React.useState<Date | undefined>(value);
  const [inputValue, setInputValue] = React.useState(formatDate(value));

  // Sync input value when external value changes
  React.useEffect(() => {
    setInputValue(formatDate(value));
    setMonth(value);
  }, [value]);

  return (
    <div className="flex flex-col gap-2">
      {label && <Label htmlFor="date-picker">{label}</Label>}
      <div className={className ?? "relative flex gap-2"}>
        <Input
          value={inputValue}
          placeholder={placeholder}
          disabled={disabled}
          className={cn("bg-background pr-7", disabled && "opacity-50")}
          onChange={(e) => {
            const date = new Date(e.target.value);
            setInputValue(e.target.value);
            if (isValidDate(date)) {
              onChange(date);
              setMonth(date);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
            }
          }}
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" className="absolute top-1/2 right-2 size-6 -translate-y-1/2" disabled={disabled}>
              <CalendarIcon className="size-3.5" />
              <span className="sr-only">Select date</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto overflow-hidden p-0" align="end" alignOffset={-8} sideOffset={10}>
            <Calendar
              mode="single"
              selected={value}
              captionLayout="dropdown"
              month={month}
              onMonthChange={setMonth}
              onSelect={(date) => {
                onChange(date);
                setInputValue(formatDate(date));
                setOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
