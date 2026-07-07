import React, { useEffect, useRef, useState } from "react";
import {
  useListSearchSuggestions,
  getListSearchSuggestionsQueryKey,
} from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Briefcase, Building, Wrench } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const KIND_ICONS: Record<string, React.ReactNode> = {
  title: <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />,
  company: <Building className="h-3.5 w-3.5 text-muted-foreground" />,
  skill: <Wrench className="h-3.5 w-3.5 text-muted-foreground" />,
};

interface SearchBoxProps {
  scope: "candidates" | "jobs";
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  inputClassName?: string;
  containerClassName?: string;
}

export function SearchBox({
  scope,
  value,
  onChange,
  placeholder,
  inputClassName,
  containerClassName,
}: SearchBoxProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [suppressed, setSuppressed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const debouncedValue = useDebounce(value, 250);
  const query = debouncedValue.trim();
  const { data: suggestions } = useListSearchSuggestions(
    { scope, q: query },
    {
      query: {
        enabled: query.length >= 2,
        queryKey: getListSearchSuggestionsQueryKey({ scope, q: query }),
      },
    },
  );

  const items = !suppressed && query.length >= 2 ? (suggestions ?? []) : [];
  const showDropdown = open && items.length > 0;

  useEffect(() => {
    setActiveIndex(-1);
  }, [debouncedValue]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent): void => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const select = (label: string, kind: string): void => {
    track("suggestion_selected", { scope, suggestion: label, kind });
    setSuppressed(true);
    onChange(label);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (!showDropdown) {
      if (e.key === "Escape") setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      const item = items[activeIndex];
      if (item) select(item.label, item.kind);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", containerClassName)}>
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          setSuppressed(false);
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className={inputClassName}
        role="combobox"
        aria-expanded={showDropdown}
        aria-autocomplete="list"
      />
      {showDropdown && (
        <div className="absolute z-50 mt-1 w-full min-w-[240px] rounded-md border bg-popover text-popover-foreground shadow-md overflow-hidden">
          <ul role="listbox">
            {items.map((item, i) => (
              <li
                key={`${item.kind}:${item.label}`}
                role="option"
                aria-selected={i === activeIndex}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm cursor-pointer",
                  i === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(item.label, item.kind);
                }}
                onMouseEnter={() => setActiveIndex(i)}
              >
                {KIND_ICONS[item.kind]}
                <span className="truncate">{item.label}</span>
                <span className="ml-auto text-xs text-muted-foreground capitalize">
                  {item.kind}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
