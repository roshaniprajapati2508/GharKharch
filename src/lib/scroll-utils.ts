"use client";

import { useEffect, useRef } from "react";

/**
 * Smoothly scrolls an element into the horizontal center of its nearest
 * scrollable container without causing any vertical page jump.
 */
export function scrollActiveIntoCenter(
  element: HTMLElement | null,
  behavior: ScrollBehavior = "smooth"
) {
  if (!element || typeof window === "undefined") return;

  // Find nearest horizontally scrollable ancestor container
  let container: HTMLElement | null = element.parentElement;
  while (container && container !== document.body && container !== document.documentElement) {
    const style = window.getComputedStyle(container);
    const overflowX = style.overflowX;
    const isScrollable =
      overflowX === "auto" ||
      overflowX === "scroll" ||
      container.classList.contains("overflow-x-auto");

    if (isScrollable && container.scrollWidth > container.clientWidth) {
      break;
    }
    container = container.parentElement;
  }

  // Fallback: If no ancestor had overflowX set explicitly, check any parent with scrollWidth > clientWidth
  if (!container || container === document.body || container === document.documentElement) {
    let fallback = element.parentElement;
    while (fallback && fallback !== document.body && fallback !== document.documentElement) {
      if (fallback.scrollWidth > fallback.clientWidth) {
        container = fallback;
        break;
      }
      fallback = fallback.parentElement;
    }
  }

  if (!container || container.scrollWidth <= container.clientWidth) return;

  const containerRect = container.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();

  // Element's center relative to container's scroll origin
  const elementCenter =
    elementRect.left - containerRect.left + container.scrollLeft + elementRect.width / 2;
  const containerCenter = container.clientWidth / 2;
  const targetScrollLeft = elementCenter - containerCenter;

  const maxScrollLeft = container.scrollWidth - container.clientWidth;
  const clampedScrollLeft = Math.max(0, Math.min(targetScrollLeft, maxScrollLeft));

  container.scrollTo({
    left: clampedScrollLeft,
    behavior,
  });
}

/**
 * Hook to automatically center the active item inside a scroll container
 * whenever the active key changes or on initial render.
 */
export function useCenterActiveItem<T extends HTMLElement = HTMLDivElement>(
  activeKey: unknown,
  activeSelector: string = "[data-active='true'], [data-state='active']"
) {
  const containerRef = useRef<T | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const timer = setTimeout(() => {
      if (!containerRef.current) return;
      const activeEl = containerRef.current.querySelector<HTMLElement>(activeSelector);
      if (activeEl) {
        scrollActiveIntoCenter(activeEl, "smooth");
      }
    }, 80);

    return () => clearTimeout(timer);
  }, [activeKey, activeSelector]);

  return containerRef;
}
