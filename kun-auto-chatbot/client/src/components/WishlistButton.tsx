import { useState, useEffect, useCallback } from "react";
import { Heart } from "lucide-react";
import {
  isInWishlist,
  addToWishlist,
  removeFromWishlist,
  onWishlistChange,
} from "@/lib/wishlist";

interface WishlistButtonProps {
  vehicle: {
    id: number;
    brand: string;
    model: string;
    price: string;
    photo?: string;
  };
  size?: "sm" | "md";
  className?: string;
}

export default function WishlistButton({ vehicle, size = "sm", className = "" }: WishlistButtonProps) {
  const [saved, setSaved] = useState(() => isInWishlist(vehicle.id));
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    setSaved(isInWishlist(vehicle.id));
    return onWishlistChange(() => setSaved(isInWishlist(vehicle.id)));
  }, [vehicle.id]);

  const toggle = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (saved) {
        removeFromWishlist(vehicle.id);
      } else {
        addToWishlist({
          id: vehicle.id,
          brand: vehicle.brand,
          model: vehicle.model,
          price: vehicle.price,
          photo: vehicle.photo,
          addedAt: Date.now(),
        });
      }

      setAnimating(true);
      setTimeout(() => setAnimating(false), 300);
    },
    [saved, vehicle],
  );

  const iconSize = size === "md" ? "w-5 h-5" : "w-4 h-4";
  const btnSize = size === "md" ? "w-9 h-9" : "w-7 h-7";

  return (
    <button
      onClick={toggle}
      className={`flex items-center justify-center rounded-full bg-black/40 backdrop-blur transition-transform ${btnSize} ${
        animating ? "scale-125" : "scale-100"
      } ${className}`}
      aria-label={saved ? "取消收藏" : "加入收藏"}
      title={saved ? "取消收藏" : "加入收藏"}
    >
      <Heart
        className={`${iconSize} transition-colors ${
          saved ? "fill-[#C4A265] text-[#C4A265]" : "fill-none text-white/50"
        }`}
      />
    </button>
  );
}
