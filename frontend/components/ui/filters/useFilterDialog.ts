"use client";
import { useEffect, useSyncExternalStore, type RefObject } from "react";
const QUERY = "(max-width: 1000px)";
function subscribe(listener: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}
const getSnapshot = () => window.matchMedia(QUERY).matches;
const getServerSnapshot = () => false;
const FOCUSABLE = "button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex='-1'])";
export function useFilterDialog(open: boolean, close: () => void,
  panelRef: RefObject<HTMLFormElement | null>, triggerRef: RefObject<HTMLButtonElement | null>) {
  const mobile = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const active = open && mobile;
  useEffect(() => {
    const panel = panelRef.current;
    if (!active || !panel) return;
    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    const restored: Array<[HTMLElement, boolean]> = [];
    // Keep our backdrop interactive; make the rest of the page inert, including other overlays.
    let branch: HTMLElement | null = panel.parentElement;
    while (branch && branch !== document.body) {
      const parent: HTMLElement | null = branch.parentElement;
      if (!parent) break;
      for (const sibling of parent.children) {
        if (sibling !== branch && sibling instanceof HTMLElement) {
          restored.push([sibling, sibling.inert]); sibling.inert = true;
        }
      }
      branch = parent;
    }
    const focusables = () => [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)]
      .filter(element => element.tabIndex >= 0 && element.getClientRects().length > 0);
    const focusFirst = () => (focusables()[0] ?? panel).focus();
    const frame = requestAnimationFrame(focusFirst);
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); close(); return; }
      if (event.key !== "Tab") return;
      const items = focusables();
      const first = items[0], last = items.at(-1);
      if (!first || !last) { event.preventDefault(); panel!.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || !panel!.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !panel!.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    }
    function onFocus(event: FocusEvent) {
      if (event.target instanceof Node && !panel!.contains(event.target)) focusFirst();
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("focusin", onFocus);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("focusin", onFocus);
      document.body.style.overflow = previousOverflow;
      for (const [element, inert] of restored) element.inert = inert;
      if (trigger?.getClientRects().length) trigger.focus();
    };
  }, [active, close, panelRef, triggerRef]);
  return active;
}
