"use client";
import { ArrowUp, ImagePlus, LoaderCircle, X } from "lucide-react";
import { useMemo, useState, type ClipboardEvent, type RefObject } from "react";

import { ImageLightbox } from "@/components/image-lightbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ImageConversationMode } from "@/store/image-conversations";
import { cn } from "@/lib/utils";

type ImageComposerProps = {
  mode: ImageConversationMode;
  prompt: string;
  imageCount: string;
  availableQuota: string;
  activeTaskCount: number;
  referenceImages: Array<{ name: string; dataUrl: string }>;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onModeChange: (value: ImageConversationMode) => void;
  onPromptChange: (value: string) => void;
  onImageCountChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
  onPickReferenceImage: () => void;
  onReferenceImageChange: (files: File[]) => void | Promise<void>;
  onRemoveReferenceImage: (index: number) => void;
};

export function ImageComposer({
  mode,
  prompt,
  imageCount,
  availableQuota,
  activeTaskCount,
  referenceImages,
  textareaRef,
  fileInputRef,
  onModeChange,
  onPromptChange,
  onImageCountChange,
  onSubmit,
  onPickReferenceImage,
  onReferenceImageChange,
  onRemoveReferenceImage,
}: ImageComposerProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const lightboxImages = useMemo(
    () => referenceImages.map((image, index) => ({ id: `${image.name}-${index}`, src: image.dataUrl })),
    [referenceImages],
  );

  const handleTextareaPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const imageFiles = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      return;
    }

    event.preventDefault();
    void onReferenceImageChange(imageFiles);
  };

  return (
    <div className="shrink-0 flex justify-center">
      <div style={{ width: "min(980px, 100%)" }}>
        {mode === "edit" && (
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => {
              void onReferenceImageChange(Array.from(event.target.files || []));
            }}
          />
        )}

        {mode === "edit" && referenceImages.length > 0 ? (
          <div className="mb-3 flex flex-wrap gap-2 px-1">
            {referenceImages.map((image, index) => (
              <div key={`${image.name}-${index}`} className="relative size-16">
                <button
                  type="button"
                  onClick={() => {
                    setLightboxIndex(index);
                    setLightboxOpen(true);
                  }}
                  className="group size-16 overflow-hidden rounded-xl border border-white/80 bg-white shadow-sm transition hover:shadow-md hover:scale-[1.05]"
                  aria-label={`预览参考图 ${image.name || index + 1}`}
                >
                  <img
                    src={image.dataUrl}
                    alt={image.name || `参考图 ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemoveReferenceImage(index);
                  }}
                  className="absolute -right-1 -top-1 inline-flex size-5 items-center justify-center rounded-full border border-white/80 bg-white/90 text-muted-foreground shadow-sm backdrop-blur-sm transition hover:border-rose-200 hover:text-rose-500"
                  aria-label={`移除参考图 ${image.name || index + 1}`}
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-[28px] border border-border/60 bg-card shadow-sm transition-shadow focus-within:shadow-md focus-within:border-primary/30">
          <div
            className="relative cursor-text"
            onClick={() => {
              textareaRef.current?.focus();
            }}
          >
            <ImageLightbox
              images={lightboxImages}
              currentIndex={lightboxIndex}
              open={lightboxOpen}
              onOpenChange={setLightboxOpen}
              onIndexChange={setLightboxIndex}
            />
            <Textarea
              ref={textareaRef}
              value={prompt}
              onChange={(event) => onPromptChange(event.target.value)}
              onPaste={handleTextareaPaste}
              placeholder={
                mode === "edit" ? "描述你希望如何修改这张参考图，可直接粘贴图片" : "输入你想要生成的画面，也可直接粘贴图片"
              }
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void onSubmit();
                }
              }}
              className="min-h-[148px] resize-none rounded-[28px] border-0 bg-transparent px-6 pt-6 pb-20 text-[15px] leading-7 text-foreground shadow-none placeholder:text-muted-foreground/60 focus-visible:ring-0"
            />

            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-card via-card/95 to-transparent px-3 pb-3 pt-6 sm:px-6 sm:pb-4">
              <div className="flex items-end justify-between gap-2">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                  {mode === "edit" && (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 rounded-full border-border/80 bg-card px-3 text-xs font-medium text-foreground/70 shadow-none transition hover:bg-secondary hover:text-foreground sm:h-10 sm:px-4 sm:text-sm"
                      onClick={onPickReferenceImage}
                    >
                      <ImagePlus className="size-3.5 sm:size-4" />
                      <span className="hidden sm:inline">{referenceImages.length > 0 ? "继续添加" : "上传图片"}</span>
                    </Button>
                  )}
                  <div className="rounded-full bg-secondary px-3 py-1.5 text-[11px] font-medium text-muted-foreground sm:py-2 sm:text-xs">
                    <span className="hidden sm:inline">剩余额度 </span>{availableQuota}
                  </div>
                  {activeTaskCount > 0 && (
                    <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-[11px] font-medium text-amber-700 sm:py-2 sm:text-xs">
                      <LoaderCircle className="size-3 animate-spin" />
                      {activeTaskCount}<span className="hidden sm:inline"> 个任务中</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 rounded-full border border-border/80 bg-card px-2.5 py-1 sm:gap-2 sm:px-3">
                    <span className="text-[11px] font-medium text-foreground/70 sm:text-sm">张数</span>
                    <Input
                      type="number"
                      min="1"
                      max="10"
                      step="1"
                      value={imageCount}
                      onChange={(event) => onImageCountChange(event.target.value)}
                      className="h-7 w-[48px] border-0 bg-transparent px-0 text-center text-[13px] font-medium text-foreground shadow-none focus-visible:ring-0 sm:h-8 sm:w-[64px] sm:text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <ModeButton active={mode === "generate"} onClick={() => onModeChange("generate")}>
                      文生图
                    </ModeButton>
                    <ModeButton active={mode === "edit"} onClick={() => onModeChange("edit")}>
                      图生图
                    </ModeButton>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void onSubmit()}
                  disabled={!prompt.trim() || (mode === "edit" && referenceImages.length === 0)}
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground/40 disabled:shadow-none sm:size-11"
                  aria-label={mode === "edit" ? "编辑图片" : "生成图片"}
                >
                  <ArrowUp className="size-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModeButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-4 py-2 text-sm font-medium transition-all",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
