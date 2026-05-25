"use client";

import { Clock3, LoaderCircle, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ImageConversation, ImageTurnStatus, StoredImage, StoredReferenceImage } from "@/store/image-conversations";

export type ImageLightboxItem = {
  id: string;
  src: string;
};

type ImageResultsProps = {
  selectedConversation: ImageConversation | null;
  onOpenLightbox: (images: ImageLightboxItem[], index: number) => void;
  onContinueEdit: (conversationId: string, image: StoredImage | StoredReferenceImage) => void;
  formatConversationTime: (value: string) => string;
};

export function ImageResults({
  selectedConversation,
  onOpenLightbox,
  onContinueEdit,
  formatConversationTime,
}: ImageResultsProps) {
  if (!selectedConversation) {
    return (
      <div className="flex h-full min-h-[420px] items-center justify-center text-center">
        <div className="w-full max-w-4xl">
          <div className="mx-auto mb-8 flex size-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary/10 via-accent to-primary/5 shadow-sm">
            <Sparkles className="size-8 text-primary/60" />
          </div>
          <h1
            className="text-3xl font-semibold tracking-tight text-foreground md:text-5xl"
            style={{
              fontFamily: '"Palatino Linotype","Book Antiqua","URW Palladio L","Times New Roman",serif',
            }}
          >
            将想法变为图像
          </h1>
          <p
            className="mt-4 text-[15px] italic tracking-[0.01em] text-muted-foreground"
            style={{
              fontFamily: '"Palatino Linotype","Book Antiqua","URW Palladio L","Times New Roman",serif',
            }}
          >
            在同一窗口里保留本地历史与任务状态，并从已有结果图继续发起新的无状态编辑。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[980px] flex-col gap-8">
      {selectedConversation.turns.map((turn, turnIndex) => {
        const referenceLightboxImages = turn.referenceImages.map((image, index) => ({
          id: `${turn.id}-reference-${index}`,
          src: image.dataUrl,
        }));
        const successfulTurnImages = turn.images.flatMap((image) =>
          image.status === "success" && image.b64_json
            ? [{ id: image.id, src: `data:image/png;base64,${image.b64_json}` }]
            : [],
        );

        return (
          <div key={turn.id} className="flex flex-col gap-4">
            <div className="flex justify-end">
              <div className="max-w-[82%] px-1 py-1 text-[15px] leading-7 text-foreground">
                <div className="mb-2 flex flex-wrap justify-end gap-2 text-[11px] text-muted-foreground">
                  <span>第 {turnIndex + 1} 轮</span>
                  <span>
                    {turn.mode === "edit" ? "编辑图" : "文生图"}
                  </span>
                  <span>{getTurnStatusLabel(turn.status)}</span>
                  <span>{formatConversationTime(turn.createdAt)}</span>
                </div>
                <div className="text-right">{turn.prompt}</div>
              </div>
            </div>

            <div className="flex justify-start">
              <div className="w-full p-1">
                {turn.referenceImages.length > 0 ? (
                  <div className="mb-4 flex flex-col items-end">
                    <div className="mb-3 text-xs font-medium text-muted-foreground">本轮参考图</div>
                    <div className="flex flex-wrap justify-end gap-3">
                      {turn.referenceImages.map((image, index) => (
                        <div key={`${turn.id}-${image.name}-${index}`} className="flex flex-col items-end gap-2">
                          <button
                            type="button"
                            onClick={() => onOpenLightbox(referenceLightboxImages, index)}
                            className="group relative h-24 w-24 overflow-hidden rounded-xl border border-border/60 bg-secondary text-left shadow-sm transition hover:shadow-md hover:scale-[1.02]"
                            aria-label={`预览参考图 ${image.name || index + 1}`}
                          >
                            <img
                              src={image.dataUrl}
                              alt={image.name || `参考图 ${index + 1}`}
                              className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
                            />
                          </button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-full border-border/80 bg-card text-foreground/70 shadow-sm transition hover:bg-secondary hover:text-foreground"
                            onClick={() => onContinueEdit(selectedConversation.id, image)}
                          >
                            <Sparkles className="size-4" />
                            加入编辑
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full bg-secondary px-3 py-1">{turn.count} 张</span>
                  <span className="rounded-full bg-secondary px-3 py-1">{getTurnStatusLabel(turn.status)}</span>
                  {turn.status === "queued" ? (
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">等待当前对话中的前序任务完成</span>
                  ) : null}
                </div>

                <div className="columns-1 gap-4 space-y-4 sm:columns-2 xl:columns-3">
                  {turn.images.map((image, index) => {
                    if (image.status === "success" && image.b64_json) {
                      const currentIndex = successfulTurnImages.findIndex((item) => item.id === image.id);

                      return (
                        <div
                          key={image.id}
                          className="break-inside-avoid overflow-hidden rounded-2xl border border-border/40 bg-card shadow-sm transition-shadow hover:shadow-md"
                        >
                          <button
                            type="button"
                            onClick={() => onOpenLightbox(successfulTurnImages, currentIndex)}
                            className="group block w-full cursor-zoom-in"
                          >
                            <img
                              src={`data:image/png;base64,${image.b64_json}`}
                              alt={`生成结果 ${index + 1}`}
                              className="block h-auto w-full transition duration-300 group-hover:brightness-95"
                            />
                          </button>
                          <div className="flex items-center justify-between gap-2 border-t border-border/30 bg-secondary/50 px-3 py-3">
                            <div className="text-xs text-muted-foreground">结果 {index + 1}</div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-full border-border/80 bg-card text-foreground/70 shadow-sm transition hover:bg-secondary hover:text-foreground"
                              onClick={() => onContinueEdit(selectedConversation.id, image)}
                            >
                              <Sparkles className="size-4" />
                              加入编辑
                            </Button>
                          </div>
                        </div>
                      );
                    }

                    if (image.status === "error") {
                      return (
                        <div
                          key={image.id}
                          className="break-inside-avoid overflow-hidden rounded-2xl border border-destructive/20 bg-destructive/5"
                        >
                          <div className="flex min-h-[320px] items-center justify-center px-6 py-8 text-center text-sm leading-6 text-destructive/70">
                            {image.error || "生成失败"}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={image.id}
                        className="break-inside-avoid overflow-hidden rounded-2xl border border-border/40 bg-secondary/50"
                      >
                        <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 px-6 py-8 text-center text-muted-foreground">
                          <div className="rounded-2xl bg-card p-3 shadow-sm">
                            {turn.status === "queued" ? (
                              <Clock3 className="size-5" />
                            ) : (
                              <LoaderCircle className="size-5 animate-spin" />
                            )}
                          </div>
                          <p className="text-sm">{turn.status === "queued" ? "已加入当前对话队列..." : "正在处理图片..."}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {turn.status === "error" && turn.error ? (
                  <div className="mt-4 border-l-2 border-amber-300 bg-amber-50/70 px-4 py-3 text-sm leading-6 text-amber-700">
                    {turn.error}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getTurnStatusLabel(status: ImageTurnStatus) {
  if (status === "queued") {
    return "排队中";
  }
  if (status === "generating") {
    return "处理中";
  }
  if (status === "success") {
    return "已完成";
  }
  return "失败";
}
