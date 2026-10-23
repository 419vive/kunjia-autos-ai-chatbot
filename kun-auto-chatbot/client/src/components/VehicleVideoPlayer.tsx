import { lazy, Suspense, useMemo, useState } from "react";
import { Player } from "@remotion/player";
import { VehicleShowcase } from "@/remotion/compositions/VehicleShowcase";
import type { VehicleVideoProps } from "@/remotion/types";

type RemotionComponent = React.ComponentType<Record<string, unknown>>;

interface VehicleVideoPlayerProps {
  vehicle: {
    title?: string | null;
    brand: string;
    model: string;
    modelYear?: string | null;
    price?: string | number | null;
    priceDisplay?: string | null;
    mileage?: string | null;
    transmission?: string | null;
    fuelType?: string | null;
    color?: string | null;
    displacement?: string | null;
    photoUrls?: string | null;
  };
}

/**
 * Embeddable Remotion video player for vehicle detail pages.
 * Renders a 15-second auto-playing showcase from the vehicle's real data.
 */
export default function VehicleVideoPlayer({ vehicle }: VehicleVideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  const photos = useMemo(() => {
    if (!vehicle.photoUrls) return [];
    const raw = vehicle.photoUrls;
    if (raw.startsWith("[")) {
      try { return JSON.parse(raw) as string[]; } catch { return []; }
    }
    return raw.split("|").filter((u) => u.trim());
  }, [vehicle.photoUrls]);

  // Need at least 1 photo to render the video
  if (photos.length === 0) return null;

  const price = vehicle.priceDisplay || `${vehicle.price}`;

  const inputProps: VehicleVideoProps = {
    title: vehicle.title || `${vehicle.brand} ${vehicle.model}`,
    brand: vehicle.brand,
    model: vehicle.model,
    modelYear: vehicle.modelYear || undefined,
    price,
    mileage: vehicle.mileage || undefined,
    transmission: vehicle.transmission || undefined,
    fuelType: vehicle.fuelType || undefined,
    color: vehicle.color || undefined,
    displacement: vehicle.displacement || undefined,
    photoUrls: photos,
  };

  return (
    <div style={{ position: "relative", borderRadius: 16, overflow: "hidden" }}>
      {!isPlaying ? (
        // Play button overlay — user taps to start video
        <button
          onClick={() => setIsPlaying(true)}
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "16/9",
            background: `url(${photos[0]}) center/cover`,
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Dark overlay */}
          <div style={{
            position: "absolute", inset: 0,
            backgroundColor: "rgba(0,0,0,0.4)",
          }} />
          {/* Play icon */}
          <div style={{
            position: "relative",
            width: 64, height: 64, borderRadius: "50%",
            backgroundColor: "rgba(196,162,101,0.9)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="#000">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          </div>
          {/* Label */}
          <span style={{
            position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)",
            color: "#fff", fontSize: 14, fontWeight: 600,
            backgroundColor: "rgba(0,0,0,0.6)", padding: "4px 14px", borderRadius: 20,
          }}>
            ▶ 播放車輛影片
          </span>
        </button>
      ) : (
        <Player
          component={VehicleShowcase as unknown as RemotionComponent}
          inputProps={inputProps}
          durationInFrames={450}
          compositionWidth={1280}
          compositionHeight={720}
          fps={30}
          autoPlay
          loop
          style={{
            width: "100%",
            aspectRatio: "16/9",
            borderRadius: 16,
          }}
          controls
        />
      )}
    </div>
  );
}
