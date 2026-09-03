"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type StudioSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export function StudioSelect({
  options,
  name,
  value,
  defaultValue,
  placeholder = "Choose an option",
  required,
  disabled,
  ariaLabel,
  triggerClassName,
  onValueChange,
}: {
  options: StudioSelectOption[];
  name?: string;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  triggerClassName?: string;
  onValueChange?: (value: string) => void;
}) {
  const resolvedPlaceholder = options.find((option) => option.value === "")?.label ?? placeholder;
  return <Select
    items={options}
    name={name}
    value={value}
    defaultValue={defaultValue}
    required={required}
    disabled={disabled}
    onValueChange={(nextValue) => onValueChange?.(nextValue ?? "")}
  >
    <SelectTrigger
      aria-label={ariaLabel}
      className={cn(
        "min-h-[45px] min-w-0 w-full rounded-[10px_7px_11px_8px] border-[1.5px] border-hippy-ink bg-[#fffaf0] px-3 py-2.5 text-[10px] font-bold text-hippy-ink shadow-[2px_2px_0_#d9a47e] hover:bg-[#fff4dc] focus-visible:border-hippy-orange focus-visible:ring-[#df682c35]",
        triggerClassName,
      )}
    >
      <SelectValue placeholder={resolvedPlaceholder} />
    </SelectTrigger>
    <SelectContent className="rounded-[12px_9px_13px_10px] border-[1.5px] border-hippy-ink bg-[#fff8e8] p-1.5 shadow-[4px_4px_0_#3b2923] ring-0">
      {options.map((option) => <SelectItem
        className="min-h-[34px] rounded-[8px] px-2.5 py-2 text-[10px] font-bold text-hippy-ink focus:bg-[#f4cf94]"
        disabled={option.disabled}
        key={option.value || "empty-option"}
        value={option.value}
      >
        {option.label}
      </SelectItem>)}
    </SelectContent>
  </Select>;
}
