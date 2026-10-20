import { Check, ChevronsUpDown, Search, SearchX } from "lucide-react";
import {
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

export type ComboboxOption = {
  value: string;
  label: string;
  /** Shown before the label, e.g. a status icon. */
  icon?: ReactNode;
  /** Smaller text under the label. Also searched. */
  description?: string;
};

type Props = {
  options: ComboboxOption[];
  /** Form field name; the value is submitted through a hidden input. */
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  size?: "sm" | "md";
  /** Width and spacing of the trigger. Defaults to full width. */
  className?: string;
  /** An action under the options, e.g. "Configure statuses…". */
  footer?: { label: string; icon?: ReactNode; onSelect: () => void };
  id?: string;
  "aria-label"?: string;
};

type Position = {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
};

/** Dropdown with a search box, like a command menu. */
export function Combobox({
  options,
  name,
  value,
  defaultValue = "",
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No results found.",
  disabled = false,
  size = "md",
  className = "w-full",
  footer,
  id,
  "aria-label": ariaLabel,
}: Props) {
  const [inner, setInner] = useState(defaultValue);
  const selectedValue = value ?? inner;
  const selected = options.find((o) => o.value === selectedValue);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<Position | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) =>
      `${o.label} ${o.description ?? ""}`.toLowerCase().includes(q),
    );
  }, [options, query]);

  const openMenu = (initialQuery = "") => {
    if (disabled) return;
    setQuery(initialQuery);
    const current = options.findIndex((o) => o.value === selectedValue);
    setActive(initialQuery ? 0 : Math.max(0, current));
    setOpen(true);
  };

  const close = (focusTrigger = true) => {
    setOpen(false);
    setPos(null);
    if (focusTrigger) triggerRef.current?.focus();
  };

  const choose = (option: ComboboxOption) => {
    if (value === undefined) setInner(option.value);
    if (option.value !== selectedValue) onChange?.(option.value);
    close();
  };

  // Float the menu under the trigger (or above it when there is no room),
  // outside any scrolling table so it is never clipped.
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const width = Math.max(rect.width, 224);
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
      const below = window.innerHeight - rect.bottom - 12;
      const above = rect.top - 12;
      setPos(
        below < 240 && above > below
          ? { bottom: window.innerHeight - rect.top + 4, left, width, maxHeight: above }
          : { top: rect.bottom + 4, left, width, maxHeight: below },
      );
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  useEffect(() => {
    if (pos) searchRef.current?.focus({ preventScroll: true });
  }, [pos != null]);

  // Close when clicking anywhere else.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      close(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [open, active, pos != null]);

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filtered[active]) choose(filtered[active]);
        break;
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        close();
        break;
      case "Tab":
        // With a footer action, Tab moves on to it instead of closing.
        if (!footer || e.shiftKey) close(false);
        break;
    }
  };

  const onTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (open) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      openMenu();
    } else if (e.key.length === 1 && e.key !== " " && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Start typing to search.
      e.preventDefault();
      openMenu(e.key);
    }
  };

  const sizing = size === "sm" ? "px-2 py-1 text-xs" : "px-2.5 py-1.5 text-sm";

  return (
    <>
      {name !== undefined && <input type="hidden" name={name} value={selectedValue} />}
      <button
        ref={triggerRef}
        type="button"
        id={id}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        disabled={disabled}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onTriggerKeyDown}
        className={`flex items-center justify-between gap-2 rounded-md border bg-white text-left text-slate-900 transition-colors focus:border-navy-600 focus:ring-2 focus:ring-navy-100 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 ${
          open ? "border-navy-600 ring-2 ring-navy-100" : "border-slate-300"
        } ${sizing} ${className}`}
      >
        {selected ? (
          <span className="flex min-w-0 items-center gap-1.5">
            {selected.icon}
            <span className="truncate">{selected.label}</span>
          </span>
        ) : (
          <span className="truncate text-slate-400">{placeholder}</span>
        )}
        <ChevronsUpDown className="size-3.5 shrink-0 text-slate-400" aria-hidden />
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              top: pos.top,
              bottom: pos.bottom,
              left: pos.left,
              width: pos.width,
              maxHeight: Math.min(pos.maxHeight, 320),
            }}
            className="fixed z-[60] flex flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg ring-1 ring-slate-900/5"
          >
            <div className="flex items-center gap-2 border-b border-slate-100 px-2.5">
              <Search className="size-4 shrink-0 text-slate-400" aria-hidden />
              <input
                ref={searchRef}
                type="text"
                role="combobox"
                aria-label={searchPlaceholder}
                aria-expanded
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={
                  filtered[active] ? `${listId}-${active}` : undefined
                }
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onSearchKeyDown}
                placeholder={searchPlaceholder}
                autoComplete="off"
                className="w-full bg-transparent py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />
            </div>
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              aria-label={ariaLabel}
              className="min-h-0 overflow-y-auto p-1"
            >
              {filtered.length === 0 ? (
                <li className="flex flex-col items-center gap-1.5 px-2 py-5 text-center text-sm text-slate-500">
                  <SearchX className="size-5 text-slate-400" aria-hidden />
                  {emptyText}
                </li>
              ) : (
                filtered.map((option, i) => {
                  const isSelected = option.value === selectedValue;
                  return (
                    <li
                      key={option.value}
                      id={`${listId}-${i}`}
                      role="option"
                      aria-selected={isSelected}
                      data-active={i === active}
                      onPointerMove={() => setActive(i)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => choose(option)}
                      className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm ${
                        i === active ? "bg-slate-100 text-slate-900" : "text-slate-700"
                      }`}
                    >
                      {option.icon}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{option.label}</span>
                        {option.description && (
                          <span className="block text-xs text-slate-500">
                            {option.description}
                          </span>
                        )}
                      </span>
                      <Check
                        className={`size-4 shrink-0 text-navy-700 ${isSelected ? "" : "invisible"}`}
                        aria-hidden
                      />
                    </li>
                  );
                })
              )}
            </ul>
            {footer && (
              <div className="border-t border-slate-100 p-1">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    close(false);
                    footer.onSelect();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.preventDefault();
                      e.stopPropagation();
                      close();
                    } else if (e.key === "Tab") {
                      close(false);
                    }
                  }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm font-medium text-navy-700 hover:bg-slate-100 focus:bg-slate-100 focus:outline-none"
                >
                  {footer.icon}
                  {footer.label}
                </button>
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
