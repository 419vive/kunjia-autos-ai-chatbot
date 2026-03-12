const STORAGE_KEY = "kun-recently-viewed";
const MAX_ITEMS = 6;

export interface RecentlyViewedItem {
  id: number;
  brand: string;
  model: string;
  price: string;
  photo?: string;
  viewedAt: number;
}

export function getRecentlyViewed(): RecentlyViewedItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const items: RecentlyViewedItem[] = JSON.parse(raw);
    // Filter out items older than 30 days
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return items.filter(i => i.viewedAt > cutoff);
  } catch { return []; }
}

export function addRecentlyViewed(item: Omit<RecentlyViewedItem, "viewedAt">) {
  const existing = getRecentlyViewed().filter(i => i.id !== item.id);
  const updated = [{ ...item, viewedAt: Date.now() }, ...existing].slice(0, MAX_ITEMS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}
