import { useState, useRef, useEffect, useCallback } from "react";
import { Expand, Minimize } from "lucide-react";

interface Vehicle360ViewerProps {
  photos: string[];
  alt: string;
}

export default function Vehicle360Viewer({ photos, alt }: Vehicle360ViewerProps) {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartX = useRef(0);
  const dragStartFrame = useRef(0);
  const lastInteraction = useRef(0);
  const autoRotateTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalFrames = photos.length;
  const pixelsPerFrame = 15; // drag distance per frame change

  // Auto-rotate logic
  useEffect(() => {
    if (autoRotate && totalFrames > 1) {
      autoRotateTimer.current = setInterval(() => {
        setCurrentFrame((prev) => (prev + 1) % totalFrames);
      }, 150);
    }
    return () => {
      if (autoRotateTimer.current) clearInterval(autoRotateTimer.current);
    };
  }, [autoRotate, totalFrames]);

  // Resume auto-rotate after 3s idle
  useEffect(() => {
    if (!autoRotate && lastInteraction.current > 0) {
      const timeout = setTimeout(() => {
        setAutoRotate(true);
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [autoRotate, isDragging]);

  const stopAutoRotate = useCallback(() => {
    setAutoRotate(false);
    lastInteraction.current = Date.now();
  }, []);

  const handleDragStart = useCallback(
    (clientX: number) => {
      setIsDragging(true);
      stopAutoRotate();
      dragStartX.current = clientX;
      dragStartFrame.current = currentFrame;
      if (showHint) setShowHint(false);
    },
    [currentFrame, showHint, stopAutoRotate]
  );

  const handleDragMove = useCallback(
    (clientX: number) => {
      if (!isDragging) return;
      const dx = clientX - dragStartX.current;
      const frameDelta = Math.round(dx / pixelsPerFrame);
      const newFrame =
        ((dragStartFrame.current + frameDelta) % totalFrames + totalFrames) % totalFrames;
      setCurrentFrame(newFrame);
    },
    [isDragging, totalFrames]
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Mouse events
  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleDragStart(e.clientX);
  };
  const onMouseMove = (e: React.MouseEvent) => handleDragMove(e.clientX);
  const onMouseUp = () => handleDragEnd();
  const onMouseLeave = () => {
    if (isDragging) handleDragEnd();
  };

  // Touch events
  const onTouchStart = (e: React.TouchEvent) => {
    handleDragStart(e.touches[0].clientX);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    handleDragMove(e.touches[0].clientX);
  };
  const onTouchEnd = () => handleDragEnd();

  return (
    <div
      ref={containerRef}
      className={`relative select-none overflow-hidden ${
        isFullscreen
          ? "fixed inset-0 z-50 bg-black flex items-center justify-center"
          : "aspect-[16/10] bg-black/30"
      }`}
      style={{ cursor: isDragging ? "grabbing" : "grab" }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <img
        src={photos[currentFrame]}
        alt={`${alt} - 360 view ${currentFrame + 1}/${totalFrames}`}
        className={`${
          isFullscreen ? "max-w-full max-h-full object-contain" : "w-full h-full object-cover"
        } pointer-events-none transition-none`}
        draggable={false}
      />

      {/* Drag hint overlay */}
      {showHint && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none animate-pulse">
          <div className="bg-black/60 backdrop-blur px-4 py-2 rounded-full text-white text-sm flex items-center gap-2">
            <span className="text-lg">&#x2194;</span> 拖動旋轉
          </div>
        </div>
      )}

      {/* Frame indicator */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur text-white text-xs">
        {currentFrame + 1} / {totalFrames}
      </div>

      {/* Fullscreen toggle */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsFullscreen((f) => !f);
        }}
        className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white hover:bg-black/60 transition-colors z-10"
        aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
      >
        {isFullscreen ? <Minimize className="w-4 h-4" /> : <Expand className="w-4 h-4" />}
      </button>

      {/* Close button in fullscreen */}
      {isFullscreen && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsFullscreen(false);
          }}
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-white hover:bg-black/80 transition-colors z-10 text-xl"
          aria-label="Close fullscreen"
        >
          &times;
        </button>
      )}
    </div>
  );
}
