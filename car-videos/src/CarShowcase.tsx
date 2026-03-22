import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Sequence,
  Img,
  staticFile,
} from "remotion";

// System font fallback (swap to @remotion/google-fonts/NotoSansSC locally)
const fontFamily =
  '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", "WenQuanYi Micro Hei", sans-serif';

// ── Vehicle Data ──────────────────────────────────────────────
// TO USE REAL PHOTOS: drop car images in public/ folder as car-1.jpg, car-2.jpg, etc.
const CAR = {
  brand: "BMW",
  model: "X1",
  year: 2015,
  price: "37.8",
  priceUnit: "萬",
  mileage: "5萬公里",
  displacement: "2.0L",
  transmission: "自排",
  color: "黑色",
  fuelType: "汽油",
  bodyType: "SUV",
  dealer: "崑家汽車",
  location: "高雄三民區",
  yearsInBusiness: "40年正派經營",
  // Set to true when you drop real photos in public/
  hasRealPhotos: false,
};

const COLORS = {
  dark: "#0d0d0d",
  accent: "#d4a843",
  accentDark: "#8b7028",
  white: "#ffffff",
  gray: "#999999",
  lightGray: "#cccccc",
  red: "#e63946",
  lineGreen: "#06c755",
};

// ── SVG Car Illustration (BMW X1 SUV silhouette) ──────────────
const CarSVG: React.FC<{ scale?: number; color?: string }> = ({
  scale = 1,
  color = COLORS.white,
}) => (
  <svg
    width={800 * scale}
    height={340 * scale}
    viewBox="0 0 800 340"
    fill="none"
  >
    {/* Car body */}
    <path
      d="M120 220 C120 220 140 120 200 100 C240 88 320 75 400 72 C480 75 560 88 600 100 C660 120 680 220 680 220"
      fill={color}
      opacity={0.15}
      stroke={color}
      strokeWidth={2}
    />
    {/* Roof line */}
    <path
      d="M200 100 C240 88 320 75 400 72 C480 75 560 88 600 100"
      fill="none"
      stroke={COLORS.accent}
      strokeWidth={3}
    />
    {/* Windows */}
    <path
      d="M220 110 C250 95 330 82 400 80 C440 82 490 90 520 100 L510 160 L230 160 Z"
      fill={COLORS.accent}
      opacity={0.2}
      stroke={COLORS.accent}
      strokeWidth={1.5}
    />
    {/* Window divider */}
    <line
      x1={380}
      y1={82}
      x2={370}
      y2={160}
      stroke={color}
      strokeWidth={2}
      opacity={0.5}
    />
    {/* Lower body */}
    <path
      d="M80 230 L120 220 L680 220 L720 230 L740 250 L740 260 L60 260 L60 250 Z"
      fill={color}
      opacity={0.12}
      stroke={color}
      strokeWidth={2}
    />
    {/* Front bumper */}
    <path
      d="M60 260 L80 230 L120 220"
      fill="none"
      stroke={color}
      strokeWidth={2}
    />
    {/* Rear bumper */}
    <path
      d="M740 260 L720 230 L680 220"
      fill="none"
      stroke={color}
      strokeWidth={2}
    />
    {/* Headlight front */}
    <ellipse cx={95} cy={235} rx={25} ry={12} fill={COLORS.accent} opacity={0.6} />
    {/* Headlight rear */}
    <ellipse cx={705} cy={235} rx={25} ry={12} fill={COLORS.red} opacity={0.5} />
    {/* Front wheel */}
    <circle cx={200} cy={270} r={50} fill={COLORS.dark} stroke={color} strokeWidth={3} />
    <circle cx={200} cy={270} r={35} fill="none" stroke={color} strokeWidth={1.5} opacity={0.5} />
    <circle cx={200} cy={270} r={18} fill="none" stroke={COLORS.accent} strokeWidth={2} />
    <circle cx={200} cy={270} r={6} fill={COLORS.accent} />
    {/* Rear wheel */}
    <circle cx={600} cy={270} r={50} fill={COLORS.dark} stroke={color} strokeWidth={3} />
    <circle cx={600} cy={270} r={35} fill="none" stroke={color} strokeWidth={1.5} opacity={0.5} />
    <circle cx={600} cy={270} r={18} fill="none" stroke={COLORS.accent} strokeWidth={2} />
    <circle cx={600} cy={270} r={6} fill={COLORS.accent} />
    {/* BMW kidney grille */}
    <rect x={85} y={224} width={16} height={18} rx={3} fill="none" stroke={color} strokeWidth={1.5} opacity={0.7} />
    <rect x={104} y={224} width={16} height={18} rx={3} fill="none" stroke={color} strokeWidth={1.5} opacity={0.7} />
    {/* Ground shadow */}
    <ellipse cx={400} cy={325} rx={350} ry={12} fill={color} opacity={0.05} />
  </svg>
);

