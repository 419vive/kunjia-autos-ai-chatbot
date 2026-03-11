import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

/**
 * Progressive image loader with blur-up effect.
 * Shows a blurred low-res placeholder while the full image loads,
 * then cross-fades to the sharp image.
 */
export function ProgressiveImage({
  src,
  alt,
  className,
  containerClassName,
  aspectRatio = "16/10",
  fallback,
}: {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  aspectRatio?: string;
  fallback?: React.ReactNode;
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Reset state when src changes (e.g., photo carousel swipe)
  useEffect(() => {
    setLoaded(false);
    setError(false);

    // Check if the image is already cached by the browser
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      setLoaded(true);
    }
  }, [src]);

  if (error && fallback) {
    return <>{fallback}</>;
  }

  return (
    <div
      className={cn("relative overflow-hidden", containerClassName)}
      style={{ aspectRatio }}
    >
      {/* Blur placeholder: solid color shimmer */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 transition-opacity duration-500",
          loaded ? "opacity-0" : "opacity-100 animate-pulse"
        )}
      />

      {/* Actual image */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        className={cn(
          "h-full w-full object-cover transition-opacity duration-500",
          loaded ? "opacity-100" : "opacity-0",
          className
        )}
      />
    </div>
  );
}
