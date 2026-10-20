import { useEffect, useRef } from "react";

const SHOW_DELAY_MS = 350;
/** Moving straight to another control within this time shows its tip at once. */
const SKIP_DELAY_MS = 300;
const GAP_PX = 6;
const EDGE_PX = 8;

/**
 * One tooltip for the whole app. Give any element a data-tooltip="…" and it
 * shows on mouse hover and keyboard focus. It lives in the top layer (a
 * popover), so tables with overflow and modal dialogs can't clip or cover it.
 * Keep an aria-label on icon-only controls; the tooltip is only visual.
 */
export function TooltipLayer() {
  const tipRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const arrowRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const tip = tipRef.current;
    const text = textRef.current;
    const arrow = arrowRef.current;
    if (!tip || !text || !arrow) return;

    let target: HTMLElement | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let hiddenAt = 0;

    const place = (el: HTMLElement) => {
      const anchor = el.getBoundingClientRect();
      const box = tip.getBoundingClientRect();
      const above = anchor.top - GAP_PX - box.height >= EDGE_PX;
      const top = above ? anchor.top - GAP_PX - box.height : anchor.bottom + GAP_PX;
      const center = anchor.left + anchor.width / 2;
      const left = Math.min(
        Math.max(center - box.width / 2, EDGE_PX),
        window.innerWidth - box.width - EDGE_PX,
      );
      tip.style.top = `${top}px`;
      tip.style.left = `${left}px`;
      tip.dataset.side = above ? "top" : "bottom";
      arrow.style.left = `${center - left}px`;
    };

    const show = (el: HTMLElement) => {
      const label = el.dataset.tooltip;
      if (!label || !el.isConnected) return;
      target = el;
      text.textContent = label;
      // Measure at the corner, where its width isn't squeezed by the last spot.
      tip.style.top = "0px";
      tip.style.left = "0px";
      // Re-showing puts it above a modal dialog that opened since.
      if (tip.matches(":popover-open")) tip.hidePopover();
      tip.showPopover();
      place(el);
    };

    const hide = () => {
      clearTimeout(timer);
      if (target) hiddenAt = Date.now();
      target = null;
      if (tip.matches(":popover-open")) tip.hidePopover();
    };

    const schedule = (el: HTMLElement) => {
      clearTimeout(timer);
      if (el === target) return;
      const warm = target !== null || Date.now() - hiddenAt < SKIP_DELAY_MS;
      if (warm) show(el);
      else timer = setTimeout(() => show(el), SHOW_DELAY_MS);
    };

    const tooltipOf = (node: EventTarget | null) =>
      node instanceof Element
        ? node.closest<HTMLElement>("[data-tooltip]")
        : null;

    const onPointerOver = (e: PointerEvent) => {
      // Touch has no hover, and a held button means a drag is under way.
      if (e.pointerType === "touch" || e.buttons !== 0) return;
      const el = tooltipOf(e.target);
      if (el) schedule(el);
      else hide();
    };
    const onPointerOut = (e: PointerEvent) => {
      const from = tooltipOf(e.target);
      if (from && !from.contains(e.relatedTarget as Node | null)) hide();
    };
    const onFocusIn = (e: FocusEvent) => {
      const el = tooltipOf(e.target);
      // Only keyboard focus; a click already showed (and then hid) the tip.
      if (el && el.matches(":focus-visible")) schedule(el);
    };
    const onFocusOut = (e: FocusEvent) => {
      if (tooltipOf(e.target) === target) hide();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") hide();
    };

    document.addEventListener("pointerover", onPointerOver);
    document.addEventListener("pointerout", onPointerOut);
    document.addEventListener("pointerdown", hide, true);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerover", onPointerOver);
      document.removeEventListener("pointerout", onPointerOut);
      document.removeEventListener("pointerdown", hide, true);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, []);

  return (
    <div
      ref={tipRef}
      popover="manual"
      // Screen readers get the control's aria-label instead.
      aria-hidden
      className="group pointer-events-none fixed inset-auto m-0 max-w-64 overflow-visible rounded-md border-0 bg-navy-900 px-2 py-1 text-xs leading-snug font-medium text-white shadow-lg transition-opacity duration-100 starting:opacity-0"
    >
      <span ref={textRef} />
      <span
        ref={arrowRef}
        className="absolute size-2 -translate-x-1/2 rotate-45 bg-navy-900 group-data-[side=bottom]:-top-1 group-data-[side=top]:-bottom-1"
      />
    </div>
  );
}
