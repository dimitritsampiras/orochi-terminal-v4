"use client"

import * as React from "react"
import { ChevronDownIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DateTimePickerProps {
  value?: string | Date
  onChange?: (value: string) => void
  disabled?: boolean
  placeholder?: string
}

export function DateTimePicker({ 
  value, 
  onChange, 
  disabled = false,
  placeholder = "Select date and time"
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false)

  // Parse the value to get date and time parts
  const dateValue = React.useMemo(() => {
    if (!value) return undefined
    const date = value instanceof Date ? value : new Date(value)
    return isNaN(date.getTime()) ? undefined : date
  }, [value])

  const timeValue = React.useMemo(() => {
    if (!dateValue) return "10:30"
    const hours = dateValue.getHours().toString().padStart(2, '0')
    const minutes = dateValue.getMinutes().toString().padStart(2, '0')
    return `${hours}:${minutes}`
  }, [dateValue])

  // Handle date selection
  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (!selectedDate || !onChange) return
    
    try {
      // If we have an existing time, preserve it, otherwise use current time
      const [hours, minutes] = timeValue.split(':').map(Number)
      
      // Validate time values
      if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        console.warn('Invalid time values, using defaults')
        selectedDate.setHours(10, 30, 0, 0)
      } else {
        selectedDate.setHours(hours, minutes, 0, 0)
      }
      
      // Validate the final date
      if (isNaN(selectedDate.getTime())) {
        console.warn('Invalid date created, skipping update')
        return
      }
      
      // Convert to ISO string for datetime-local input compatibility
      const isoString = selectedDate.toISOString().slice(0, 16)
      onChange(isoString)
      setOpen(false)
    } catch (error) {
      console.error('Error handling date selection:', error)
    }
  }

  // Handle time change
  const handleTimeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!onChange) return
    
    try {
      const timeStr = event.target.value
      
      // Validate time string format
      if (!timeStr || !timeStr.includes(':')) {
        console.warn('Invalid time format:', timeStr)
        return
      }
      
      const timeParts = timeStr.split(':')
      if (timeParts.length < 2) {
        console.warn('Invalid time parts:', timeParts)
        return
      }
      
      const [hours, minutes] = timeParts.map(Number)
      
      // Validate time values
      if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        console.warn('Invalid time values:', { hours, minutes })
        return
      }
      
      // Use existing date or today's date
      const newDate = dateValue ? new Date(dateValue) : new Date()
      
      // Validate base date
      if (isNaN(newDate.getTime())) {
        console.warn('Invalid base date, using today')
        const today = new Date()
        today.setHours(hours, minutes, 0, 0)
        
        if (isNaN(today.getTime())) {
          console.error('Failed to create valid date')
          return
        }
        
        const isoString = today.toISOString().slice(0, 16)
        onChange(isoString)
        return
      }
      
      newDate.setHours(hours, minutes, 0, 0)
      
      // Final validation before converting to ISO
      if (isNaN(newDate.getTime())) {
        console.error('Date became invalid after setting time')
        return
      }
      
      // Convert to ISO string for datetime-local input compatibility
      const isoString = newDate.toISOString().slice(0, 16)
      onChange(isoString)
    } catch (error) {
      console.error('Error handling time change:', error)
    }
  }

  return (
    <div className="flex gap-2 w-full">
      <div className="flex flex-col gap-1 flex-1">
        <Label htmlFor="date-picker" className="text-xs text-muted-foreground font-normal">
          Date
        </Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              id="date-picker"
              className="w-full justify-between font-normal"
              disabled={disabled}
            >
              {dateValue ? dateValue.toLocaleDateString() : "Select date"}
              <ChevronDownIcon />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto overflow-hidden p-0" align="start">
            <Calendar
              mode="single"
              selected={dateValue}
              captionLayout="dropdown"
              onSelect={handleDateSelect}
              disabled={disabled}
            />
          </PopoverContent>
        </Popover>
      </div>
      <div className="flex flex-col gap-1 flex-1">
        <Label htmlFor="time-picker" className="text-xs text-muted-foreground font-normal">
          Time
        </Label>
        <Input
          type="time"
          id="time-picker"
          value={timeValue}
          onChange={handleTimeChange}
          disabled={disabled}
          className="bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
        />
      </div>
    </div>
  )
}
