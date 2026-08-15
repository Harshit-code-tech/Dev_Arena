import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import "../styles/AnimatedSelect.css";

export type AnimatedSelectOption<T extends string = string> = {
  value: T;
  label: string;
  description?: string;
  disabled?: boolean;
};

type AnimatedSelectProps<T extends string> = {
  id?: string;
  value: T;
  options: AnimatedSelectOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  ariaLabel?: string;
  error?: boolean | string;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
};

export default function AnimatedSelect<T extends string>({
  id,
  value,
  options,
  onChange,
  disabled = false,
  ariaLabel,
  error = false,
  searchable = false,
  searchPlaceholder = "Search options",
  emptyMessage = "No matching options",
}: AnimatedSelectProps<T>) {
  const generatedId = useId();
  const triggerId = id || `animated-select-${generatedId}`;
  const listboxId = `${triggerId}-listbox`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options;
    return options.filter((option) =>
      `${option.label} ${option.description || ""}`.toLowerCase().includes(normalized),
    );
  }, [options, query]);

  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const selectedFilteredIndex = filteredOptions.findIndex((option) => option.value === value && !option.disabled);
    const firstEnabledIndex = filteredOptions.findIndex((option) => !option.disabled);
    setActiveIndex(selectedFilteredIndex >= 0 ? selectedFilteredIndex : Math.max(firstEnabledIndex, 0));
    if (searchable) window.setTimeout(() => searchRef.current?.focus(), 0);
  }, [open, searchable, value]); // filtered options are intentionally recalculated by query navigation

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    const firstEnabledIndex = filteredOptions.findIndex((option) => !option.disabled);
    setActiveIndex(Math.max(firstEnabledIndex, 0));
  }, [query]);

  function choose(option: AnimatedSelectOption<T> | undefined) {
    if (!option || option.disabled) return;
    onChange(option.value);
    setOpen(false);
  }

  function move(direction: 1 | -1) {
    if (filteredOptions.length === 0) return;
    let nextIndex = activeIndex;
    for (let attempts = 0; attempts < filteredOptions.length; attempts += 1) {
      nextIndex = (nextIndex + direction + filteredOptions.length) % filteredOptions.length;
      if (!filteredOptions[nextIndex]?.disabled) {
        setActiveIndex(nextIndex);
        return;
      }
    }
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) setOpen(true);
      else move(event.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (event.key === "Home" && open) {
      event.preventDefault();
      const index = filteredOptions.findIndex((option) => !option.disabled);
      if (index >= 0) setActiveIndex(index);
      return;
    }
    if (event.key === "End" && open) {
      event.preventDefault();
      const reversedIndex = [...filteredOptions].reverse().findIndex((option) => !option.disabled);
      if (reversedIndex >= 0) setActiveIndex(filteredOptions.length - reversedIndex - 1);
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && open && event.currentTarget !== searchRef.current) {
      event.preventDefault();
      choose(filteredOptions[activeIndex]);
    }
    if (event.key === "Tab") setOpen(false);
  }

  const activeOption = filteredOptions[activeIndex];
  const activeOptionId = activeOption ? `${listboxId}-option-${activeIndex}` : undefined;

  return (
    <div
      className={`animated-select${open ? " is-open" : ""}${error ? " has-error" : ""}${disabled ? " is-disabled" : ""}`}
      ref={rootRef}
    >
      <button
        id={triggerId}
        type="button"
        className="animated-select__trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-expanded={open}
        aria-invalid={Boolean(error)}
        aria-activedescendant={open ? activeOptionId : undefined}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleKeyDown}
      >
        <span>{selected?.label || value || "Select an option"}</span>
        <i aria-hidden="true" />
      </button>

      <div
        id={listboxId}
        className="animated-select__menu"
        role="listbox"
        aria-labelledby={triggerId}
        aria-hidden={!open}
      >
        {searchable && open && (
          <div className="animated-select__search-wrap">
            <input
              ref={searchRef}
              className="animated-select__search"
              value={query}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
        )}
        {filteredOptions.map((option, index) => (
          <button
            id={`${listboxId}-option-${index}`}
            key={option.value}
            type="button"
            role="option"
            tabIndex={-1}
            aria-selected={option.value === value}
            aria-disabled={option.disabled || undefined}
            disabled={option.disabled}
            className={`${option.value === value ? "is-selected" : ""}${index === activeIndex ? " is-active" : ""}`}
            onPointerMove={() => !option.disabled && setActiveIndex(index)}
            onClick={() => choose(option)}
          >
            <span>{option.label}</span>
            {option.description && <small>{option.description}</small>}
          </button>
        ))}
        {filteredOptions.length === 0 && <p className="animated-select__empty">{emptyMessage}</p>}
      </div>
      {typeof error === "string" && error && <small className="animated-select__error">{error}</small>}
    </div>
  );
}
