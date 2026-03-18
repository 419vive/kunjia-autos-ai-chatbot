import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * Hook that triggers a reveal animation when element enters viewport.
 * Uses IntersectionObserver for performance.
 */
export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(
  options?: { threshold?: number; rootMargin?: string; once?: boolean }
): [RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const { threshold = 0.15, rootMargin = "0px 0px -40px 0px", once = true } = options || {};

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (once) observer.unobserve(el);
        } else if (!once) {
          setIsVisible(false);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin, once]);

  return [ref, isVisible];
}

/**
 * CSS classes for scroll reveal animations.
 * Apply `revealClass(isVisible)` to get the appropriate classes.
 */
export function revealClass(isVisible: boolean, variant: "up" | "left" | "right" | "scale" = "up"): string {
  const base = "transition-all duration-700 ease-out";
  if (isVisible) return `${base} opacity-100 translate-y-0 translate-x-0 scale-100`;

  switch (variant) {
    case "up": return `${base} opacity-0 translate-y-8`;
    case "left": return `${base} opacity-0 -translate-x-8`;
    case "right": return `${base} opacity-0 translate-x-8`;
    case "scale": return `${base} opacity-0 scale-95`;
  }
}

/**
 * Stagger delay for list items.
 * Returns inline style with transitionDelay.
 */
export function staggerDelay(index: number, baseMs = 80): React.CSSProperties {
  return { transitionDelay: `${index * baseMs}ms` };
}
