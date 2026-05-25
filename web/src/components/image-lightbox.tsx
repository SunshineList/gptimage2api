"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";

import { cn } from "@/lib/utils";

type LightboxImage = {
  id: string;
  src: string;
};

type ImageLightboxProps = {
  images: LightboxImage[];
  currentIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onIndexChange: (index: number) => void;
};

export function ImageLightbox({
  images,
  currentIndex,
  open,
  onOpenChange,
  onIndexChange,
}: ImageLightboxProps) {
  const current = images[currentIndex];
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < images.length - 1;

  // Zoom & pan state
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement>(null);

  // Touch tracking refs
  const touchState = useRef<{
    initialDistance: number;
    initialScale: number;
    initialTranslate: { x: number; y: number };
    pinchCenter: { x: number; y: number };
    panStart: { x: number; y: number };
    panTranslate: { x: number; y: number };
    mode: "none" | "pan" | "pinch";
    lastTapTime: number;
    lastTapPos: { x: number; y: number };
  }>({
    initialDistance: 0,
    initialScale: 1,
    initialTranslate: { x: 0, y: 0 },
    pinchCenter: { x: 0, y: 0 },
    panStart: { x: 0, y: 0 },
    panTranslate: { x: 0, y: 0 },
    mode: "none",
    lastTapTime: 0,
    lastTapPos: { x: 0, y: 0 },
  });

  // Reset zoom when image changes
  useEffect(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, [current?.id]);

  const clampTranslate = useCallback((s: number, tx: number, ty: number) => {
    if (s <= 1) return { x: 0, y: 0 };
    const max = (s - 1) * 100;
    return {
      x: Math.max(-max, Math.min(max, tx)),
      y: Math.max(-max, Math.min(max, ty)),
    };
  }, []);

  const getTouchDistance = (touches: React.TouchList | TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getTouchCenter = (touches: React.TouchList | TouchList) => ({
    x: (touches[0].clientX + touches[1].clientX) / 2,
    y: (touches[0].clientY + touches[1].clientY) / 2,
  });

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touches = e.touches;

      if (touches.length === 2) {
        // Pinch start
        const dist = getTouchDistance(touches);
        const center = getTouchCenter(touches);
        touchState.current = {
          ...touchState.current,
          initialDistance: dist,
          initialScale: scale,
          initialTranslate: translate,
          pinchCenter: center,
          mode: "pinch",
        };
      } else if (touches.length === 1 && scale > 1) {
        // Pan start
        touchState.current = {
          ...touchState.current,
          panStart: { x: touches[0].clientX, y: touches[0].clientY },
          panTranslate: translate,
          mode: "pan",
        };
      } else if (touches.length === 1 && scale <= 1) {
        // Detect double tap
        const now = Date.now();
        const pos = { x: touches[0].clientX, y: touches[0].clientY };
        const { lastTapTime, lastTapPos } = touchState.current;
        const dist = Math.hypot(pos.x - lastTapPos.x, pos.y - lastTapPos.y);
        if (now - lastTapTime < 300 && dist < 30) {
          // Double tap detected
          if (scale > 1) {
            setScale(1);
            setTranslate({ x: 0, y: 0 });
          } else {
            setScale(2.5);
            setTranslate({ x: 0, y: 0 });
          }
        }
        touchState.current.lastTapTime = now;
        touchState.current.lastTapPos = pos;
      }
    },
    [scale, translate],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const touches = e.touches;
      const state = touchState.current;

      if (touches.length === 2 && state.mode === "pinch") {
        e.preventDefault();
        const dist = getTouchDistance(touches);
        const center = getTouchCenter(touches);
        const newScale = Math.max(1, Math.min(5, state.initialScale * (dist / state.initialDistance)));

        // Calculate translate to keep pinch center stable
        const scaleRatio = newScale / state.initialScale;
        const newTx = state.initialTranslate.x * scaleRatio + (center.x - state.pinchCenter.x) * (1 - scaleRatio);
        const newTy = state.initialTranslate.y * scaleRatio + (center.y - state.pinchCenter.y) * (1 - scaleRatio);
        const clamped = clampTranslate(newScale, newTx, newTy);

        setScale(newScale);
        setTranslate(clamped);
      } else if (touches.length === 1 && state.mode === "pan") {
        const dx = touches[0].clientX - state.panStart.x;
        const dy = touches[0].clientY - state.panStart.y;
        const clamped = clampTranslate(
          scale,
          state.panTranslate.x + dx,
          state.panTranslate.y + dy,
        );
        setTranslate(clamped);
      }
    },
    [scale, clampTranslate],
  );

  const handleTouchEnd = useCallback(() => {
    const state = touchState.current;
    if (state.mode === "pan" || state.mode === "pinch") {
      if (scale <= 1) {
        setScale(1);
        setTranslate({ x: 0, y: 0 });
      }
    }
    state.mode = "none";
  }, [scale]);

  const goPrev = useCallback(() => {
    if (hasPrev) onIndexChange(currentIndex - 1);
  }, [hasPrev, currentIndex, onIndexChange]);

  const goNext = useCallback(() => {
    if (hasNext) onIndexChange(currentIndex + 1);
  }, [hasNext, currentIndex, onIndexChange]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, goPrev, goNext]);

  const handleDownload = useCallback(() => {
    if (!current) return;
    const link = document.createElement("a");
    link.href = current.src;
    link.download = `image-${current.id}.png`;
    link.click();
  }, [current]);

  if (!current) return null;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden outline-none"
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <DialogPrimitive.Title className="sr-only">
            图片预览
          </DialogPrimitive.Title>

          {/* toolbar */}
          <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
            {images.length > 1 && (
              <span className="rounded-full bg-black/50 px-3 py-1.5 text-xs font-medium text-white/90">
                {currentIndex + 1} / {images.length}
              </span>
            )}
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex size-9 items-center justify-center rounded-full bg-black/50 text-white/90 transition hover:bg-black/70"
              aria-label="下载图片"
            >
              <Download className="size-4" />
            </button>
            <DialogPrimitive.Close className="inline-flex size-9 items-center justify-center rounded-full bg-black/50 text-white/90 transition hover:bg-black/70">
              <X className="size-4" />
              <span className="sr-only">关闭</span>
            </DialogPrimitive.Close>
          </div>

          {/* prev */}
          {hasPrev && (
            <button
              type="button"
              onClick={goPrev}
              className="absolute left-4 z-10 inline-flex size-10 items-center justify-center rounded-full bg-black/40 text-white/90 transition hover:bg-black/60"
              aria-label="上一张"
            >
              <ChevronLeft className="size-5" />
            </button>
          )}

          {/* image with zoom/pan */}
          <div
            className={cn(
              "flex max-h-[90vh] max-w-[90vw] items-center justify-center",
              scale > 1 ? "cursor-grab" : "cursor-zoom-in",
            )}
            onClick={() => {
              if (scale <= 1) {
                onOpenChange(false);
              }
            }}
            onDoubleClick={() => {
              if (scale > 1) {
                setScale(1);
                setTranslate({ x: 0, y: 0 });
              } else {
                setScale(2.5);
                setTranslate({ x: 0, y: 0 });
              }
            }}
          >
            <img
              ref={imageRef}
              src={current.src}
              alt=""
              className="select-none rounded-lg object-contain transition-transform duration-200"
              style={{
                transform: `scale(${scale}) translate(${translate.x / scale}px, ${translate.y / scale}px)`,
                maxHeight: "90vh",
                maxWidth: "90vw",
                touchAction: scale > 1 ? "none" : "manipulation",
              }}
              onClick={(e) => {
                if (scale > 1) e.stopPropagation();
              }}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              draggable={false}
            />
          </div>

          {/* zoom indicator */}
          {scale > 1 && (
            <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/50 px-4 py-1.5 text-xs font-medium text-white/90">
              {Math.round(scale * 100)}%
              <button
                type="button"
                className="ml-2 text-white/60 hover:text-white/90 transition"
                onClick={() => { setScale(1); setTranslate({ x: 0, y: 0 }); }}
              >
                重置
              </button>
            </div>
          )}

          {/* next */}
          {hasNext && (
            <button
              type="button"
              onClick={goNext}
              className="absolute right-4 z-10 inline-flex size-10 items-center justify-center rounded-full bg-black/40 text-white/90 transition hover:bg-black/60"
              aria-label="下一张"
            >
              <ChevronRight className="size-5" />
            </button>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
