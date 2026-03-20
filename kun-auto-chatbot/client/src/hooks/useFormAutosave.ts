import { useEffect, useRef, useState, useCallback } from "react";

interface UseFormAutosaveResult<T> {
  restoredData: T | null;
  clearDraft: () => void;
  hasDraft: boolean;
}

/**
 * Auto-saves form data to sessionStorage with debouncing.
 * Restores draft on mount. Clears on successful submission.
 *
 * @param key - sessionStorage key (e.g. "kunjia_bookvisit_draft")
 * @param formData - current form state object
 * @param debounceMs - save debounce delay (default 500ms)
 */
export function useFormAutosave<T extends Record<string, unknown>>(
  key: string,
  formData: T,
  debounceMs = 500,
): UseFormAutosaveResult<T> {
  const [restoredData, setRestoredData] = useState<T | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const initialLoadDone = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // On mount: check for saved draft and restore it
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    try {
      const saved = sessionStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved) as T;
        // Only restore if there's actually some data filled in
        const hasContent = Object.values(parsed).some(
          (v) => typeof v === "string" ? v.trim().length > 0 : v != null,
        );
        if (hasContent) {
          setRestoredData(parsed);
          setHasDraft(true);
        }
      }
    } catch {
      // Corrupted data — ignore
      sessionStorage.removeItem(key);
    }
  }, [key]);

  // Debounced save on every formData change (skip the very first render)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        sessionStorage.setItem(key, JSON.stringify(formData));
      } catch {
        // sessionStorage full or unavailable — ignore
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [key, formData, debounceMs]);

  const clearDraft = useCallback(() => {
    sessionStorage.removeItem(key);
    setHasDraft(false);
    setRestoredData(null);
  }, [key]);

  return { restoredData, clearDraft, hasDraft };
}
