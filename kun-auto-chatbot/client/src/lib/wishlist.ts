const STORAGE_KEY = "kunjia_wishlist";
const MAX_ITEMS = 20;
const CHANGE_EVENT = "kunjia-wishlist-change";

export interface WishlistItem {
  id: number;
  brand: string;
  model: string;
  price: string;
  photo?: string;
  addedAt: number;
}

export function getWishlist(): WishlistItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as WishlistItem[];
  } catch { return []; }
}

function save(items: WishlistItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function addToWishlist(item: WishlistItem): void {
  const existing = getWishlist().filter(i => i.id !== item.id);
  const updated = [item, ...existing].slice(0, MAX_ITEMS);
  save(updated);
}

export function removeFromWishlist(id: number): void {
  const updated = getWishlist().filter(i => i.id !== id);
  save(updated);
}

export function isInWishlist(id: number): boolean {
  return getWishlist().some(i => i.id === id);
}

export function getWishlistCount(): number {
  return getWishlist().length;
}

export function onWishlistChange(callback: () => void): () => void {
  const handleCustom = () => callback();
  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) callback();
  };

  window.addEventListener(CHANGE_EVENT, handleCustom);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(CHANGE_EVENT, handleCustom);
    window.removeEventListener("storage", handleStorage);
  };
}
