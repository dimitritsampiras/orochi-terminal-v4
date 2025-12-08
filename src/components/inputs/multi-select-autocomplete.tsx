import { Input } from '@/components/ui/input';

import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Icon } from '@iconify/react';
import { cn, truncate } from '@/lib/utils';

interface MultiSelectValue {
  existingIds: number[];
  newOptions: string[];
}

function MultiSelectAutocomplete({
  options,
  value,
  onChange,
  placeholder = 'Search'
}: {
  options: {
    label: string;
    value: number;
  }[];
  value: MultiSelectValue;

  onChange: (value: MultiSelectValue) => void;
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);

  const handleInputClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isOpen) {
      setIsOpen(true);
    }
    // Focus the input after a short delay to ensure popover is open
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const toggleExistingOption = (optionValue: number) => {
    const newExistingIds = value.existingIds.includes(optionValue)
      ? value.existingIds.filter((v) => v !== optionValue)
      : [...value.existingIds, optionValue];

    onChange({
      ...value,
      existingIds: newExistingIds
    });
  };

  const toggleNewOption = (optionLabel: string) => {
    const newOptions = value.newOptions.includes(optionLabel)
      ? value.newOptions.filter((v) => v !== optionLabel)
      : [...value.newOptions, optionLabel];

    onChange({
      ...value,
      newOptions
    });
  };

  const addNewOption = () => {
    if (inputValue.trim() && !value.newOptions.includes(inputValue.trim())) {
      const trimmedValue = inputValue.trim();
      // Check if this label already exists in existing options
      const existsInOptions = options.some(
        (opt) => opt.label.toLowerCase() === trimmedValue.toLowerCase()
      );

      if (!existsInOptions) {
        onChange({
          ...value,
          newOptions: [...value.newOptions, trimmedValue]
        });
        setInputValue('');
      }
    }
  };

  const filteredExistingOptions = options.filter((option) =>
    option.label.toLowerCase().includes(inputValue.toLowerCase())
  );

  const filteredNewOptions = value.newOptions.filter((option) =>
    option.toLowerCase().includes(inputValue.toLowerCase())
  );

  const canAddNew =
    inputValue.trim() &&
    !value.newOptions.includes(inputValue.trim()) &&
    !options.some((opt) => opt.label.toLowerCase() === inputValue.trim().toLowerCase());

  return (
    <>
      <div className="relative">
        <Input
          ref={inputRef}
          className="cursor-pointer"
          placeholder={placeholder}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onClick={handleInputClick}
          onFocus={() => setIsOpen(true)}
          onBlur={(e) => {
            if (popoverRef.current?.contains(e.relatedTarget as Node)) {
              return;
            }
            setTimeout(() => setIsOpen(false), 150);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canAddNew) {
              e.preventDefault();
              addNewOption();
            }
            if (e.key === 'Escape') {
              setIsOpen(false);
            }
          }}
        />

        {isOpen && (
          <div
            ref={popoverRef}
            className={`
              absolute top-12 z-50 w-full bg-popover border border-border rounded-md shadow-md p-2
              animate-in fade-in-0 slide-in-from-top-2 duration-200
            `}
            onMouseDown={(e) => e.preventDefault()}
          >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addNewOption}
              disabled={!canAddNew}
              className="w-full text-sm h-8 mb-1 justify-start"
            >
              <Icon icon="ph:plus-circle" className="size-4 mr-2" />
              {canAddNew ? `Add "${truncate(inputValue.trim(), 10)}"` : 'Add new option'}
            </Button>

            {/* Existing Options */}
            {filteredExistingOptions.length > 0 && (
              <div className="max-h-[200px] overflow-y-auto scrollbar-thin">
                {filteredExistingOptions.map((option) => (
                  <Button
                    type="button"
                    variant="ghost"
                    className={cn('flex justify-start w-full h-8 mb-1')}
                    key={option.value}
                    onClick={() => toggleExistingOption(option.value)}
                  >
                    {value.existingIds.includes(option.value) ? (
                      <div className="size-5 shadow-xs bg-black border rounded-sm flex items-center justify-center">
                        <Icon icon="ph:check-bold" className="size-3 text-white" />
                      </div>
                    ) : (
                      <div className="size-5 shadow-xs bg-white border rounded-sm" />
                    )}
                    {option.label}
                  </Button>
                ))}
              </div>
            )}

            {filteredExistingOptions.length === 0 &&
              filteredNewOptions.length === 0 &&
              !canAddNew && (
                <div className="flex items-center justify-center h-8 text-sm text-muted-foreground">
                  No options found
                </div>
              )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1 mt-2">
        {value.existingIds.map((id) => (
          <div
            key={id}
            className="text-xs px-2 py-1 border border-zinc-100 flex rounded-md justify-between bg-zinc-50 items-center gap-2 w-fit"
          >
            <span className="capitalize">{options.find((o) => o.value === id)?.label}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                toggleExistingOption(id);
              }}
            >
              <Icon icon="ph:x" className="size-3" />
            </Button>
          </div>
        ))}
        {value.newOptions.map((option) => (
          <div
            key={option}
            className="text-xs px-2 py-1 border border-zinc-100 flex rounded-md justify-between bg-zinc-50 items-center gap-2 w-fit"
          >
            <span className="capitalize">{option}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                toggleNewOption(option);
              }}
            >
              <Icon icon="ph:x" className="size-3" />
            </Button>
          </div>
        ))}
      </div>
    </>
  );
}

export default MultiSelectAutocomplete;
