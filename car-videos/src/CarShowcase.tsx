import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Sequence,
} from "remotion";
// System font fallback (Google Fonts blocked in this environment)
const fontFamily =
  '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", "WenQuanYi Micro Hei", sans-serif';

// ── Vehicle Data ──────────────────────────────────────────────
const CAR = {
  brand: "BMW",
  model: "X1",
  year: 2015,
  price: "37.8萬",
  mileage: "5萬公里",
  displacement: "2.0L",
  transmission: "自排",
  color: "黑色",
  fuelType: "汽油",
  bodyType: "SUV",
  dealer: "崑家汽車",
  location: "高雄三民區",
  yearsInBusiness: "40年正派經營",
  lineUrl: "https://page.line.me/825oftez",
  photoUrl:
    "https://img.8891.com.tw/images/car/1726/1726-1.jpg",
};

// ── Color Palette ─────────────────────────────────────────────
const COLORS = {
  dark: "#0a0a0a",
  accent: "#c9a962", // Gold
  white: "#ffffff",
  gray: "#888888",
  gradientTop: "#1a1a2e",
  gradientBottom: "#0a0a0a",
};

// ── Scene 1: Brand Reveal ─────────────────────────────────────
const BrandReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const lineScale = spring({ frame, fps, config: { damping: 200 } });
  const lineWidth = interpolate(lineScale, [0, 1], [0, 600], {
    extrapolateRight: "clamp",
  });

  const brandOpacity = interpolate(frame, [0.4 * fps, 0.8 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const brandY = interpolate(frame, [0.4 * fps, 0.8 * fps], [30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const modelOpacity = interpolate(frame, [0.8 * fps, 1.2 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const modelY = interpolate(frame, [0.8 * fps, 1.2 * fps], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const yearOpacity = interpolate(frame, [1.2 * fps, 1.6 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${COLORS.gradientTop} 0%, ${COLORS.dark} 100%)`,
        justifyContent: "center",
        alignItems: "center",
        fontFamily,
      }}
    >
      {/* Decorative gold line */}
      <div
        style={{
          position: "absolute",
          top: "42%",
          left: "50%",
          transform: "translateX(-50%)",
          width: lineWidth,
          height: 2,
          backgroundColor: COLORS.accent,
        }}
      />

      {/* Brand name */}
      <div
        style={{
          position: "absolute",
          top: "28%",
          textAlign: "center",
          opacity: brandOpacity,
          transform: `translateY(${brandY}px)`,
        }}
      >
        <div
          style={{
            fontSize: 140,
            fontWeight: 900,
            color: COLORS.white,
            letterSpacing: 20,
          }}
        >
          {CAR.brand}
        </div>
      </div>

      {/* Model */}
      <div
        style={{
          position: "absolute",
          top: "48%",
          textAlign: "center",
          opacity: modelOpacity,
          transform: `translateY(${modelY}px)`,
        }}
      >
        <div
          style={{
            fontSize: 90,
            fontWeight: 700,
            color: COLORS.accent,
            letterSpacing: 8,
          }}
        >
          {CAR.model}
        </div>
      </div>

      {/* Year */}
      <div
        style={{
          position: "absolute",
          top: "62%",
          textAlign: "center",
          opacity: yearOpacity,
        }}
      >
        <div
          style={{
            fontSize: 48,
            fontWeight: 400,
            color: COLORS.gray,
            letterSpacing: 12,
          }}
        >
          {CAR.year}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 2: Price Hero ───────────────────────────────────────
const PriceHero: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const priceScale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 200 },
  });

  const labelOpacity = interpolate(frame, [0.5 * fps, 0.9 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const badgeScale = spring({
    frame,
    fps,
    delay: Math.round(0.8 * fps),
    config: { damping: 15 },
  });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${COLORS.dark} 0%, #1a0a00 50%, ${COLORS.dark} 100%)`,
        justifyContent: "center",
        alignItems: "center",
        fontFamily,
      }}
    >
      {/* Price label */}
      <div
        style={{
          position: "absolute",
          top: "30%",
          opacity: labelOpacity,
          fontSize: 42,
          color: COLORS.gray,
          letterSpacing: 6,
        }}
      >
        超值價格
      </div>

      {/* Price */}
      <div
        style={{
          position: "absolute",
          top: "38%",
          transform: `scale(${priceScale})`,
        }}
      >
        <div
          style={{
            fontSize: 160,
            fontWeight: 900,
            color: COLORS.accent,
            textAlign: "center",
          }}
        >
          {CAR.price}
        </div>
      </div>

      {/* Hot badge */}
      <div
        style={{
          position: "absolute",
          top: "58%",
          transform: `scale(${badgeScale})`,
          backgroundColor: "#cc3333",
          padding: "16px 48px",
          borderRadius: 50,
        }}
      >
        <div
          style={{
            fontSize: 36,
            fontWeight: 700,
            color: COLORS.white,
          }}
        >
          詢問熱烈
        </div>
      </div>

      {/* Mileage */}
      <div
        style={{
          position: "absolute",
          top: "70%",
          opacity: labelOpacity,
          fontSize: 36,
          color: COLORS.gray,
        }}
      >
        里程 {CAR.mileage}
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 3: Specs Grid ───────────────────────────────────────
const SpecItem: React.FC<{
  label: string;
  value: string;
  delay: number;
}> = ({ label, value, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    delay: Math.round(delay * fps),
    config: { damping: 200 },
  });

  const y = interpolate(entrance, [0, 1], [40, 0]);
  const opacity = entrance;

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${y}px)`,
        textAlign: "center",
        padding: "30px 0",
      }}
    >
      <div
        style={{
          fontSize: 32,
          color: COLORS.gray,
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 52,
          fontWeight: 700,
          color: COLORS.white,
        }}
      >
        {value}
      </div>
    </div>
  );
};

const SpecsGrid: React.FC = () => {
  const specs = [
    { label: "排氣量", value: CAR.displacement },
    { label: "變速箱", value: CAR.transmission },
    { label: "燃料", value: CAR.fuelType },
    { label: "車型", value: CAR.bodyType },
    { label: "顏色", value: CAR.color },
    { label: "年份", value: String(CAR.year) },
  ];

  return (
    <AbsoluteFill
      style={{
        background: COLORS.dark,
        fontFamily,
        padding: "120px 80px",
      }}
    >
      {/* Title */}
      <div
        style={{
          fontSize: 48,
          fontWeight: 700,
          color: COLORS.accent,
          textAlign: "center",
          marginBottom: 60,
          letterSpacing: 8,
        }}
      >
        車輛規格
      </div>

      {/* 2-column grid */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "20px 60px",
        }}
      >
        {specs.map((spec, i) => (
          <div key={spec.label} style={{ width: "40%" }}>
            <SpecItem
              label={spec.label}
              value={spec.value}
              delay={0.15 * i}
            />
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 4: Dealer Trust ─────────────────────────────────────
const DealerTrust: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const nameEntrance = spring({
    frame,
    fps,
    config: { damping: 200 },
  });

  const taglineOpacity = interpolate(
    frame,
    [0.5 * fps, 1.0 * fps],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const ctaScale = spring({
    frame,
    fps,
    delay: Math.round(1.2 * fps),
    config: { damping: 15 },
  });

  const ctaPulse = interpolate(
    frame,
    [2.0 * fps, 2.5 * fps, 3.0 * fps, 3.5 * fps],
    [1, 1.05, 1, 1.05],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${COLORS.dark} 0%, #0a1a0a 50%, ${COLORS.dark} 100%)`,
        justifyContent: "center",
        alignItems: "center",
        fontFamily,
      }}
    >
      {/* Dealer name */}
      <div
        style={{
          position: "absolute",
          top: "25%",
          transform: `scale(${nameEntrance})`,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 100,
            fontWeight: 900,
            color: COLORS.accent,
          }}
        >
          {CAR.dealer}
        </div>
      </div>

      {/* Tagline */}
      <div
        style={{
          position: "absolute",
          top: "42%",
          opacity: taglineOpacity,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 40, color: COLORS.white, marginBottom: 16 }}>
          {CAR.location}
        </div>
        <div style={{ fontSize: 36, color: COLORS.gray }}>
          {CAR.yearsInBusiness}
        </div>
      </div>

      {/* CTA */}
      <div
        style={{
          position: "absolute",
          top: "60%",
          transform: `scale(${ctaScale * ctaPulse})`,
        }}
      >
        <div
          style={{
            backgroundColor: "#06c755", // LINE green
            padding: "24px 80px",
            borderRadius: 60,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 44,
              fontWeight: 700,
              color: COLORS.white,
            }}
          >
            LINE 立即詢問
          </div>
        </div>
      </div>

      {/* Website */}
      <div
        style={{
          position: "absolute",
          top: "78%",
          opacity: taglineOpacity,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 32, color: COLORS.gray }}>
          kuncar.tw
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── Main Composition ──────────────────────────────────────────
export const CarShowcase: React.FC = () => {
  const { fps } = useVideoConfig();

  const sceneDuration = 4 * fps; // 4 seconds per scene

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.dark }}>
      {/* Scene 1: Brand Reveal (0-4s) */}
      <Sequence
        from={0}
        durationInFrames={sceneDuration}
        premountFor={Math.round(0.5 * fps)}
      >
        <BrandReveal />
      </Sequence>

      {/* Scene 2: Price Hero (4-8s) */}
      <Sequence
        from={sceneDuration}
        durationInFrames={sceneDuration}
        premountFor={Math.round(0.5 * fps)}
      >
        <PriceHero />
      </Sequence>

      {/* Scene 3: Specs Grid (8-12s) */}
      <Sequence
        from={2 * sceneDuration}
        durationInFrames={sceneDuration}
        premountFor={Math.round(0.5 * fps)}
      >
        <SpecsGrid />
      </Sequence>

      {/* Scene 4: Dealer Trust + CTA (12-16s) */}
      <Sequence
        from={3 * sceneDuration}
        durationInFrames={sceneDuration}
        premountFor={Math.round(0.5 * fps)}
      >
        <DealerTrust />
      </Sequence>
    </AbsoluteFill>
  );
};