// ── Scene 1: Car Hero with Brand ──────────────────────────────
const CarHero: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const carEntrance = spring({ frame, fps, config: { damping: 200 } });
  const carX = interpolate(carEntrance, [0, 1], [-400, 0]);

  const textOpacity = interpolate(frame, [0.6 * fps, 1.0 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const textY = interpolate(frame, [0.6 * fps, 1.0 * fps], [30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const priceEntrance = spring({
    frame,
    fps,
    delay: Math.round(1.0 * fps),
    config: { damping: 12, stiffness: 200 },
  });

  const badgeScale = spring({
    frame,
    fps,
    delay: Math.round(1.4 * fps),
    config: { damping: 15 },
  });

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 50% 30%, #1a1a2e 0%, ${COLORS.dark} 70%)`,
        fontFamily,
      }}
    >
      {/* Top: brand + model */}
      <div
        style={{
          position: "absolute",
          top: 100,
          width: "100%",
          textAlign: "center",
          opacity: textOpacity,
          transform: `translateY(${textY}px)`,
        }}
      >
        <div
          style={{
            fontSize: 36,
            color: COLORS.gray,
            letterSpacing: 12,
            marginBottom: 8,
          }}
        >
          {CAR.year} {CAR.bodyType}
        </div>
        <div
          style={{
            fontSize: 120,
            fontWeight: 900,
            color: COLORS.white,
            letterSpacing: 10,
          }}
        >
          {CAR.brand}
        </div>
        <div
          style={{
            fontSize: 80,
            fontWeight: 700,
            color: COLORS.accent,
            letterSpacing: 6,
            marginTop: -10,
          }}
        >
          {CAR.model}
        </div>
      </div>

      {/* Center: car image */}
      <div
        style={{
          position: "absolute",
          top: "42%",
          left: "50%",
          transform: `translateX(calc(-50% + ${carX}px))`,
        }}
      >
        {CAR.hasRealPhotos ? (
          <Img
            src={staticFile("car-1.jpg")}
            style={{
              width: 900,
              height: 600,
              objectFit: "cover",
              borderRadius: 20,
            }}
          />
        ) : (
          <CarSVG scale={1.2} />
        )}
      </div>

      {/* Bottom: price overlay */}
      <div
        style={{
          position: "absolute",
          bottom: 200,
          width: "100%",
          textAlign: "center",
          transform: `scale(${priceEntrance})`,
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontSize: 42, color: COLORS.lightGray }}>NT$</span>
          <span
            style={{
              fontSize: 140,
              fontWeight: 900,
              color: COLORS.accent,
            }}
          >
            {CAR.price}
          </span>
          <span style={{ fontSize: 60, fontWeight: 700, color: COLORS.accent }}>
            {CAR.priceUnit}
          </span>
        </div>
      </div>

      {/* Badge */}
      <div
        style={{
          position: "absolute",
          bottom: 120,
          width: "100%",
          display: "flex",
          justifyContent: "center",
          transform: `scale(${badgeScale})`,
        }}
      >
        <div
          style={{
            backgroundColor: COLORS.red,
            padding: "12px 40px",
            borderRadius: 30,
            fontSize: 32,
            fontWeight: 700,
            color: COLORS.white,
          }}
        >
          詢問熱烈 · 限量一台
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 2: Specs with Car ───────────────────────────────────
const SpecsWithCar: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const specs = [
    { icon: "⚡", label: "排氣量", value: CAR.displacement },
    { icon: "⚙", label: "變速箱", value: CAR.transmission },
    { icon: "⛽", label: "燃料", value: CAR.fuelType },
    { icon: "🛣", label: "里程", value: CAR.mileage },
    { icon: "🎨", label: "顏色", value: CAR.color },
    { icon: "📅", label: "年份", value: String(CAR.year) },
  ];

  return (
    <AbsoluteFill
      style={{
        background: COLORS.dark,
        fontFamily,
      }}
    >
      {/* Car at top */}
      <div
        style={{
          position: "absolute",
          top: 80,
          width: "100%",
          display: "flex",
          justifyContent: "center",
        }}
      >
        {CAR.hasRealPhotos ? (
          <Img
            src={staticFile("car-2.jpg")}
            style={{
              width: 900,
              height: 500,
              objectFit: "cover",
              borderRadius: 16,
            }}
          />
        ) : (
          <CarSVG scale={1.1} />
        )}
      </div>

      {/* Gold divider */}
      <div
        style={{
          position: "absolute",
          top: "45%",
          left: "10%",
          width: "80%",
          height: 2,
          backgroundColor: COLORS.accent,
          opacity: 0.4,
        }}
      />

      {/* Specs list */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          width: "100%",
          padding: "0 80px",
        }}
      >
        {specs.map((spec, i) => {
          const entrance = spring({
            frame,
            fps,
            delay: Math.round(0.12 * i * fps),
            config: { damping: 200 },
          });
          const x = interpolate(entrance, [0, 1], [80, 0]);
          return (
            <div
              key={spec.label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "22px 20px",
                borderBottom: `1px solid rgba(255,255,255,0.08)`,
                opacity: entrance,
                transform: `translateX(${x}px)`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <span style={{ fontSize: 36 }}>{spec.icon}</span>
                <span style={{ fontSize: 34, color: COLORS.gray }}>
                  {spec.label}
                </span>
              </div>
              <span
                style={{
                  fontSize: 40,
                  fontWeight: 700,
                  color: COLORS.white,
                }}
              >
                {spec.value}
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 3: Why Choose Us ────────────────────────────────────
const WhyChooseUs: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const reasons = [
    { num: "40+", text: "年經營歷史" },
    { num: "500+", text: "台成交紀錄" },
    { num: "4.8", text: "Google 評分" },
    { num: "100%", text: "實車實價" },
  ];

  const titleOpacity = interpolate(frame, [0, 0.5 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, #0a0a1a 0%, ${COLORS.dark} 50%, #0a1a0a 100%)`,
        fontFamily,
      }}
    >
      {/* Dealer badge */}
      <div
        style={{
          position: "absolute",
          top: 140,
          width: "100%",
          textAlign: "center",
          opacity: titleOpacity,
        }}
      >
        <div
          style={{
            fontSize: 80,
            fontWeight: 900,
            color: COLORS.accent,
            marginBottom: 16,
          }}
        >
          {CAR.dealer}
        </div>
        <div style={{ fontSize: 32, color: COLORS.gray, letterSpacing: 6 }}>
          {CAR.location} · {CAR.yearsInBusiness}
        </div>
      </div>

      {/* Stats grid */}
      <div
        style={{
          position: "absolute",
          top: "38%",
          width: "100%",
          padding: "0 60px",
          display: "flex",
          flexWrap: "wrap",
          gap: 0,
        }}
      >
        {reasons.map((r, i) => {
          const entrance = spring({
            frame,
            fps,
            delay: Math.round(0.2 * i * fps),
            config: { damping: 15 },
          });
          return (
            <div
              key={r.text}
              style={{
                width: "50%",
                textAlign: "center",
                padding: "40px 0",
                transform: `scale(${entrance})`,
              }}
            >
              <div
                style={{
                  fontSize: 72,
                  fontWeight: 900,
                  color: COLORS.accent,
                }}
              >
                {r.num}
              </div>
              <div
                style={{
                  fontSize: 30,
                  color: COLORS.lightGray,
                  marginTop: 8,
                }}
              >
                {r.text}
              </div>
            </div>
          );
        })}
      </div>

      {/* Car silhouette at bottom */}
      <div
        style={{
          position: "absolute",
          bottom: 100,
          width: "100%",
          display: "flex",
          justifyContent: "center",
          opacity: 0.3,
        }}
      >
        <CarSVG scale={0.9} color={COLORS.accent} />
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 4: CTA ──────────────────────────────────────────────
const CallToAction: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const carEntrance = spring({ frame, fps, config: { damping: 200 } });
  const carY = interpolate(carEntrance, [0, 1], [60, 0]);

  const ctaScale = spring({
    frame,
    fps,
    delay: Math.round(0.8 * fps),
    config: { damping: 12 },
  });

  const ctaPulse = interpolate(
    frame,
    [2.0 * fps, 2.3 * fps, 2.6 * fps, 2.9 * fps, 3.2 * fps, 3.5 * fps],
    [1, 1.06, 1, 1.06, 1, 1.06],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const infoOpacity = interpolate(frame, [0.4 * fps, 0.8 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 50% 70%, #0a1a0a 0%, ${COLORS.dark} 70%)`,
        fontFamily,
      }}
    >
      {/* Car at top */}
      <div
        style={{
          position: "absolute",
          top: 100,
          width: "100%",
          display: "flex",
          justifyContent: "center",
          opacity: carEntrance,
          transform: `translateY(${carY}px)`,
        }}
      >
        {CAR.hasRealPhotos ? (
          <Img
            src={staticFile("car-3.jpg")}
            style={{
              width: 900,
              height: 500,
              objectFit: "cover",
              borderRadius: 16,
            }}
          />
        ) : (
          <CarSVG scale={1.1} color={COLORS.accent} />
        )}
      </div>

      {/* Price reminder */}
      <div
        style={{
          position: "absolute",
          top: "42%",
          width: "100%",
          textAlign: "center",
          opacity: infoOpacity,
        }}
      >
        <div style={{ fontSize: 36, color: COLORS.gray }}>
          {CAR.brand} {CAR.model} · {CAR.year} · {CAR.mileage}
        </div>
        <div
          style={{
            fontSize: 100,
            fontWeight: 900,
            color: COLORS.accent,
            marginTop: 8,
          }}
        >
          {CAR.price}{CAR.priceUnit}
        </div>
      </div>

      {/* LINE CTA button */}
      <div
        style={{
          position: "absolute",
          top: "62%",
          width: "100%",
          display: "flex",
          justifyContent: "center",
          transform: `scale(${ctaScale * ctaPulse})`,
        }}
      >
        <div
          style={{
            backgroundColor: COLORS.lineGreen,
            padding: "28px 100px",
            borderRadius: 60,
            boxShadow: "0 8px 32px rgba(6, 199, 85, 0.3)",
          }}
        >
          <div style={{ fontSize: 48, fontWeight: 700, color: COLORS.white }}>
            LINE 立即詢問
          </div>
        </div>
      </div>

      {/* Contact info */}
      <div
        style={{
          position: "absolute",
          bottom: 160,
          width: "100%",
          textAlign: "center",
          opacity: infoOpacity,
        }}
      >
        <div style={{ fontSize: 36, fontWeight: 700, color: COLORS.white, marginBottom: 12 }}>
          {CAR.dealer}
        </div>
        <div style={{ fontSize: 28, color: COLORS.gray }}>
          {CAR.location} · kuncar.tw
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── Main Composition ──────────────────────────────────────────
export const CarShowcase: React.FC = () => {
  const { fps } = useVideoConfig();
  const sceneDuration = 5 * fps; // 5 seconds per scene = 20s total

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.dark }}>
      <Sequence from={0} durationInFrames={sceneDuration} premountFor={Math.round(0.5 * fps)}>
        <CarHero />
      </Sequence>
      <Sequence from={sceneDuration} durationInFrames={sceneDuration} premountFor={Math.round(0.5 * fps)}>
        <SpecsWithCar />
      </Sequence>
      <Sequence from={2 * sceneDuration} durationInFrames={sceneDuration} premountFor={Math.round(0.5 * fps)}>
        <WhyChooseUs />
      </Sequence>
      <Sequence from={3 * sceneDuration} durationInFrames={sceneDuration} premountFor={Math.round(0.5 * fps)}>
        <CallToAction />
      </Sequence>
    </AbsoluteFill>
  );
};
